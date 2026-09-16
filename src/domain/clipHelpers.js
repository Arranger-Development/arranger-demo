import { getTrackTypeFromInstanceId } from './trackInstances.js';

const CLIP_TRACK_LABELS = Object.freeze({
  bass: 'Bass',
  chord: 'Chord',
  drums: 'Drum',
  melody: 'Melody',
  pad: 'Pad',
  sample: 'Sampler',
  vocal: 'Vocal',
});

function createClipId(trackId, bar) {
  return `${trackId}-bar-${bar}`;
}

function formatClipName(trackId, bar) {
  const trackType = getTrackTypeFromInstanceId(trackId);
  const label = CLIP_TRACK_LABELS[trackType] ?? trackId;
  const barNumber = String(bar + 1).padStart(2, '0');

  return `${label} ${barNumber}`;
}

function createClipRecord(trackId, bar) {
  return {
    id: createClipId(trackId, bar),
    trackId,
    bar,
    name: formatClipName(trackId, bar),
  };
}

export {
  CLIP_TRACK_LABELS,
  createClipId,
  createClipRecord,
  formatClipName,
};
