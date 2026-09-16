import { getTotalBars } from '../domain/projectLength.js';

const PROJECT_FILE_SCHEMA_VERSION = 1;

function cloneProjectValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createProjectFile(state, options = {}) {
  if (!state || typeof state !== 'object') {
    throw new TypeError('A project state is required to create a project file.');
  }

  return {
    app: 'Project Arranger',
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    schemaVersion: PROJECT_FILE_SCHEMA_VERSION,
    transport: {
      bpm: state.bpm,
      rootKey: state.rootKey,
      scale: state.scale,
    },
    arrangement: cloneProjectValue({
      totalBars: getTotalBars(state),
      clips: state.clips,
      matrix: state.matrix,
      mutedTracks: state.mutedTracks,
      primaryChordTrackId: state.primaryChordTrackId,
      trackInstancesById: state.trackInstancesById,
      trackOrder: state.trackOrder,
      volumes: state.volumes,
    }),
    editor: {
      melodyRhythmTemplateId: state.melodyRhythmTemplateId,
      melodyScaleId: state.melodyScaleId,
      melodyTimbreId: state.melodyTimbreId,
    },
  };
}

function createProjectFileBlob(state, options = {}) {
  const projectFile = createProjectFile(state, options);
  return new Blob([JSON.stringify(projectFile, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
}

export {
  PROJECT_FILE_SCHEMA_VERSION,
  createProjectFile,
  createProjectFileBlob,
};
