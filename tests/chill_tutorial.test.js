import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import useMusicStore from '../src/store/useMusicStore.js';
import {
  CHILL_RECIPE_DEFINITIONS,
  CHILL_TUTORIAL_BPM,
  CHILL_TUTORIAL_SCORE,
  createChillTutorialAppState,
  createChillTutorialMatrix,
  isChillTutorialScoreComplete,
} from '../src/tutorial/chillTutorialScore.js';
import { applyChillTutorialRecipeSequence } from '../src/tutorial/chillTutorialRecipeSequence.js';
import {
  CHILL_TUTORIAL_STAGES,
  CHILL_TUTORIAL_STEPS,
  createChillTutorialSession,
} from '../src/tutorial/chillTutorialSteps.js';
import {
  CHILL_TUTORIAL_RUN_STATES,
  advanceChillTutorialStep,
  beginChillTutorialPreview,
  cancelChillTutorialPreview,
  completeChillTutorialPreview,
} from '../src/tutorial/chillTutorialRuntime.js';
import {
  TUTORIAL_CATALOG,
  TUTORIAL_IDS,
} from '../src/tutorial/tutorialCatalog.js';
import {
  getContextualTutorialPosition,
  getUnionRect,
} from '../src/tutorial/contextualTutorialPosition.js';

const APPROVED_CHILL_SCORE = {
  drums: [
    {},
    { kick: [15], snare: [13], hihat: [13, 15] },
    { kick: [1, 7, 15], snare: [9], hihat: [1, 5, 7, 9, 13] },
    { kick: [3, 6, 12, 15], snare: [9], hihat: [1, 5, 7, 9, 13] },
    { kick: [1, 7, 15], snare: [9], hihat: [1, 5, 7, 9, 13] },
    { kick: [3, 11], snare: [9], hihat: [1, 5, 7, 9, 13] },
    { kick: [1, 3, 7, 15], snare: [9], hihat: [1, 5, 7, 9, 13] },
    { kick: [3, 11, 13], snare: [9], hihat: [1, 3, 5, 9] },
  ],
  chord: [
    [['Cmaj7', 1], ['Cmaj7', 13]],
    [['Am7', 1], ['Amadd9', 11], ['Am7', 13]],
    [['Fmaj7', 1], ['F', 11]],
    [['Gsus2', 1], ['G', 9], ['G7', 15]],
    [['Am', 1], ['Am', 9], ['Am7', 13]],
    [['Fmaj7', 1], ['Fmaj7', 13]],
    [['G', 1], ['G', 9]],
    [['Cmaj7', 1], ['C', 9]],
  ],
  bass: [
    [],
    [['A0', 11], ['A0', 15]],
    [['F0', 1], ['F0', 5], ['F0', 11], ['F#0', 15]],
    [['G0', 1], ['G0', 5], ['G0', 11], ['G0', 15]],
    [['A0', 1], ['A0', 5], ['A0', 11], ['A0', 15]],
    [['F0', 1], ['F0', 5], ['F0', 11], ['F0', 15]],
    [['G0', 1], ['G0', 5], ['G0', 11], ['G0', 15]],
    [['C1', 1], ['C1', 5], ['C1', 11], ['C1', 15]],
  ],
  melody: [
    [],
    [],
    [['B4', 1], ['G4', 3], ['E4', 15]],
    [['G4', 1]],
    [['E4', 1], ['A4', 3], ['D4', 9], ['C4', 15]],
    [['E4', 1], ['D4', 3], ['G4', 9], ['D4', 11]],
    [['D4', 1]],
    [],
  ],
};

const EXPECTED_RECIPE_GROUPS = [
  ['intro-chord'],
  ['intro-drums', 'intro-bass'],
  ['phrase-drums', 'phrase-bass'],
  ['phrase-chord'],
  ['phrase-melody'],
  ['second-drums', 'second-chord', 'second-bass', 'second-melody'],
  ['home-drums', 'home-chord', 'home-bass', 'home-melody'],
  [],
];

test('tutorial catalog keeps Chill first with the shortened entry copy', () => {
  assert.deepEqual(
    TUTORIAL_CATALOG.map((tutorial) => tutorial.id),
    [TUTORIAL_IDS.CHILL_RAINY_STREET, TUTORIAL_IDS.LEGACY_BASICS],
  );
  assert.equal(TUTORIAL_CATALOG[0].runtime, 'contextual');
  assert.equal(TUTORIAL_CATALOG[0].duration, '3–4 分钟');
  assert.equal(
    TUTORIAL_CATALOG[0].description,
    '用 88 BPM 和四条轨道，完成一段有前奏、主题、变化和收尾的 8 小节编曲。',
  );
  assert.equal(TUTORIAL_CATALOG[1].runtime, 'sidebar');
});

test('Chill tutorial exposes the approved eight steps and five chronological stages', () => {
  assert.deepEqual(CHILL_TUTORIAL_STAGES, ['前奏', '主题', '变化', '收尾', '完整播放']);
  assert.equal(CHILL_TUTORIAL_STEPS.length, 8);
  assert.deepEqual(
    CHILL_TUTORIAL_STEPS.map((step) => step.stageLabel),
    ['前奏', '前奏', '主题', '主题', '主题', '变化', '收尾', '完整播放'],
  );
  assert.deepEqual(
    CHILL_TUTORIAL_STEPS.map((step) => step.recipeIds),
    EXPECTED_RECIPE_GROUPS,
  );
  assert.equal(CHILL_TUTORIAL_STEPS.at(-1).explicit, true);
  assert.deepEqual(
    CHILL_TUTORIAL_STEPS.at(-1).anchorSelectors,
    ['[data-tutorial-anchor="transport"]'],
  );
  assert.deepEqual(createChillTutorialSession(), {
    appliedRecipeIds: [],
    completed: false,
    completedStepIds: [],
    hasStarted: false,
    paused: false,
    runState: CHILL_TUTORIAL_RUN_STATES.IDLE,
    stepIndex: 0,
  });
});

test('the eight steps use the approved preview ranges and complete copy', () => {
  assert.deepEqual(
    CHILL_TUTORIAL_STEPS.map((step) => step.preview),
    [
      { bar: 0, maxPlaybackSteps: 32 },
      { bar: 0, maxPlaybackSteps: 32 },
      { bar: 2, maxPlaybackSteps: 16 },
      { bar: 2, maxPlaybackSteps: 16 },
      { bar: 2, maxPlaybackSteps: 32 },
      { bar: 2, maxPlaybackSteps: 64 },
      { bar: 4, maxPlaybackSteps: 64 },
      { bar: 0, maxPlaybackSteps: 128 },
    ],
  );
  assert.deepEqual(
    CHILL_TUTORIAL_STEPS.map((step) => step.primaryLabel),
    [
      '加入和声并试听',
      '加入节奏并试听',
      '建立骨架并试听',
      '加入和声并试听',
      '加入旋律并试听',
      '生成第二句并试听',
      '完成收尾并试听',
      '播放完整成品',
    ],
  );
  assert.equal(
    CHILL_TUTORIAL_STEPS.at(-1).completionMessage,
    '教程完成，原有的 8 小节编曲已保留。',
  );
});

test('Chill step copy stays concise and removes the old detail hierarchy', () => {
  CHILL_TUTORIAL_STEPS.forEach((step) => {
    assert.ok(step.instruction);
    assert.ok(step.listenFor);
    assert.equal(Object.hasOwn(step, 'title'), false);
    assert.equal(Object.hasOwn(step, 'detail'), false);
    assert.equal(Object.hasOwn(step, 'actionSummary'), false);
    assert.equal(Object.hasOwn(step, 'recipeId'), false);
  });
});

test('multi-track steps expose every related Clip anchor for union highlighting', () => {
  assert.equal(CHILL_TUTORIAL_STEPS[1].anchorSelectors.length, 4);
  assert.equal(CHILL_TUTORIAL_STEPS[5].anchorSelectors.length, 8);
  assert.equal(CHILL_TUTORIAL_STEPS[6].anchorSelectors.length, 8);
  assert.deepEqual(CHILL_TUTORIAL_STEPS[5].targets.map((target) => target.trackId), [
    'drums',
    'chord',
    'bass',
    'melody',
  ]);
});

test('Chill preview lifecycle records grouped recipes by step and deduplicates retries', () => {
  const initialSession = createChillTutorialSession();
  const previewing = beginChillTutorialPreview(initialSession, {
    recipeIds: ['intro-drums', 'intro-bass'],
    stepId: 'intro-rhythm',
  });
  assert.equal(previewing.stepIndex, 0);
  assert.equal(previewing.runState, CHILL_TUTORIAL_RUN_STATES.PREVIEWING);
  assert.deepEqual(previewing.appliedRecipeIds, ['intro-drums', 'intro-bass']);
  assert.deepEqual(previewing.completedStepIds, ['intro-rhythm']);

  const completed = completeChillTutorialPreview(previewing);
  assert.equal(completed.stepIndex, 0);
  assert.equal(completed.runState, CHILL_TUTORIAL_RUN_STATES.COMPLETED);

  const advanced = advanceChillTutorialStep(completed, CHILL_TUTORIAL_STEPS.length);
  assert.equal(advanced.stepIndex, 1);
  assert.equal(advanced.runState, CHILL_TUTORIAL_RUN_STATES.IDLE);

  const retrying = beginChillTutorialPreview(
    cancelChillTutorialPreview(previewing),
    { recipeIds: ['intro-drums', 'intro-bass'], stepId: 'intro-rhythm' },
  );
  assert.deepEqual(retrying.appliedRecipeIds, ['intro-drums', 'intro-bass']);
  assert.deepEqual(retrying.completedStepIds, ['intro-rhythm']);
});

test('the immutable Chill score matches every approved note and step', () => {
  assert.deepEqual(CHILL_TUTORIAL_SCORE, APPROVED_CHILL_SCORE);
  assert.equal(CHILL_TUTORIAL_BPM, 88);
  assert.deepEqual(
    Object.keys(CHILL_RECIPE_DEFINITIONS).sort(),
    EXPECTED_RECIPE_GROUPS.flat().sort(),
  );
});

test('grouped recipe execution composes to the exact approved master at 88 BPM', () => {
  const initialState = useMusicStore.getInitialState();
  let tutorialState = {
    ...initialState,
    ...createChillTutorialAppState(initialState),
  };
  const immutableTrackState = {
    primaryChordTrackId: tutorialState.primaryChordTrackId,
    trackInstancesById: tutorialState.trackInstancesById,
    trackOrder: tutorialState.trackOrder,
    visibleTrackIds: tutorialState.visibleTrackIds,
    volumes: tutorialState.volumes,
  };

  assert.equal(tutorialState.bpm, 88);
  assert.equal(isChillTutorialScoreComplete(tutorialState.matrix), false);
  assert.equal(tutorialState.clips.ids.length, 32);

  for (const step of CHILL_TUTORIAL_STEPS.slice(0, -1)) {
    const patch = applyChillTutorialRecipeSequence(tutorialState, step.recipeIds, {
      focusBar: step.focusBar,
      focusTrackId: step.focusTrackId,
    });
    assert.ok(patch, step.id);
    tutorialState = { ...tutorialState, ...patch };
  }

  assert.equal(isChillTutorialScoreComplete(tutorialState.matrix), true);
  assert.deepEqual(tutorialState.matrix, {
    ...tutorialState.matrix,
    ...createChillTutorialMatrix(),
  });
  assert.equal(tutorialState.bpm, 88);
  assert.deepEqual({
    primaryChordTrackId: tutorialState.primaryChordTrackId,
    trackInstancesById: tutorialState.trackInstancesById,
    trackOrder: tutorialState.trackOrder,
    visibleTrackIds: tutorialState.visibleTrackIds,
    volumes: tutorialState.volumes,
  }, immutableTrackState);

  const bassCells = tutorialState.matrix.bass.flat().filter(Boolean);
  assert.equal(bassCells.every((cell) => cell.duration === '8n'), true);
  assert.equal(bassCells.every((cell) => cell.grooveTemplateId === 'bass-8th-swing'), true);
  assert.equal(
    tutorialState.matrix.melody.flat().filter(Boolean).every((cell) => cell.durationSteps === undefined),
    true,
  );
});

test('recipe sequences fail atomically and preserve the configured focus', () => {
  const initialState = useMusicStore.getInitialState();
  const tutorialState = {
    ...initialState,
    ...createChillTutorialAppState(initialState),
  };
  const patch = applyChillTutorialRecipeSequence(
    tutorialState,
    ['intro-drums', 'intro-bass'],
    { focusBar: 1, focusTrackId: 'drums' },
  );
  assert.equal(patch.activeTrackId, 'drums');
  assert.equal(patch.selectedBar, 1);
  assert.equal(patch.selectedClipId, 'drums-bar-1');
  assert.equal(patch.matrix.drums[1].some(Boolean), true);
  assert.equal(patch.matrix.bass[1].some(Boolean), true);
  assert.equal(applyChillTutorialRecipeSequence(tutorialState, ['intro-drums', 'missing']), null);
  assert.equal(tutorialState.matrix.drums[1].some(Boolean), false);
});

test('Chill App batches one step into one Store patch and advances only after playback', async () => {
  const source = await readFile(new URL('../src/app/App.jsx', import.meta.url), 'utf8');

  assert.match(source, /applyChillTutorialRecipeSequence\([\s\S]*step\.recipeIds/);
  assert.match(source, /withUndoCheckpoint\(\(\) => \{\s*useMusicStore\.setState\(recipePatch\);/);
  assert.match(source, /audioEngine\.setPlaybackCompleteHandler\?\.\(\(\) => \{/);
  assert.match(source, /completeChillTutorialPreview\(session\)/);
  assert.match(source, /CHILL_STEP_AUTO_ADVANCE_MS = 300/);
  assert.match(source, /CHILL_COMPLETE_AUTO_ADVANCE_MS = 800/);
  assert.match(source, /completedSteps\.flatMap\(\(step\) => step\.recipeIds\)/);
  assert.match(source, /cancelChillPreviewPlayback\(\);[\s\S]*TRANSPORT_STOP/);
});

test('the Chill coachmark renders only the simplified information hierarchy', async () => {
  const source = await readFile(
    new URL('../src/app/components/ChillTutorialOverlay.jsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /\{stepIndex \+ 1\}\/\{stepCount\} · \{step\.stageLabel\}/);
  assert.match(source, /正在定位这一步，请稍候…/);
  assert.match(source, /重新试听并继续/);
  assert.match(source, /退出教程/);
  assert.doesNotMatch(source, /<h2|编曲动作|展开说明|为什么这样编|chill-coachmark-progress/);
});

test('union target rectangles span all highlighted Clips', () => {
  assert.deepEqual(getUnionRect([
    { left: 40, right: 100, top: 120, bottom: 150 },
    { left: 180, right: 240, top: 260, bottom: 300 },
  ]), {
    bottom: 300,
    height: 180,
    left: 40,
    right: 240,
    top: 120,
    width: 200,
  });
  assert.equal(getUnionRect([]), null);
});

test('contextual placement tries top bottom right left and clamps at viewport edges', () => {
  const cardRect = { width: 200, height: 120 };
  const viewport = { width: 1000, height: 700 };

  assert.deepEqual(
    getContextualTutorialPosition({
      cardRect,
      targetRect: {
        bottom: 400,
        height: 50,
        left: 400,
        right: 500,
        top: 350,
        width: 100,
      },
      viewport,
    }),
    { left: 350, placement: 'top', top: 216 },
  );

  assert.equal(
    getContextualTutorialPosition({
      cardRect,
      targetRect: {
        bottom: 80,
        height: 50,
        left: 400,
        right: 500,
        top: 30,
        width: 100,
      },
      viewport,
    }).placement,
    'bottom',
  );

  assert.equal(
    getContextualTutorialPosition({
      cardRect,
      placements: ['right', 'left'],
      targetRect: {
        bottom: 330,
        height: 60,
        left: 80,
        right: 140,
        top: 270,
        width: 60,
      },
      viewport,
    }).placement,
    'right',
  );

  const clamped = getContextualTutorialPosition({
    cardRect: { width: 360, height: 300 },
    targetRect: {
      bottom: 696,
      height: 20,
      left: 970,
      right: 990,
      top: 676,
      width: 20,
    },
    viewport: { width: 400, height: 340 },
  });
  assert.equal(clamped.left, 28);
  assert.equal(clamped.top, 28);
});
