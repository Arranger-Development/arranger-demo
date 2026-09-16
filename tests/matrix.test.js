import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  BEATS_PER_BAR,
  CHORD_SPAN,
  CORE_TRACK_IDS,
  DEFAULT_BPM,
  DRUMS_INSTRUMENT_IDS,
  EIGHTH_STEPS_PER_BAR,
  OPTIONAL_TRACK_IDS,
  ROOT_KEY,
  SCALE,
  STEPS_PER_BAR,
  TOTAL_BARS,
  TRACK_IDS,
} from '../src/domain/musicConstants.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';
import useMusicStore from '../src/store/useMusicStore.js';
import { DRUMS_COLUMNS, DRUMS_INSTRUMENTS } from '../src/data/drumsNotes.js';
import {
  MAX_TRACK_VOLUME_DB,
  MIN_TRACK_VOLUME_DB,
} from '../src/app/trackVolumeViewModels.js';

function everyCell(matrix, predicate) {
  for (const trackId of TRACK_IDS) {
    for (let barIndex = 0; barIndex < TOTAL_BARS; barIndex += 1) {
      for (let stepIndex = 0; stepIndex < STEPS_PER_BAR; stepIndex += 1) {
        if (!predicate(matrix[trackId][barIndex][stepIndex], trackId, barIndex, stepIndex)) {
          return false;
        }
      }
    }
  }
  return true;
}

beforeEach(() => {
  useMusicStore.setState(useMusicStore.getInitialState(), true);
});

test('music constants describe the v0.22 drums-based arrangement model', () => {
  assert.equal(TOTAL_BARS, 8);
  assert.equal(STEPS_PER_BAR, 16);
  assert.equal(BEATS_PER_BAR, 4);
  assert.equal(CHORD_SPAN, 4);
  assert.equal(EIGHTH_STEPS_PER_BAR, 8);
  assert.deepEqual(TRACK_IDS, ['drums', 'chord', 'bass', 'melody', 'pad', 'vocal', 'sample']);
  assert.deepEqual(CORE_TRACK_IDS, ['drums', 'chord', 'bass', 'melody']);
  assert.deepEqual(OPTIONAL_TRACK_IDS, ['pad', 'vocal', 'sample']);
  assert.deepEqual(DRUMS_INSTRUMENT_IDS, ['kick', 'snare', 'hihat']);
  assert.equal(DEFAULT_BPM, 120);
  assert.equal(ROOT_KEY, 'C');
  assert.equal(SCALE, 'Ionian');
});

test('drums notes exports use drums naming and 16 columns', () => {
  assert.equal(DRUMS_COLUMNS, 16);
  assert.deepEqual(
    DRUMS_INSTRUMENTS.map((instrument) => instrument.id),
    DRUMS_INSTRUMENT_IDS,
  );
});

test('createInitialMatrix creates all core and optional tracks with eight bars and sixteen empty steps', () => {
  const matrix = createInitialMatrix();

  assert.deepEqual(Object.keys(matrix), TRACK_IDS);
  assert.equal(Object.hasOwn(matrix, 'drums'), true);

  for (const trackId of TRACK_IDS) {
    assert.equal(matrix[trackId].length, TOTAL_BARS);
    for (const bar of matrix[trackId]) {
      assert.equal(bar.length, STEPS_PER_BAR);
      assert.equal(bar.every((cell) => cell === null), true);
    }
  }
});

test('createInitialMatrix does not share nested references', () => {
  const matrixA = createInitialMatrix();
  const matrixB = createInitialMatrix();

  matrixA.drums[0][0] = { instruments: ['kick'] };
  matrixA.drums[1][0] = { instruments: ['snare'] };

  assert.notEqual(matrixA.drums[0], matrixA.drums[1]);
  assert.notEqual(matrixA.drums[0], matrixA.bass[0]);
  assert.equal(matrixB.drums[0][0], null);
  assert.equal(matrixB.drums[1][0], null);
});

test('store starts with transport, context, volumes, and matrix defaults', () => {
  const state = useMusicStore.getState();

  assert.equal(state.bpm, DEFAULT_BPM);
  assert.equal(state.rootKey, ROOT_KEY);
  assert.equal(state.scale, SCALE);
  assert.equal(state.isPlaying, false);
  assert.equal(state.currentBar, 0);
  assert.equal(state.currentStep, 0);
  assert.equal(state.seekBar, 0);
  assert.equal(state.seekStep, 0);
  assert.equal(state.activeTrackId, 'drums');
  assert.equal(state.melodyScaleId, 'chinese');
  assert.equal(state.melodyRhythmTemplateId, null);
  assert.equal(state.melodyTimbreId, 'piano');
  assert.deepEqual(state.visibleTrackIds, CORE_TRACK_IDS);
  assert.equal(state.selectedBar, 0);
  assert.equal(state.selectedClipId, null);
  assert.deepEqual(Object.keys(state.volumes), TRACK_IDS);
  assert.equal(Object.values(state.volumes).every((volume) => volume === 0), true);
  assert.deepEqual(Object.keys(state.mutedTracks), CORE_TRACK_IDS);
  assert.equal(Object.values(state.mutedTracks).every((muted) => muted === false), true);
  assert.equal(everyCell(state.matrix, (cell) => cell === null), true);
});

test('Melody style application updates global scale and rhythm atomically', () => {
  const store = useMusicStore.getState();
  let notifications = 0;
  const unsubscribe = useMusicStore.subscribe(() => {
    notifications += 1;
  });

  assert.equal(store.setMelodyStyleTemplate('blues'), true);
  unsubscribe();
  assert.equal(notifications, 1);
  assert.equal(useMusicStore.getState().melodyScaleId, 'blues');
  assert.equal(useMusicStore.getState().melodyRhythmTemplateId, 'blues');
  assert.equal(useMusicStore.getState().melodyTimbreId, 'blues');
  assert.equal(useMusicStore.getState().setMelodyStyleTemplate('syncopation'), false);
  assert.equal(useMusicStore.getState().melodyScaleId, 'blues');
  assert.equal(useMusicStore.getState().melodyRhythmTemplateId, 'blues');
  assert.equal(useMusicStore.getState().melodyTimbreId, 'blues');
  assert.equal(useMusicStore.getState().setMelodyStyleTemplate('chinese', 'piano'), true);
  assert.equal(useMusicStore.getState().melodyTimbreId, 'piano');
  useMusicStore.getState().setMelodyScaleId('major');
  assert.equal(useMusicStore.getState().melodyScaleId, 'chinese');
});

test('addVisibleTrack adds optional tracks once and selects the new row', () => {
  const store = useMusicStore.getState();

  assert.equal(store.addVisibleTrack('vocal'), 'vocal');

  let state = useMusicStore.getState();
  assert.deepEqual(state.visibleTrackIds, ['drums', 'chord', 'bass', 'melody', 'vocal']);
  assert.equal(state.activeTrackId, 'vocal');
  assert.equal(state.selectedClipId, null);

  assert.equal(state.addVisibleTrack('vocal'), null);
  state = useMusicStore.getState();
  assert.deepEqual(state.visibleTrackIds, ['drums', 'chord', 'bass', 'melody', 'vocal']);

  assert.equal(state.addVisibleTrack('unknown'), null);
  assert.deepEqual(useMusicStore.getState().visibleTrackIds, ['drums', 'chord', 'bass', 'melody', 'vocal']);
});

test('setTrackVolume updates one track and clamps values to the supported range', () => {
  useMusicStore.getState().setTrackVolume('drums', -12);
  let { volumes } = useMusicStore.getState();

  assert.equal(volumes.drums, -12);
  assert.equal(volumes.bass, 0);

  useMusicStore.getState().setTrackVolume('drums', MIN_TRACK_VOLUME_DB - 10);
  volumes = useMusicStore.getState().volumes;
  assert.equal(volumes.drums, MIN_TRACK_VOLUME_DB);

  useMusicStore.getState().setTrackVolume('drums', MAX_TRACK_VOLUME_DB + 10);
  volumes = useMusicStore.getState().volumes;
  assert.equal(volumes.drums, MAX_TRACK_VOLUME_DB);

  useMusicStore.getState().setTrackVolume('unknown-track', -6);
  assert.deepEqual(useMusicStore.getState().volumes, volumes);
});

test('toggleTrackMute flips one valid track without changing its stored volume', () => {
  const store = useMusicStore.getState();
  store.setTrackVolume('chord', -9);

  store.toggleTrackMute('chord');
  let state = useMusicStore.getState();
  assert.equal(state.mutedTracks.chord, true);
  assert.equal(state.volumes.chord, -9);
  assert.equal(state.mutedTracks.drums, false);

  state.toggleTrackMute('chord');
  state = useMusicStore.getState();
  assert.equal(state.mutedTracks.chord, false);
  assert.equal(state.volumes.chord, -9);

  const previousMutedTracks = state.mutedTracks;
  state.toggleTrackMute('unknown-track');
  assert.equal(useMusicStore.getState().mutedTracks, previousMutedTracks);
});

test('setCell writes only the requested cell', () => {
  const cell = { instruments: ['kick'] };

  useMusicStore.getState().setCell('drums', 2, 4, cell);
  const { matrix } = useMusicStore.getState();

  assert.deepEqual(matrix.drums[2][4], cell);
  assert.equal(matrix.drums[2][3], null);
  assert.equal(matrix.drums[3][4], null);
  assert.equal(matrix.bass[2][4], null);
});

test('setTrackMatrix replaces one track with one store notification', () => {
  const nextBassTrack = createInitialMatrix().bass;
  nextBassTrack[0][0] = { type: 'bass', note: 'C1', duration: '16n' };
  nextBassTrack[3][8] = { type: 'bass', note: 'G0', duration: '16n' };
  useMusicStore.getState().setCell('drums', 2, 4, { instruments: ['kick'] });

  let notifications = 0;
  const unsubscribe = useMusicStore.subscribe(() => {
    notifications += 1;
  });
  useMusicStore.getState().setTrackMatrix('bass', nextBassTrack);
  unsubscribe();

  const { matrix } = useMusicStore.getState();
  assert.equal(notifications, 1);
  assert.deepEqual(matrix.bass, nextBassTrack);
  assert.deepEqual(matrix.drums[2][4], { instruments: ['kick'] });

  useMusicStore.getState().setTrackMatrix('unknown-track', nextBassTrack);
  assert.equal(useMusicStore.getState().matrix, matrix);
});

test('clearStep clears only the requested cell', () => {
  useMusicStore.getState().setCell('drums', 2, 4, { instruments: ['kick'] });
  useMusicStore.getState().setCell('bass', 2, 4, { note: 'C1', velocity: 100 });

  useMusicStore.getState().clearStep('drums', 2, 4);
  const { matrix } = useMusicStore.getState();

  assert.equal(matrix.drums[2][4], null);
  assert.deepEqual(matrix.bass[2][4], { note: 'C1', velocity: 100 });
});

test('clearTrack clears one track without clearing other tracks', () => {
  useMusicStore.getState().setCell('drums', 0, 0, { instruments: ['kick'] });
  useMusicStore.getState().setCell('bass', 0, 0, { note: 'C1', velocity: 100 });

  useMusicStore.getState().clearTrack('drums');
  const { matrix } = useMusicStore.getState();

  assert.equal(matrix.drums.every((bar) => bar.every((cell) => cell === null)), true);
  assert.deepEqual(matrix.bass[0][0], { note: 'C1', velocity: 100 });
});

test('clearTrack removes Chord notes and source metadata without touching other tracks', () => {
  useMusicStore.getState().setCell('chord', 0, 0, {
    chordName: 'C',
    progressionTemplateId: 'doowop',
    selectedGrooveTemplateId: 'block-basic',
    type: 'chord-source',
  });
  useMusicStore.getState().setCell('chord', 0, 4, {
    chordName: 'C',
    grooveTemplateId: 'block-basic',
    type: 'chord',
  });
  useMusicStore.getState().setCell('bass', 0, 0, { note: 'C1', velocity: 100 });

  useMusicStore.getState().clearTrack('chord');
  const { matrix } = useMusicStore.getState();

  assert.equal(matrix.chord.every((bar) => bar.every((cell) => cell === null)), true);
  assert.deepEqual(matrix.bass[0][0], { note: 'C1', velocity: 100 });
});

test('clearMatrix resets the full matrix', () => {
  useMusicStore.getState().setCell('drums', 0, 0, { instruments: ['kick'] });
  useMusicStore.getState().setCell('bass', 0, 0, { note: 'C1', velocity: 100 });

  useMusicStore.getState().clearMatrix();
  const { matrix } = useMusicStore.getState();

  assert.equal(everyCell(matrix, (cell) => cell === null), true);
});
