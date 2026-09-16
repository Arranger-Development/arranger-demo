import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dispatchCommand,
  createCommandDispatcher,
} from '../src/input/commandDispatcher.js';
import {
  mapKeyboardEventToCommand,
  shouldPreventDefaultForCommand,
} from '../src/input/keyboardMap.js';
import useMusicStore from '../src/store/useMusicStore.js';

function createMelodyNoteOn(note, inputId = 'keyboard:KeyA') {
  return { type: 'melody.noteOn', inputId, note, source: 'keyboard' };
}

function createMelodyNoteOff(inputId = 'keyboard:KeyA', note) {
  return { type: 'melody.noteOff', inputId, ...(note ? { note } : {}) };
}

function createMockStore(initial = {}) {
  const calls = [];
  const state = {
    bpm: 120,
    isPlaying: false,
    matrix: { drums: [] },
    seekBar: 0,
    seekStep: 0,
    currentBar: 0,
    currentStep: 0,
    ...initial,
    copySelectedClip: () => calls.push(['copySelectedClip']),
    deleteSelectedClip: () => calls.push(['deleteSelectedClip']),
    pasteClip: () => calls.push(['pasteClip']),
    play: () => calls.push(['play']),
    pause: () => calls.push(['pause']),
    stop: () => calls.push(['stop']),
    toggleTrackMute: (trackId) => calls.push(['toggleTrackMute', trackId]),
    setTransportPosition: (bar, step) => {
      calls.push(['setTransportPosition', bar, step]);
      state.currentBar = bar;
      state.currentStep = step;
    },
    setSeekPosition: (bar, step) => calls.push(['setSeekPosition', bar, step]),
  };

  return {
    calls,
    getState: () => state,
  };
}

test('dispatchCommand rejects invalid commands before side effects', async () => {
  const store = createMockStore();

  const result = await dispatchCommand(
    { type: 'drums.toggle', bar: 0, step: 0, instrument: 'tom' },
    { store },
  );

  assert.deepEqual(result, { ok: false, reason: 'invalid-command' });
  assert.deepEqual(
    await dispatchCommand(
      { type: 'drums.preview', instrument: 'kick', inputTimestampMs: -1 },
      { store },
    ),
    { ok: false, reason: 'invalid-command' },
  );
  assert.deepEqual(
    await dispatchCommand(
      { type: 'drums.preview', inputSource: 'keyboard', instrument: 'kick' },
      { store },
    ),
    { ok: false, reason: 'invalid-command' },
  );
  assert.deepEqual(store.calls, []);
});

test('transport commands dispatch to store and optional audio dependencies', async () => {
  const store = createMockStore({ isPlaying: false, bpm: 96, currentBar: 1, currentStep: 4 });
  const audioCalls = [];
  let playOptions = null;
  const audio = {
    play: (options) => {
      playOptions = options;
      audioCalls.push([
        'audio.play',
        options.bpm,
        options.bar,
        options.step,
        options.matrixSource().drums,
        typeof options.onPositionChange,
      ]);
    },
    pause: () => audioCalls.push(['audio.pause']),
    stop: () => audioCalls.push(['audio.stop']),
    seekToStep: (bar, step) => audioCalls.push(['audio.seekToStep', bar, step]),
  };

  assert.deepEqual(await dispatchCommand({
    type: 'transport.togglePlay',
    audibleTrackIds: ['melody'],
    maxPlaybackSteps: 48,
  }, { store, audio }), { ok: true });
  assert.deepEqual(playOptions.audibleTrackIds, ['melody']);
  assert.equal(playOptions.maxPlaybackSteps, 48);
  playOptions.onPositionChange(1, 5);
  store.getState().isPlaying = true;
  assert.deepEqual(await dispatchCommand({ type: 'transport.togglePlay' }, { store, audio }), { ok: true });
  assert.deepEqual(await dispatchCommand({ type: 'transport.seek', bar: 2, step: 8 }, { store, audio }), { ok: true });
  assert.deepEqual(await dispatchCommand({ type: 'transport.stop' }, { store, audio }), { ok: true });

  assert.deepEqual(store.calls, [
    ['play'],
    ['setTransportPosition', 1, 5],
    ['pause'],
    ['setTransportPosition', 2, 8],
    ['stop'],
  ]);
  assert.equal(store.getState().currentBar, 2);
  assert.equal(store.getState().currentStep, 8);
  assert.deepEqual(audioCalls, [
    ['audio.play', 96, 1, 4, [], 'function'],
    ['audio.pause'],
    ['audio.seekToStep', 2, 8],
    ['audio.stop'],
  ]);
});

test('transport stop-and-rewind stops playback and returns both store and audio to the start', async () => {
  const store = createMockStore({ isPlaying: true, currentBar: 5, currentStep: 11 });
  const audioCalls = [];
  const audio = {
    stop: () => audioCalls.push(['audio.stop']),
    seekToStep: (bar, step) => audioCalls.push(['audio.seekToStep', bar, step]),
  };

  assert.deepEqual(
    await dispatchCommand({ type: 'transport.stopAndRewind' }, { store, audio }),
    { ok: true },
  );
  assert.deepEqual(store.calls, [
    ['stop'],
    ['setTransportPosition', 0, 0],
  ]);
  assert.equal(store.getState().currentBar, 0);
  assert.equal(store.getState().currentStep, 0);
  assert.deepEqual(audioCalls, [
    ['audio.stop'],
    ['audio.seekToStep', 0, 0],
  ]);
});

test('track mute commands toggle store state and refresh the live audio node', async () => {
  const store = createMockStore();
  const audioCalls = [];
  const audio = {
    refreshTrackVolume: (trackId) => audioCalls.push(['refreshTrackVolume', trackId]),
  };

  assert.deepEqual(
    await dispatchCommand({ type: 'track.toggleMute', trackId: 'bass' }, { store, audio }),
    { ok: true },
  );
  assert.deepEqual(store.calls, [['toggleTrackMute', 'bass']]);
  assert.deepEqual(audioCalls, [['refreshTrackVolume', 'bass']]);
});

test('transport commands preserve audio engine method context', async () => {
  const store = createMockStore();
  const audioCalls = [];
  const audio = {
    label: 'engine',
    play() {
      audioCalls.push(['play', this.label]);
    },
    stop() {
      audioCalls.push(['stop', this.label]);
    },
  };

  await dispatchCommand({ type: 'transport.togglePlay' }, { store, audio });
  await dispatchCommand({ type: 'transport.stop' }, { store, audio });

  assert.deepEqual(audioCalls, [
    ['play', 'engine'],
    ['stop', 'engine'],
  ]);
});

test('domain commands dispatch to injected handlers with drums naming', async () => {
  const calls = [];
  const audioCalls = [];
  const handlers = {
    tutorial: {
      next: () => calls.push(['tutorial.next']),
      completeTask: () => calls.push(['tutorial.completeTask']),
    },
    app: {
      undo: () => calls.push(['app.undo']),
      redo: () => calls.push(['app.redo']),
    },
    drums: {
      toggle: (command) => calls.push(['drums.toggle', command.bar, command.step, command.instrument]),
      selectClip: (command) => calls.push(['drums.selectClip', command.bar]),
    },
    chord: {
      selectClip: (command) => calls.push(['chord.selectClip', command.bar]),
      toggleRhythm: (command) => calls.push(['chord.toggleRhythm', command.bar, command.step]),
      openHarmony: (command) => calls.push(['chord.openHarmony', command.bar, command.step]),
      closeHarmony: () => calls.push(['chord.closeHarmony']),
      applyHarmonyOption: (command) => calls.push([
        'chord.applyHarmonyOption',
        command.bar,
        command.step,
        command.mode,
        command.optionIndex,
      ]),
      selectHarmonyOption: (command) => calls.push([
        'chord.selectHarmonyOption',
        command.bar,
        command.step,
        command.mode,
        command.optionIndex,
      ]),
      previewHarmonyOption: (command) => calls.push([
        'chord.previewHarmonyOption',
        command.bar,
        command.step,
        command.mode,
        command.optionIndex,
      ]),
      selectOption: (command) => calls.push(['chord.selectOption', command.optionIndex]),
      confirm: () => calls.push(['chord.confirm']),
      setCell: (command) => calls.push(['chord.setCell', command.bar, command.span, command.root]),
      clearCell: (command) => calls.push(['chord.clearCell', command.bar, command.span]),
    },
    melody: {
      noteOn: (command) => calls.push(['melody.noteOn', command.note]),
      noteOff: (command) => calls.push(['melody.noteOff', command.note]),
      selectClip: (command) => calls.push(['melody.selectClip', command.bar]),
      selectStep: (command) => calls.push(['melody.selectStep', command.bar, command.step]),
    },
  };
  const audio = {
    triggerDrumsStep: (instrument) => audioCalls.push(['audio.triggerDrumsStep', instrument]),
  };

  await dispatchCommand({ type: 'app.undo' }, { handlers });
  await dispatchCommand({ type: 'app.redo' }, { handlers });
  await dispatchCommand({ type: 'tutorial.next' }, { handlers });
  await dispatchCommand({ type: 'tutorial.completeTask' }, { handlers });
  await dispatchCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 4,
    instrument: 'kick',
    preview: true,
  }, { handlers, audio });
  await dispatchCommand({
    type: 'drums.toggle',
    bar: 0,
    step: 4,
    instrument: 'hihat',
    preview: false,
  }, { handlers, audio });
  await dispatchCommand({ type: 'drums.selectClip', bar: 5 }, { handlers });
  await dispatchCommand({ type: 'chord.selectClip', bar: 4 }, { handlers });
  await dispatchCommand({ type: 'chord.toggleRhythm', bar: 4, step: 12 }, { handlers });
  await dispatchCommand({ type: 'chord.openHarmony', bar: 4, step: 12 }, { handlers });
  await dispatchCommand({ type: 'chord.closeHarmony' }, { handlers });
  await dispatchCommand({
    type: 'chord.applyHarmonyOption',
    bar: 4,
    step: 12,
    mode: 'enrich',
    optionIndex: 2,
  }, { handlers });
  await dispatchCommand({
    type: 'chord.selectHarmonyOption',
    bar: 4,
    step: 12,
    mode: 'enrich',
    optionIndex: 1,
  }, { handlers });
  await dispatchCommand({
    type: 'chord.previewHarmonyOption',
    bar: 4,
    step: 12,
    mode: 'enrich',
    optionIndex: 1,
  }, { handlers });
  await dispatchCommand({ type: 'chord.selectOption', optionIndex: 3 }, { handlers });
  await dispatchCommand({ type: 'chord.confirm' }, { handlers });
  await dispatchCommand({ type: 'chord.setCell', bar: 2, span: 1, root: 'G#' }, { handlers });
  await dispatchCommand({ type: 'chord.clearCell', bar: 2, span: 1 }, { handlers });
  await dispatchCommand(createMelodyNoteOn('D4'), { handlers });
  await dispatchCommand(createMelodyNoteOff('keyboard:KeyA', 'D4'), { handlers });
  await dispatchCommand({ type: 'melody.selectClip', bar: 6 }, { handlers });
  await dispatchCommand({ type: 'melody.selectStep', bar: 6, step: 12 }, { handlers });

  assert.deepEqual(calls, [
    ['app.undo'],
    ['app.redo'],
    ['tutorial.next'],
    ['tutorial.completeTask'],
    ['drums.toggle', 0, 4, 'kick'],
    ['drums.toggle', 0, 4, 'hihat'],
    ['drums.selectClip', 5],
    ['chord.selectClip', 4],
    ['chord.toggleRhythm', 4, 12],
    ['chord.openHarmony', 4, 12],
    ['chord.closeHarmony'],
    ['chord.applyHarmonyOption', 4, 12, 'enrich', 2],
    ['chord.selectHarmonyOption', 4, 12, 'enrich', 1],
    ['chord.previewHarmonyOption', 4, 12, 'enrich', 1],
    ['chord.selectOption', 3],
    ['chord.confirm'],
    ['chord.setCell', 2, 1, 'G#'],
    ['chord.clearCell', 2, 1],
    ['melody.noteOff', 'D4'],
    ['melody.selectClip', 6],
    ['melody.selectStep', 6, 12],
  ]);
  assert.deepEqual(audioCalls, [
    ['audio.triggerDrumsStep', 'kick'],
  ]);
});

test('melody noteOn uses isolated input audio without calling editor recording handlers', async () => {
  const calls = [];
  const handlers = {
    melody: {
      noteOn: (command) => calls.push(['handler.melody.noteOn', command.note]),
    },
  };
  const audio = {
    triggerMelodyInputOneShot: (note) => calls.push([
      'audio.triggerMelodyInputOneShot',
      note,
    ]),
  };

  await dispatchCommand(createMelodyNoteOn('C4'), { handlers, audio });

  assert.deepEqual(calls, [
    ['audio.triggerMelodyInputOneShot', 'C4'],
  ]);
});

test('drums preview triggers audio without calling the matrix toggle handler', async () => {
  const calls = [];
  const handlers = {
    drums: {
      toggle: () => calls.push(['handler.drums.toggle']),
    },
  };
  const audio = {
    triggerDrumsStep: (instrument, time, options) => calls.push([
      'audio.triggerDrumsStep',
      instrument,
      time,
      options,
    ]),
  };

  assert.deepEqual(
    await dispatchCommand({
      type: 'drums.preview',
      inputTimestampMs: 321.5,
      instrument: 'snare',
    }, { handlers, audio }),
    { ok: true },
  );
  assert.deepEqual(calls, [[
    'audio.triggerDrumsStep',
    'snare',
    undefined,
    { immediate: true },
  ]]);
});

test('melody noteOn does not fall back to editor recording when audio preview is unavailable', async () => {
  const calls = [];
  const handlers = {
    melody: {
      noteOn: (command) => calls.push(['handler.melody.noteOn', command.note]),
    },
  };

  assert.deepEqual(await dispatchCommand(createMelodyNoteOn('C4'), { handlers }), { ok: true });

  assert.deepEqual(calls, []);
});

test('createCommandDispatcher binds dependencies', async () => {
  const store = createMockStore();
  const dispatch = createCommandDispatcher({ store });

  assert.deepEqual(await dispatch({ type: 'transport.stop' }), { ok: true });
  assert.deepEqual(store.calls, [['stop']]);
});

test('clip commands dispatch to selected clip store actions and injected handlers', async () => {
  const store = createMockStore();
  const calls = [];
  const handlers = {
    clip: {
      copySelected: () => calls.push(['clip.copySelected']),
      paste: () => calls.push(['clip.paste']),
    },
  };

  assert.deepEqual(await dispatchCommand({ type: 'clip.copySelected' }, { store, handlers }), { ok: true });
  assert.deepEqual(await dispatchCommand({ type: 'clip.deleteSelected' }, { store }), { ok: true });
  assert.deepEqual(await dispatchCommand({ type: 'clip.paste' }, { store, handlers }), { ok: true });
  assert.deepEqual(calls, [
    ['clip.copySelected'],
    ['clip.paste'],
  ]);
  assert.deepEqual(store.calls, [['deleteSelectedClip']]);
});

test('keyboard map turns common keys into app commands', () => {
  assert.deepEqual(mapKeyboardEventToCommand({ type: 'keydown', key: 'z', ctrlKey: true }), { type: 'app.undo' });
  assert.deepEqual(mapKeyboardEventToCommand({ type: 'keydown', key: 'z', metaKey: true }), { type: 'app.undo' });
  assert.equal(mapKeyboardEventToCommand({ type: 'keyup', key: 'z', ctrlKey: true }), null);
  assert.equal(mapKeyboardEventToCommand({ type: 'keydown', key: 'z', ctrlKey: true, shiftKey: true }), null);
  assert.equal(mapKeyboardEventToCommand({ type: 'keydown', key: 'z', metaKey: true, shiftKey: true }), null);
  assert.equal(mapKeyboardEventToCommand({ type: 'keydown', key: 'y', ctrlKey: true }), null);
  assert.equal(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'z', ctrlKey: true, target: { tagName: 'INPUT', isContentEditable: false } },
    ),
    null,
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'c', ctrlKey: true },
      { selectedClipId: 'drums-bar-0' },
    ),
    { type: 'clip.copySelected' },
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'c', metaKey: true },
      { selectedClipId: 'drums-bar-0' },
    ),
    { type: 'clip.copySelected' },
  );
  assert.equal(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'c', ctrlKey: true },
      { selectedClipId: null },
    ),
    null,
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'c', ctrlKey: true },
      { hasTimelineSelection: true, selectedClipId: null },
    ),
    { type: 'clip.copySelected' },
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'v', metaKey: true },
      { canPasteClip: true },
    ),
    { type: 'clip.paste' },
  );
  assert.equal(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'v', metaKey: true },
      { activeTrackId: 'drums', canPasteClip: false, selectedBar: 0 },
    ),
    null,
  );
  assert.equal(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'v', metaKey: true, target: { tagName: 'TEXTAREA', isContentEditable: false } },
      { canPasteClip: true },
    ),
    null,
  );
  assert.deepEqual(mapKeyboardEventToCommand({ type: 'keydown', key: ' ' }), { type: 'transport.togglePlay' });
  assert.deepEqual(mapKeyboardEventToCommand({ type: 'keydown', code: 'Space' }), { type: 'transport.togglePlay' });
  assert.deepEqual(mapKeyboardEventToCommand({ type: 'keydown', key: 'Escape' }), { type: 'transport.stop' });
  assert.deepEqual(mapKeyboardEventToCommand({ type: 'keydown', key: 'Enter' }), { type: 'tutorial.next' });
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keydown', key: 'ArrowRight' }, { seekBar: 0, seekStep: 15 }),
    { type: 'transport.seek', bar: 1, step: 0 },
  );
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keydown', key: 'ArrowLeft' }, { seekBar: 0, seekStep: 0 }),
    { type: 'transport.seek', bar: 0, step: 0 },
  );
  assert.equal(
    mapKeyboardEventToCommand({ type: 'keydown', key: '·' }, { activeTrackId: 'melody', melodyScaleId: 'major' }),
    null,
  );
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keydown', code: 'KeyQ', key: 'q' }, { activeTrackId: 'melody', melodyScaleId: 'major' }),
    createMelodyNoteOn('C5', 'keyboard:KeyQ'),
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', code: 'KeyQ', key: 'q', timeStamp: 654.25 },
      { activeTrackId: 'melody', melodyScaleId: 'major' },
    ),
    { ...createMelodyNoteOn('C5', 'keyboard:KeyQ'), inputTimestampMs: 654.25 },
  );
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keyup', code: 'KeyQ', key: 'й' }, { activeTrackId: 'drums', melodyScaleId: 'pentatonic' }),
    createMelodyNoteOff('keyboard:KeyQ'),
  );
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keydown', code: 'KeyF', key: 'ф' }, { activeTrackId: 'melody', melodyScaleId: 'pentatonic' }),
    createMelodyNoteOn('G4', 'keyboard:KeyF'),
  );
  assert.equal(
    mapKeyboardEventToCommand({ type: 'keydown', code: 'KeyY', key: 'y' }, { activeTrackId: 'melody', melodyScaleId: 'pentatonic' }),
    null,
  );
  assert.equal(
    mapKeyboardEventToCommand({ type: 'keydown', code: 'KeyA', key: 'a', ctrlKey: true }, { activeTrackId: 'melody', melodyScaleId: 'major' }),
    null,
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', code: 'KeyA', key: 'a', timeStamp: 987.25 },
      { activeTrackId: 'drums' },
    ),
    { type: 'drums.preview', inputTimestampMs: 987.25, instrument: 'kick' },
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', code: 'KeyS', key: 's' },
      { activeTrackId: 'drums' },
    ),
    { type: 'drums.preview', instrument: 'snare' },
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', code: 'KeyD', key: 'd' },
      { activeTrackId: 'drums' },
    ),
    { type: 'drums.preview', instrument: 'hihat' },
  );
  assert.equal(
    mapKeyboardEventToCommand(
      { type: 'keydown', code: 'KeyA', key: 'a', metaKey: true },
      { activeTrackId: 'drums' },
    ),
    null,
  );
  assert.equal(
    mapKeyboardEventToCommand(
      { type: 'keydown', code: 'KeyA', key: 'a', repeat: true },
      { activeTrackId: 'drums' },
    ),
    null,
  );
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', code: 'KeyA', key: 'a' },
      { activeTrackId: 'melody', melodyScaleId: 'major' },
    ),
    createMelodyNoteOn('C4', 'keyboard:KeyA'),
  );
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keydown', key: '4' }, { activeTrackId: 'chord' }),
    { type: 'chord.selectOption', optionIndex: 3 },
  );
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keydown', key: 'Delete' }, { selectedClipId: 'drums-bar-0' }),
    { type: 'clip.deleteSelected' },
  );
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keydown', key: 'Backspace' }, { selectedClipId: 'drums-bar-0' }),
    { type: 'clip.deleteSelected' },
  );
  assert.equal(mapKeyboardEventToCommand({ type: 'keydown', key: 'Delete' }, { selectedClipId: null }), null);
  assert.deepEqual(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'Delete' },
      { hasTimelineSelection: true, selectedClipId: null },
    ),
    { type: 'clip.deleteSelected' },
  );
  assert.equal(
    mapKeyboardEventToCommand(
      { type: 'keydown', key: 'Delete', target: { tagName: 'INPUT', isContentEditable: false } },
      { selectedClipId: 'drums-bar-0' },
    ),
    null,
  );
  assert.equal(mapKeyboardEventToCommand({ type: 'keydown', code: 'KeyA', key: 'a', target: { tagName: 'INPUT' } }, { activeTrackId: 'melody' }), null);
  assert.equal(mapKeyboardEventToCommand({ type: 'keydown', code: 'KeyA', key: 'a', repeat: true }, { activeTrackId: 'melody' }), null);
  assert.deepEqual(
    mapKeyboardEventToCommand({ type: 'keyup', code: 'KeyA', key: 'a', target: { tagName: 'INPUT' } }, { activeTrackId: 'melody' }),
    createMelodyNoteOff('keyboard:KeyA'),
  );
});

test('keyboard mapped commands should prevent browser defaults', () => {
  assert.equal(shouldPreventDefaultForCommand({ type: 'transport.togglePlay' }), true);
  assert.equal(shouldPreventDefaultForCommand(null), false);
});

test('dispatcher can use the real music store for existing transport actions', async () => {
  useMusicStore.setState(useMusicStore.getInitialState(), true);

  await dispatchCommand({ type: 'transport.seek', bar: 3, step: 12 });
  assert.equal(useMusicStore.getState().currentBar, 3);
  assert.equal(useMusicStore.getState().currentStep, 12);
  assert.equal(useMusicStore.getState().seekBar, 3);
  assert.equal(useMusicStore.getState().seekStep, 12);

  await dispatchCommand({ type: 'transport.stop' });
  assert.equal(useMusicStore.getState().isPlaying, false);
  assert.equal(useMusicStore.getState().currentBar, 3);
  assert.equal(useMusicStore.getState().currentStep, 12);
  assert.equal(useMusicStore.getState().seekBar, 3);
  assert.equal(useMusicStore.getState().seekStep, 12);
});
