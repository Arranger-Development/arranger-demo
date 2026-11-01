import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleJamTemplate, launchJamColumn, deleteJamTemplate } from '../src/app/jamTemplateSelection.js';
import { createJamTemplateProjects } from '../src/app/jamTemplateProjects.js';
import { createJamAudition } from '../src/app/jamAudition.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { getDialDrumPreset } from '../src/data/dialDrumPresets.js';

const ready = () => new Promise(resolve => setImmediate(resolve));
test('continuous strip launches the global 32nd column atomically without changing the retained draft',async()=>{
  const f=fixture();
  const drum=f.store.saveTemplate({...f.drums,targetSlot:31},'32nd drum');
  const bass=f.store.saveTemplate({...f.bass,targetSlot:31},'32nd bass');
  const draft={...f.second,dirty:true};f.store.setDraft(draft);
  assert.equal(launchJamColumn({projectStore:f.store,playback:f.playback,audition:f.audition,slotIndex:31}),true);
  await ready();const source=f.tick(0);
  assert.deepEqual(f.store.current().workspace.selection,{drums:drum.id,chord:null,bass:bass.id,melody:null});
  assert.equal(source.stepOffset,0);assert.equal(f.plays,1);
  assert.deepEqual(f.store.current().workspace.draft,draft);
  assert.equal(launchJamColumn({projectStore:f.store,playback:f.playback,audition:f.audition,slotIndex:32}),false);
});
test('column launch follows compacted slots after deletion without moving other tracks',async()=>{
  const f=fixture();
  const later=f.store.saveTemplate({...f.drums,targetSlot:16},'Third page');
  f.store.removeTemplate('drums',f.drums.id);
  assert.equal(launchJamColumn({projectStore:f.store,playback:f.playback,audition:f.audition,columnIndex:0}),true,'bass still occupies first column');
  await ready();f.tick(0);
  assert.equal(f.store.current().workspace.selection.drums,f.second.id);
  assert.equal(launchJamColumn({projectStore:f.store,playback:f.playback,audition:f.audition,columnIndex:1}),true);
  f.tick(16);
  assert.equal(f.store.current().workspace.selection.drums,later.id);
  assert.equal(f.store.current().workspace.selection.bass,null);
});
function fixture() {
  const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const store=createJamTemplateProjects(storage,'pop',null,100);
  const drums=store.saveTemplate({trackId:'drums',timbreId:'soft-electronic-kit',bars:structuredClone(getDialDrumPreset(100,100).bars)},'鼓1');
  const second=store.saveTemplate({...drums,bars:structuredClone(getDialDrumPreset(0,0).bars)},'鼓2');
  const bass=store.saveTemplate({trackId:'bass',timbreId:'round-electric-bass',bars:[Array.from({length:16},(_,i)=>i===0 ? {type:'bass',note:'C2'} : null)]},'贝斯1');
  let options, plays=0, absolute=0;
  const audio={async play(value){options=value;plays++;return true;},stop(){},stopAllVoices(){},setTempo(){},resetPerformanceEffects(){},getAbsolutePlaybackStep:()=>absolute};
  const playback=createSessionPlayback(audio);
  const audition=createJamAudition(playback,{readWorkspace:()=>store.current().workspace,readDraft:()=>store.current().workspace.draft});
  return {store,audio,playback,audition,drums,second,bass,get plays(){return plays;},
    toggle(template,draft=null){toggleJamTemplate({projectStore:store,playback,audition,trackId:template.trackId,templateId:template.id,draft});},
    tick(step){absolute=step;const source=options.playbackSource(step,step*.15);source.onAudible?.();return source;},
    events(source,step){return createMatrixPlaybackAdapter(source,{totalBars:source.totalBars}).getEventsForFlatStep(step);},
  };
}

const remove = (f,template) => deleteJamTemplate({projectStore:f.store,playback:f.playback,audition:f.audition,trackId:template.trackId,templateId:template.id});
test('the current deletion reducer works with a store retained from before a code update',()=>{
  const f=fixture();
  f.store.removeTemplate=()=>{throw new Error('stale pre-update delete method');};
  assert.equal(remove(f,f.drums),true);
  assert.equal(f.store.current().workspace.templates.drums[0].id,f.second.id);
  assert.equal(f.store.current().workspace.templates.drums[0].slotIndex,0);
});
test('deleting a selected phrase removes only that audio track without replaying the retained draft',async()=>{
  const f=fixture();
  launchJamColumn({projectStore:f.store,playback:f.playback,audition:f.audition,slotIndex:0});
  await ready();f.tick(0);f.tick(3);
  f.store.setDraft({...f.drums,editingTemplateId:f.drums.id,dirty:true});
  assert.equal(remove(f,f.drums),true);
  assert.equal(f.store.current().workspace.templates.drums[0].id,f.second.id);
  assert.equal(f.store.current().workspace.templates.drums[0].slotIndex,0);
  assert.equal(f.store.current().workspace.selection.drums,null);
  const next=f.tick(4);
  assert.ok(next.matrix.drums.flat().every(cell=>cell===null));
  assert.ok(f.events(f.tick(16),16).some(e=>e.trackId==='bass'));
  assert.equal(f.plays,1);assert.equal(f.playback.isActive(),true);
});
test('deleting an unrelated phrase keeps a pending transition and its audio request intact',async()=>{
  const f=fixture();f.toggle(f.drums);await ready();f.tick(0);f.tick(3);
  f.toggle(f.second);
  const before=f.playback.getProgress();
  remove(f,f.bass);
  assert.deepEqual(f.playback.getProgress(),before);
  f.tick(16);assert.equal(f.playback.getProgress().snapshot.phraseIds.drums,f.second.id);
  assert.equal(f.plays,1);
});
test('deleting a queued replacement restores the playing selection; deleting the playing origin preserves the queue',async()=>{
  const f=fixture();f.toggle(f.drums);await ready();f.tick(0);f.tick(3);f.toggle(f.second);
  remove(f,f.second);
  assert.equal(f.store.current().workspace.selection.drums,f.drums.id);
  f.tick(16);assert.equal(f.playback.getProgress().snapshot.phraseIds.drums,f.drums.id);
  const g=fixture();g.toggle(g.drums);await ready();g.tick(0);g.tick(3);g.toggle(g.second);
  remove(g,g.drums);g.tick(4);
  assert.equal(g.playback.getProgress().snapshot.phraseIds.drums,null);
  assert.equal(g.store.current().workspace.selection.drums,g.second.id);
  g.tick(16);assert.equal(g.playback.getProgress().snapshot.phraseIds.drums,g.second.id);
});
test('a gem on a muted sounding track restores its sound instead of toggling it off',async()=>{
  const f=fixture();f.toggle(f.drums);await ready();f.tick(0);f.tick(3);
  f.store.patch({mutedTracks:{...f.store.current().workspace.mutedTracks,drums:true}});
  f.toggle(f.drums);
  assert.equal(f.store.current().workspace.selection.drums,f.drums.id);
  assert.equal(f.store.current().workspace.mutedTracks.drums,false);
  f.tick(16);assert.equal(f.playback.getProgress().snapshot.phraseIds.drums,f.drums.id);
});
test('deleting the last sounding phrase stops; deleting while paused never starts audio',async()=>{
  const f=fixture();f.toggle(f.drums);await ready();f.tick(0);
  remove(f,f.drums);f.tick(1);assert.equal(f.playback.isActive(),false);
  f.store.patch({selection:{...f.store.current().workspace.selection,drums:f.second.id,bass:f.bass.id}});
  remove(f,f.second);await ready();assert.equal(f.playback.isActive(),false);assert.equal(f.plays,1);
});
test('deleting a soloed origin preserves its draft and resumes only the remaining saved combination',async()=>{
  const f=fixture();f.toggle(f.bass);await ready();f.tick(0);
  const draft={...f.drums,editingTemplateId:f.drums.id,dirty:true};
  f.store.setDraft(draft);f.audition.toggle(draft);f.tick(1);
  remove(f,f.drums);await ready();
  const source=f.tick(2);
  assert.equal(f.audition.getTrack(),null);
  assert.ok(source.matrix.drums.flat().every(cell=>cell===null));
  assert.ok(f.events(source,0).some(e=>e.trackId==='bass'));
  assert.deepEqual(f.store.current().workspace.draft.bars,draft.bars);
  assert.equal(f.store.current().workspace.draft.editingTemplateId,undefined);
});
test('deleting another phrase leaves solo audition alone; stopped solo deletion stops audio',async()=>{
  const f=fixture();
  const draft={...f.drums,editingTemplateId:f.drums.id,dirty:true};f.store.setDraft(draft);
  f.audition.toggle(draft);await ready();f.tick(0);
  const before=f.playback.getProgress();remove(f,f.second);
  assert.deepEqual(f.playback.getProgress(),before);assert.equal(f.audition.getTrack(),'drums');
  remove(f,f.drums);f.tick(1);assert.equal(f.playback.isActive(),false);assert.equal(f.audition.getTrack(),null);
});

test('repeating a playing gem pauses it at the next sixteenth, then stops the empty clock',async()=>{
  const f=fixture(); f.toggle(f.drums); await ready(); f.tick(0);
  assert.equal(f.plays,1); f.toggle(f.drums);
  assert.equal(f.store.current().workspace.selection.drums,null);
  assert.equal(f.playback.isActive(),true,'wait for the scheduled pause boundary');
  assert.equal(f.tick(1).done,true); assert.equal(f.playback.isActive(),false);
});
test('clicking a playing gem in a column pauses only its track',async()=>{
  const f=fixture();launchJamColumn({projectStore:f.store,playback:f.playback,audition:f.audition,slotIndex:0});
  await ready();f.tick(0);f.tick(3);f.toggle(f.drums);
  assert.deepEqual(f.store.current().workspace.selection,{drums:null,chord:null,bass:f.bass.id,melody:null});
  const next=f.tick(4);
  assert.deepEqual(next.releaseTrackIds,['drums']);
  assert.equal(next.trackStepOffsets.bass,0);
  assert.ok(next.matrix.drums.flat().every(cell=>cell===null));
  assert.ok(f.events(f.tick(16),16).some(event=>event.trackId==='bass'));
  assert.equal(f.plays,1);
});
test('stopped historical selections stay silent; clicking restores only the target mute and volume',async()=>{
  const f=fixture();f.store.patch({selection:{drums:f.drums.id,bass:f.bass.id,chord:null,melody:null},
    mutedTracks:{drums:true,bass:true,chord:false,melody:false},volumes:{drums:-24,bass:-5,chord:0,melody:0}});
  f.toggle(f.drums);await ready();
  const w=f.store.current().workspace;
  assert.equal(w.mutedTracks.drums,false);assert.equal(w.volumes.drums,0);
  assert.equal(w.mutedTracks.bass,true);assert.equal(w.volumes.bass,-5);
  assert.equal(w.selection.bass,null);
  assert.ok(f.events(f.tick(0),0).every(event=>event.trackId==='drums'));
});
test('rapidly cancelling the last selection while banks prepare invalidates the audio start',async()=>{
  const f=fixture();let finish;
  f.audio.preparePerformanceEffects=()=>new Promise(resolve=>{finish=resolve;});
  f.toggle(f.drums);f.toggle(f.drums);finish();await ready();
  assert.equal(f.store.current().workspace.selection.drums,null);
  assert.equal(f.plays,0);assert.equal(f.playback.isActive(),false);
});
test('cancelling one track of a preparing column leaves the other requested tracks intact',async()=>{
  const f=fixture();let finish;
  f.audio.preparePerformanceEffects=()=>new Promise(resolve=>{finish=resolve;});
  launchJamColumn({projectStore:f.store,playback:f.playback,audition:f.audition,slotIndex:0});
  f.toggle(f.drums);finish();await ready();
  assert.deepEqual(new Set(f.events(f.tick(0),0).map(e=>e.trackId)),new Set(['bass']));
  assert.equal(f.store.current().workspace.selection.bass,f.bass.id);
});
test('cancelling a queued same-track replacement leaves the original phrase playing',async()=>{
  const f=fixture();f.toggle(f.drums);await ready();f.tick(0);f.tick(3);
  f.toggle(f.second);f.toggle(f.second);
  assert.equal(f.store.current().workspace.selection.drums,f.drums.id);
  const source=f.tick(16);
  assert.equal(f.playback.getProgress().snapshot.phraseIds.drums,f.drums.id);
  assert.deepEqual(source.releaseTrackIds,[]);assert.equal(source.trackStepOffsets.drums,0);
});
test('unsaved drafts never join another saved phrase after the original is paused',async()=>{
  const f=fixture();const draft={...f.drums,dirty:true};f.store.setDraft(draft);
  f.toggle(f.drums);await ready();f.tick(0);f.toggle(f.drums);f.tick(1);
  f.toggle(f.bass);await ready();
  assert.deepEqual(new Set(f.events(f.tick(0),0).map(e=>e.trackId)),new Set(['bass']));
  assert.deepEqual(f.store.current().workspace.draft,draft);
});
test('different tracks layer independently and the last request wins only within its own track',async()=>{
  const f=fixture();f.toggle(f.drums);await ready();f.tick(0);f.tick(3);
  f.toggle(f.bass);f.toggle(f.second);
  assert.deepEqual(f.store.current().workspace.selection,{drums:f.second.id,chord:null,bass:f.bass.id,melody:null});
  const source=f.tick(16);
  assert.deepEqual(new Set(f.events(source,16).map(e=>e.trackId)),new Set(['drums','bass']));
  assert.equal(source.trackStepOffsets.drums,16);assert.equal(source.trackStepOffsets.bass,16);
  assert.deepEqual(source.releaseTrackIds,['drums']);assert.equal(f.plays,1);
});
test('audition returns to the layered saved mix and preserves independent track starts',async()=>{
  const f=fixture();f.toggle(f.drums);await ready();f.tick(0);f.tick(3);f.toggle(f.bass);f.tick(16);
  const draft={...f.second,editingTemplateId:f.second.id,dirty:true};f.store.setDraft(draft);
  f.audition.toggle(draft);f.tick(17);f.tick(19);f.audition.release();
  const source=f.tick(20);
  assert.equal(source.trackStepOffsets.drums,0);assert.equal(source.trackStepOffsets.bass,16);
  assert.equal(f.playback.getProgress().snapshot.phraseIds.drums,f.drums.id);
  assert.equal(f.playback.getProgress().snapshot.phraseIds.bass,f.bass.id);
  assert.deepEqual(f.store.current().workspace.draft,draft);assert.equal(f.plays,1);
});

test('column launch commits all four slots once, stops empty tracks at the boundary, and starts at zero', async () => {
  const f = fixture(); const launch = columnIndex => launchJamColumn({ projectStore:f.store,playback:f.playback,audition:f.audition,columnIndex });
  assert.equal(launch(0), true); await ready(); f.tick(0); f.tick(5);
  const draft = { ...f.bass, dirty:true }; f.store.setDraft(draft);
  let commits=0; const patch=f.store.patch; f.store.patch=value=>{ commits++;return patch(value); };
  assert.equal(launch(1), true); assert.equal(commits,1);
  assert.deepEqual(f.store.current().workspace.selection,{drums:f.second.id,chord:null,bass:null,melody:null});
  assert.ok(f.tick(15).matrix.bass[0].some(Boolean), 'old bass continues until boundary');
  const next=f.tick(16);
  assert.equal(next.trackStepOffsets.drums,16); assert.ok(next.matrix.bass.flat().every(cell=>cell===null));
  assert.deepEqual(f.store.current().workspace.draft,draft);
  assert.equal(f.playback.getProgress().snapshot.phraseIds.drums,f.second.id);
  assert.equal(f.plays,1,'one running transport');
  assert.equal(launch(1),false); assert.equal(commits,1);
});

test('column launch uses the current page, restores audible tracks, and ignores empty/duplicate requests',async()=>{
  const f=fixture();
  while(f.store.current().workspace.templates.drums.length<9) f.store.saveTemplate({...f.drums,id:undefined},'下一页');
  f.store.patch({mutedTracks:{drums:true,chord:false,bass:false,melody:false},volumes:{drums:-24,chord:0,bass:0,melody:0}});
  const args={projectStore:f.store,playback:f.playback,audition:f.audition,page:1,columnIndex:0};
  assert.equal(launchJamColumn(args),true);
  assert.equal(f.store.current().workspace.selection.drums,f.store.current().workspace.templates.drums[8].id);
  assert.equal(f.store.current().workspace.volumes.drums,0);assert.equal(f.store.current().workspace.mutedTracks.drums,false);
  assert.equal(launchJamColumn(args),false,'duplicate while preparing is idempotent');
  assert.equal(launchJamColumn({...args,columnIndex:7}),false);
  assert.equal(launchJamColumn({...args,columnIndex:8}),false);
  await ready();f.tick(0);f.tick(32);assert.equal(f.playback.isActive(),true);
});
