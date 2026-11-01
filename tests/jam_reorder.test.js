import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamTemplateProjects, sortUserTemplatesForCreation } from '../src/app/jamTemplateProjects.js';
import { jamSlotAfterMove, jamTemplateRange, relocateJamDraft, relocateJamHistory, jamTemplatePage, jamLauncherColumnCount } from '../src/app/jamTemplateSlots.js';
import { createJamReorderController } from '../src/app/jamReorderController.js';
import { createPerformanceMidiInput, mapPerformanceKeyboard } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame } from '../src/input/launchpadXPerformanceSurface.js';
import { JAM_TEMPLATE_PADS } from '../src/input/jamPadLayout.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { toggleJamTemplate, launchJamColumn } from '../src/app/jamTemplateSelection.js';

const TRACKS=['drums','chord','bass','melody'];
function fixture() {
  const data=new Map();let fail=false,writes=0;
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{writes++;if(fail)throw new Error('full');data.set(k,v);}};
  const store=createJamTemplateProjects(storage,'pop',null,100);
  const templates={};
  for(const t of TRACKS) templates[t]=[0,1,2,4,8,16,31,35].map(slot=>store.saveTemplate({trackId:t,targetSlot:slot,
    bars:[Array.from({length:16},(_,i)=>i===0?t==='drums'?{instruments:['kick']}:t==='bass'?{type:'bass',note:'C2'}:{type:'notes',notes:['C4']}:null)]},`${t}-${slot}`));
  return {store,templates,storage,get writes(){return writes;},fail(){fail=true;},move(move,expected){return store.moveSlots(move,expected);}};
}
const names=(w,t,n=10)=>jamTemplateRange(w.templates[t],0,n).map(p=>p?.name??null);

test('slot insertion is a reversible permutation including all holes, in either direction',()=>{
  for(const [from,to] of [[1,4],[4,1],[0,39],[39,0],[8,16],[31,2]]) {
    const slots=Array.from({length:40},(_,i)=>jamSlotAfterMove(i,from,to));
    assert.equal(new Set(slots).size,40);assert.equal(slots[from],to);
    for(let i=0;i<40;i++)assert.equal(jamSlotAfterMove(slots[i],to,from),i);
  }
});
test('a single insertion shifts intervening slots and holes, preserving IDs, source data, library order and mix',()=>{
  const f=fixture(),before=structuredClone(f.store.current().workspace);
  const creation=sortUserTemplatesForCreation(before.templates.drums).map(p=>p.id),writes=f.writes;
  assert.equal(f.move({trackId:'drums',from:1,to:4}),true);
  const w=f.store.current().workspace;
  assert.deepEqual(names(w,'drums',6),['drums-0','drums-2',null,'drums-4','drums-1',null]);
  assert.deepEqual(w.templates.bass,before.templates.bass);
  assert.deepEqual(w.templates.drums.map(p=>({...p,slotIndex:0})),before.templates.drums.map(p=>({...p,slotIndex:0})));
  assert.deepEqual(sortUserTemplatesForCreation(w.templates.drums).map(p=>p.id),creation);
  for(const key of ['selection','volumes','mutedTracks','timbres'])assert.deepEqual(w[key],before[key]);
  assert.equal(f.writes-writes,1);
});
test('moving to an empty slot shifts the hole to the old position without compacting unrelated gaps',()=>{
  const f=fixture();f.move({trackId:'bass',from:1,to:3});
  assert.deepEqual(names(f.store.current().workspace,'bass',10),['bass-0','bass-2',null,'bass-1','bass-4',null,null,null,'bass-8',null]);
});
test('column insertion is one atomic four-track permutation including empty cells',()=>{
  const f=fixture(),w=f.store.current().workspace;
  f.store.patch({templates:{...w.templates,chord:w.templates.chord.filter(p=>p.slotIndex!==1),melody:w.templates.melody.filter(p=>p.slotIndex!==2)}});
  const before=structuredClone(f.store.current().workspace),writes=f.writes;let notices=0;
  f.store.subscribe(()=>notices++);f.move({trackId:null,from:1,to:4});
  assert.equal(f.writes-writes,1);assert.equal(notices,1);
  for(const t of TRACKS) for(const p of before.templates[t])assert.equal(f.store.current().workspace.templates[t].find(q=>q.id===p.id).slotIndex,jamSlotAfterMove(p.slotIndex,1,4));
  assert.equal(jamTemplateRange(f.store.current().workspace.templates.chord,0,5)[4],null);
});
test('single and column moves persist at 9, 17, 32 and trailing slots without a schema migration',()=>{
  const f=fixture();for(const to of [8,16,31,43])assert.equal(f.move({trackId:'drums',from:f.store.current().workspace.templates.drums[0].slotIndex,to}),true);
  const reopened=createJamTemplateProjects(f.storage,'pop',null,100).current().workspace;
  assert.equal(reopened.templates.drums[0].slotIndex,43);assert.equal(reopened.slotLayoutVersion,1);
  assert.ok(jamLauncherColumnCount(reopened.templates)>=52);
});
test('drafts and note undo/redo snapshots follow their original saved phrase or empty slot',()=>{
  const f=fixture(),original=f.templates.drums[1];
  const saved={...original,editingTemplateId:original.id,dirty:true},blank={trackId:'bass',targetSlot:3,bars:[Array(16).fill(null)],dirty:true};
  f.store.setDraft(saved);f.store.setDraft(blank);
  const history={undo:[saved,blank],redo:[{...blank,targetSlot:7}]};
  const move={trackId:null,from:1,to:4};f.move(move);
  const w=f.store.current().workspace,h=relocateJamHistory(history,move,w.templates);
  assert.equal(w.draftsByTrack.drums.slotIndex,4);assert.equal(w.draft.targetSlot,2);
  assert.equal(h.undo[0].slotIndex,4);assert.equal(h.undo[1].targetSlot,2);assert.equal(h.redo[0].targetSlot,7);
  assert.deepEqual(h.undo[0].bars,saved.bars);assert.equal(h.undo[0].dirty,true);
  assert.equal(f.store.saveTemplate({...w.draft,bars:saved.bars},'new blank').slotIndex,2);
  assert.equal(f.store.saveTemplate(w.draftsByTrack.drums,'changed',original.id).slotIndex,4);
  assert.equal(relocateJamDraft(blank,{trackId:'drums',from:1,to:4},w.templates),blank);
});
test('invalid origins, cross-track IDs, stale templates and switched projects do not overwrite positions',()=>{
  const f=fixture(),p=f.store.current(),expected={projectId:p.id,templates:p.workspace.templates};
  for(const move of [{trackId:'drums',from:3,to:4},{trackId:null,from:3,to:4},{trackId:'bad',from:0,to:4},
    {from:0,to:-1},{from:0,to:48},{from:0,to:0},{from:.5,to:4}])assert.equal(f.move(move),false);
  assert.equal(f.move({from:0,to:4},expected),true);
  assert.equal(f.move({from:0,to:2},expected),false);
  f.store.create();assert.equal(f.move({from:0,to:2},expected),false);
});
test('storage failure rolls back the entire move and leaves drafts and history destinations untouched',()=>{
  const f=fixture();f.store.setDraft({...f.templates.drums[1],editingTemplateId:f.templates.drums[1].id,dirty:true});
  const before=structuredClone(f.store.current().workspace);f.fail();
  assert.equal(f.move({trackId:null,from:1,to:4}),false);
  assert.deepEqual(f.store.current().workspace,before);assert.ok(f.store.getSnapshot().error);
});

function pointerFixture(trackId='drums') {
  const g={left:120,right:780,origin:136,scrollLeft:0,top:100,bottom:170,pitch:64,gap:16,columns:48};
  const previews=[],commits=[];
  const c=createJamReorderController({read:t=>t===trackId||t===null?{...g}:null,scroll:left=>{g.scrollLeft=Math.max(0,Math.min(2600,left));},
    preview:value=>previews.push(value),commit:(move,source)=>{commits.push({move,source});return true;}});
  const pointer=(x,y=125,extra={})=>({pointerId:1,clientX:x,clientY:y,button:0,buttons:1,pointerType:'mouse',...extra});
  const begin=(extra={})=>c.begin(pointer(220,125,extra),{trackId,from:1});
  return {c,g,previews,commits,pointer,begin};
}
test('pointer sorting starts strictly after 8px and horizontal intent, commits once and suppresses its click',()=>{
  const f=pointerFixture();f.begin();assert.equal(f.c.move(f.pointer(228)),false);
  assert.equal(f.c.move(f.pointer(228,133)),false,'eight pixels are still a click');
  assert.equal(f.c.move(f.pointer(229,133)),true);assert.equal(f.commits.length,0);
  f.c.move(f.pointer(410));assert.equal(f.previews.at(-1).to,4);
  assert.equal(f.c.end(f.pointer(410)),true);assert.equal(f.c.end(f.pointer(410)),false);
  assert.deepEqual(f.commits[0].move,{trackId:'drums',from:1,to:4});assert.equal(f.g.scrollLeft,0,'ordinary dragging never pans the viewport');
  assert.equal(f.c.suppress(0),false);assert.equal(f.c.suppress(1),true);assert.equal(f.c.suppress(1),false);
});
test('plain clicks, tools, blank origins, vertical gestures and secondary pointers never reorder',()=>{
  const f=pointerFixture();f.begin();f.c.end(f.pointer(220));assert.equal(f.c.suppress(1),false);
  assert.equal(f.c.begin(f.pointer(220),null),false);assert.equal(f.c.move(f.pointer(410)),false);
  assert.equal(f.begin({button:2}),false);assert.equal(f.begin({isPrimary:false}),false);
  f.begin();assert.equal(f.c.move(f.pointer(224,145)),false);assert.equal(f.c.suppress(1),true);
  assert.equal(f.commits.length,0);
});
test('touch sorts horizontally while vertical scrolling and all cancellation paths preserve saved positions',()=>{
  for(const cancel of [f=>f.c.cancel(),f=>f.c.end(f.pointer(410),true),f=>f.c.move(f.pointer(410,220)),f=>f.c.move(f.pointer(115))]) {
    const f=pointerFixture();f.begin({pointerType:'touch'});assert.equal(f.c.move(f.pointer(410,125,{pointerType:'touch'})),true);
    cancel(f);f.c.end(f.pointer(115,220,{pointerType:'touch'}));assert.equal(f.commits.length,0);
  }
  const f=pointerFixture();f.begin({pointerType:'touch'});f.c.move(f.pointer(410,125,{pointerType:'touch'}));f.c.end(f.pointer(410,125,{pointerType:'touch'}));assert.equal(f.commits.length,1);
});
test('edge scrolling can reach column 32 and is clamped, while cross-row and effect-panel drops are invalid',()=>{
  const f=pointerFixture();f.begin();f.c.move(f.pointer(776));for(let i=0;i<145;i++)f.c.tick(16);
  assert.ok(f.previews.at(-1).to>=31);assert.ok(f.g.scrollLeft>0);
  f.c.move(f.pointer(776,200));const before=f.g.scrollLeft;f.c.tick(50);assert.equal(f.g.scrollLeft,before);
  f.c.end(f.pointer(900));assert.equal(f.commits.length,0);
});
test('column pointer uses the same insertion request and moving back to the origin is a no-op',()=>{
  const f=pointerFixture(null);f.begin();f.c.move(f.pointer(410));f.c.end(f.pointer(410));assert.equal(f.commits[0].move.trackId,null);
  const g=pointerFixture();g.begin();g.c.move(g.pointer(410));g.c.end(g.pointer(220));assert.equal(g.commits.length,0);assert.equal(g.c.suppress(1),true);
});

test('playing and queued IDs, track phases and audio requests survive reordering; remapped keys and LEDs follow slots',async()=>{
  const f=fixture();let options,plays=0;const states=[];
  const playback=createSessionPlayback({async play(o){options=o;plays++;return true;},stop(){},stopAllVoices(){},setTempo(){},getAbsolutePlaybackStep:()=>5},n=>states.push(n));
  const audition={getTrack:()=>null,release(){}};
  const toggle=p=>toggleJamTemplate({projectStore:f.store,playback,audition,trackId:p.trackId,templateId:p.id});
  toggle(f.templates.drums[0]);await new Promise(r=>setImmediate(r));options.playbackSource(0,0).onAudible();options.playbackSource(5,.75).onAudible();
  toggle(f.templates.bass[0]);const progress=playback.getProgress(),state=structuredClone(states.at(-1));
  f.move({trackId:null,from:0,to:31});assert.deepEqual(playback.getProgress(),progress);assert.deepEqual(states.at(-1),state);assert.equal(plays,1);
  options.playbackSource(16,2.4).onAudible();assert.equal(states.at(-1).playingPhraseIds.drums,f.templates.drums[0].id);assert.equal(states.at(-1).playingPhraseIds.bass,f.templates.bass[0].id);
  const w=f.store.current().workspace,templates=Object.fromEntries(TRACKS.map(t=>[t,jamTemplatePage(w.templates[t],3)]));
  const expected={type:'template',trackId:'drums',templateId:f.templates.drums[0].id};
  assert.deepEqual(mapPerformanceKeyboard({type:'keydown',code:'Digit8'},templates),expected);
  const pad=JAM_TEMPLATE_PADS.find(p=>p.trackId==='drums'&&p.index===7);
  assert.deepEqual(createPerformanceMidiInput().handle([0x90,pad.note,127],templates,{version:5}),expected);
  const frame=createLaunchpadXPerformanceLedFrame({version:5,templates,page:3,pageCount:6,selectedTracks:[],status:states.at(-1)});
  assert.equal(frame.find(([s,n])=>s===0x90&&n===pad.note)[2],17);
  assert.equal(launchJamColumn({projectStore:f.store,playback,audition,slotIndex:31}),true);
  assert.equal(f.store.current().workspace.selection.chord,f.templates.chord[0].id);
});
