import { selectLaunchpadTrackClip } from './launchpadClipSelection.js';

function selectLaunchpadMelodyClip({
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
    trackId: 'melody',
    withUndoCheckpoint,
  });
}

export { selectLaunchpadMelodyClip };
