import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
const segment = (id, bars=2,kind='main') => ({id,kind,totalBars:bars,matrix:{drums:Array.from({length:bars},()=>Array(16).fill(null))}});
function fixture() {
  const notices=[]; let options,absolute=0;
  const audio={stop(){},stopAllVoices(){},resetPerformanceEffects(){},setTempo(){},getAbsolutePlaybackStep:()=>absolute,
    async play(o){options=o;return true;}};
  const controller=createSessionPlayback(audio,n=>notices.push(n));
  return {controller,notices,audio,tick(step){absolute=step;const value=options.playbackSource(step,step*.15);value.onAudible?.();return value;},async ready(){await new Promise(r=>setImmediate(r));}};
}
test('launch queues to next bar, starts at local zero and a duplicate pending request cancels',async()=>{
  const f=fixture();f.controller.launch(segment('a'),100);await f.ready();f.tick(0);f.tick(5);
  f.controller.launch(segment('b'),100);assert.equal(f.notices.at(-1).pendingId,'b');
  f.controller.launch(segment('b'),100);assert.equal(f.notices.at(-1).pendingId,null);
  f.controller.launch(segment('b'),100);assert.equal(f.tick(15).stepOffset,0);
  assert.equal(f.tick(16).stepOffset,16);assert.equal(f.notices.at(-1).playingId,'b');assert.equal(f.controller.getProgress().fraction,0);
});
test('one-shot transition releases boundary voices and returns to the previous main from bar one',async()=>{
  const f=fixture();f.controller.launch(segment('a',4),100);await f.ready();f.tick(0);f.tick(5);
  f.controller.launch(segment('fill',1,'transition'),100);
  assert.equal(f.tick(16).releaseVoices,true);assert.equal(f.notices.at(-1).playingId,'fill');
  f.tick(31);assert.equal(f.tick(32).stepOffset,32);assert.equal(f.notices.at(-1).playingId,'a');
});
test('standalone transition ends, and selecting a main during a transition supersedes its return',async()=>{
  const f=fixture();f.controller.launch(segment('fill',1,'transition'),100);await f.ready();f.tick(0);assert.equal(f.tick(16).done,true);assert.equal(f.controller.isActive(),false);
  f.controller.launch(segment('a'),100);await f.ready();f.tick(0);f.tick(1);f.controller.launch(segment('fill',2,'transition'),100);f.tick(16);f.tick(17);f.controller.launch(segment('b'),100);f.tick(32);f.tick(64);assert.equal(f.notices.at(-1).playingId,'b');
});
