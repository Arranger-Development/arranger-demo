import { applyChillTutorialRecipe } from './chillTutorialScore.js';

function applyChillTutorialRecipeSequence(
  appState,
  recipeIds,
  { focusBar = null, focusTrackId = null } = {},
) {
  if (!Array.isArray(recipeIds) || recipeIds.length === 0) return null;

  let nextState = appState;
  for (const recipeId of recipeIds) {
    const recipePatch = applyChillTutorialRecipe(nextState, recipeId);
    if (!recipePatch) return null;
    nextState = {
      ...nextState,
      ...recipePatch,
    };
  }

  const selectedBar = focusBar ?? nextState.selectedBar;
  const activeTrackId = focusTrackId ?? nextState.activeTrackId;
  const selectedClip = nextState.clips.byId[`${activeTrackId}-bar-${selectedBar}`];
  return {
    activeTrackId,
    bpm: nextState.bpm,
    clips: nextState.clips,
    matrix: nextState.matrix,
    selectedBar,
    selectedClipId: selectedClip?.id ?? nextState.selectedClipId,
  };
}

export { applyChillTutorialRecipeSequence };
