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
test('Live skips empty columns, repeats exactly, exits infinity manually and stops at the end',async()=>{
  const f=fixture();const columns=[{id:'empty',snapshot:null,repeat:null},{id:'a',snapshot:segment('a',1),repeat:2},{id:'b',snapshot:segment('b',1,'transition'),repeat:null},{id:'c',snapshot:segment('c',1),repeat:1}];
  f.controller.live(columns,100);await f.ready();f.tick(0);f.tick(16);assert.equal(f.notices.at(-1).playingId,'a');f.tick(32);assert.equal(f.notices.at(-1).playingId,'b');f.tick(48);f.tick(64);assert.equal(f.notices.at(-1).playingId,'b');
  f.controller.live(columns,100,'c');await f.ready();f.tick(0);assert.equal(f.notices.at(-1).playingId,'c');assert.equal(f.tick(16).done,true);assert.equal(f.notices.at(-1).mode,'stopped');
});
test('stop invalidates late startup and audible callbacks; edits update the same queued snapshot',async()=>{
  const f=fixture();f.controller.launch(segment('a'),100);await f.ready();const old=f.tick(0);f.tick(1);
  f.controller.launch(segment('a',4),100,{edit:true});f.controller.launch(segment('a',1),100,{edit:true});assert.equal(f.tick(16).totalBars,1);
  f.controller.stop();old.onAudible();assert.equal(f.notices.at(-1).mode,'stopped');
  let finish;let plays=0;const audio={...f.audio,preparePerformanceEffects:()=>new Promise(r=>finish=r),play:()=>{plays++;return true;}};
  const p=createSessionPlayback(audio);p.launch(segment('a'),100);p.stop();finish();await f.ready();assert.equal(plays,0);
});


test('Live seeks immediately, restarts the current column, skips forwards from empties, and rewinds', async () => {
  const f = fixture();
  const columns = [{id:'a',snapshot:segment('a',1),repeat:null},{id:'empty',snapshot:null,repeat:1},{id:'b',snapshot:segment('b',1),repeat:2},{id:'end',snapshot:null,repeat:1}];
  f.controller.live(columns,100); await f.ready(); const old=f.tick(0); f.tick(6);
  assert.equal(f.controller.live(columns,100,'empty'),true); await f.ready(); old.onAudible();
  f.tick(0); assert.equal(f.notices.at(-1).playingId,'b'); assert.equal(f.notices.at(-1).pendingId,null);
  f.tick(16); f.tick(20); f.controller.live(columns,100,'b'); await f.ready(); f.tick(0);
  assert.deepEqual(f.controller.getLivePosition(),{id:'b',cycle:1,step:0});
  assert.equal(f.controller.live(columns,100,'end'),false);
  assert.equal(f.notices.at(-1).playingId,'b');
  f.controller.rewindLive(columns,100); await f.ready(); f.tick(0); assert.equal(f.notices.at(-1).playingId,'a');
  f.controller.stop(); f.controller.rewindLive(columns,100);
  assert.equal(f.notices.at(-1).mode,'stopped'); assert.deepEqual(f.controller.getLivePosition(),{id:'a',cycle:1,step:0});
});

test('Live cursor follows stable IDs through reorder, clamps replacements, and recovers deleted columns', () => {
  const f=fixture(); const a={id:'a',snapshot:segment('a'),repeat:3}; const b={id:'b',snapshot:segment('b'),repeat:1};
  f.controller.restoreLivePosition({id:'a',cycle:3,step:25},[a,b]);
  f.controller.syncLiveColumns([b,a]); assert.equal(f.controller.getLivePosition().id,'a');
  f.controller.syncLiveColumns([b,{...a,repeat:1,snapshot:segment('short',1)}]);
  assert.deepEqual(f.controller.getLivePosition(),{id:'a',cycle:1,step:15});
  f.controller.syncLiveColumns([b]); assert.deepEqual(f.controller.getLivePosition(),{id:'b',cycle:1,step:0});
  f.controller.syncLiveColumns([]); assert.equal(f.controller.getLivePosition(),null);
});

test('rapid Live seeks, pause during preparation and stale callbacks cannot restart old audio', async () => {
  const f=fixture(); const preparations=[]; let plays=0;
  f.audio.preparePerformanceEffects=()=>new Promise(r=>preparations.push(r));
  const original=f.audio.play; f.audio.play=async o=>{plays++;return original(o);};
  const columns=[{id:'a',snapshot:segment('a'),repeat:1},{id:'b',snapshot:segment('b'),repeat:1}];
  f.controller.live(columns,100,'a'); f.controller.live(columns,100,'b');
  preparations.splice(0).forEach(r=>r()); await f.ready(); assert.equal(plays,1);
  const stale=f.tick(0); f.controller.pauseLive(); stale.onAudible(); assert.equal(f.notices.at(-1).mode,'paused');
  f.controller.live(columns,100,'a'); f.controller.pauseLive(); preparations.shift()(); await f.ready();
  assert.equal(plays,1); assert.equal(f.notices.at(-1).mode,'paused');
});
