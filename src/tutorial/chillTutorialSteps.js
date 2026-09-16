import { CHILL_TUTORIAL_RUN_STATES } from './chillTutorialRuntime.js';

const CHILL_TUTORIAL_STAGES = Object.freeze([
  '前奏',
  '主题',
  '变化',
  '收尾',
  '完整播放',
]);

function target(trackId, bars) {
  return Object.freeze({
    bars: Object.freeze([...bars]),
    trackId,
  });
}

function createAnchorSelectors(targets) {
  if (targets.length === 0) {
    return Object.freeze(['[data-tutorial-anchor="transport"]']);
  }

  return Object.freeze(targets.flatMap(({ bars, trackId }) => (
    bars.map((bar) => `[data-tutorial-anchor="${trackId}-bar-${bar}"]`)
  )));
}

function step({
  completionMessage = '',
  explicit = false,
  focusBar = null,
  focusTrackId = null,
  id,
  instruction,
  listenFor,
  previewBar,
  previewSteps,
  primaryLabel,
  recipeIds = [],
  stageIndex,
  targets = [],
}) {
  const frozenTargets = Object.freeze([...targets]);
  return Object.freeze({
    anchorSelectors: createAnchorSelectors(frozenTargets),
    completionMessage,
    explicit,
    focusBar,
    focusTrackId,
    id,
    instruction,
    listenFor,
    preferredPlacements: Object.freeze(['top', 'bottom', 'right', 'left']),
    preview: Object.freeze({
      bar: previewBar,
      maxPlaybackSteps: previewSteps,
    }),
    primaryLabel,
    recipeIds: Object.freeze([...recipeIds]),
    stageIndex,
    stageLabel: CHILL_TUTORIAL_STAGES[stageIndex],
    targets: frozenTargets,
  });
}

const CHILL_TUTORIAL_STEPS = Object.freeze([
  step({
    id: 'intro-harmony',
    stageIndex: 0,
    instruction: '先生成第 1–2 小节的和弦，完成前奏的和声部分。',
    listenFor: '听第 1–2 小节的和弦变化，其他轨道暂时没有进入。',
    primaryLabel: '加入和声并试听',
    recipeIds: ['intro-chord'],
    targets: [target('chord', [0, 1])],
    focusTrackId: 'chord',
    focusBar: 0,
    previewBar: 0,
    previewSteps: 32,
  }),
  step({
    id: 'intro-rhythm',
    stageIndex: 0,
    instruction: '再加入前奏里的鼓和低音，旋律继续保持空白。',
    listenFor: '比较两个小节：第 1 小节较空，第 2 小节开始出现鼓和低音。',
    primaryLabel: '加入节奏并试听',
    recipeIds: ['intro-drums', 'intro-bass'],
    targets: [target('drums', [0, 1]), target('bass', [0, 1])],
    focusTrackId: 'drums',
    focusBar: 1,
    previewBar: 0,
    previewSteps: 32,
  }),
  step({
    id: 'theme-skeleton',
    stageIndex: 1,
    instruction: '加入第 3–4 小节的鼓和低音，先建立主题的节奏骨架。',
    listenFor: '先只听鼓和低音，确认主题的节奏和低音走向。',
    primaryLabel: '建立骨架并试听',
    recipeIds: ['phrase-drums', 'phrase-bass'],
    targets: [target('drums', [2, 3]), target('bass', [2, 3])],
    focusTrackId: 'drums',
    focusBar: 2,
    previewBar: 2,
    previewSteps: 16,
  }),
  step({
    id: 'theme-harmony',
    stageIndex: 1,
    instruction: '在第 3–4 小节加入和弦，完成主题的和声进行。',
    listenFor: '听加入和弦前后的区别，鼓和低音内容保持不变。',
    primaryLabel: '加入和声并试听',
    recipeIds: ['phrase-chord'],
    targets: [target('chord', [2, 3])],
    focusTrackId: 'chord',
    focusBar: 2,
    previewBar: 2,
    previewSteps: 16,
  }),
  step({
    id: 'theme-melody',
    stageIndex: 1,
    instruction: '在第 3–4 小节加入旋律，完成第一句话。',
    listenFor: '听旋律加入后，四条轨道怎样组合成完整主题。',
    primaryLabel: '加入旋律并试听',
    recipeIds: ['phrase-melody'],
    targets: [target('melody', [2, 3])],
    focusTrackId: 'melody',
    focusBar: 2,
    previewBar: 2,
    previewSteps: 32,
  }),
  step({
    id: 'second-phrase',
    stageIndex: 2,
    instruction: '生成第 5–6 小节的四条轨道，完成第二句话。',
    listenFor: '比较第 3–4 和第 5–6 小节，听两句话之间的变化。',
    primaryLabel: '生成第二句并试听',
    recipeIds: ['second-drums', 'second-chord', 'second-bass', 'second-melody'],
    targets: [
      target('drums', [4, 5]),
      target('chord', [4, 5]),
      target('bass', [4, 5]),
      target('melody', [4, 5]),
    ],
    focusTrackId: 'drums',
    focusBar: 4,
    previewBar: 2,
    previewSteps: 64,
  }),
  step({
    id: 'ending',
    stageIndex: 3,
    instruction: '生成第 7–8 小节的四条轨道，完成整段收尾。',
    listenFor: '听第 8 小节怎样减少鼓和旋律，并让和声与低音结束在 C。',
    primaryLabel: '完成收尾并试听',
    recipeIds: ['home-drums', 'home-chord', 'home-bass', 'home-melody'],
    targets: [
      target('drums', [6, 7]),
      target('chord', [6, 7]),
      target('bass', [6, 7]),
      target('melody', [6, 7]),
    ],
    focusTrackId: 'chord',
    focusBar: 7,
    previewBar: 4,
    previewSteps: 64,
  }),
  step({
    id: 'complete-playback',
    stageIndex: 4,
    instruction: '从第 1 小节播放到第 8 小节，检查四个部分是否连接顺畅。',
    listenFor: '依次确认：1–2 前奏、3–4 第一句、5–6 第二句、7–8 收尾。',
    primaryLabel: '播放完整成品',
    recipeIds: [],
    previewBar: 0,
    previewSteps: 128,
    explicit: true,
    completionMessage: '教程完成，原有的 8 小节编曲已保留。',
  }),
]);

function createChillTutorialSession() {
  return {
    appliedRecipeIds: [],
    completed: false,
    completedStepIds: [],
    hasStarted: false,
    paused: false,
    runState: CHILL_TUTORIAL_RUN_STATES.IDLE,
    stepIndex: 0,
  };
}

export {
  CHILL_TUTORIAL_STAGES,
  CHILL_TUTORIAL_STEPS,
  createChillTutorialSession,
};
