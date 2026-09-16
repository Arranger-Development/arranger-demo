import {
  CORE_TRACK_IDS,
  TRACK_IDS,
} from './musicConstants.js';

const TRACK_TYPE_LABELS = Object.freeze({
  bass: 'Bass',
  chord: 'Chord',
  drums: 'Drums',
  melody: 'Melody',
  pad: 'Pad',
  sample: 'Sampler',
  vocal: 'Vocal',
});

function isTrackType(value) {
  return TRACK_IDS.includes(value);
}

function createTrackInstance({
  createdIndex,
  id,
  name,
  ordinal,
  type,
}) {
  return {
    createdIndex,
    id,
    name,
    ordinal,
    type,
  };
}

function createDefaultTrackState() {
  const trackInstancesById = Object.fromEntries(
    CORE_TRACK_IDS.map((type, index) => [
      type,
      createTrackInstance({
        createdIndex: index + 1,
        id: type,
        name: TRACK_TYPE_LABELS[type],
        ordinal: 1,
        type,
      }),
    ]),
  );

  return {
    nextTrackCreatedIndex: CORE_TRACK_IDS.length + 1,
    nextTrackOrdinalByType: Object.fromEntries(
      TRACK_IDS.map((type) => [type, CORE_TRACK_IDS.includes(type) ? 2 : 1]),
    ),
    primaryChordTrackId: 'chord',
    trackInstancesById,
    trackOrder: [...CORE_TRACK_IDS],
  };
}

function getTrackTypeFromInstanceId(trackId) {
  if (isTrackType(trackId)) return trackId;
  if (typeof trackId !== 'string') return null;

  return TRACK_IDS.find((type) => new RegExp(`^${type}-[1-9]\\d*$`).test(trackId)) ?? null;
}

function getTrackType(state, trackId) {
  return state?.trackInstancesById?.[trackId]?.type
    ?? getTrackTypeFromInstanceId(trackId);
}

function getTrackInstanceIdsByType(state, type) {
  if (!isTrackType(type)) return [];

  return (state?.trackOrder ?? [])
    .filter((trackId) => getTrackType(state, trackId) === type);
}

function getDefaultTrackName(type, ordinal) {
  const label = TRACK_TYPE_LABELS[type] ?? type;
  return ordinal > 1 ? `${label} ${ordinal}` : label;
}

function createNextTrackInstance(state, type) {
  if (!isTrackType(type)) return null;

  const ordinal = state.nextTrackOrdinalByType?.[type] ?? 1;
  const id = ordinal === 1 ? type : `${type}-${ordinal}`;
  const createdIndex = state.nextTrackCreatedIndex ?? 1;

  return createTrackInstance({
    createdIndex,
    id,
    name: getDefaultTrackName(type, ordinal),
    ordinal,
    type,
  });
}

function canRemoveTrackInstance(state, trackId) {
  const type = getTrackType(state, trackId);
  if (!type || !state?.trackInstancesById?.[trackId]) return false;
  if (!CORE_TRACK_IDS.includes(type)) return true;
  return getTrackInstanceIdsByType(state, type).length > 1;
}

export {
  TRACK_TYPE_LABELS,
  canRemoveTrackInstance,
  createDefaultTrackState,
  createNextTrackInstance,
  getDefaultTrackName,
  getTrackInstanceIdsByType,
  getTrackType,
  getTrackTypeFromInstanceId,
  isTrackType,
};
