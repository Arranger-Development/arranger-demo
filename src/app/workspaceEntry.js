import { createClipRecord } from '../domain/clipHelpers.js';
import { createMultimodalRecommendationAppState } from './multimodalRecommendation.js';

// Called once at a home/AI entry, never when switching workspace modes.
export function createWorkspaceEntryState(initialState, { destination = 'creation', recommendation } = {}) {
  const blank = {
    ...initialState,
    matrix: structuredClone(initialState.matrix),
    clips: { ids: [], byId: {} },
    selectedClipId: null,
  };
  if (!recommendation) return blank;
  if (destination === 'jam') return { ...blank, bpm: recommendation.bpm };
  return { ...blank, ...createMultimodalRecommendationAppState(recommendation) };
}

// The first legacy lesson explicitly teaches opening this demonstration clip.
export function createLegacyTutorialEntryState(initialState) {
  const blank = createWorkspaceEntryState(initialState);
  const clip = createClipRecord('drums', 0);
  return { ...blank, clips: { ids: [clip.id], byId: { [clip.id]: clip } } };
}
