import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEffectAutomation, mergeEffectTake, effectLaneEvents } from '../src/app/effectAutomation.js';
import { createJamEffects } from '../src/app/jamEffects.js';
import { createJamEffectAutomation } from '../src/app/jamEffectAutomation.js';
import { createSessionPlayback } from '../src/app/sessionPlayback.js';
import { createSession, createSessionEditor, readSession, writeSession, createExportEntry, createArrangementImport } from '../src/app/performanceSession.js';
import { performanceTemplates } from '../src/app/performanceModel.js';

const automationData = () => ({ version: 1, cycleSteps: 32, tracks: {
  drums: { volume: { initial: -3, points: [{ step: 3.25, value: -12 }] }, cutoff: { initial: 20000, points: [{ step: 6.5, value: 500 }] } },
  bass: { volume: { initial: -6, points: [{ step: 2, value: -9 }] } },
} });
const segment = (id = 'a', effectAutomation = automationData(), kind = 'main') => ({ id, kind, totalBars: 2, repeat: kind === 'main' ? null : 1, effectAutomation, matrix: { drums: Array.from({ length: 2 }, () => Array(16).fill(null)) } });
function fixture(snapshot = segment()) {
  let absolute = 0, time = 0, notifications = [], options;
  const scheduled = [], cancelled = [], completed = [];
  const audio = { immediate: () => time, getAbsolutePlaybackStep: () => absolute,
    setPerformanceEffect() {}, schedulePerformanceEffect(track, values, at) { scheduled.push({ track, values, time: at }); },
    cancelPerformanceEffect(track, parameter, at) { cancelled.push({ track, parameter, time: at }); },
    schedulePerformanceNotification(at, callback) { notifications.push({ at, callback }); },
    stop() {}, stopAllVoices() {}, resetPerformanceEffects() {}, setTempo() {},
    async play(o) { options = o; return true; },
  };
  const effects = createJamEffects(audio), auto = createJamEffectAutomation(audio, effects, (...args) => completed.push(args));
  const clock = step => { absolute = step; time = step / 8; const due = notifications.filter(n => n.at <= time); notifications = notifications.filter(n => n.at > time); due.forEach(n => n.callback()); };
  const schedule = step => {
    const position = { id: snapshot.id, snapshot, startStep: 0, cycle: Math.floor(step / 32) + 1, totalSteps: 32 };
    auto.schedule({ ...position, absoluteStep: step, time: step / 8, bpm: 120 });
    return () => auto.audible(position, step);
  };
  const tick = step => { clock(step); schedule(step)(); clock(step); };
  auto.start();
  return { audio, effects, auto, scheduled, cancelled, completed, clock, schedule, tick,
    source: step => options.playbackSource(step, step / 8), ready: () => new Promise(r => setImmediate(r)) };
}

test('optional automation validates lanes without corrupting old music; fractional timing survives', () => {
  assert.equal(normalizeEffectAutomation({ version: 7 }), undefined);
  const data = automationData(); data.tracks.drums.cutoff.points.push({ step: NaN, value: 300 }, { step: 1, value: -10 });
  data.tracks.melody = { repeat: { initial: 3, points: [] } };
  const result = normalizeEffectAutomation(data);
  assert.equal(result.tracks.drums.volume.points[0].step, 3.25);
  assert.equal(result.tracks.drums.cutoff.points.length, 1); assert.equal(result.tracks.melody, undefined);
});

test('one cycle records actual fractional steps and replaces only touched track/parameter lanes', () => {
  const f = fixture(), before = automationData(); f.auto.arm(segment(), 0); f.tick(0);
  assert.equal(f.auto.getSnapshot().phase, 'recording');
  f.clock(2.375); f.effects.volume('drums', -18);
  f.effects.select('melody'); f.clock(5.625); f.effects.cutoff('melody', 800);
  f.tick(32); assert.equal(f.auto.isRecording(), false); assert.equal(f.completed.length, 1);
  const data = f.completed[0][1];
  assert.deepEqual(data.tracks.drums.cutoff, before.tracks.drums.cutoff);
  assert.deepEqual(data.tracks.bass.volume, before.tracks.bass.volume);
  assert.deepEqual(data.tracks.drums.volume, { initial: -3, points: [{ step: 2.375, value: -18 }] });
  assert.equal(data.tracks.melody.cutoff.points[0].step, 5.625);
});

test('late touches inside the audio lookahead are captured before actual end and reschedule next-cycle baseline', () => {
  const f = fixture(); f.auto.arm(segment(), 0); f.tick(0); f.clock(31.5);
  const end = f.schedule(32); assert.equal(f.auto.isRecording(), true);
  f.clock(31.875); f.effects.volume('bass', -21);
  assert.ok(f.cancelled.some(c => c.track === 'bass' && c.parameter === 'volume' && c.time === 31.875 / 8));
  assert.ok(f.scheduled.some(c => c.track === 'bass' && c.time === 4 && c.values.volume === -6));
  f.clock(32); end(); assert.equal(f.completed[0][1].tracks.bass.volume.points[0].step, 31.875);
});

test('waiting and cancelled/no-op recording leave original automation untouched', () => {
  const f = fixture(); f.tick(0); f.auto.arm(segment(), 32);
  f.clock(3); f.effects.volume('drums', -10); assert.equal(f.auto.getSnapshot().phase, 'armed');
  f.tick(32); f.auto.cancelTake(); f.tick(64); assert.equal(f.completed.length, 0);
  f.auto.arm(segment(), 96); f.tick(96); f.tick(128); assert.equal(f.completed.length, 0);
});

test('manual volume suppresses only that lane for this cycle and automatically resumes next cycle', () => {
  const f = fixture(); f.tick(0); f.clock(1); f.effects.volume('drums', -20);
  f.scheduled.length = 0; f.tick(3); f.tick(6); f.tick(32);
  assert.ok(!f.scheduled.some(c => c.values.volume === -12));
  assert.ok(f.scheduled.some(c => c.track === 'drums' && c.values.cutoff === 500));
  assert.ok(f.scheduled.some(c => c.track === 'drums' && c.values.volume === -3));
  assert.equal(f.effects.getManual('drums').volume, -20);
  f.auto.stop(); assert.equal(f.effects.getSnapshot().volumes.drums, -20);
});

test('manual repeater ownership spans the seam; old release cannot stop latest owner; new cycle resumes after release', () => {
  const snapshot = segment(); snapshot.effectAutomation.tracks.drums.repeat = { initial: null, points: [{ step: 1, value: 8 }, { step: 7, value: null }] };
  const f = fixture(snapshot); f.tick(0); f.clock(1); f.effects.repeat.press('screen', 4, 120); f.effects.repeat.press('midi', 16, 120);
  f.effects.repeat.release('screen'); assert.equal(f.effects.repeat.getSnapshot(), 16);
  f.tick(32); f.scheduled.length = 0; f.tick(33);
  assert.ok(!f.scheduled.some(c => c.values.held));
  f.effects.repeat.release('midi'); f.tick(39); assert.equal(f.effects.repeat.getSnapshot(), null);
  f.tick(64); f.tick(65); assert.ok(f.scheduled.some(c => c.values.held && c.values.division === 8));
});

test('blur blocks future filter/repeat automation until an explicit restart; stop invalidates queued UI callbacks', () => {
  const f = fixture(); f.tick(0); f.auto.arm(segment(), 32); f.auto.suspend(); assert.equal(f.auto.isRecording(), false);
  f.scheduled.length = 0; f.tick(6); f.tick(32);
  assert.ok(!f.scheduled.some(c => c.values.cutoff !== undefined || c.values.held));
  f.auto.start(); f.tick(38); assert.ok(f.scheduled.some(c => c.values.cutoff === 500));
  f.schedule(64); f.auto.stop(); f.clock(64); assert.equal(f.effects.getSnapshot().volumes.drums, 0);
});

test('recording and saved effects stay in independent drafts; old session reads and creation export preserve manual mix', () => {
  const genre = 'chill', profile = 'ai-demo-1', catalog = performanceTemplates(genre, profile);
  const editor = createSessionEditor(createSession(genre, profile), { catalog });
  editor.edit({ selection: { drums: catalog.drums[0].id }, effectAutomation: automationData() });
  assert.equal(editor.getSnapshot().session.sections.length, 0); editor.save(() => true);
  const session = editor.getSnapshot().session, section = session.sections[0]; session.volumes.drums = -7;
  assert.equal(editor.getSnapshot().drafts[editor.getSnapshot().editingId].effectAutomation, undefined);
  editor.edit({ effectAutomation: undefined }, section.id); assert.ok(section.effectAutomation);
  const map = new Map(), storage = { getItem: k => map.get(k), setItem: (k, v) => map.set(k, v) };
  writeSession(storage, genre, profile, session);
  assert.deepEqual(readSession(storage, genre, profile).sections[0].effectAutomation, automationData());
  const entry = createExportEntry(section, genre, profile); assert.equal(entry.snapshot.effectAutomation, undefined);
  const project = createArrangementImport(session, [entry], { [entry.id]: 1 }); assert.equal(project.volumes.drums, -7);
  assert.equal(JSON.stringify(project).includes('effectAutomation'), false);
});

test('length edits retain out-of-range points and release Repeater at original take end', () => {
  const take = { length: 16, lanes: { 'drums:repeat': { initial: null, points: [{ step: 3.5, value: 4 }] } } };
  const merged = mergeEffectTake(automationData(), take);
  assert.equal(merged.cycleSteps, 32);
  assert.ok(effectLaneEvents(merged, 'drums', 'repeat').some(p => p.step === 16 && p.value === null));
  assert.deepEqual(merged.tracks.bass, automationData().tracks.bass);
});

test('playback records stopped and playing loops for one cycle; transition auditions once then stops', async () => {
  const f = fixture(), controller = createSessionPlayback(f.audio, () => {}, f.auto), snapshot = segment('fill', undefined, 'transition');
  controller.record(snapshot, 120); await f.ready();
  f.clock(0); f.source(0).onAudible(); f.clock(2.25); f.effects.volume('drums', -9);
  f.clock(32); f.source(32).onAudible(); assert.equal(f.completed.length, 1); assert.equal(controller.isActive(), true);
  f.clock(64); const end = f.source(64); assert.equal(end.done, true); end.onAudible(); assert.equal(controller.isActive(), false);
  controller.launch(segment(), 120); await f.ready(); f.clock(3); f.source(3).onAudible(); controller.record(segment(), 120);
  assert.equal(f.auto.getSnapshot().phase, 'armed'); f.clock(32); f.source(32).onAudible(); assert.equal(f.auto.getSnapshot().phase, 'recording');
  controller.stop(); assert.equal(f.auto.isRecording(), false);
});

test('a second take keeps completed draft lanes instead of reverting to the old saved snapshot', () => {
  const f = fixture(); f.auto.arm(segment(), 0); f.tick(0); f.clock(5); f.effects.volume('drums', -20); f.tick(32);
  f.auto.arm(segment(), 64); f.tick(64); f.clock(67); f.effects.cutoff('melody', 400); f.tick(96);
  assert.equal(f.completed.length, 2);
  assert.deepEqual(f.completed[1][1].tracks.drums.volume.points, [{ step: 5, value: -20 }]);
  assert.deepEqual(f.completed[1][1].tracks.melody.cutoff.points, [{ step: 3, value: 400 }]);
});
test('clearing automation cancels queued values and restores the manual mix without changing saved data', () => {
  const snapshot = segment(), before = structuredClone(snapshot.effectAutomation), f = fixture(snapshot);
  f.tick(0); f.clock(1); f.effects.volume('bass', -14); f.auto.clear('a'); f.scheduled.length = 0;
  f.tick(32); f.tick(35); assert.ok(!f.scheduled.some(c => c.values.volume === -12));
  assert.equal(f.effects.getSnapshot().volumes.bass, -14); assert.deepEqual(snapshot.effectAutomation, before);
});
test('stop during preparation cancels the take and cannot resurrect audio when loading completes', async () => {
  const f = fixture(); let ready, starts = 0;
  f.audio.preparePerformanceEffects = () => new Promise(resolve => { ready = resolve; });
  f.audio.play = async () => { starts++; return true; };
  const controller = createSessionPlayback(f.audio, () => {}, f.auto);
  controller.record(segment(), 120); assert.equal(f.auto.isRecording(), true);
  controller.stop(); ready(); await f.ready(); assert.equal(starts, 0); assert.equal(f.auto.isRecording(), false);
});
test('a post-record transition can be left without stopping the next loop at the old preview deadline', async () => {
  const f = fixture(), controller = createSessionPlayback(f.audio, () => {}, f.auto);
  controller.record(segment('fill', undefined, 'transition'), 120); await f.ready();
  f.clock(0); f.source(0).onAudible(); f.clock(32); f.source(32).onAudible();
  controller.launch(segment('next'), 120); f.clock(48); f.source(48).onAudible();
  f.clock(64); assert.notEqual(f.source(64).done, true);
});
test('after blur, an intentional loop switch resumes automation at the quantized boundary', async () => {
  const f = fixture(), controller = createSessionPlayback(f.audio, () => {}, f.auto);
  controller.launch(segment(), 120); await f.ready(); f.clock(0); f.source(0).onAudible();
  f.auto.suspend(); f.scheduled.length = 0; controller.launch(segment('next'), 120);
  f.clock(16); f.source(16).onAudible(); f.clock(22); f.source(22).onAudible();
  assert.ok(f.scheduled.some(c => c.track === 'drums' && c.values.cutoff === 500));
});
test('blur releases already sounding automatic repeats on every track, not only the manual pad owner', () => {
  const f = fixture(), calls = []; f.audio.setPerformanceEffect = (track, patch) => calls.push({ track, patch });
  f.tick(0); f.effects.display('bass', 'repeat', 4); f.auto.suspend();
  for (const track of ['drums', 'chord', 'bass', 'melody']) assert.ok(calls.some(c => c.track === track && c.patch.held === false));
  assert.ok(Object.values(f.effects.getSnapshot().repeats).every(value => value === null));
});
test('a late manual touch before a queued loop switch cannot suppress the incoming loop automation', () => {
  const f = fixture(); f.tick(0); f.clock(15.75);
  f.auto.schedule({ snapshot: segment('next'), startStep: 16, cycle: 1, absoluteStep: 16, time: 2, bpm: 120 });
  f.scheduled.length = 0; f.effects.volume('drums', -20);
  assert.ok(f.scheduled.some(c => c.track === 'drums' && c.values.volume === -3 && c.time === 2));
});

test('new group effects record fractional actions per target and replay after the take', () => {
  const f=fixture(); f.auto.arm(segment(),0); f.tick(0); f.effects.toggleTrack('bass');
  f.clock(2.5); f.effects.press('pitch','bend',7,120); f.effects.reverb(.6);
  f.clock(3.5); f.effects.release('pitch','bend'); f.effects.press('chopper','gate',32,120);
  f.clock(4.5); f.effects.release('chopper','gate'); f.effects.press('brake','brake',1,120);
  f.clock(5.5); f.effects.release('brake','brake'); f.tick(32);
  const data=f.completed[0][1];
  for(const track of ['drums','bass']) {
    assert.deepEqual(data.tracks[track].pitch.points.slice(0,2),[{step:2.5,value:7},{step:3.5,value:0}]);
    assert.equal(data.tracks[track].reverb.points[0].value,.6);
    assert.equal(data.tracks[track].chopper.points[0].value,32);
    assert.equal(data.tracks[track].brake.points[0].value,1);
  }
  assert.equal(data.tracks.melody,undefined);
  f.scheduled.length=0; f.tick(34);
  assert.ok(f.scheduled.some(e=>e.track==='bass'&&e.values.pitch===7&&e.time===34.5/8));
  f.auto.stop();assert.equal(f.effects.getSnapshot().pitches.drums,0);assert.equal(f.effects.getSnapshot().reverbs.drums,.6);
});

test('new momentary lanes respect a held override across cycles and blur cancels future automation',()=>{
  const snapshot=segment(); snapshot.effectAutomation.tracks.drums.pitch={initial:0,points:[{step:1,value:-12},{step:4,value:0}]};
  snapshot.effectAutomation.tracks.drums.chopper={initial:null,points:[{step:1,value:16},{step:4,value:null}]};
  const f=fixture(snapshot);f.tick(0);f.clock(1);f.effects.press('pitch','held',7,120);f.tick(32);f.scheduled.length=0;f.tick(33);
  assert.ok(!f.scheduled.some(e=>e.values.pitch===-12));assert.ok(f.scheduled.some(e=>e.values.chopper===16));
  f.effects.release('pitch','held');f.tick(64);f.tick(65);assert.ok(f.scheduled.some(e=>e.values.pitch===-12));
  f.auto.suspend();f.scheduled.length=0;f.tick(96);f.tick(97);
  assert.ok(!f.scheduled.some(e=>e.values.pitch!==undefined||e.values.chopper!==undefined));
  assert.equal(f.effects.getSnapshot().choppers.drums,null);assert.equal(f.effects.getSnapshot().pitches.drums,0);
});
