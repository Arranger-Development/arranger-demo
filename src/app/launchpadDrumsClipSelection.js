import { selectLaunchpadTrackClip } from './launchpadClipSelection.js';

function selectLaunchpadDrumsClip({
  bar,
  canSelectClip = () => true,
  dispatchSeek = () => {},
  store,
  withUndoCheckpoint = (callback) => callback(),
} = {}) {
  return selectLaunchpadTrackClip({
    bar,
    canSelectClip,
    dispatchSeek,
    store,
    trackId: 'drums',
    withUndoCheckpoint,
  });
}

export { selectLaunchpadDrumsClip };
