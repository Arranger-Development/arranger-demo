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

test('single source startup cancellation rejects obsolete audible callbacks', async () => {
  const f=fixture(); f.controller.launch(segment('a'),100); await f.ready(); const old=f.tick(0);
  f.controller.stop(); old.onAudible(); assert.equal(f.notices.at(-1).mode,'stopped');
  f.controller.launch(segment('b'),110); await f.ready(); f.tick(0); assert.equal(f.notices.at(-1).playingId,'b');
});

test('transition plays once and returns to the original main at its start',async()=>{
 const f=fixture();f.controller.launch(segment('a',4),100);await f.ready();f.tick(0);f.tick(5);
 f.controller.launch(segment('fill',1,'transition'),100);assert.equal(f.tick(5).releaseVoices,true);
 assert.equal(f.tick(21).stepOffset,21);assert.equal(f.notices.at(-1).playingId,'a');
 f.controller.stop();f.controller.launch(segment('only',1,'transition'),100);await f.ready();f.tick(0);assert.equal(f.tick(16).done,true);
});
