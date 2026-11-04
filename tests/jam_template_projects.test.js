import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAL_DRUM_PRESETS, getDialDrumPreset } from '../src/data/dialDrumPresets.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { toggleDrumsCellInstrument } from '../src/domain/drumsCells.js';
import { createJamTemplateProjects, getJamTemplateProjects, jamTemplateProjectsKey, jamCombinationSnapshot, applyUserTemplate, sortUserTemplatesForCreation, upgradeJamSlotLayout, defaultJamTimbres } from '../src/app/jamTemplateProjects.js';
import { createSession, createSessionEditor, TIMBRE_OPTIONS } from '../src/app/performanceSession.js';
import { createJamProjects } from '../src/app/jamProjects.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import { createPerformanceMidiInput } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame } from '../src/input/launchpadXPerformanceSurface.js';

const memory = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) }; };
const draft = () => ({ trackId:'drums', timbreId:'soft-electronic-kit', params:{strength:100,groove:100}, bars:structuredClone(getDialDrumPreset(100,100).bars) });
test('new Jam phrases default to all four Deep Autumn banks through save, playback and reopening',()=>{
  const storage=memory(),store=createJamTemplateProjects(storage,'pop',null,100);
  const expected={drums:'deep-autumn-drums',chord:'deep-autumn-chord',bass:'deep-autumn-bass',melody:'deep-autumn-melody'};
  assert.deepEqual(defaultJamTimbres(),expected);
  assert.equal(jamCombinationSnapshot(store.current().workspace),null,'the entry stays musically blank');
  const selection={};
  for(const track of Object.keys(expected)) {
    const cell=track==='drums'?{instruments:['kick']}:track==='bass'?{type:'bass',note:'C2'}
      :track==='melody'?{type:'melody',note:'C4'}:{type:'notes',notes:['C4']};
    const saved=store.saveTemplate({trackId:track,bars:[[cell,...Array(15).fill(null)]]},track);
    assert.equal(saved.timbreId,expected[track]);selection[track]=saved.id;
  }
  store.patch({selection});
  const restored=createJamTemplateProjects(storage,'pop',null,100),snapshot=jamCombinationSnapshot(restored.current().workspace);
  assert.deepEqual(snapshot.timbres,expected);
  const events=createMatrixPlaybackAdapter(snapshot.matrix,{totalBars:snapshot.totalBars}).getEventsForFlatStep(0);
  assert.deepEqual(new Set(events.map(e=>e.trackId)),new Set(Object.keys(expected)));
  for(const event of events)assert.equal(event.timbreId,expected[event.trackId]);
  const applied=applyUserTemplate({matrix:createInitialMatrix(),clips:{ids:[],byId:{}},totalBars:8},restored.current().workspace.templates.drums[0],0);
  assert.equal(applied.matrix.drums[0][0].requestedTimbreId,expected.drums);
  restored.create();assert.ok(Object.values(restored.current().workspace.templates).every(row=>row.length===0));
  assert.equal(jamCombinationSnapshot(restored.current().workspace),null);
});
test('Deep Autumn fallback preserves explicit project and saved-phrase choices while filling missing banks',()=>{
  const storage=memory(),store=createJamTemplateProjects(storage,'pop',null,100),selection={};
  const old={drums:'soft-electronic-kit',chord:'warm-electric-piano',bass:'round-electric-bass',melody:'airy-synth-lead'};
  for(const [track,timbreId] of Object.entries(old)) {
    const cell=track==='drums'?{instruments:['kick']}:track==='bass'?{type:'bass',note:'C2'}
      :track==='melody'?{type:'melody',note:'C4'}:{type:'notes',notes:['C4']};
    selection[track]=store.saveTemplate({trackId:track,timbreId,bars:[[cell,...Array(15).fill(null)]]},track).id;
  }
  store.patch({selection});store.setTimbre('chord','deep-autumn-chord');
  store.setDraft({trackId:'melody',timbreId:old.melody,bars:[Array(16).fill(null)],dirty:true});
  let restored=createJamTemplateProjects(storage,'pop',null,100);
  assert.deepEqual(jamCombinationSnapshot(restored.current().workspace).timbres,{...old,chord:'deep-autumn-chord'});
  assert.equal(restored.current().workspace.draft.timbreId,old.melody);
  const key=jamTemplateProjectsKey('pop',null),raw=JSON.parse(storage.getItem(key));
  for(const project of raw.projects)delete project.workspace.templates.bass[0].timbreId;
  storage.setItem(key,JSON.stringify(raw));restored=createJamTemplateProjects(storage,'pop',null,100);
  assert.deepEqual(jamCombinationSnapshot(restored.current().workspace).timbres,{...old,chord:'deep-autumn-chord',bass:'deep-autumn-bass'});
});
test('all 25 authored combinations preserve 406 hits and exact substep rolls in the playback adapter', () => {
  assert.equal(DIAL_DRUM_PRESETS.length,25);
  assert.equal(new Set(DIAL_DRUM_PRESETS.map(p => `${p.strength}:${p.groove}`)).size,25);
  let count=0;
  for (const p of DIAL_DRUM_PRESETS) {
    const adapter=createMatrixPlaybackAdapter({drums:p.bars},{totalBars:1});
    const events=Array.from({length:16},(_,step)=>adapter.getEventsForStep(0,step)).flat();
    assert.equal(events.length,p.bars.flat().reduce((n,c)=>n+(c?.drumHits.length??0),0)); count+=events.length;
  }
  assert.equal(count,406);
  const adapter=createMatrixPlaybackAdapter({drums:draft().bars},{totalBars:1});
  const roll=adapter.getEventsForStep(0,8).filter(e=>e.instrument==='hihat');
  assert.equal(roll.length,2); assert.deepEqual(roll.map(e=>e.timingOffset),[0,0.5]);
  assert.ok(roll.every(e=>e.durationSteps===0.5));
});
test('manual toggles delete all hits of one instrument and retain other instrument timing', () => {
  const cell=draft().bars[0][8];
  const without=toggleDrumsCellInstrument(cell,'hihat');
  assert.ok(without.drumHits.every(hit=>hit.instrument!=='hihat'));
  assert.deepEqual(without.drumHits,cell.drumHits.filter(hit=>hit.instrument!=='hihat'));
  const added=toggleDrumsCellInstrument(without,'hihat');
  assert.equal(added.drumHits.filter(hit=>hit.instrument==='hihat').length,1);
});
test('templates persist per project; duplicate saves have distinct IDs and in-place edits retain identity', () => {
  const storage=memory(), store=createJamTemplateProjects(storage,'pop',null,100);
  const first=store.saveTemplate(draft(),'One'), second=store.saveTemplate(draft(),'Two');
  assert.notEqual(first.id,second.id);
  const edited=draft(); edited.bars[0][0]=null;
  store.saveTemplate(edited,'Renamed',first.id);
  assert.equal(store.current().workspace.templates.drums.length,2);
  const originalId=store.current().id;
  store.create(); assert.equal(store.current().workspace.templates.drums.length,0);
  store.switchTo(originalId);
  const restored=createJamTemplateProjects(storage,'pop',null,100);
  assert.equal(restored.current().workspace.templates.drums[0].name,'Renamed');
  assert.equal(restored.current().workspace.templates.drums[0].bars[0][0],null);
});
test('unnamed templates use compact, non-conflicting names without changing existing custom names', () => {
  const storage=memory(), store=createJamTemplateProjects(storage,'pop',null,100);
  const first=store.saveTemplate(draft(),'');
  const second=store.saveTemplate(draft(),'');
  const custom=store.saveTemplate(draft(),'我的鼓');
  assert.equal(first.name,'鼓1'); assert.equal(second.name,'鼓2');
  store.removeTemplate('drums',first.id);
  const next=store.saveTemplate(draft(),'');
  assert.equal(next.name,'鼓1');
  const restored=createJamTemplateProjects(storage,'pop',null,100);
  assert.equal(restored.current().workspace.templates.drums.find(p=>p.id===custom.id).name,'我的鼓');
  assert.equal(new Set(restored.current().workspace.templates.drums.map(p=>p.name)).size,3);
});
test('old sections migrate to deduplicated single-track templates while legacy keys are retained', () => {
  const storage=memory(), old=createJamProjects(storage,'pop',null,100);
  const editor=createSessionEditor(createSession('pop',null,100));
  editor.edit({selection:{drums:'pop-4-on-floor',chord:null,bass:null,melody:null}});
  // Use the actual default pad ID rather than requiring a particular factory catalog.
  editor.edit({selection:{drums:editor.getSnapshot().session.pads.drums[0],chord:null,bass:null,melody:null}});
  editor.save(); editor.edit({selection:{drums:editor.getSnapshot().session.pads.drums[0],chord:null,bass:null,melody:null}}); editor.save();
  old.save(editor.getSnapshot(),['C4','E4','G4']);
  const before=storage.getItem('arranger-jam-projects:v1:pop');
  const next=createJamTemplateProjects(storage,'pop',null,100);
  assert.equal(next.current().workspace.templates.drums.length,1);
  next.initialize(); assert.equal(storage.getItem('arranger-jam-projects:v1:pop'),before);
});
test('creation receives a deep copy of the full template with exact roll events and timbre', () => {
  const storage=memory(), store=createJamTemplateProjects(storage,'pop',null,100);
  const template=store.saveTemplate(draft(),'Roll');
  const state={matrix:createInitialMatrix(),clips:{ids:[],byId:{}},totalBars:8};
  const applied=applyUserTemplate(state,template,2);
  assert.deepEqual(applied.matrix.drums[2][8].drumHits,template.bars[0][8].drumHits);
  assert.equal(applied.matrix.drums[2][8].requestedTimbreId,template.timbreId);
  applied.matrix.drums[2][8].drumHits[0].velocity=0;
  assert.notEqual(template.bars[0][8].drumHits[0].velocity,0);
  assert.equal(applied.clips.byId['drums-bar-2'].name,'Roll');
});
test('drum editing overrides only its track in a combination', () => {
  const store=createJamTemplateProjects(memory(),'pop',null,100);
  const drum=store.saveTemplate(draft(),'Drum');
  const bass=store.saveTemplate({trackId:'bass',timbreId:'round-electric-bass',bars:[Array.from({length:16},(_,i)=>i===0?{type:'bass',note:'C2',duration:'4n'}:null)]},'Bass');
  store.patch({selection:{drums:drum.id,bass:bass.id,chord:null,melody:null}});
  const w=store.current().workspace, override=draft(); override.bars[0][8]=null;
  const snapshot=jamCombinationSnapshot(w,override);
  assert.equal(snapshot.matrix.drums[0][8],null); assert.equal(snapshot.matrix.bass[0][0].note,'C2');
  assert.equal(jamCombinationSnapshot(w,override,true).matrix.bass[0][0],null);
});
test('unreadable new storage is never silently overwritten; failed saves retain draft', () => {
  const storage=memory(), key=jamTemplateProjectsKey('pop',null); storage.setItem(key,'broken');
  const store=createJamTemplateProjects(storage,'pop',null,100);
  store.patch({draft:draft()}); assert.equal(store.save(),false);
  assert.equal(storage.getItem(key),'broken'); assert.ok(store.current().workspace.draft);
});
test('new Jam pads trigger saved templates and replace legacy loop/record controls', () => {
  const templates={drums:[{id:'saved-drum'}]}, surface={version:5,templates,selection:{drums:'saved-drum'},page:0,pageCount:2,status:{mode:'jam'}};
  const input=createPerformanceMidiInput();
  assert.deepEqual(input.handle([0x90,71,127],templates,surface),{type:'template',trackId:'drums',templateId:'saved-drum'});
  assert.equal(input.handle([0x90,11,127],templates,surface).type,'repeat');
  assert.equal(input.handle([0xb0,19,127],templates,surface),null);
  const frame=createLaunchpadXPerformanceLedFrame(surface);
  assert.notEqual(frame.find(m=>m[0]===0x90&&m[1]===11)[2],0);
  assert.equal(frame.find(m=>m[0]===0xb0&&m[1]===19)[2],0);
  assert.notEqual(frame.find(m=>m[0]===0xb0&&m[1]===94)[2],0);
});
test('entrypoint changes retain the active Jam project context and its shared templates', () => {
  const before=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{value:memory(),configurable:true});
  try {
    const jam=getJamTemplateProjects('pop','template-entrypoint-test',100); jam.initialize();
    jam.saveTemplate(draft(),'Shared');
    const creation=getJamTemplateProjects('rock',null,120);
    assert.equal(creation,jam); assert.equal(creation.current().workspace.templates.drums[0].name,'Shared');
  } finally { if (before) Object.defineProperty(globalThis,'localStorage',before); else delete globalThis.localStorage; }
});
test('a failed new-project write keeps the active project and does not duplicate failed template saves', () => {
  const storage=memory(), store=createJamTemplateProjects(storage,'pop',null,100), id=store.current().id;
  store.initialize(); storage.setItem=()=>{throw new Error('full');};
  assert.equal(store.create(),false); assert.equal(store.current().id,id);
  assert.equal(store.saveTemplate(draft(),'Failed'),null); assert.equal(store.current().workspace.templates.drums.length,0);
});
test('a changed timbre replaces baked sample-bank metadata, and uneven loop lengths repeat in full', () => {
  const store=createJamTemplateProjects(memory(),'pop',null,100);
  const d=draft(); for (const c of d.bars[0]) if(c)c.timbreId='deep-autumn-drums';
  const drum=store.saveTemplate(d,'Default kit');
  const bass=store.saveTemplate({trackId:'bass',timbreId:'round-electric-bass',bars:Array.from({length:3},()=>Array.from({length:16},(_,i)=>i===0?{type:'bass',note:'C2'}:null))},'Three');
  const chord=store.saveTemplate({trackId:'chord',timbreId:'warm-electric-piano',bars:Array.from({length:2},()=>Array.from({length:16},(_,i)=>i===0?{type:'chord',notes:['C4','E4']} : null))},'Two');
  store.patch({selection:{drums:drum.id,bass:bass.id,chord:chord.id,melody:null}});
  const snapshot=jamCombinationSnapshot(store.current().workspace);
  assert.equal(snapshot.totalBars,6); assert.equal(snapshot.matrix.drums[0][8].timbreId,undefined);
});
test('instrument timbre persists per project, follows every template and solo, and is captured when saving', () => {
  const storage=memory(), store=createJamTemplateProjects(storage,'pop',null,100);
  const first=store.saveTemplate(draft(),'鼓1');
  const second=store.saveTemplate({...draft(),bars:structuredClone(getDialDrumPreset(0,0).bars)},'鼓2');
  const original=structuredClone(store.current().workspace.templates.drums);
  const chosen=TIMBRE_OPTIONS.drums[1];
  assert.equal(store.setTimbre('drums',chosen),true);
  for (const template of [first,second]) {
    store.patch({selection:{drums:template.id,bass:null,chord:null,melody:null}});
    const snapshot=jamCombinationSnapshot(store.current().workspace);
    assert.equal(snapshot.timbres.drums,chosen);
    for (const cell of snapshot.matrix.drums[0].filter(Boolean)) assert.equal(cell.requestedTimbreId,chosen);
    assert.deepEqual(snapshot.matrix.drums[0].map(c=>c?.drumHits),template.bars[0].map(c=>c?.drumHits));
  }
  assert.deepEqual(store.current().workspace.templates.drums,original,'existing saved templates keep their original sound and notes');
  assert.equal(jamCombinationSnapshot(store.current().workspace,draft(),true).timbres.drums,chosen);
  const next=store.saveTemplate(draft(),'新模板');
  assert.equal(next.timbreId,chosen);
  const state={matrix:createInitialMatrix(),clips:{ids:[],byId:{}},totalBars:8};
  assert.equal(applyUserTemplate(state,next,0).clips.byId['drums-bar-0'].requestedTimbreId,chosen);
  const id=store.current().id;
  store.create(); assert.equal(store.current().workspace.timbres.drums,null);
  store.switchTo(id);
  const restored=createJamTemplateProjects(storage,'pop',null,100);
  assert.equal(restored.current().workspace.timbres.drums,chosen);
  assert.equal(restored.current().workspace.timbres.bass,null);
});
test('legacy projects keep their template timbre until explicitly changed and reject cross-instrument sounds', () => {
  const storage=memory(), store=createJamTemplateProjects(storage,'pop',null,100);
  const chosen=TIMBRE_OPTIONS.drums[1];
  const template=store.saveTemplate({...draft(),timbreId:chosen},'旧模板');
  store.patch({selection:{drums:template.id,bass:null,chord:null,melody:null}});
  const key=jamTemplateProjectsKey('pop',null), data=JSON.parse(storage.getItem(key));
  for (const project of data.projects) delete project.workspace.timbres;
  storage.setItem(key,JSON.stringify(data));
  const restored=createJamTemplateProjects(storage,'pop',null,100);
  assert.equal(restored.current().workspace.timbres.drums,null);
  assert.equal(jamCombinationSnapshot(restored.current().workspace).timbres.drums,chosen);
  assert.equal(restored.setTimbre('drums',TIMBRE_OPTIONS.bass[1]),false);
  assert.equal(restored.current().workspace.timbres.drums,null);
});
test('long uneven phrases loop independently without allocating their entire common cycle', () => {
  const store=createJamTemplateProjects(memory(),'pop',null,100);
  const bass=store.saveTemplate({trackId:'bass',timbreId:'round-electric-bass',bars:Array.from({length:127},(_,bar)=>Array.from({length:16},(_,i)=>i===0?{type:'bass',note:bar===0?'C2':'D2'}:null))},'Long bass');
  const chord=store.saveTemplate({trackId:'chord',timbreId:'warm-electric-piano',bars:Array.from({length:128},()=>Array.from({length:16},(_,i)=>i===0?{type:'chord',notes:['C4','E4']}:null))},'Long chord');
  store.patch({selection:{drums:null,bass:bass.id,chord:chord.id,melody:null}});
  const snapshot=jamCombinationSnapshot(store.current().workspace);
  assert.equal(snapshot.totalBars,16256); assert.equal(snapshot.matrix.bass.length,127); assert.equal(snapshot.matrix.chord.length,128);
  const adapter=createMatrixPlaybackAdapter(snapshot,{totalBars:snapshot.totalBars});
  assert.equal(adapter.getEventsForStep(127,0).find(e=>e.trackId==='bass').note,'C2');
  assert.equal(adapter.getEventsForStep(128,0).find(e=>e.trackId==='bass').note,'D2');
});

test('each instrument draft survives switching instruments, project reload, rename and template removal',()=>{
  const storage=memory(),store=createJamTemplateProjects(storage,'pop',null,100);
  const saved=store.saveTemplate(draft(),'Before');
  store.setDraft({...draft(),editingTemplateId:saved.id,name:'Before',dirty:true});
  const bass={trackId:'bass',name:'Bass draft',bars:[Array.from({length:16},(_,i)=>i===0?{type:'bass',note:'C2'}:null)],dirty:true};
  store.setDraft(bass);
  store.renameTemplate('drums',saved.id,'After');
  const reloaded=createJamTemplateProjects(storage,'pop',null,100);
  assert.equal(reloaded.current().workspace.draftsByTrack.drums.name,'After');
  assert.deepEqual(reloaded.current().workspace.draftsByTrack.bass,bass);
  reloaded.removeTemplate('drums',saved.id);
  assert.equal(reloaded.current().workspace.draftsByTrack.drums.editingTemplateId,undefined);
  assert.ok(reloaded.current().workspace.draftsByTrack.drums.bars[0].some(Boolean));
});
test('a legacy single editor draft is adopted by its track without discarding its exact hits',()=>{
  const storage=memory(),store=createJamTemplateProjects(storage,'pop',null,100);
  store.patch({draft:draft()});
  const restored=createJamTemplateProjects(storage,'pop',null,100);
  assert.deepEqual(restored.current().workspace.draftsByTrack.drums.bars,draft().bars);
});

test('deletion preserves all surviving visual slots across 32 columns and persists unchanged musical data',()=>{
  const storage=memory(),store=createJamTemplateProjects(storage,'pop',null,100);
  const saved=[0,40,7,8,16,31,32].map(slot=>store.saveTemplate({...draft(),targetSlot:slot},`Slot ${slot}`));
  const other=store.saveTemplate({trackId:'bass',timbreId:'round-electric-bass',bars:draft().bars,targetSlot:31},'Other row');
  const selected=saved.find(p=>p.slotIndex===32);
  store.patch({selection:{...store.current().workspace.selection,drums:selected.id,bass:other.id}});
  store.removeTemplate('drums',saved.find(p=>p.slotIndex===7).id);
  const w=store.current().workspace;
  assert.deepEqual(w.templates.drums.map(p=>[p.name,p.slotIndex]),[
    ['Slot 0',0],['Slot 40',40],['Slot 8',8],['Slot 16',16],['Slot 31',31],['Slot 32',32],
  ]);
  assert.deepEqual(w.templates.bass,[other]);
  assert.equal(w.selection.drums,selected.id);
  for(const template of w.templates.drums) {
    const original=saved.find(p=>p.id===template.id);
    assert.deepEqual({...template,slotIndex:original.slotIndex},original);
  }
  assert.deepEqual(createJamTemplateProjects(storage,'pop',null,100).current().workspace,w);
  const before=store.getSnapshot();
  assert.equal(store.removeTemplate('drums','missing'),false);
  assert.equal(store.removeTemplate('invalid',selected.id),false);
  assert.equal(store.getSnapshot(),before);
  store.removeTemplate('drums',saved[1].id); // Last visible item: nothing else moves.
  assert.deepEqual(store.current().workspace.templates.drums.map(p=>p.slotIndex),[0,8,16,31,32]);
  store.removeTemplate('drums',saved[0].id); // First item: later items keep their original locations.
  assert.deepEqual(store.current().workspace.templates.drums.map(p=>p.slotIndex),[8,16,31,32]);
});

test('deletion preserves editor locations and blank draft targets',()=>{
  const store=createJamTemplateProjects(memory(),'pop',null,100);
  const saved=Array.from({length:3},(_,slot)=>store.saveTemplate({...draft(),targetSlot:slot},`Slot ${slot}`));
  const edited={...saved[2],editingTemplateId:saved[2].id,dirty:true,bars:structuredClone(getDialDrumPreset(0,0).bars)};
  store.setDraft(edited);
  store.removeTemplate('drums',saved[0].id);
  assert.deepEqual(store.current().workspace.draft,{...edited,slotIndex:2});
  store.setDraft(edited); // Undo history still refers to the same slot.
  assert.equal(store.current().workspace.draft.slotIndex,2);
  store.removeTemplate('drums',saved[2].id);
  const detached=store.current().workspace.draft;
  for(const field of ['id','editingTemplateId','slotIndex','targetSlot']) assert.equal(detached[field],undefined);
  assert.deepEqual(detached.bars,edited.bars);assert.equal(detached.dirty,true);
  store.setDraft(edited);
  assert.deepEqual(store.current().workspace.draft,detached);
  const restored=store.saveTemplate(detached,'Preserved');
  assert.notEqual(restored.id,saved[2].id);
  assert.equal(restored.slotIndex,0);

  const pending={...draft(),targetSlot:2,dirty:true};
  store.setDraft(pending);
  store.saveTemplate({...draft(),targetSlot:3},'Later');
  store.saveTemplate({...draft(),targetSlot:5},'Further');
  store.removeTemplate('drums',saved[1].id);
  assert.equal(store.current().workspace.draft.targetSlot,2,'blank draft remains in its original free slot');
  assert.ok(store.saveTemplate(store.current().workspace.draft,'New draft'));
});

test('legacy projects retain existing holes, keeping notes, selected IDs and unsaved edits intact',()=>{
  const storage=memory(),store=createJamTemplateProjects(storage,'pop',null,104);
  const firstId=store.current().id;
  const saved=[14,0,8].map(slot=>store.saveTemplate({...draft(),targetSlot:slot},`Drum ${slot}`));
  const bass=store.saveTemplate({trackId:'bass',timbreId:'round-electric-bass',targetSlot:20,bars:[Array.from({length:16},(_,i)=>i===0?{
    type:'bass',note:'C2',notePerformances:{C2:[{offset:0.03,duration:1.27,velocity:0.63}]},
  }:null)]},'Bass');
  store.patch({selection:{...store.current().workspace.selection,drums:saved[0].id,bass:bass.id}});
  const pending={...draft(),name:'Unfinished',targetSlot:1,dirty:true};
  store.setDraft(pending);
  const editing={...bass,editingTemplateId:bass.id,dirty:true,params:{strength:25,groove:75}};
  store.setDraft(editing);
  store.create();
  store.saveTemplate({...draft(),targetSlot:31},'Second project');
  store.switchTo(firstId);
  const key=jamTemplateProjectsKey('pop',null),raw=JSON.parse(storage.getItem(key));
  for(const project of raw.projects) delete project.workspace.slotLayoutVersion;
  storage.setItem(key,JSON.stringify(raw));
  const before=storage.getItem(key),restored=createJamTemplateProjects(storage,'pop',null,104);
  assert.equal(storage.getItem(key),before,'reading does not overwrite the source');
  const w=restored.current().workspace;
  assert.deepEqual(w.templates.drums.map(p=>p.slotIndex),[14,0,8],'preserve both library order and valid visual slots');
  assert.equal(w.templates.bass[0].slotIndex,20);
  for(const original of [...saved,bass]) {
    const migrated=w.templates[original.trackId].find(p=>p.id===original.id);
    assert.deepEqual({...migrated,slotIndex:original.slotIndex},original);
  }
  assert.equal(w.selection.drums,saved[0].id);assert.equal(w.selection.bass,bass.id);
  assert.deepEqual(w.draft,{...editing,slotIndex:20});
  assert.deepEqual(w.draftsByTrack.drums,{...pending,targetSlot:1});
  assert.equal(restored.getSnapshot().projects[1].workspace.templates.drums[0].slotIndex,31);
  assert.equal(upgradeJamSlotLayout(w),w,'the migration is idempotent');
  assert.equal(restored.initialize(),true);
  restored.saveTemplate({...draft(),targetSlot:15},'New explicit slot');
  const reopened=createJamTemplateProjects(storage,'pop',null,104);
  assert.deepEqual(reopened.current().workspace.templates.drums.map(p=>p.slotIndex),[14,0,8,15],'new intentional placements survive reload');
  assert.equal(reopened.current().workspace.slotLayoutVersion,1);
});


test('creation template order is a projection: newest saves first, legacy and invalid stamps fall back to reverse insertion', () => {
  const templates = Object.freeze([
    Object.freeze({id:'old-a'}), Object.freeze({id:'old-b'}),
    Object.freeze({id:'invalid',savedAt:'100'}), Object.freeze({id:'saved-a',savedAt:1}),
    Object.freeze({id:'saved-b',savedAt:2}),
  ]);
  assert.deepEqual(sortUserTemplatesForCreation(templates).map(p=>p.id),['saved-b','saved-a','invalid','old-b','old-a']);
  assert.deepEqual(templates.map(p=>p.id),['old-a','old-b','invalid','saved-a','saved-b']);
});

test('all four creation libraries persist recent saves without changing Jam slot positions; rename does not reorder', () => {
  const storage=memory(),store=createJamTemplateProjects(storage,'pop',null,100);
  for(const track of ['drums','chord','bass','melody']) {
    const d={...draft(),trackId:track};
    const first=store.saveTemplate(d,'First'),second=store.saveTemplate(d,'Second');
    assert.deepEqual(sortUserTemplatesForCreation(store.current().workspace.templates[track]).map(p=>p.id),[second.id,first.id]);
    store.saveTemplate(d,'Updated',first.id);
    const raw=store.current().workspace.templates[track];
    assert.deepEqual(raw.map(p=>p.id),[first.id,second.id],'Jam bindings retain their indices');
    assert.deepEqual(sortUserTemplatesForCreation(raw).map(p=>p.id),[first.id,second.id]);
    const stamp=raw[1].savedAt;
    store.renameTemplate(track,second.id,'Renamed');
    const restored=createJamTemplateProjects(storage,'pop',null,100).current().workspace.templates[track];
    assert.equal(restored[1].savedAt,stamp);
    assert.deepEqual(sortUserTemplatesForCreation(restored).map(p=>p.id),[first.id,second.id]);
  }
});

test('old v2 libraries gain save ordering lazily and failed saves never move a template or advance its stamp', () => {
  const storage=memory(),store=createJamTemplateProjects(storage,'pop',null,100);
  const first=store.saveTemplate(draft(),'One'),second=store.saveTemplate(draft(),'Two');
  const raw=JSON.parse(storage.getItem(jamTemplateProjectsKey('pop',null)));
  for(const template of raw.projects[0].workspace.templates.drums) delete template.savedAt;
  storage.setItem(jamTemplateProjectsKey('pop',null),JSON.stringify(raw));
  const old=createJamTemplateProjects(storage,'pop',null,100);
  assert.deepEqual(sortUserTemplatesForCreation(old.current().workspace.templates.drums).map(p=>p.id),[second.id,first.id]);
  old.saveTemplate(draft(),'One saved',first.id);
  assert.deepEqual(sortUserTemplatesForCreation(old.current().workspace.templates.drums).map(p=>p.id),[first.id,second.id]);
  const before=structuredClone(old.current().workspace.templates.drums);
  storage.setItem=()=>{throw new Error('quota');};
  assert.equal(old.saveTemplate(draft(),'Two fails',second.id),null);
  assert.deepEqual(old.current().workspace.templates.drums,before);
});
