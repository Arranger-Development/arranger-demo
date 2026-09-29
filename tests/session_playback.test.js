import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { jamPhraseProgress } from '../src/app/liveCellProgress.js';
const segment = (id, bars=2,kind='main') => ({id,kind,totalBars:bars,matrix:{drums:Array.from({length:bars},()=>Array(16).fill(null))}});
test('saved loop selection auditions its draft, cancels pending selection and toggles the playing loop off', async () => {
  const f = fixture(); const options = { returnAfterTransition: false };
  const draft = { ...segment('loop-a', 4), phraseIds: { drums: 'unsaved-beat' }, phraseBars: { drums: 4 } };
  f.controller.launch(draft, 120, options); await f.ready();
  f.tick(5); f.tick(64);
  assert.equal(f.notices.at(-1).cycle, 2);
  assert.deepEqual(f.controller.getProgress().snapshot, draft);
  f.controller.launch(segment('loop-b'), 120, options);
  assert.equal(f.notices.at(-1).pendingId, 'loop-b');
  f.controller.launch(segment('loop-b'), 120, options);
  assert.equal(f.notices.at(-1).pendingId, null);
  f.controller.launch(segment('loop-b'), 120, options);
  assert.equal(f.tick(79).totalBars, 4);
  f.tick(80);
  assert.equal(f.notices.at(-1).playingId, 'loop-b');
  assert.equal(f.controller.getProgress().fraction, 0);
  f.controller.launch(draft, 120, options);
  f.controller.launch(segment('loop-b'), 120, options);
  assert.equal(f.controller.isActive(), false, 'clicking the playing loop stops even with another loop queued');
  assert.equal(f.notices.at(-1).pendingId, null);
  assert.equal(f.controller.getProgress(), null);
});

test('selected transition loop ends once without returning to the preceding loop', async () => {
  const f = fixture(); const options = { returnAfterTransition: false };
  f.controller.launch(segment('main'), 100, options); await f.ready(); f.tick(3);
  f.controller.launch(segment('fill', 1, 'transition'), 100, options);
  assert.equal(f.tick(16).releaseVoices, true);
  assert.equal(f.notices.at(-1).playingId, 'fill');
  assert.equal(f.tick(32).done, true);
  assert.equal(f.controller.isActive(), false);
  assert.equal(f.controller.getProgress(), null);
});

test('loop clicks during preparation cancel or replace targets without stale playback', async () => {
  const f = fixture(); const preparations = []; let plays = 0;
  const options = { returnAfterTransition: false };
  f.audio.preparePerformanceEffects = () => new Promise(resolve => preparations.push(resolve));
  const play = f.audio.play;
  f.audio.play = async o => { plays++; return play(o); };
  f.controller.launch(segment('a'), 100, options);
  assert.equal(f.notices.at(-1).loading, true);
  f.controller.launch(segment('a'), 100, options);
  preparations.shift()(); await f.ready();
  assert.equal(plays, 0);
  f.controller.launch(segment('a'), 100, options);
  f.controller.launch(segment('b'), 100, options);
  f.controller.launch(segment('b'), 100, options);
  assert.equal(f.notices.at(-1).pendingId, null);
  f.controller.launch(segment('c'), 100, options);
  preparations.shift()(); await f.ready(); f.tick(0);
  assert.equal(plays, 1);
  assert.equal(f.notices.at(-1).playingId, 'c');
  const old = f.tick(1);
  f.controller.launch(segment('c'), 100, options);
  old.onAudible();
  assert.equal(f.notices.at(-1).mode, 'stopped');
});

test('combination editing quantizes full transition mixtures and stops instead of returning to the old main', async () => {
  const f = fixture(); const options = { edit: true, returnAfterTransition: false };
  f.controller.launch(segment('draft'), 100, options); await f.ready(); f.tick(3);
  f.controller.launch(segment('draft', 1, 'transition'), 100, options);
  assert.equal(f.tick(15).totalBars, 2);
  assert.equal(f.tick(16).totalBars, 1); assert.equal(f.tick(17).stepOffset, 16);
  assert.equal(f.tick(32).done, true); assert.equal(f.controller.isActive(), false);
});
function fixture() {
  const notices=[]; let options,absolute=0;
  const audio={stop(){},stopAllVoices(){},resetPerformanceEffects(){},setTempo(){},getAbsolutePlaybackStep:()=>absolute,
    async play(o){options=o;return true;}};
  const controller=createSessionPlayback(audio,n=>notices.push(n));
  return {controller,notices,audio,tick(step){absolute=step;const value=options.playbackSource(step,step*.15);value.onAudible?.();return value;},async ready(){await new Promise(r=>setImmediate(r));}};
}
test('Jam perimeter keeps audible identity through cancellation, one-shot fill and stop', async () => {
  const f = fixture();
  const main = { ...segment('main'), phraseIds: { drums: 'beat' }, phraseBars: { drums: 2 } };
  const fill = { ...segment('main:transition:drums:10', 1, 'transition'), phraseIds: { drums: 'fill' }, phraseBars: { drums: 1 } };
  f.controller.launch(main, 120); await f.ready(); f.tick(5);
  f.controller.launch(fill, 120);
  assert.equal(jamPhraseProgress(f.controller.getProgress(), 'drums', 'beat'), 5 / 32);
  assert.equal(jamPhraseProgress(f.controller.getProgress(), 'drums', 'fill'), 0);
  f.controller.launch(fill, 120); f.tick(16);
  assert.equal(jamPhraseProgress(f.controller.getProgress(), 'drums', 'beat'), .5);
  f.controller.launch(fill, 120); f.tick(32); f.tick(40);
  assert.equal(jamPhraseProgress(f.controller.getProgress(), 'drums', 'fill'), .5);
  assert.equal(jamPhraseProgress(f.controller.getProgress(), 'drums', 'beat'), 0);
  assert.equal(f.tick(48).done, true);
  assert.equal(jamPhraseProgress(f.controller.getProgress(), 'drums', 'beat'), 0);
  f.controller.stop();
  assert.equal(jamPhraseProgress(f.controller.getProgress(), 'drums', 'beat'), 0);
});
test('launch queues to next bar, starts at local zero and a duplicate pending request cancels',async()=>{
  const f=fixture();f.controller.launch(segment('a'),100);await f.ready();f.tick(0);f.tick(5);
  f.controller.launch(segment('b'),100);assert.equal(f.notices.at(-1).pendingId,'b');
  f.controller.launch(segment('b'),100);assert.equal(f.notices.at(-1).pendingId,null);
  f.controller.launch(segment('b'),100);assert.equal(f.tick(15).stepOffset,0);
  assert.equal(f.tick(16).stepOffset,16);assert.equal(f.notices.at(-1).playingId,'b');assert.equal(f.controller.getProgress().fraction,0);
});
test('one-shot transition releases boundary voices and stops without returning to the previous main',async()=>{
  const f=fixture();f.controller.launch(segment('a',4),100);await f.ready();f.tick(0);f.tick(5);
  f.controller.launch(segment('fill',1,'transition'),100);
  assert.equal(f.tick(16).releaseVoices,true);assert.equal(f.notices.at(-1).playingId,'fill');
  f.tick(31);assert.equal(f.tick(32).done,true);assert.equal(f.notices.at(-1).playingId,null);
});
test('standalone transition ends, and selecting a main during a transition supersedes its return',async()=>{
  const f=fixture();f.controller.launch(segment('fill',1,'transition'),100);await f.ready();f.tick(0);assert.equal(f.tick(16).done,true);assert.equal(f.controller.isActive(),false);
  f.controller.launch(segment('a'),100);await f.ready();f.tick(0);f.tick(1);f.controller.launch(segment('fill',2,'transition'),100);f.tick(16);f.tick(17);f.controller.launch(segment('b'),100);f.tick(32);f.tick(64);assert.equal(f.notices.at(-1).playingId,'b');
});
test('stop invalidates late startup and audible callbacks; edits update the same queued snapshot',async()=>{
  const f=fixture();f.controller.launch(segment('a'),100);await f.ready();const old=f.tick(0);f.tick(1);
  f.controller.launch(segment('a',4),100,{edit:true});f.controller.launch(segment('a',1),100,{edit:true});assert.equal(f.tick(16).totalBars,1);
  f.controller.stop();old.onAudible();assert.equal(f.notices.at(-1).mode,'stopped');
  let finish;let plays=0;const audio={...f.audio,preparePerformanceEffects:()=>new Promise(r=>finish=r),play:()=>{plays++;return true;}};
  const p=createSessionPlayback(audio);p.launch(segment('a'),100);p.stop();finish();await f.ready();assert.equal(plays,0);
});



test('sequence repeats finite loops and transitions, skips empty drafts and ends without returning',async()=>{
 const f=fixture();assert.equal(f.controller.sequence([null],100),false);
 const a={...segment('a',1),repeat:2},b={...segment('b',1,'transition'),repeat:2};
 f.controller.sequence([null,a,b],100);await f.ready();f.tick(0);f.tick(16);assert.equal(f.notices.at(-1).playingId,'a');f.tick(32);assert.equal(f.notices.at(-1).playingId,'b');f.tick(48);assert.equal(f.notices.at(-1).cycle,2);assert.equal(f.tick(64).done,true);
});
test('infinity holds, clicking a loop takes over at next bar and cancels when clicked again',async()=>{
 const f=fixture();f.controller.sequence([{...segment('a',1),repeat:null},{...segment('b',1),repeat:1}],100);await f.ready();f.tick(0);f.tick(64);
 const target={...segment('b',1),repeat:1};f.controller.launch(target,100);f.controller.launch(target,100);assert.equal(f.notices.at(-1).pendingId,null);
 f.controller.launch(target,100);assert.equal(f.tick(79).stepOffset,0);f.tick(80);assert.equal(f.notices.at(-1).mode,'jam');assert.equal(f.notices.at(-1).playingId,'b');assert.equal(f.tick(96).done,true);
});
test('clicking the current sequence loop switches to standalone instead of stopping or advancing',async()=>{
 const f=fixture();const a={...segment('a',1),repeat:1};f.controller.sequence([a,segment('b')],100);await f.ready();f.tick(3);f.controller.launch(a,100);f.tick(16);assert.equal(f.notices.at(-1).mode,'jam');assert.equal(f.notices.at(-1).playingId,'a');assert.equal(f.tick(32).done,true);
});
test('standalone finite repetition and sequence edits restart their cycle but retain the queue',async()=>{
 const f=fixture();f.controller.launch({...segment('a',1),repeat:2},100);await f.ready();f.tick(0);f.tick(16);assert.equal(f.tick(32).done,true);
 f.controller.sequence([{...segment('a',1),repeat:2},{...segment('b',1),repeat:1}],100);await f.ready();f.tick(17);
 f.controller.launch({...segment('a',1),repeat:2},100,{edit:true});f.tick(32);assert.equal(f.notices.at(-1).cycle,1);f.tick(48);f.tick(64);assert.equal(f.notices.at(-1).playingId,'b');
});
test('sequence snapshots are independent; stopping or starting a new sequence invalidates pending startup',async()=>{
 const f=fixture();const waits=[];f.audio.preparePerformanceEffects=()=>new Promise(r=>waits.push(r));
 const a=segment('a');f.controller.sequence([a],100);a.matrix.drums[0][0]={changed:true};f.controller.stop();waits.shift()();await f.ready();assert.equal(f.notices.at(-1).mode,'stopped');
 f.controller.sequence([a],100);f.controller.sequence([segment('b')],120);waits.splice(0).forEach(r=>r());await f.ready();f.tick(0);assert.equal(f.notices.at(-1).playingId,'b');
 f.controller.launch(null,120);assert.equal(f.controller.isActive(),false);
});
