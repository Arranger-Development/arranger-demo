import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PERFORMANCE_KEYS, mapPerformanceKeyboard, createPerformanceMidiInput, performanceKeyLabel } from '../src/input/performanceInput.js';
import { createLaunchpadXPerformanceLedFrame, createLedFrameSender } from '../src/input/launchpadXPerformanceSurface.js';
import { createPerformanceEditor } from '../src/app/performanceEditor.js';
import { createPerformancePlayback } from '../src/app/performancePlayback.js';
import { PERFORMANCE_TRACKS, emptySelection, performanceTemplates, createPerformanceMatrix, createPerformanceSequence } from '../src/app/performanceModel.js';
import { AI_PERFORMANCE_PROFILE_ID } from '../src/data/aiPerformanceTemplates.js';

const templates = performanceTemplates('pop', AI_PERFORMANCE_PROFILE_ID);
const session = () => ({ bpm: 100, saved: Array.from({ length: 5 }, emptySelection) });
const key = (code, overrides = {}) => ({ type: 'keydown', code, ...overrides });
const light = (frame, note) => frame.find(([status, number]) => status === 0x90 && number === note)?.[2];

test('four keyboard rows follow actual template order in AI and every ordinary genre', () => {
  for (const group of [templates, ...['pop', 'hip-hop', 'r-and-b', 'electronic-edm', 'rock'].map((genre) => performanceTemplates(genre))]) {
    for (const trackId of PERFORMANCE_TRACKS) {
      PERFORMANCE_KEYS[trackId].forEach((code, index) => {
        const expected = group[trackId][index];
        assert.deepEqual(mapPerformanceKeyboard(key(code), group), expected
          ? { type: 'template', trackId, templateId: expected.id } : null);
        assert.equal(performanceKeyLabel(trackId, index), code.replace(/^(Key|Digit)/, ''));
      });
    }
  }
  // Physical position is independent of key text / Caps Lock.
  assert.deepEqual(mapPerformanceKeyboard(key('KeyQ', { key: 'Q' }), templates), mapPerformanceKeyboard(key('KeyQ', { key: 'q' }), templates));
});

test('typing, composing, held keys, modifiers, transport and loop shortcuts are ignored', () => {
  for (const overrides of [
    { repeat: true }, { type: 'keyup' }, { isComposing: true }, { keyCode: 229 },
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    ...['INPUT', 'TEXTAREA', 'SELECT'].map((tagName) => ({ target: { tagName } })),
    { target: { isContentEditable: true } }, { target: { closest: () => ({}) } },
  ]) assert.equal(mapPerformanceKeyboard(key('KeyQ', overrides), templates), null);
  for (const code of ['Space', 'Enter', 'Escape', 'Tab', 'F1', 'Digit7', 'ArrowRight', 'Numpad1']) {
    assert.equal(mapPerformanceKeyboard(key(code), templates), null);
  }
  assert.ok(mapPerformanceKeyboard(key('KeyQ', { target: { tagName: 'BUTTON' } }), templates));
});

test('Launchpad maps physical top rows and bottom controls; repeat/release/pressure never retrigger', () => {
  const input = createPerformanceMidiInput();
  PERFORMANCE_TRACKS.forEach((trackId, row) => {
    for (let column = 0; column < 8; column += 1) {
      const note = (8 - row) * 10 + column + 1;
      const template = templates[trackId][column];
      assert.deepEqual(input.handle([0x90, note, 127], templates), template
        ? { type: 'template', trackId, templateId: template.id } : null);
      assert.equal(input.handle([0x90, note, 64], templates), null);
      assert.equal(input.handle([0xa0, note, 127], templates), null);
      assert.equal(input.handle([0x80, note, 64], templates), null);
    }
  });
  for (let index = 0; index < 5; index += 1) assert.deepEqual(input.handle([0x90, 11 + index, 1], templates), { type: 'loop', index });
  assert.deepEqual(input.handle([0x90, 17, 100], templates), { type: 'save' });
  assert.deepEqual(input.handle([0x90, 18, 100], templates), { type: 'togglePlayback' });
  assert.equal(input.handle([0x90, 18, 0], templates), null);
  assert.deepEqual(input.handle([0x90, 18, 100], templates), { type: 'togglePlayback' });
  for (const data of [[0xb0, 98, 127], [0xb0, 49, 127], [0x91, 81, 127], [0x90, 16, 127], [0x90, 21, 127], [0x90, 31, 127], [0x90, 41, 127]]) assert.equal(input.handle(data, templates), null);
  input.reset();
  assert.deepEqual(input.handle([0x90, 18, 100], templates), { type: 'togglePlayback' });
});

test('consecutive inputs before rendering preserve tracks, drafts and independent saved snapshots', () => {
  const initial = session();
  const editor = createPerformanceEditor(initial);
  let changes = 0;
  const unsubscribe = editor.subscribe(() => { changes += 1; });
  const midi = createPerformanceMidiInput();
  const actions = [mapPerformanceKeyboard(key('Digit1'), templates), midi.handle([0x90, 51, 127], templates)];
  for (const action of actions) editor.toggleTemplate(action.trackId, action.templateId);
  assert.equal(editor.getSnapshot().drafts[0].drums, templates.drums[0].id);
  assert.equal(editor.getSnapshot().drafts[0].melody, templates.melody[0].id);
  const saved = editor.save();
  editor.toggleTemplate('drums', templates.drums[1].id);
  editor.selectLoop(1);
  editor.toggleTemplate('bass', templates.bass[0].id);
  editor.save();
  editor.selectLoop(0);
  assert.equal(editor.getSnapshot().drafts[0].drums, templates.drums[1].id);
  assert.equal(saved.saved[0].drums, templates.drums[0].id);
  assert.deepEqual(initial.saved, session().saved);
  editor.toggleTemplate('drums', templates.drums[1].id);
  editor.toggleTemplate('melody', templates.melody[0].id);
  assert.deepEqual(editor.save().saved[0], emptySelection());
  assert.equal(editor.setBpm(140).bpm, 140);
  assert.equal(editor.getSnapshot().session.saved[1].bass, templates.bass[0].id);
  assert.equal(editor.selectLoop(5), null);
  assert.ok(changes >= 10);
  unsubscribe();
  const previous = changes;
  editor.selectLoop(2);
  assert.equal(changes, previous);
});

test('LEDs distinguish templates, editing/saved loops, save feedback and transport; unused pads stay off', () => {
  const editor = createPerformanceEditor(session());
  editor.toggleTemplate('drums', templates.drums[0].id);
  editor.save();
  editor.selectLoop(1);
  const state = editor.getSnapshot();
  const base = { templates, ...state, saved: state.session.saved, status: { mode: 'stopped' } };
  const frame = createLaunchpadXPerformanceLedFrame(base);
  assert.equal(frame.length, 80);
  assert.equal(light(frame, 81), 19);
  assert.equal(light(frame, 12), 17);
  assert.equal(light(frame, 11), 42);
  assert.equal(light(frame, 13), 15);
  assert.equal(light(frame, 18), 17);
  for (const note of [87, 88, 76, 65, 66, 56, 41, 31, 21, 16]) assert.equal(light(frame, note), 0);
  assert.ok(frame.filter(([status]) => status === 0xb0).every(([, , value]) => value === 0));
  editor.toggleTemplate('chord', templates.chord[0].id);
  const dirty = { ...base, drafts: editor.getSnapshot().drafts };
  assert.equal(light(createLaunchpadXPerformanceLedFrame(dirty), 71), 9);
  assert.equal(light(createLaunchpadXPerformanceLedFrame(dirty), 17), 9);
  assert.equal(light(createLaunchpadXPerformanceLedFrame({ ...dirty, saveFeedback: true }), 17), 17);
  assert.equal(light(createLaunchpadXPerformanceLedFrame({ ...dirty, storageError: true }), 17), 5);
  const loading = { ...dirty, status: { mode: 'sequence', loading: true }, progress: { segment: 0, fraction: .5 } };
  assert.equal(light(createLaunchpadXPerformanceLedFrame(loading, 0), 18), 5);
  assert.equal(light(createLaunchpadXPerformanceLedFrame(loading, 300), 18), 7);
  assert.equal(light(createLaunchpadXPerformanceLedFrame(loading), 21), 0);
});

test('progress lights follow audible fraction, loop index and beat phase, including preview', () => {
  for (const mode of ['sequence', 'preview']) {
    const base = { templates, ...session(), selectedLoop: 4, sequenceIndices: [1, 4], status: { mode }, beatPhase: .1 };
    for (const [fraction, count] of [[0, 1], [.125, 2], [.5, 5], [.999, 8]]) {
      const frame = createLaunchpadXPerformanceLedFrame({ ...base, progress: { segment: 1, fraction } });
      assert.equal(frame.filter(([status, note, value]) => status === 0x90 && note >= 21 && note <= 28 && value).length, count);
      assert.equal(light(frame, 15), 49);
    }
    const frame = createLaunchpadXPerformanceLedFrame({ ...base, beatPhase: .75, progress: { segment: 0, fraction: 0 } });
    assert.equal(light(frame, mode === 'preview' ? 15 : 12), mode === 'preview' ? 50 : 18);
    assert.equal(light(frame, 22), 0);
    assert.equal(light(frame, 18), 5);
  }
});

test('LED output sends only changed colors and repaints fully after reset or partial failure', () => {
  const sender = createLedFrameSender();
  const sent = [];
  const output = { send: (message) => sent.push(message) };
  const frame = createLaunchpadXPerformanceLedFrame({ templates });
  sender.send(output, frame);
  sender.send(output, frame);
  assert.equal(sent.length, 80);
  sender.send(output, [[0x90, 18, 5]]);
  assert.equal(sent.length, 81);
  sender.reset();
  sender.send(output, frame);
  assert.equal(sent.length, 161);
  assert.throws(() => sender.send({ send() { throw new Error('Disconnected'); } }, [[0x90, 18, 5]]));
  sender.send(output, [[0x90, 18, 5]]);
  assert.equal(sent.length, 162);
});

test('beat indication uses audio position across BPM changes, variable segments, loading and stops', async () => {
  let finish;
  let position = 0;
  let starts = 0;
  const audio = {
    startAudio: async () => { starts += 1; },
    play: () => new Promise((resolve) => { finish = resolve; }),
    stop() {}, stopAllVoices() {}, setTempo() {},
    getPlaybackProgress: () => ({ position }),
  };
  const playback = createPerformancePlayback(audio);
  await playback.unlockAudio();
  assert.equal(starts, 1);
  const selections = session().saved;
  selections[1] = { ...emptySelection(), drums: templates.drums[0].id };
  selections[4] = { ...emptySelection(), chord: templates.chord[1].id };
  playback.sequence(createPerformanceSequence(selections, 'pop', AI_PERFORMANCE_PROFILE_ID), 100);
  assert.equal(playback.getBeatPhase(), 0);
  assert.equal(playback.getProgress(), null);
  finish(true);
  await new Promise((resolve) => setImmediate(resolve));
  position = 34.5;
  assert.equal(playback.getBeatPhase(), .625);
  assert.deepEqual(playback.getProgress(), { segment: 1, fraction: 2.5 / 64 });
  playback.setTempo(180);
  assert.equal(playback.getBeatPhase(), .625);
  playback.preview(createPerformanceMatrix(selections[1], 'pop', AI_PERFORMANCE_PROFILE_ID), 180);
  playback.stop();
  finish(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(playback.getBeatPhase(), 0);
  assert.equal(playback.getProgress(), null);
  assert.equal(playback.isActive(), false);
});
