import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamTemplateProjects, jamTemplateProjectsKey, sortUserTemplatesForCreation, jamCombinationSnapshot } from '../src/app/jamTemplateProjects.js';
import { createJamPhraseHistory } from '../src/app/jamPhraseHistory.js';
import { blankJamDraft } from '../src/app/jamDraftActions.js';
import { mapPerformanceKeyboard, createPerformanceMidiInput } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame } from '../src/input/launchpadXPerformanceSurface.js';
import { launchJamColumn } from '../src/app/jamTemplateSelection.js';

function memory() {
  const data=new Map();let writes=0,failed=false;
  return {data,get writes(){return writes;},set failed(value){failed=value;},getItem:k=>data.get(k)??null,setItem(k,v){if(failed)throw new Error('quota');writes++;data.set(k,v);}};
}
const makeStore=storage=>createJamTemplateProjects(storage,'pop',null,100);
const blank=(slot=0,track='bass')=>blankJamDraft(track,'deep-autumn-bass',slot);
const withNote=(p,note='C2')=>({...p,bars:[[{type:'bass',note,noteDurationSteps:{[note]:4},notePerformances:[{note,offset:.2,duration:3.5,velocity:.7}]},...Array(15).fill(null)]]});
function harness() {
  const storage=memory(),store=makeStore(storage);
  const read=(pid,id)=>store.getSnapshot().projects.find(p=>p.id===pid)?.workspace.templates.bass.find(p=>p.id===id);
  const history=createJamPhraseHistory(read);
  const edit=(draft,record=true)=>{const before=read(store.current().id,draft.id);const p=store.commitPhraseEdit(draft);if(record)history.record(store.current().id,before,p);return p;};
  return {storage,store,history,read,edit};
}

test('each clicked empty slot creates a stable independent phrase; note edits atomically update the same ID and survive reload',()=>{
  const s=memory(),store=makeStore(s);
  const a=store.commitPhraseEdit(blank(0),{create:true}),b=store.commitPhraseEdit(blank(8),{create:true}),c=store.commitPhraseEdit(blank(16),{create:true});
  assert.equal(new Set([a.id,b.id,c.id]).size,3);assert.equal(s.writes,3);
  const before=s.writes,edited=store.commitPhraseEdit(withNote({...a,editingTemplateId:a.id},'F#2'));
  assert.equal(s.writes,before+1,'one edit is one storage transaction');
  assert.equal(edited.id,a.id);assert.equal(edited.savedAt,a.savedAt);assert.equal(edited.slotIndex,0);
  assert.equal(store.current().workspace.draft.editingTemplateId,a.id);
  assert.deepEqual(store.current().workspace.draft.bars,edited.bars);
  const restored=makeStore(s);restored.enableLiveEditing();
  assert.deepEqual(restored.current().workspace.templates.bass.map(p=>p.id),[a.id,b.id,c.id]);
  assert.deepEqual(restored.current().workspace.templates.bass[0].bars,edited.bars);
  assert.deepEqual(restored.current().workspace.templates.bass.map(p=>p.slotIndex),[0,8,16]);
});

test('automatic updates preserve library order, position, ID and creation order; stale project/phrase updates cannot resurrect deleted blocks',()=>{
  const f=harness(),a=f.store.commitPhraseEdit(blank(0),{create:true}),b=f.store.commitPhraseEdit(blank(1),{create:true});
  const order=sortUserTemplatesForCreation([withNote(a),withNote(b)]).map(p=>p.id);
  const edited=f.edit(withNote(a));assert.equal(edited.savedAt,a.savedAt);
  assert.deepEqual(sortUserTemplatesForCreation([edited,withNote(b)]).map(p=>p.id),order);
  assert.equal(f.store.commitPhraseEdit(withNote(a),{projectId:'wrong'}),null);
  f.store.removeTemplate('bass',a.id);
  assert.equal(f.store.current().workspace.draft,null,'live deletion must not detach a new unsaved draft');
  assert.equal(f.store.commitPhraseEdit(withNote(a)),null);
  assert.equal(f.store.current().workspace.templates.bass.length,1);
});

test('old dirty drafts update their original ID and new drafts relocate safely; migration is one-time and seeds undo',()=>{
  const s=memory(),old=makeStore(s);
  const saved=old.saveTemplate(withNote(blank(3),'C2'),'Original');
  old.setDraft({...saved,editingTemplateId:saved.id,name:'Latest',bars:withNote(saved,'D2').bars,dirty:true});
  const oldChord=old.saveTemplate({...blank(0,'chord'),bars:[[{type:'notes',notes:['C4']},...Array(15).fill(null)]]},'Chord');
  old.setDraft({...blank(0,'chord'),name:'Unbound',dirty:true});
  const current=makeStore(s);current.enableLiveEditing();
  const w=current.current().workspace;
  assert.equal(w.templates.bass[0].id,saved.id);assert.equal(w.templates.bass[0].slotIndex,3);assert.equal(w.templates.bass[0].bars[0][0].note,'D2');
  assert.equal(w.templates.chord.length,2);assert.equal(w.templates.chord[0].id,oldChord.id);assert.equal(w.templates.chord[1].slotIndex,1);
  const h=createJamPhraseHistory((pid,id)=>current.getSnapshot().projects.find(p=>p.id===pid).workspace.templates.bass.find(p=>p.id===id));
  h.seed(current.takeMigrationHistory());assert.equal(h.get(current.current().id,saved.id).undo.length,1);
  const previous=h.take(current.current().id,w.templates.bass[0]);current.commitPhraseEdit(previous);
  assert.equal(current.current().workspace.templates.bass[0].bars[0][0].note,'C2');
  const count=current.current().workspace.templates.chord.length;current.enableLiveEditing();assert.equal(current.current().workspace.templates.chord.length,count);
  const reload=makeStore(s);reload.enableLiveEditing();assert.deepEqual(reload.takeMigrationHistory(),[]);
});

test('quota failures retain the newest edit in memory, block project switching, and successful retry persists it',()=>{
  const s=memory(),store=makeStore(s);store.create();const other=store.getSnapshot().projects[0].id;
  const phrase=store.commitPhraseEdit(blank(),{create:true});s.failed=true;
  const edited=store.commitPhraseEdit(withNote(phrase,'G2'));
  assert.equal(edited.bars[0][0].note,'G2');assert.ok(store.getSnapshot().error);
  assert.equal(store.switchTo(other),false);assert.equal(store.current().workspace.templates.bass[0].bars[0][0].note,'G2');
  assert.equal(makeStore(s).current().workspace.templates.bass[0].bars[0][0],null);
  s.failed=false;assert.equal(store.save(),true);assert.equal(store.getSnapshot().error,undefined);
  assert.equal(makeStore(s).current().workspace.templates.bass[0].bars[0][0].note,'G2');
});

test('phrase histories are independent across same-track blocks and projects; undo is persisted and does not move a reordered phrase',()=>{
  const f=harness(),pid=f.store.current().id,a=f.store.commitPhraseEdit(blank(0),{create:true}),b=f.store.commitPhraseEdit(blank(1),{create:true});
  const a1=f.edit(withNote(a,'D2'));f.edit(withNote(b,'E2'));
  f.store.moveSlots({trackId:'bass',from:0,to:9});
  const current=f.read(pid,a.id),previous=f.history.take(pid,current);assert.equal(previous.slotIndex,current.slotIndex);
  f.edit(previous,false);assert.equal(f.read(pid,a.id).bars[0][0],null);assert.equal(f.history.get(pid,b.id).undo.length,1);
  const redo=f.history.take(pid,f.read(pid,a.id),true);f.edit(redo,false);assert.deepEqual(f.read(pid,a.id).bars,a1.bars);
  const reload=makeStore(f.storage);assert.deepEqual(reload.current().workspace.templates.bass.find(p=>p.id===a.id).bars,a1.bars);
  assert.equal(createJamPhraseHistory(()=>null).get(pid,a.id).undo.length,0);
  assert.equal(f.history.get('other-project',a.id).undo.length,0);
});

test('one MIDI or text gesture makes one undo, including undo before the gesture timer ends',()=>{
  const f=harness(),pid=f.store.current().id,p=f.store.commitPhraseEdit(withNote(blank()),{create:true});
  f.history.begin(pid,p);
  let current=p;for(const strength of [0,25,75,100])current=f.edit({...withNote(current,'F2'),params:{strength,groove:50}});
  assert.equal(f.history.get(pid,p.id).undo.length,1);
  f.edit(f.history.take(pid,current),false);assert.deepEqual(f.read(pid,p.id).bars,p.bars);
  f.history.end();assert.equal(f.history.get(pid,p.id).undo.length,0);
  f.edit(f.history.take(pid,f.read(pid,p.id),true),false);
  f.history.begin(pid,f.read(pid,p.id));for(const name of ['N','Na','Name'])f.edit({...f.read(pid,p.id),name});f.history.end();
  assert.equal(f.history.get(pid,p.id).undo.length,2);
  f.edit(f.history.take(pid,f.read(pid,p.id)),false);assert.equal(f.read(pid,p.id).name,p.name);
});

test('each phrase retains only the newest 50 undo records',()=>{
  const f=harness(),pid=f.store.current().id,p=f.store.commitPhraseEdit(blank(),{create:true});
  for(let i=0;i<65;i++)f.edit({...f.read(pid,p.id),name:`n${i}`});
  assert.equal(f.history.get(pid,p.id).undo.length,50);
  for(let i=0;i<50;i++)f.edit(f.history.take(pid,f.read(pid,p.id)),false);
  assert.equal(f.read(pid,p.id).name,'n14');assert.equal(f.history.take(pid,f.read(pid,p.id)),null);
});

test('empty retained blocks stay silent, dark and absent from Creation; pads reopen editing while keyboard stays inert',()=>{
  const storage=memory(),store=makeStore(storage),empty=store.commitPhraseEdit(blank(0,'drums'),{create:true}),full=store.commitPhraseEdit({...blank(1,'drums'),bars:[[{instruments:['kick']},...Array(15).fill(null)]]},{create:true});
  const templates={drums:[empty,full]},surface={version:5,manualSave:false,canSave:false,storageError:true,templates,status:{mode:'jam',playingPhraseIds:{drums:empty.id}},selection:{drums:empty.id}};
  assert.equal(mapPerformanceKeyboard({type:'keydown',code:'Digit1'},templates),null);
  assert.equal(mapPerformanceKeyboard({type:'keydown',code:'Digit2'},templates).templateId,full.id);
  const input=createPerformanceMidiInput();assert.deepEqual(input.handle([0x90,81,127],templates,surface),{type:'editPhrase',trackId:'drums',slotIndex:0});
  assert.equal(input.handle([0xb0,97,127],templates,surface),null);
  const frame=createLaunchpadXPerformanceLedFrame(surface);assert.equal(frame.find(m=>m[0]===0x90&&m[1]===81)[2],0);
  assert.notEqual(frame.find(m=>m[0]===0x90&&m[1]===82)[2],0);assert.equal(frame.find(m=>m[0]===0xb0&&m[1]===97)[2],0);
  assert.deepEqual(sortUserTemplatesForCreation([empty,full]).map(p=>p.id),[full.id]);
  const w={...store.current().workspace,selection:{drums:empty.id}};assert.equal(jamCombinationSnapshot(w),null);
  assert.equal(launchJamColumn({projectStore:store,playback:{},audition:{},slotIndex:0}),false);
  const raw=JSON.parse(storage.getItem(jamTemplateProjectsKey('pop',null)));
  assert.equal(raw.version,2);assert.equal(raw.projects[0].workspace.templates.drums.length,2);
});

test('legacy phrases without creation timestamps keep their Creation order during automatic editing',()=>{
  const storage=memory(),old=makeStore(storage),a=old.saveTemplate(withNote(blank()),'Older'),b=old.saveTemplate(withNote(blank(1)),'Newer');
  const key=jamTemplateProjectsKey('pop',null),raw=JSON.parse(storage.getItem(key));
  delete raw.projects[0].workspace.templates.bass[0].savedAt;storage.setItem(key,JSON.stringify(raw));
  const store=makeStore(storage),before=sortUserTemplatesForCreation(store.current().workspace.templates.bass).map(p=>p.id);
  const changed=store.commitPhraseEdit({...store.current().workspace.templates.bass[0],name:'Changed'});
  assert.equal(changed.savedAt,undefined);
  assert.deepEqual(sortUserTemplatesForCreation(store.current().workspace.templates.bass).map(p=>p.id),before);
  assert.deepEqual(before,[b.id,a.id]);
});

test('automatic writes with only runtime metadata or field order changes do not add undo entries',()=>{
  const f=harness(),p=f.store.commitPhraseEdit(blank(),{create:true}),pid=f.store.current().id;
  const reordered=Object.fromEntries(Object.entries(p).reverse());
  f.history.record(pid,{...p,editingTemplateId:p.id,dirty:false},{...reordered,slotIndex:9,savedAt:50});
  assert.equal(f.history.get(pid,p.id).undo.length,0);
});

test('switching from naming to a hardware gesture makes separate undo checkpoints on the same phrase',()=>{
  const f=harness(),pid=f.store.current().id,p=f.store.commitPhraseEdit(blank(),{create:true});
  f.history.begin(pid,p,'name');f.edit({...p,name:'Named'});
  f.history.begin(pid,f.read(pid,p.id),'midi');f.edit({...withNote(f.read(pid,p.id)),params:{strength:100,groove:50}});f.history.end();
  assert.equal(f.history.get(pid,p.id).undo.length,2);
  f.edit(f.history.take(pid,f.read(pid,p.id)),false);assert.equal(f.read(pid,p.id).name,'Named');assert.equal(f.read(pid,p.id).bars[0][0],null);
  f.edit(f.history.take(pid,f.read(pid,p.id)),false);assert.equal(f.read(pid,p.id).name,p.name);
});

for (const track of ['drums','chord','bass','melody']) test(`${track}: immediate edits persist source event metadata and clearing notes keeps the same block`,()=>{
  const storage=memory(),store=makeStore(storage),p=store.commitPhraseEdit(blank(3,track),{create:true});
  const cell=track==='drums'?{instruments:['kick'],drumHits:[{instrument:'kick',offset:.5,velocity:.8}]}
    :{type:'notes',notes:['C3','E3'],noteDurationSteps:{C3:3.5,E3:1.25},notePerformances:[{note:'C3',offset:.1,duration:3.5,velocity:.7},{note:'E3',offset:.2,duration:1.25,velocity:.6}]};
  const edited=store.commitPhraseEdit({...p,bars:[[cell,...Array(15).fill(null)]]});
  assert.deepEqual(makeStore(storage).current().workspace.templates[track][0].bars,edited.bars);
  const cleared=store.commitPhraseEdit({...edited,bars:[Array(16).fill(null)]});
  assert.equal(cleared.id,p.id);assert.equal(cleared.slotIndex,3);assert.equal(store.current().workspace.templates[track].length,1);
  assert.equal(sortUserTemplatesForCreation(store.current().workspace.templates[track]).length,0);
});
