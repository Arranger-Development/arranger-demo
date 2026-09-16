import { selectLaunchpadTrackClip } from './launchpadClipSelection.js';

function selectLaunchpadChordClip({
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
    trackId: 'chord',
    withUndoCheckpoint,
  });
}

export { selectLaunchpadChordClip };
