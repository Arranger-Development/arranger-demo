import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BAR_NUMBERS, TRACK_UI } from '../src/app/uiShellData.js';
import { createInitialClips } from '../src/store/slices/clipsSlice.js';
import { createTimelineTracks } from '../src/app/timelineViewModels.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

test('createTimelineTracks decorates static track UI with clip state by bar', () => {
  const clips = createInitialClips();
  const tracks = createTimelineTracks({
    barNumbers: BAR_NUMBERS,
    clips,
    selectedBar: 0,
    trackUi: TRACK_UI,
  });

  const drums = tracks.find((track) => track.id === 'drums');
  const bass = tracks.find((track) => track.id === 'bass');
  const chord = tracks.find((track) => track.id === 'chord');

  assert.equal(tracks.length, TRACK_UI.length);
  assert.equal(drums.clip.id, 'drums-bar-0');
  assert.equal(drums.hasClip, true);
  assert.equal(drums.bars.length, BAR_NUMBERS.length);
  assert.deepEqual(drums.bars[0], {
    bar: 0,
    barNumber: 1,
    clip: drums.clipsByBar[0],
    canAddClip: false,
  });
  assert.deepEqual(drums.bars[1], {
    bar: 1,
    barNumber: 2,
    clip: null,
    canAddClip: true,
  });
  assert.equal(drums.clipsByBar.length, BAR_NUMBERS.length);
  assert.equal(drums.clipsByBar[0].id, 'drums-bar-0');
  assert.equal(drums.clipsByBar[1], null);
  assert.equal(chord.clip, null);
  assert.equal(bass.clip, null);
  assert.equal(bass.hasClip, false);
});

test('createTimelineTracks decorates chord clips with the current chord label', () => {
  const clips = createInitialClips();
  const matrix = createInitialMatrix();
  clips.ids.push('chord-bar-2');
  clips.byId['chord-bar-2'] = {
    id: 'chord-bar-2',
    trackId: 'chord',
    bar: 2,
    name: 'Chord 03',
  };
  matrix.chord[2][0] = {
    type: 'chord',
    root: 'C',
    chordRoot: 'C',
    quality: 'maj7',
    label: 'Cmaj7',
    toneRoots: ['C', 'E', 'G', 'B'],
  };
  matrix.chord[2][1] = {
    type: 'chord',
    root: 'C',
    chordRoot: 'C',
    quality: 'maj7',
    label: 'Cmaj7',
    toneRoots: ['C', 'E', 'G', 'B'],
  };
  matrix.chord[2][2] = { type: 'notes', notes: ['A'], label: 'A' };
  matrix.chord[2][5] = { type: 'notes', notes: ['D', 'F'], label: 'D/F' };

  const tracks = createTimelineTracks({
    barNumbers: BAR_NUMBERS,
    clips,
    matrix,
    selectedBar: 2,
    trackUi: TRACK_UI,
  });
  const chord = tracks.find((track) => track.id === 'chord');

  assert.equal(chord.clip.chordLabel, 'Cmaj7');
  assert.equal(chord.bars[2].clip.chordLabel, 'Cmaj7');
});

test('createTimelineTracks treats silent chord source metadata as empty', () => {
  const clips = createInitialClips();
  const matrix = createInitialMatrix();
  clips.ids.push('chord-bar-2');
  clips.byId['chord-bar-2'] = {
    id: 'chord-bar-2',
    trackId: 'chord',
    bar: 2,
    name: 'Chord 03',
  };
  matrix.chord[2][0] = {
    type: 'chord-source',
    label: 'F',
    sourceChordLabel: 'F',
    progressionTemplateId: 'doowop',
    selectedGrooveTemplateId: 'custom-rhythm',
  };

  const tracks = createTimelineTracks({
    barNumbers: BAR_NUMBERS,
    clips,
    matrix,
    selectedBar: 2,
    trackUi: TRACK_UI,
  });
  const chord = tracks.find((track) => track.id === 'chord');

  assert.equal(chord.clip.hasContent, false);
  assert.equal(chord.clip.chordLabel, null);
  assert.equal(chord.bars[2].clip.hasContent, false);
  assert.equal(chord.bars[2].clip.chordLabel, null);
});

test('createTimelineTracks marks drums clips with matrix content as non-empty', () => {
  const clips = createInitialClips();
  const matrix = createInitialMatrix();
  matrix.drums[0][0] = { instruments: ['kick'] };

  const tracks = createTimelineTracks({
    barNumbers: BAR_NUMBERS,
    clips,
    matrix,
    selectedBar: 0,
    trackUi: TRACK_UI,
  });
  const drums = tracks.find((track) => track.id === 'drums');

  assert.equal(drums.clip.hasContent, true);
  assert.equal(drums.bars[0].clip.hasContent, true);
});

test('createTimelineTracks marks tracks with clips outside the selected bar', () => {
  const clips = createInitialClips();
  clips.ids.push('bass-bar-2');
  clips.byId['bass-bar-2'] = {
    id: 'bass-bar-2',
    trackId: 'bass',
    bar: 2,
    name: 'Bass 01',
  };

  const tracks = createTimelineTracks({
    barNumbers: BAR_NUMBERS,
    clips,
    selectedBar: 0,
    trackUi: TRACK_UI,
  });
  const bass = tracks.find((track) => track.id === 'bass');

  assert.equal(bass.clip, null);
  assert.equal(bass.hasClip, true);
  assert.equal(bass.clipsByBar[2].id, 'bass-bar-2');
});

test('createTimelineTracks uses live store volumes for the left track controls', () => {
  const tracks = createTimelineTracks({
    barNumbers: BAR_NUMBERS,
    clips: createInitialClips(),
    selectedBar: 0,
    trackUi: TRACK_UI,
    volumes: {
      drums: -12,
      bass: -3,
      chord: 0,
      melody: 0,
    },
  });
  const drums = tracks.find((track) => track.id === 'drums');
  const bass = tracks.find((track) => track.id === 'bass');

  assert.equal(drums.volume.value, -12);
  assert.equal(drums.volume.label, '-12dB');
  assert.equal(drums.volume.level, 40);
  assert.equal(bass.volume.value, -3);
  assert.equal(bass.volume.label, '-3dB');
});
