import { getTrackType } from '../domain/trackInstances.js';

function createTrackScopedMatrix({
  activeTrackId,
  activeTrackType,
  matrix,
  primaryChordTrackId,
}) {
  if (!activeTrackType || !matrix?.[activeTrackId]) return matrix;

  return {
    ...matrix,
    [activeTrackType]: matrix[activeTrackId],
    ...(activeTrackType === 'bass' && matrix?.[primaryChordTrackId]
      ? { chord: matrix[primaryChordTrackId] }
      : {}),
  };
}

function createTrackScopedClips({
  activeTrackId,
  activeTrackType,
  clips,
  primaryChordTrackId,
  trackInstancesById,
}) {
  if (!activeTrackType || !clips) return clips;

  const scopedClips = clips.ids
    .map((clipId) => clips.byId[clipId])
    .filter((clip) => (
      clip?.trackId === activeTrackId
      || (
        activeTrackType === 'bass'
        && clip?.trackId === primaryChordTrackId
        && getTrackType({ trackInstancesById }, clip.trackId) === 'chord'
      )
    ))
    .map((clip) => ({
      ...clip,
      trackId: clip.trackId === activeTrackId ? activeTrackType : 'chord',
    }));

  return {
    ids: scopedClips.map((clip) => clip.id),
    byId: Object.fromEntries(scopedClips.map((clip) => [clip.id, clip])),
  };
}

function resolveTrackMatrixPatch({
  activeTrackId,
  activeTrackType,
  currentMatrix,
  nextScopedMatrix,
}) {
  if (!nextScopedMatrix?.[activeTrackType]) return currentMatrix;
  return {
    ...currentMatrix,
    [activeTrackId]: nextScopedMatrix[activeTrackType],
  };
}

export {
  createTrackScopedClips,
  createTrackScopedMatrix,
  resolveTrackMatrixPatch,
};
