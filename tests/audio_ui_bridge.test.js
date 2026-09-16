import assert from 'node:assert/strict';
import { test } from 'node:test';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import {
  createDefaultDrumsPattern,
  createUiAudioDispatcher,
  seedDefaultDrumsPattern,
} from '../src/app/audioUiBridge.js';

function createMockStore(initial = {}) {
  const calls = [];
  const state = {
    matrix: createInitialMatrix(),
    bpm: 120,
    currentBar: 0,
    currentStep: 0,
    isPlaying: false,
    activeTrackId: 'drums',
    clips: { ids: [], byId: {} },
    selectedBar: 0,
    selectedClipId: null,
    play: () => calls.push(['play']),
    stop: () => calls.push(['stop']),
    setCell: (trackId, bar, step, cell) => {
      calls.push(['setCell', trackId, bar, step, cell]);
      state.matrix[trackId][bar][step] = cell;
    },
    setTransportPosition: (bar, step) => {
      calls.push(['seek', bar, step]);
      state.currentBar = bar;
      state.currentStep = step;
    },
    ...initial,
  };

  return {
    calls,
    getState: () => state,
  };
}

test('seedDefaultDrumsPattern writes an audible one-bar drums pattern', () => {
  const store = createMockStore();

  seedDefaultDrumsPattern(store);

  assert.deepEqual(store.getState().matrix.drums[0][0], { instruments: ['kick', 'hihat'] });
  assert.deepEqual(store.getState().matrix.drums[0][4], { instruments: ['hihat'] });
  assert.deepEqual(store.getState().matrix.drums[0][8], { instruments: ['snare', 'hihat'] });
  assert.deepEqual(store.getState().matrix.drums[0][12], { instruments: ['hihat'] });
  assert.equal(store.getState().matrix.bass[0][0], null);
  assert.equal(createDefaultDrumsPattern().length, 6);
});

test('seedDefaultDrumsPattern is idempotent and keeps non-pattern cells intact', () => {
  const store = createMockStore();
  store.getState().matrix.drums[0][2] = { instruments: ['kick'] };

  seedDefaultDrumsPattern(store);
  seedDefaultDrumsPattern(store);

  assert.deepEqual(store.getState().matrix.drums[0][0], { instruments: ['kick', 'hihat'] });
  assert.deepEqual(store.getState().matrix.drums[0][2], { instruments: ['kick'] });
});

test('createUiAudioDispatcher connects transport commands and drums preview audio', async () => {
  const store = createMockStore({ bpm: 98, currentBar: 1, currentStep: 4 });
  const audioCalls = [];
  let playOptions = null;
  const dispatch = createUiAudioDispatcher({
    store,
    audio: {
      play: (options) => {
        playOptions = options;
        audioCalls.push([
          'play',
          options.bpm,
          options.bar,
          options.step,
          options.matrixSource(),
          typeof options.onPositionChange,
        ]);
      },
      stop: () => audioCalls.push(['stop']),
      triggerDrumsStep: (instruments) => audioCalls.push(['preview', instruments]),
    },
  });

  await dispatch({ type: 'transport.togglePlay' });
  playOptions.onPositionChange(1, 5);
  await dispatch({
    type: 'drums.toggle',
    bar: 0,
    step: 0,
    instrument: 'kick',
    preview: true,
  });
  await dispatch({ type: 'transport.stop' });

  assert.deepEqual(store.calls, [
    ['play'],
    ['seek', 1, 5],
    ['stop'],
  ]);
  assert.equal(audioCalls[0][0], 'play');
  assert.equal(audioCalls[0][1], 98);
  assert.equal(audioCalls[0][2], 1);
  assert.equal(audioCalls[0][3], 4);
  assert.equal(audioCalls[0][4], store.getState().matrix);
  assert.equal(audioCalls[0][5], 'function');
  assert.equal(store.getState().currentBar, 1);
  assert.equal(store.getState().currentStep, 5);
  assert.deepEqual(audioCalls.slice(1), [
    ['preview', 'kick'],
    ['stop'],
  ]);
});

test('createUiAudioDispatcher preserves existing audio position observers', async () => {
  const store = createMockStore();
  const observedPositions = [];
  let playOptions = null;
  const audio = {
    onPositionChange: (bar, step) => observedPositions.push(['tutorial', bar, step]),
    play: (options) => {
      playOptions = options;
    },
  };
  const dispatch = createUiAudioDispatcher({ store, audio });

  await dispatch({ type: 'transport.togglePlay' });
  playOptions.onPositionChange(2, 8);

  assert.deepEqual(store.calls, [
    ['play'],
    ['seek', 2, 8],
  ]);
  assert.deepEqual(observedPositions, [['tutorial', 2, 8]]);
});

test('createUiAudioDispatcher previews melody key presses without recording notes', async () => {
  const store = createMockStore({
    activeTrackId: 'melody',
    clips: {
      ids: ['melody-bar-1'],
      byId: {
        'melody-bar-1': {
          id: 'melody-bar-1',
          trackId: 'melody',
          bar: 1,
          name: 'Melody 02',
        },
      },
    },
    currentBar: 1,
    currentStep: 5,
    selectedBar: 1,
    selectedClipId: 'melody-bar-1',
  });
  const audioCalls = [];
  const dispatch = createUiAudioDispatcher({
    store,
    audio: {
      triggerMelodyInputOneShot: (note) => (
        audioCalls.push(['melody-input-one-shot', note])
      ),
    },
  });

  await dispatch({ type: 'melody.noteOn', inputId: 'keyboard:KeyA', note: 'C4', source: 'keyboard' });
  await dispatch({ type: 'melody.noteOff', inputId: 'keyboard:KeyA', note: 'C4' });

  assert.equal(store.getState().matrix.melody[1][5], null);
  assert.deepEqual(store.calls, []);
  assert.equal(store.getState().currentStep, 5);
  assert.deepEqual(audioCalls, [
    ['melody-input-one-shot', 'C4'],
  ]);
});

test('createUiAudioDispatcher does not fall back to recording melody notes without audio', async () => {
  const store = createMockStore({
    activeTrackId: 'melody',
    currentBar: 0,
    currentStep: 3,
  });
  const audioCalls = [];
  const dispatch = createUiAudioDispatcher({
    store,
    audio: {},
  });

  await dispatch({ type: 'melody.noteOn', inputId: 'keyboard:KeyS', note: 'D4', source: 'keyboard' });

  assert.deepEqual(store.calls, []);
  assert.equal(store.getState().matrix.melody[0][3], null);
  assert.equal(store.getState().currentStep, 3);
  assert.deepEqual(audioCalls, []);
});
