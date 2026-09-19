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
