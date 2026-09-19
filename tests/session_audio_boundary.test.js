import test from 'node:test';
import assert from 'node:assert/strict';
import AudioEngine from '../src/audio/AudioEngine.js';
import {createDrumsCell} from '../src/domain/drumsCells.js';
import {createSessionPlayback} from '../src/app/sessionPlayback.js';
for (const mode of ['launch']) test(`real scheduler ${mode} switches before reading boundary notes, with local position zero and audible-time notification`,async()=>{
  let tick; const hits=[],draws=[]; let time=0;
  const Transport={bpm:{value:100},PPQ:192,position:'0:0:0',scheduleRepeat(fn){tick=fn;return 1;},clear(){},start(){},stop(){},getTicksAtTime:()=>time/.15*48};
  const tone={Transport,start:async()=>{},loaded:async()=>{},now:()=>time,getDraw:()=>({schedule(fn,at){draws.push({fn,at});}})};
  const engine=new AudioEngine({tone,now:()=>time,immediate:()=>time,samplerFactory:()=>({toDestination(){return this;},triggerAttack(){},triggerAttackRelease(){},releaseAll(){}}),playerFactory:(url,instrument)=>({toDestination(){return this;},start(at){hits.push({instrument,at});},stop(){}})});
  // Exercise actual event scheduling without needing a browser worklet in this unit test.
  engine.preparePerformanceEffects=async()=>{};
  const notices=[];const playback=createSessionPlayback(engine,n=>notices.push(n));
  const snap=(id,instrument)=>{const bar=Array(16).fill(null);bar[0]=createDrumsCell([instrument]);return {id,kind:'main',totalBars:2,matrix:{drums:[bar,Array(16).fill(null)]}};};
  playback[mode](snap('main','kick'),100);await new Promise(r=>setImmediate(r));
  for(let i=0;i<=4;i++){time=i*.15;tick(time);while(draws.length)draws.shift().fn();}
  playback[mode](snap('next','snare'),100);
  for(let i=5;i<16;i++){time=i*.15;tick(time);while(draws.length)draws.shift().fn();}
  time=2.4;tick(time);
  assert.equal(notices.at(-1).playingId,'main','lookahead must not advance visible progress');
  assert.deepEqual(hits.at(-1),{instrument:'snare',at:2.4});
  while(draws.length)draws.shift().fn();
  assert.equal(notices.at(-1).playingId,'next');assert.equal(engine.currentBar,0);assert.equal(engine.currentStep,0);
});
