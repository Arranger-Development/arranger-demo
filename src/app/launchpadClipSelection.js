import { getTimelineBars } from '../domain/projectLength.js';
import { getTrackType } from '../domain/trackInstances.js';

const LAUNCHPAD_TRACK_IDS = Object.freeze(['drums', 'chord', 'melody']);

function isValidBar(bar, state) {
  return Number.isInteger(bar) && bar >= 0 && bar < getTimelineBars(state);
}

function hasActiveTrackClip(state, trackId, trackType = trackId) {
  const selectedClip = state.clips?.byId?.[state.selectedClipId];
  return state.activeTrackId === trackId
    && getTrackType(state, trackId) === trackType
    && selectedClip?.trackId === trackId;
}

function selectLaunchpadTrackClip({
  bar,
  canSelectClip = () => true,
  dispatchSeek = () => {},
  store,
  trackId,
  withUndoCheckpoint = (callback) => callback(),
} = {}) {
  if (
    !isValidBar(bar, store?.getState?.())
    || !LAUNCHPAD_TRACK_IDS.includes(trackId)
    || typeof store?.getState !== 'function'
  ) {
    return { ok: false, reason: 'invalid-selection' };
  }

  const state = store.getState();
  const activeTrackId = getTrackType(state, state.activeTrackId) === trackId
    ? state.activeTrackId
    : null;
  if (!activeTrackId || !hasActiveTrackClip(state, activeTrackId, trackId)) {
    return { ok: false, reason: `inactive-${trackId}` };
  }

  const existingClip = state.getClipForTrackBar(activeTrackId, bar);
  const candidateClip = existingClip ?? { bar, trackId: activeTrackId };
  if (canSelectClip(candidateClip) === false) {
    return { ok: false, reason: 'blocked' };
  }

  let selectedClip = existingClip;
  if (existingClip) {
    state.selectClip(existingClip.id);
  } else {
    withUndoCheckpoint(() => {
      selectedClip = store.getState().createClip(activeTrackId, bar);
    });
  }

  if (!selectedClip) return { ok: false, reason: 'selection-failed' };

  const nextState = store.getState();
  if (nextState.currentBar !== bar || nextState.currentStep !== 0) {
    dispatchSeek(bar, 0);
  }

  return { ok: true, created: !existingClip, bar };
}

export { selectLaunchpadTrackClip };
