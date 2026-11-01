import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { createMatrixPlaybackAdapter } from '../src/audio/matrixPlaybackAdapter.js';
import { jamPhraseProgress } from '../src/app/liveCellProgress.js';

const ready = () => new Promise(resolve => setImmediate(resolve));
function phrase(track, id, bars = 1) {
  return { id: 'jam-current-combination', repeat: null, kind: 'main', totalBars: bars,
    phraseIds: { [track]: id }, phraseBars: { [track]: bars },
    matrix: { [track]: Array.from({ length: bars }, (_, bar) => Array.from({ length: 16 }, (_, step) => (
      track === 'drums' ? { instruments: ['kick'], marker: `${bar}:${step}` }
        : track === 'bass' ? { type: 'bass', note: ['C2','D2','E2','F2'][bar % 4] }
          : { type: 'notes', notes: [['C4','E4'],['D4','F4'],['E4','G4']][bar % 3], durationSteps: 8 }
    ))) } };
}
function fixture() {
  let options, absolute = 0, plays = 0;
  const notices = [];
  const audio = { stop() {}, stopAllVoices() {}, setTempo() {}, getAbsolutePlaybackStep: () => absolute,
    async play(value) { options = value; plays++; return true; } };
  const playback = createSessionPlayback(audio, value => notices.push(value));
  const read = step => { absolute = step; return options.playbackSource(step, step * .15); };
  return { playback, audio, notices, read, get plays() { return plays; },
    tick(step) { const source = read(step); source.onAudible?.(); return source; },
    get state() { return notices.at(-1); },
    events(source, step) { return createMatrixPlaybackAdapter(source, { totalBars: source.totalBars }).getEventsForFlatStep(step); },
    toggle(track, id, bars) { playback.toggleTrack(phrase(track, id, bars), track, 100); } };
}

test('drum → add bass → add chord → pause bass preserves the other two track origins', async () => {
  const f = fixture(); f.toggle('drums','d',4); await ready(); f.tick(0); f.tick(5);
  f.toggle('bass','b',2); const bass = f.read(16);
  assert.equal(f.state.playingPhraseIds.bass,null); assert.equal(f.state.queuedPhraseIds.bass,'b');
  bass.onAudible(); assert.equal(f.state.playingPhraseIds.bass,'b');
  assert.deepEqual(bass.releaseTrackIds,[],'adding a track releases no existing voices');
  f.tick(20); f.toggle('chord','c',3); const chord = f.tick(32);
  assert.deepEqual(chord.trackStepOffsets,{drums:0,chord:32,bass:16,melody:0});
  assert.equal(f.playback.getProgress().trackPositions.drums.localStep,32);
  f.tick(35); f.toggle('bass','b');
  assert.equal(f.state.playingPhraseIds.bass,'b','a pause is not audible at click time');
  const stopped = f.tick(36);
  assert.deepEqual(stopped.releaseTrackIds,['bass']);
  assert.deepEqual(f.state.playingPhraseIds,{drums:'d',chord:'c',bass:null,melody:null});
  assert.equal(f.state.trackPositions.drums.localStep,36); assert.equal(f.state.trackPositions.chord.localStep,4);
  assert.equal(f.plays,1);
});

test('independent unequal loops wrap at their own starts across the common adapter length', async () => {
  const f = fixture(); f.toggle('bass','b',4); await ready(); f.tick(0); f.tick(5);
  f.toggle('chord','c',3); f.tick(16);
  const at48 = f.tick(48);
  assert.equal(f.events(at48,48).find(e => e.trackId === 'bass').note,'F2');
  assert.deepEqual(f.events(at48,48).find(e => e.trackId === 'chord').notes,['E4','G4']);
  const at64 = f.tick(64);
  assert.equal(f.events(at64,64).find(e => e.trackId === 'bass').note,'C2');
  assert.deepEqual(f.events(at64,64).find(e => e.trackId === 'chord').notes,['C4','E4']);
  assert.equal(jamPhraseProgress(f.playback.getProgress(),'chord','c'),0);
  assert.deepEqual(at64.releaseTrackIds,[],'normal wrapping must not truncate sample tails');
});

test('same-track replacement and a paused phrase restart from zero without restarting other tracks', async () => {
  const f = fixture(); f.toggle('bass','b',4); await ready(); f.tick(0); f.tick(5);
  f.toggle('chord','c',3); f.tick(16); f.tick(18); f.toggle('bass','b2',2);
  const replacement = f.tick(32);
  assert.equal(replacement.trackStepOffsets.bass,32); assert.equal(replacement.trackStepOffsets.chord,16);
  assert.deepEqual(replacement.releaseTrackIds,['bass']);
  f.tick(35); f.toggle('bass','b2'); f.tick(36); f.tick(40); f.toggle('bass','b2',2);
  const restarted = f.tick(48);
  assert.equal(restarted.trackStepOffsets.bass,48); assert.equal(restarted.trackStepOffsets.chord,16);
  assert.equal(f.state.trackPositions.bass.localStep,0); assert.equal(f.state.trackPositions.chord.localStep,32);
});

test('pausing the current phrase keeps another phrase on that same track queued and the silent clock alive', async () => {
  const f = fixture(); f.toggle('bass','a'); await ready(); f.tick(0); f.tick(5);
  f.toggle('bass','b'); f.toggle('bass','a');
  const silence = f.tick(6);
  assert.equal(silence.done,undefined); assert.equal(f.playback.isActive(),true);
  assert.equal(f.state.playingPhraseIds.bass,null); assert.equal(f.state.queuedPhraseIds.bass,'b');
  f.tick(16); assert.equal(f.state.playingPhraseIds.bass,'b');
});

test('different-track queues survive pauses, replacements and cancellation of another track', async () => {
  const f = fixture(); f.toggle('bass','a'); await ready(); f.tick(0); f.tick(5);
  f.toggle('chord','c'); f.toggle('bass','b'); f.toggle('bass','b'); f.toggle('bass','a');
  f.tick(6); assert.equal(f.state.queuedPhraseIds.chord,'c'); assert.equal(f.playback.isActive(),true);
  f.tick(16); assert.equal(f.state.playingPhraseIds.chord,'c'); assert.equal(f.state.playingPhraseIds.bass,null);
});

test('rapid pause and restart schedules a fresh start after the pause boundary', async () => {
  const f = fixture(); f.toggle('bass','a'); await ready(); f.tick(0); f.tick(5);
  f.toggle('bass','a'); f.toggle('bass','a');
  f.tick(6); assert.equal(f.state.playingPhraseIds.bass,null);
  f.tick(16); assert.equal(f.state.trackPositions.bass.localStep,0);
});

test('lookahead callbacks cannot clear a newer request, and older callbacks cannot resurrect a paused track', async () => {
  const f = fixture(); f.toggle('bass','a'); await ready(); f.tick(0); f.tick(5);
  f.toggle('bass','b'); const prepared = f.read(16);
  f.toggle('bass','c'); prepared.onAudible();
  assert.equal(f.state.playingPhraseIds.bass,'b'); assert.equal(f.state.queuedPhraseIds.bass,'c');
  f.tick(32); assert.equal(f.state.playingPhraseIds.bass,'c');
  prepared.onAudible(); assert.equal(f.state.playingPhraseIds.bass,'c');
  f.toggle('bass','c'); const stop = f.read(33); stop.onAudible();
  prepared.onAudible(); assert.equal(f.state.mode,'stopped');
});

test('cancelling a launch already read by lookahead ignores its callback and restores the old origin', async () => {
  const f = fixture(); f.toggle('bass','a',4); await ready(); f.tick(0); f.tick(5);
  f.toggle('bass','b'); const prepared = f.read(16); f.toggle('bass','b'); prepared.onAudible();
  assert.equal(f.state.playingPhraseIds.bass,'a');
  const restored = f.tick(17);
  assert.equal(restored.trackStepOffsets.bass,0); assert.equal(f.state.playingPhraseIds.bass,'a');
  assert.equal(f.state.queuedPhraseIds,null);
});

test('one column request synchronizes all origins, but later single actions override only their own track', async () => {
  const f = fixture(); f.toggle('bass','a',4); await ready(); f.tick(0); f.tick(5);
  const b=phrase('bass','b',2), c=phrase('chord','c',3);
  f.playback.launch({...b,phraseIds:{...b.phraseIds,...c.phraseIds},phraseBars:{bass:2,chord:3},matrix:{...b.matrix,...c.matrix}},100,{edit:true});
  f.toggle('chord','other',2);
  const at16=f.tick(16);
  assert.equal(f.state.playingPhraseIds.bass,'b');assert.equal(f.state.playingPhraseIds.chord,'other');
  assert.equal(at16.trackStepOffsets.bass,16);assert.equal(at16.trackStepOffsets.chord,16);
});

test('failure and stop clear all track requests and invalidate old callbacks', async () => {
  const f=fixture(); f.audio.play=async()=>{throw new Error('sample failed');};
  f.toggle('bass','a');f.toggle('chord','c');await ready();
  assert.equal(f.state.error,'sample failed');assert.equal(f.state.mode,'stopped');assert.equal(f.state.queuedPhraseIds,null);
  assert.deepEqual(f.state.playingPhraseIds,{});
  const g=fixture();g.toggle('bass','a');await ready();const old=g.read(0);g.playback.stop();old.onAudible();
  assert.equal(g.state.mode,'stopped');assert.deepEqual(g.state.playingPhraseIds,{});
});

test('a new launch between the prepared final stop and its callback cannot be lost', async () => {
  const f=fixture();f.toggle('bass','a');await ready();f.tick(0);f.toggle('bass','a');
  const ending=f.read(1);assert.equal(ending.done,true);
  f.toggle('chord','c');await ready();ending.onAudible();
  assert.equal(f.playback.isActive(),true);f.tick(0);
  assert.equal(f.state.playingPhraseIds.chord,'c');assert.equal(f.plays,2);
});

test('editing a selected phrase keeps unrelated track tails and both playback origins intact', async () => {
  const f=fixture();f.toggle('bass','a',4);await ready();f.tick(0);f.tick(5);f.toggle('chord','c',3);f.tick(16);f.tick(20);
  const a=phrase('bass','a',4), c=phrase('chord','c',3);
  a.matrix.bass[0][0].note='G2';
  f.playback.launch({...a,phraseIds:{...a.phraseIds,...c.phraseIds},phraseBars:{bass:4,chord:3},matrix:{...a.matrix,...c.matrix}},100,{edit:true,quantize:'step',preservePhase:true});
  const edited=f.tick(21);
  assert.deepEqual(edited.releaseTrackIds,['bass']);assert.equal(edited.trackStepOffsets.bass,0);assert.equal(edited.trackStepOffsets.chord,16);
});

test('audition holds underlying starts and pending launches, then restores their elapsed progress', async () => {
  const f=fixture();f.toggle('bass','a',4);await ready();f.tick(0);f.tick(5);f.toggle('chord','c',3);
  f.playback.audition(phrase('drums','draft',1),100);f.tick(6);f.tick(16);
  assert.equal(f.state.playingPhraseIds.bass,null);assert.equal(f.state.queuedPhraseIds.chord,'c');
  f.playback.resumeJam();f.tick(17);
  assert.equal(f.state.trackPositions.bass.localStep,17);assert.equal(f.state.trackPositions.chord.localStep,1);
  assert.equal(f.state.queuedPhraseIds,null);
});

test('auto-retained phrase edits replace only that track at the next step and preserve other queued boundaries',async()=>{
  const f=fixture();f.toggle('bass','a',4);await ready();f.tick(0);f.tick(5);f.toggle('chord','c',3);
  const next=phrase('bass','a',4);next.matrix.bass.forEach(bar=>bar.forEach(cell=>{cell.note='G2';}));
  f.playback.updatePhrase(next,'bass','a');const at6=f.tick(6);
  assert.equal(f.events(at6,6).find(e=>e.trackId==='bass').note,'G2');
  assert.deepEqual(at6.releaseTrackIds,['bass']);assert.equal(f.state.trackPositions.bass.startStep,0);
  assert.equal(f.state.queuedPhraseIds.chord,'c');f.tick(16);
  assert.equal(f.state.trackPositions.chord.startStep,16);assert.equal(f.state.trackPositions.bass.startStep,0);assert.equal(f.plays,1);
});

test('editing a queued ID keeps its original bar boundary and rejects callbacks from a previously prepared version',async()=>{
  const f=fixture();f.toggle('bass','a',4);await ready();f.tick(0);f.tick(5);f.toggle('bass','b',2);
  const prepared=f.read(16),next=phrase('bass','b',2);next.matrix.bass.forEach(bar=>bar.forEach(cell=>{cell.note='A2';}));
  f.playback.updatePhrase(next,'bass','b');prepared.onAudible();
  assert.equal(f.state.playingPhraseIds.bass,'a');assert.equal(f.state.queuedPhraseIds.bass,'b');
  const current=f.tick(17);assert.equal(f.events(current,17)[0].note,'A2');
  assert.equal(f.state.trackPositions.bass.startStep,16);assert.equal(f.state.trackPositions.bass.localStep,1);
  assert.equal(f.state.queuedPhraseIds,null);prepared.onAudible();assert.equal(f.state.trackPositions.bass.localStep,1);
});

test('a queued edit before its boundary is audible on that same boundary; cancellation restores the old phrase',async()=>{
  const f=fixture();f.toggle('bass','a');await ready();f.tick(0);f.tick(5);f.toggle('bass','b');
  const next=phrase('bass','b');next.matrix.bass[0].forEach(cell=>{cell.note='F#2';});
  f.playback.updatePhrase(next,'bass','b');const boundary=f.tick(16);
  assert.equal(f.events(boundary,16)[0].note,'F#2');assert.equal(f.state.trackPositions.bass.localStep,0);
  const g=fixture();g.toggle('bass','a');await ready();g.tick(0);g.tick(5);g.toggle('bass','b');g.read(16);
  g.playback.updatePhrase(next,'bass','b');g.toggle('bass','b');g.tick(17);
  assert.equal(g.state.playingPhraseIds.bass,'a');assert.equal(g.state.trackPositions.bass.startStep,0);assert.equal(g.state.queuedPhraseIds,null);
});

test('retained edits beneath editor solo are heard on resume; a new phrase ID never joins the old mix',async()=>{
  const f=fixture();f.toggle('bass','a',4);await ready();f.tick(0);f.tick(5);
  f.playback.audition(phrase('chord','editor',1),100);f.tick(6);
  const next=phrase('bass','a',4);next.matrix.bass.forEach(bar=>bar.forEach(cell=>{cell.note='B2';}));
  f.playback.updatePhrase(next,'bass','a');const hidden=f.tick(7);assert.deepEqual(hidden.releaseTrackIds,[]);
  f.playback.updatePhrase(phrase('melody','new',1),'melody','new');f.playback.resumeJam();const resumed=f.tick(8);
  assert.equal(f.events(resumed,8)[0].note,'B2');assert.equal(f.state.trackPositions.bass.startStep,0);
  assert.equal(f.state.playingPhraseIds.melody,null);assert.equal(f.plays,1);
});

test('clearing a retained block stops its sound and undo can restore its origin while editing',async()=>{
  const f=fixture();f.toggle('bass','a',4);await ready();f.tick(0);f.tick(5);
  f.playback.audition(phrase('chord','editor',1),100);f.tick(6);
  const empty=phrase('bass','a',4);empty.matrix.bass=empty.matrix.bass.map(()=>Array(16).fill(null));empty.phraseIds.bass=null;
  f.playback.updatePhrase(empty,'bass','a');f.tick(7);
  const restored=phrase('bass','a',4);f.playback.updatePhrase(restored,'bass','a');f.tick(8);
  f.playback.resumeJam();f.tick(9);assert.equal(f.state.trackPositions.bass.startStep,0);assert.equal(f.state.playingPhraseIds.bass,'a');
  f.playback.updatePhrase(empty,'bass','a');assert.equal(f.tick(10).done,true);assert.equal(f.state.mode,'stopped');
  f.playback.updatePhrase(restored,'bass','a');assert.equal(f.playback.isActive(),false,'editing a stopped phrase cannot start it');
});

test('cancelling an already prepared replacement restores the latest auto-retained version of its audible predecessor',async()=>{
  const f=fixture();f.toggle('bass','a',4);await ready();f.tick(0);f.tick(5);f.toggle('bass','b',2);const prepared=f.read(16);
  const next=phrase('bass','a',4);next.matrix.bass.forEach(bar=>bar.forEach(cell=>{cell.note='G#2';}));
  f.playback.updatePhrase(next,'bass','a');f.toggle('bass','b');const restored=f.tick(17);
  assert.equal(f.events(restored,17)[0].note,'G#2');assert.equal(f.state.trackPositions.bass.startStep,0);
  assert.equal(f.state.playingPhraseIds.bass,'a');prepared.onAudible();assert.equal(f.state.playingPhraseIds.bass,'a');
});
