import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleJamTemplate } from '../src/app/jamTemplateSelection.js';
import { createJamTemplateProjects } from '../src/app/jamTemplateProjects.js';
import { createJamAudition } from '../src/app/jamAudition.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { getDialDrumPreset } from '../src/data/dialDrumPresets.js';

const ready = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const data=new Map(), storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const store=createJamTemplateProjects(storage,'pop',null,100);
  const drums=store.saveTemplate({trackId:'drums',timbreId:'soft-electronic-kit',bars:structuredClone(getDialDrumPreset(100,100).bars)},'鼓1');
  const second=store.saveTemplate({...drums,bars:structuredClone(getDialDrumPreset(0,0).bars)},'鼓2');
  const bass=store.saveTemplate({trackId:'bass',timbreId:'round-electric-bass',bars:[Array.from({length:16},(_,i)=>i===0 ? {type:'bass',note:'C2'} : null)]},'贝斯1');
  let options, plays=0;
  const audio={async play(value){options=value;plays++;return true;},stop(){},stopAllVoices(){},setTempo(){},resetPerformanceEffects(){}};
  const playback=createSessionPlayback(audio);
  const audition=createJamAudition(playback,{readWorkspace:()=>store.current().workspace,readDraft:()=>store.current().workspace.draft});
  return {store,audio,playback,audition,drums,second,bass,get plays(){return plays;},
    toggle(template,draft=null){toggleJamTemplate({projectStore:store,playback,audition,trackId:template.trackId,templateId:template.id,draft});},
    tick(step){const source=options.playbackSource(step,step*.15);source.onAudible?.();return source;},
    events(source,step){return createMatrixPlaybackAdapter(source,{totalBars:source.totalBars}).getEventsForStep(0,step%16);},
  };
}

test('selecting starts audition; repeating the selection clears the last track and stops',async()=>{
  const f=fixture(); f.toggle(f.drums); await ready(); f.tick(0);
  assert.equal(f.store.current().workspace.selection.drums,f.drums.id);
  assert.equal(f.plays,1); assert.equal(f.playback.isActive(),true);
  f.toggle(f.drums);
  assert.equal(f.store.current().workspace.selection.drums,null);
  assert.equal(f.playback.isActive(),false);
});
test('cancelling one track applies on the next step and keeps the other track and musical phase',async()=>{
  const f=fixture(); f.store.patch({selection:{drums:null,bass:f.bass.id,chord:null,melody:null}});
  f.toggle(f.drums); await ready(); f.tick(0); f.tick(3);
  f.toggle(f.drums); const next=f.tick(4);
  assert.equal(next.stepOffset,0); assert.equal(f.plays,1);
  assert.ok(f.events(next,4).every(event=>event.trackId!=='drums'));
  assert.ok(f.events(f.tick(16),16).some(event=>event.trackId==='bass'));
  assert.equal(f.store.current().workspace.selection.bass,f.bass.id);
  assert.equal(f.playback.isActive(),true);
});
test('cancelling a paused selection never starts the other selected tracks or changes their mix',()=>{
  const f=fixture(); f.store.patch({selection:{drums:f.drums.id,bass:f.bass.id,chord:null,melody:null},mutedTracks:{drums:true,bass:false,chord:false,melody:false}});
  f.toggle(f.drums);
  assert.equal(f.store.current().workspace.selection.drums,null);
  assert.equal(f.store.current().workspace.mutedTracks.drums,true);
  assert.equal(f.playback.isActive(),false); assert.equal(f.plays,0);
});
test('cancelling the final audible track stops even when another selected track is muted',async()=>{
  const f=fixture(); f.store.patch({selection:{drums:null,bass:f.bass.id,chord:null,melody:null},mutedTracks:{drums:false,bass:true,chord:false,melody:false}});
  f.toggle(f.drums); await ready(); f.tick(0); f.toggle(f.drums);
  assert.equal(f.store.current().workspace.selection.bass,f.bass.id);
  assert.equal(f.store.current().workspace.mutedTracks.bass,true);
  assert.equal(f.playback.isActive(),false);
});
test('rapidly cancelling the last selection while sounds prepare invalidates the pending audio start',async()=>{
  const f=fixture(); let finish;
  f.audio.preparePerformanceEffects=()=>new Promise(resolve=>{finish=resolve;});
  f.toggle(f.drums); f.toggle(f.drums); finish(); await ready();
  assert.equal(f.store.current().workspace.selection.drums,null);
  assert.equal(f.plays,0); assert.equal(f.playback.isActive(),false);
});
test('cancelling during loading preserves the other selected track at its first audible step',async()=>{
  const f=fixture(); let finish;
  f.store.patch({selection:{drums:null,bass:f.bass.id,chord:null,melody:null}});
  f.audio.preparePerformanceEffects=()=>new Promise(resolve=>{finish=resolve;});
  f.toggle(f.drums); f.toggle(f.drums); finish(); await ready();
  const events=f.events(f.tick(0),0);
  assert.ok(events.some(event=>event.trackId==='bass'));
  assert.ok(events.every(event=>event.trackId!=='drums'));
});
test('switching templates replaces the same-track selection and cancelling a queued switch removes that track',async()=>{
  const f=fixture(); f.store.patch({selection:{drums:null,bass:f.bass.id,chord:null,melody:null}});
  f.toggle(f.drums); await ready(); f.tick(0); f.tick(3);
  f.toggle(f.second);
  assert.equal(f.store.current().workspace.selection.drums,f.second.id);
  f.toggle(f.second);
  assert.equal(f.store.current().workspace.selection.drums,null);
  assert.ok(f.events(f.tick(4),4).every(event=>event.trackId!=='drums'));
  assert.equal(f.plays,1);
});
test('retained editor drafts cannot resurrect a cancelled track when another template is selected',async()=>{
  const f=fixture(); f.store.setDraft({...f.drums,dirty:true});
  f.toggle(f.drums); await ready(); f.tick(0);
  f.toggle(f.drums,f.drums);
  assert.equal(f.playback.isActive(),false);
  assert.equal(f.store.current().workspace.draft.dirty,true);
  f.toggle(f.bass,f.drums); await ready();
  const events=f.events(f.tick(0),0);
  assert.ok(events.some(event=>event.trackId==='bass'));
  assert.ok(events.every(event=>event.trackId!=='drums'));
});
