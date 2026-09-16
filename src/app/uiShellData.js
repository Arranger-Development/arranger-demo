import {
  OPTIONAL_TRACK_IDS,
  TOTAL_BARS,
  TRACK_IDS,
} from '../domain/musicConstants.js';
import { CHORD_GRID_PITCHES } from '../domain/chordCells.js';
import { createTrackVolumeView } from './trackVolumeViewModels.js';
import { TRACK_TYPE_LABELS, getTrackTypeFromInstanceId } from '../domain/trackInstances.js';

const trackLabels = {
  drums: 'Drums',
  bass: 'Bass',
  chord: 'Chord',
  melody: 'Melody',
  pad: 'Pad',
  sample: 'Sampler',
  vocal: 'Vocal',
};

const TRACK_UI = Object.freeze(
  TRACK_IDS.map((id) => Object.freeze({
    id,
    label: trackLabels[id],
    volume: createTrackVolumeView(),
  })),
);

function getTrackUiByIds(trackIds, trackInstancesById = null) {
  const trackUiById = new Map(TRACK_UI.map((track) => [track.id, track]));
  return trackIds.map((trackId) => {
    const instance = trackInstancesById?.[trackId];
    const type = instance?.type ?? getTrackTypeFromInstanceId(trackId);
    const typeUi = trackUiById.get(type);
    if (!typeUi) return null;

    return {
      ...typeUi,
      id: trackId,
      label: instance?.name ?? TRACK_TYPE_LABELS[type] ?? typeUi.label,
      ordinal: instance?.ordinal ?? 1,
      type,
    };
  }).filter(Boolean);
}

const OPTIONAL_TRACK_UI = Object.freeze(getTrackUiByIds(OPTIONAL_TRACK_IDS));

const BAR_NUMBERS = Object.freeze(
  Array.from({ length: TOTAL_BARS }, (_, index) => index + 1),
);

const CHORD_NOTES = Object.freeze([
  { label: 'B', sharp: false },
  { label: 'A#', sharp: true },
  { label: 'A', sharp: false },
  { label: 'G#', sharp: true },
  { label: 'G', sharp: false },
  { label: 'F#', sharp: true },
  { label: 'F', sharp: false },
  { label: 'E', sharp: false },
  { label: 'D#', sharp: true },
  { label: 'D', sharp: false },
  { label: 'C#', sharp: true },
  { label: 'C', sharp: false, root: true },
]);

const BEAT_NUMBERS = Object.freeze([1, 2, 3, 4]);

export {
  BAR_NUMBERS,
  BEAT_NUMBERS,
  CHORD_GRID_PITCHES,
  CHORD_NOTES,
  getTrackUiByIds,
  OPTIONAL_TRACK_UI,
  TRACK_UI,
};
