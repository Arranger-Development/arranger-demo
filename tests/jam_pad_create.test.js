import test from 'node:test';
import assert from 'node:assert/strict';
import { JAM_TEMPLATE_PADS } from '../src/input/jamPadLayout.js';
import { createPerformanceMidiInput, mapPerformanceKeyboard, PERFORMANCE_KEYS } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame } from '../src/input/launchpadXPerformanceSurface.js';
import { createJamTemplateProjects } from '../src/app/jamTemplateProjects.js';
import { blankJamDraft } from '../src/app/jamDraftActions.js';
import { jamTemplatePage } from '../src/app/jamTemplateSlots.js';

test('all 32 phrase pads open their exact empty slot across the first four banks without repeat or release actions',()=>{
  const input=createPerformanceMidiInput(),templates={drums:[],chord:[],bass:[],melody:[]};
  for(const page of [0,1,2,3])for(const {note,trackId,index} of JAM_TEMPLATE_PADS) {
    const s={version:5,page};
    assert.deepEqual(input.handle([0x90,note,127],templates,s),{type:'editPhrase',trackId,slotIndex:page*8+index});
    assert.equal(input.handle([0x90,note,50],templates,{...s,page:page+1}),null,'holding across a bank change must not create another block');
    assert.equal(input.handle([0x80,note,0],templates,s),null);
  }
  assert.deepEqual(templates,{drums:[],chord:[],bass:[],melody:[]},'decoding itself does not create or mutate phrases');
});

test('retained empty blocks reopen editing; adding notes switches the same pad to playback and lights it',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const store=createJamTemplateProjects(storage,'pop',null,100);store.enableLiveEditing();
  for(const [trackId,note,key] of [['drums',71,'Digit1'],['chord',61,'KeyQ'],['bass',51,'KeyA'],['melody',41,'KeyZ']]) {
    const phrase=store.commitPhraseEdit(blankJamDraft(trackId,undefined,8),{create:true});
    let templates={[trackId]:jamTemplatePage(store.current().workspace.templates[trackId],1)},s={version:5,page:1,templates,status:{mode:'stopped'}};
    const input=createPerformanceMidiInput();
    assert.deepEqual(input.handle([0x90,note,127],templates,s),{type:'editPhrase',trackId,slotIndex:8});
    assert.equal(mapPerformanceKeyboard({type:'keydown',code:key},templates),null);
    assert.equal(createLaunchpadXPerformanceLedFrame(s).find(m=>m[0]===144&&m[1]===note)[2],{drums:19,chord:11,bass:43,melody:51}[trackId]);
    const cell=trackId==='drums'?{instruments:['kick']}:{type:trackId==='chord'?'notes':trackId,notes:['C4']};
    const edited=store.commitPhraseEdit({...phrase,bars:[[cell,...Array(15).fill(null)]]});
    assert.equal(edited.id,phrase.id);
    templates={[trackId]:jamTemplatePage(store.current().workspace.templates[trackId],1)};s={...s,templates};
    input.handle([0x80,note,0],templates,s);
    assert.deepEqual(input.handle([0x90,note,127],templates,s),{type:'template',trackId,templateId:phrase.id});
    assert.notEqual(createLaunchpadXPerformanceLedFrame(s).find(m=>m[0]===144&&m[1]===note)[2],0);
    assert.equal(store.current().workspace.templates[trackId].length,1);
  }
});

test('empty-slot creation is exclusive to current Jam phrase pads and rejects invalid bank positions',()=>{
  const input=createPerformanceMidiInput(),templates={};
  for(const page of [-1,0.5,'1',Number.MAX_SAFE_INTEGER]) {
    assert.equal(input.handle([0x90,71,127],templates,{version:5,page}),null);
    input.handle([0x80,71,0],templates,{version:5,page});
  }
  for(const version of [undefined,4]) {
    assert.equal(input.handle([0x90,71,127],templates,{version}),null);
    input.handle([0x80,71,0],templates,{version});
  }
  for(const note of [...Array.from({length:8},(_,i)=>81+i),21,28,31,38]) {
    assert.equal(input.handle([0x90,note,127],templates,{version:5}),null);
    input.handle([0x80,note,0],templates,{version:5});
  }
  for(const keys of Object.values(PERFORMANCE_KEYS))for(const code of keys)assert.equal(mapPerformanceKeyboard({type:'keydown',code},templates),null);
});

test('pad editing follows persisted slots after moves and deletion without relocating the remaining content',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const store=createJamTemplateProjects(storage,'pop',null,100);store.enableLiveEditing();
  const empty=store.commitPhraseEdit(blankJamDraft('bass',undefined,8),{create:true});
  const full=store.commitPhraseEdit({...blankJamDraft('bass',undefined,16),bars:[[{type:'bass',note:'D2'},...Array(15).fill(null)]]},{create:true});
  store.moveSlots({trackId:'bass',from:8,to:31});
  const restored=createJamTemplateProjects(storage,'pop',null,100),input=createPerformanceMidiInput();
  const command=(note,page)=>{const t={bass:jamTemplatePage(restored.current().workspace.templates.bass,page)};
    const result=input.handle([0x90,note,127],t,{version:5,page});input.handle([0x80,note,0],t,{version:5,page});return result;};
  assert.deepEqual(command(51,1),{type:'editPhrase',trackId:'bass',slotIndex:8});
  assert.deepEqual(command(58,3),{type:'editPhrase',trackId:'bass',slotIndex:31});
  assert.equal(restored.current().workspace.templates.bass.find(p=>p.id===empty.id).slotIndex,31);
  assert.deepEqual(command(58,1),{type:'template',trackId:'bass',templateId:full.id});
  restored.removeTemplate('bass',empty.id);
  assert.deepEqual(command(58,3),{type:'editPhrase',trackId:'bass',slotIndex:31});
  assert.equal(restored.current().workspace.templates.bass.find(p=>p.id===full.id).slotIndex,15);
});
