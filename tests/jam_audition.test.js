import test from 'node:test';
import assert from 'node:assert/strict';
import { createJamAudition } from '../src/app/jamAudition.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { jamCombinationSnapshot } from '../src/app/jamTemplateProjects.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { getDialDrumPreset } from '../src/data/dialDrumPresets.js';

const ready = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const drums={id:'d',trackId:'drums',timbreId:'soft-electronic-kit',bars:structuredClone(getDialDrumPreset(100,100).bars)};
  const bass={id:'b',trackId:'bass',timbreId:'round-electric-bass',bars:[Array.from({length:16},(_,i) => i===0 ? {type:'bass',note:'C2'} : null)]};
  const w={bpm:100,templates:{drums:[drums],bass:[bass],chord:[],melody:[]},selection:{drums:'d',bass:'b',chord:null,melody:null}};
  let options, plays=0, stopped=0, solo=false;
  const audio={async play(value){plays++;options=value;return true;}, stop(){stopped++;},stopAllVoices(){},resetPerformanceEffects(){},setTempo(){}};
  const playback=createSessionPlayback(audio);
  const audition=createJamAudition(playback,{readWorkspace:()=>w,readDraft:()=>drums,onSoloChange:value=>{solo=value;}});
  return {audition,playback,audio,w,drums,get plays(){return plays;},get stopped(){return stopped;},get solo(){return solo;},
    events(step){const source=options.playbackSource(step,step*.15);source.onAudible?.();return createMatrixPlaybackAdapter(source,{totalBars:source.totalBars}).getEventsForStep(0,step%16);}};
}
test('Solo starts a stopped transport and schedules only the draft drum hits, including substep rolls',async()=>{
  const f=fixture(); f.audition.toggle(f.drums); await ready();
  assert.equal(f.plays,1); assert.equal(f.playback.isActive(),true); assert.equal(f.solo,true);
  const hits=Array.from({length:16},(_,step)=>f.events(step)).flat();
  assert.equal(hits.length,29); assert.ok(hits.every(hit=>hit.trackId==='drums'));
  assert.ok(hits.some(hit=>hit.timingOffset===.5));
  f.audition.toggle(f.drums); assert.equal(f.playback.isActive(),false); assert.equal(f.solo,false);
});
test('Solo resumes the running combination without restarting its transport',async()=>{
  const f=fixture(); f.playback.launch(jamCombinationSnapshot(f.w),100); await ready(); f.events(0);
  assert.ok(f.events(0).some(event=>event.trackId==='bass'));
  f.audition.toggle(f.drums); assert.ok(f.events(1).every(event=>event.trackId==='drums'));
  f.audition.toggle(f.drums); f.events(2);
  assert.equal(f.plays,1); assert.equal(f.playback.isActive(),true);
  assert.ok(f.events(16).some(event=>event.trackId==='bass'));
});
test('cancelling solo while the sound bank is preparing cannot start stale audio',async()=>{
  const f=fixture(); let finish;
  f.audio.preparePerformanceEffects=()=>new Promise(resolve=>{finish=resolve;});
  f.audition.toggle(f.drums); f.audition.toggle(f.drums); finish(); await ready();
  assert.equal(f.plays,0); assert.equal(f.playback.isActive(),false); assert.equal(f.solo,false);
});
