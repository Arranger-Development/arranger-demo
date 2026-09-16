const CHILL_TUTORIAL_RUN_STATES = Object.freeze({
  COMPLETED: 'completed',
  IDLE: 'idle',
  PREVIEWING: 'previewing',
});

function addUniqueIds(currentIds = [], nextIds = []) {
  const uniqueIds = new Set(currentIds);
  nextIds.filter(Boolean).forEach((id) => uniqueIds.add(id));
  return [...uniqueIds];
}

function beginChillTutorialPreview(session, { recipeIds = [], stepId = null } = {}) {
  return {
    ...session,
    appliedRecipeIds: addUniqueIds(session.appliedRecipeIds, recipeIds),
    completedStepIds: addUniqueIds(session.completedStepIds, [stepId]),
    hasStarted: true,
    runState: CHILL_TUTORIAL_RUN_STATES.PREVIEWING,
  };
}

function cancelChillTutorialPreview(session) {
  if (session.runState === CHILL_TUTORIAL_RUN_STATES.IDLE) return session;
  return {
    ...session,
    runState: CHILL_TUTORIAL_RUN_STATES.IDLE,
  };
}

function completeChillTutorialPreview(session) {
  return {
    ...session,
    runState: CHILL_TUTORIAL_RUN_STATES.COMPLETED,
  };
}

function advanceChillTutorialStep(session, stepCount) {
  return {
    ...session,
    runState: CHILL_TUTORIAL_RUN_STATES.IDLE,
    stepIndex: Math.min(session.stepIndex + 1, stepCount - 1),
  };
}

export {
  CHILL_TUTORIAL_RUN_STATES,
  advanceChillTutorialStep,
  beginChillTutorialPreview,
  cancelChillTutorialPreview,
  completeChillTutorialPreview,
};
