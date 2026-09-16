import { createBassCell } from '../app/bassActions.js';
import { createMelodyCell } from '../app/melodyActions.js';
import { createChordCell } from '../domain/chordCells.js';
import { createClipRecord } from '../domain/clipHelpers.js';
import { createDrumsCell } from '../domain/drumsCells.js';
import {
  CORE_TRACK_IDS,
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../domain/musicConstants.js';

const CHILL_TUTORIAL_BPM = 88;

const CHILL_TUTORIAL_SCORE = Object.freeze({
  drums: Object.freeze([
    Object.freeze({}),
    Object.freeze({ kick: [15], snare: [13], hihat: [13, 15] }),
    Object.freeze({ kick: [1, 7, 15], snare: [9], hihat: [1, 5, 7, 9, 13] }),
    Object.freeze({ kick: [3, 6, 12, 15], snare: [9], hihat: [1, 5, 7, 9, 13] }),
    Object.freeze({ kick: [1, 7, 15], snare: [9], hihat: [1, 5, 7, 9, 13] }),
    Object.freeze({ kick: [3, 11], snare: [9], hihat: [1, 5, 7, 9, 13] }),
    Object.freeze({ kick: [1, 3, 7, 15], snare: [9], hihat: [1, 5, 7, 9, 13] }),
    Object.freeze({ kick: [3, 11, 13], snare: [9], hihat: [1, 3, 5, 9] }),
  ]),
  chord: Object.freeze([
    Object.freeze([['Cmaj7', 1], ['Cmaj7', 13]]),
    Object.freeze([['Am7', 1], ['Amadd9', 11], ['Am7', 13]]),
    Object.freeze([['Fmaj7', 1], ['F', 11]]),
    Object.freeze([['Gsus2', 1], ['G', 9], ['G7', 15]]),
    Object.freeze([['Am', 1], ['Am', 9], ['Am7', 13]]),
    Object.freeze([['Fmaj7', 1], ['Fmaj7', 13]]),
    Object.freeze([['G', 1], ['G', 9]]),
    Object.freeze([['Cmaj7', 1], ['C', 9]]),
  ]),
  bass: Object.freeze([
    Object.freeze([]),
    Object.freeze([['A0', 11], ['A0', 15]]),
    Object.freeze([['F0', 1], ['F0', 5], ['F0', 11], ['F#0', 15]]),
    Object.freeze([['G0', 1], ['G0', 5], ['G0', 11], ['G0', 15]]),
    Object.freeze([['A0', 1], ['A0', 5], ['A0', 11], ['A0', 15]]),
    Object.freeze([['F0', 1], ['F0', 5], ['F0', 11], ['F0', 15]]),
    Object.freeze([['G0', 1], ['G0', 5], ['G0', 11], ['G0', 15]]),
    Object.freeze([['C1', 1], ['C1', 5], ['C1', 11], ['C1', 15]]),
  ]),
  melody: Object.freeze([
    Object.freeze([]),
    Object.freeze([]),
    Object.freeze([['B4', 1], ['G4', 3], ['E4', 15]]),
    Object.freeze([['G4', 1]]),
    Object.freeze([['E4', 1], ['A4', 3], ['D4', 9], ['C4', 15]]),
    Object.freeze([['E4', 1], ['D4', 3], ['G4', 9], ['D4', 11]]),
    Object.freeze([['D4', 1]]),
    Object.freeze([]),
  ]),
});

const CHILL_RECIPE_DEFINITIONS = Object.freeze({
  'phrase-drums': Object.freeze({ trackId: 'drums', bars: Object.freeze([2, 3]) }),
  'phrase-chord': Object.freeze({ trackId: 'chord', bars: Object.freeze([2, 3]) }),
  'phrase-bass': Object.freeze({ trackId: 'bass', bars: Object.freeze([2, 3]) }),
  'phrase-melody': Object.freeze({ trackId: 'melody', bars: Object.freeze([2, 3]) }),
  'second-drums': Object.freeze({ trackId: 'drums', bars: Object.freeze([4, 5]) }),
  'second-chord': Object.freeze({ trackId: 'chord', bars: Object.freeze([4, 5]) }),
  'second-bass': Object.freeze({ trackId: 'bass', bars: Object.freeze([4, 5]) }),
  'second-melody': Object.freeze({ trackId: 'melody', bars: Object.freeze([4, 5]) }),
  'home-drums': Object.freeze({ trackId: 'drums', bars: Object.freeze([6, 7]) }),
  'home-chord': Object.freeze({ trackId: 'chord', bars: Object.freeze([6, 7]) }),
  'home-bass': Object.freeze({ trackId: 'bass', bars: Object.freeze([6, 7]) }),
  'home-melody': Object.freeze({ trackId: 'melody', bars: Object.freeze([6, 7]) }),
  'intro-chord': Object.freeze({ trackId: 'chord', bars: Object.freeze([0, 1]) }),
  'intro-drums': Object.freeze({ trackId: 'drums', bars: Object.freeze([0, 1]) }),
  'intro-bass': Object.freeze({ trackId: 'bass', bars: Object.freeze([0, 1]) }),
});

function createEmptyBar() {
  return Array.from({ length: STEPS_PER_BAR }, () => null);
}

function createScoreBar(trackId, barIndex) {
  const bar = createEmptyBar();
  const score = CHILL_TUTORIAL_SCORE[trackId]?.[barIndex];
  if (!score) return bar;

  if (trackId === 'drums') {
    Object.entries(score).forEach(([instrument, steps]) => {
      steps.forEach((oneBasedStep) => {
        const stepIndex = oneBasedStep - 1;
        const currentInstruments = bar[stepIndex]?.instruments ?? [];
        bar[stepIndex] = createDrumsCell([...currentInstruments, instrument]);
      });
    });
    return bar;
  }

  score.forEach(([value, oneBasedStep]) => {
    const stepIndex = oneBasedStep - 1;
    if (trackId === 'chord') bar[stepIndex] = createChordCell(value);
    if (trackId === 'bass') bar[stepIndex] = createBassCell(value, '8n', 'bass-8th-swing');
    if (trackId === 'melody') bar[stepIndex] = createMelodyCell(value);
  });
  return bar;
}

function createChillTutorialMatrix() {
  return Object.fromEntries(
    CORE_TRACK_IDS.map((trackId) => [
      trackId,
      Array.from({ length: TOTAL_BARS }, (_, barIndex) => createScoreBar(trackId, barIndex)),
    ]),
  );
}

function ensureClip(clips, trackId, bar) {
  const existing = clips.ids
    .map((clipId) => clips.byId[clipId])
    .find((clip) => clip?.trackId === trackId && clip.bar === bar);
  if (existing) return clips;

  const clip = createClipRecord(trackId, bar);
  return {
    ids: [...clips.ids, clip.id],
    byId: {
      ...clips.byId,
      [clip.id]: clip,
    },
  };
}

function applyChillTutorialRecipe(appState, recipeId) {
  const recipe = CHILL_RECIPE_DEFINITIONS[recipeId];
  if (!recipe) return null;

  const nextTrackMatrix = appState.matrix[recipe.trackId].map((bar) => [...bar]);
  let nextClips = appState.clips;
  recipe.bars.forEach((barIndex) => {
    nextTrackMatrix[barIndex] = createScoreBar(recipe.trackId, barIndex);
    nextClips = ensureClip(nextClips, recipe.trackId, barIndex);
  });

  const selectedBar = recipe.bars[0];
  const selectedClip = nextClips.byId[`${recipe.trackId}-bar-${selectedBar}`];
  return {
    activeTrackId: recipe.trackId,
    bpm: CHILL_TUTORIAL_BPM,
    clips: nextClips,
    matrix: {
      ...appState.matrix,
      [recipe.trackId]: nextTrackMatrix,
    },
    selectedBar,
    selectedClipId: selectedClip?.id ?? null,
  };
}

function createChillTutorialAppState(appState) {
  let nextClips = appState.clips;
  CORE_TRACK_IDS.forEach((trackId) => {
    for (let bar = 0; bar < TOTAL_BARS; bar += 1) {
      nextClips = ensureClip(nextClips, trackId, bar);
    }
  });

  return {
    activeTrackId: 'drums',
    bpm: CHILL_TUTORIAL_BPM,
    clips: nextClips,
    currentBar: 0,
    currentStep: 0,
    matrix: Object.fromEntries(
      Object.entries(appState.matrix).map(([trackId, trackMatrix]) => [
        trackId,
        CORE_TRACK_IDS.includes(trackId)
          ? trackMatrix.map(() => createEmptyBar())
          : trackMatrix,
      ]),
    ),
    seekBar: 0,
    seekStep: 0,
    selectedBar: 2,
    selectedClipId: 'drums-bar-2',
  };
}

function isChillTutorialScoreComplete(matrix) {
  const expected = createChillTutorialMatrix();
  return CORE_TRACK_IDS.every((trackId) => (
    JSON.stringify(matrix?.[trackId]) === JSON.stringify(expected[trackId])
  ));
}

export {
  CHILL_RECIPE_DEFINITIONS,
  CHILL_TUTORIAL_BPM,
  CHILL_TUTORIAL_SCORE,
  applyChillTutorialRecipe,
  createChillTutorialAppState,
  createChillTutorialMatrix,
  createScoreBar,
  isChillTutorialScoreComplete,
};
