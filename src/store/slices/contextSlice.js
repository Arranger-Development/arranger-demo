import { getTotalBars } from '../../domain/projectLength.js';
import {
  CORE_TRACK_IDS,
  TRACK_IDS,
} from '../../domain/musicConstants.js';
import {
  canRemoveTrackInstance,
  createDefaultTrackState,
  createNextTrackInstance,
  getTrackInstanceIdsByType,
  getTrackType,
} from '../../domain/trackInstances.js';
import { createEmptyTrackMatrix } from '../createInitialMatrix.js';
import {
  getMelodyStyleTemplate,
  normalizeMelodyScaleId,
  normalizeMelodyStyleTemplateId,
} from '../../data/melodyStyleTemplates.js';
import { normalizeMelodyTimbreId } from '../../data/melodyTimbres.js';

function removeObjectKey(object, key) {
  const nextObject = { ...object };
  delete nextObject[key];
  return nextObject;
}

function createMelodyTimbrePatch(state, value) {
  const melodyTimbreId = normalizeMelodyTimbreId(value);
  let matrix = state.matrix;
  for (const trackId of getTrackInstanceIdsByType(state, 'melody')) {
    const bars = state.matrix[trackId];
    if (!bars?.some((bar) => bar.some((cell) => cell?.timbreId))) continue;
    if (matrix === state.matrix) matrix = { ...state.matrix };
    matrix[trackId] = bars.map((bar) => bar.map((cell) => (
      cell?.timbreId ? { ...cell, timbreId: melodyTimbreId } : cell
    )));
  }
  return { melodyTimbreId, matrix };
}

export default function createContextSlice(set, get) {
  const defaultTrackState = createDefaultTrackState();

  return {
    activeTrackId: 'drums',
    melodyRhythmTemplateId: null,
    melodyScaleId: 'chinese',
    melodyTimbreId: 'piano',
    selectedBar: 0,
    selectedClipId: null,
    visibleTrackIds: [...CORE_TRACK_IDS],
    ...defaultTrackState,

    addVisibleTrack: (trackId) => {
      if (!TRACK_IDS.includes(trackId)) return null;
      if (getTrackInstanceIdsByType(get(), trackId).length > 0) return null;
      return get().addTrackInstance(trackId);
    },
    addTrackInstance: (type) => {
      const state = get();
      const track = createNextTrackInstance(state, type);
      if (!track) return null;

      const nextTrackOrder = [...state.trackOrder, track.id];
      set({
        activeTrackId: track.id,
        matrix: {
          ...state.matrix,
          [track.id]: createEmptyTrackMatrix(getTotalBars(state)),
        },
        mutedTracks: {
          ...state.mutedTracks,
          [track.id]: false,
        },
        nextTrackCreatedIndex: track.createdIndex + 1,
        nextTrackOrdinalByType: {
          ...state.nextTrackOrdinalByType,
          [type]: track.ordinal + 1,
        },
        primaryChordTrackId: type === 'chord' && !state.primaryChordTrackId
          ? track.id
          : state.primaryChordTrackId,
        selectedClipId: null,
        trackInstancesById: {
          ...state.trackInstancesById,
          [track.id]: track,
        },
        trackOrder: nextTrackOrder,
        visibleTrackIds: nextTrackOrder,
        volumes: {
          ...state.volumes,
          [track.id]: 0,
        },
      });

      return track.id;
    },
    renameTrackInstance: (trackId, name) => {
      const state = get();
      const track = state.trackInstancesById?.[trackId];
      const nextName = typeof name === 'string' ? name.trim() : '';
      if (!track || !nextName) return null;

      set({
        trackInstancesById: {
          ...state.trackInstancesById,
          [trackId]: {
            ...track,
            name: nextName,
          },
        },
      });
      return trackId;
    },
    moveTrackInstance: (trackId, targetIndex) => {
      const state = get();
      const sourceIndex = state.trackOrder.indexOf(trackId);
      if (sourceIndex < 0 || !Number.isInteger(targetIndex)) return false;

      const boundedTargetIndex = Math.max(0, Math.min(state.trackOrder.length - 1, targetIndex));
      if (boundedTargetIndex === sourceIndex) return false;

      const nextTrackOrder = [...state.trackOrder];
      nextTrackOrder.splice(sourceIndex, 1);
      nextTrackOrder.splice(boundedTargetIndex, 0, trackId);
      set({
        trackOrder: nextTrackOrder,
        visibleTrackIds: nextTrackOrder,
      });
      return true;
    },
    removeTrackInstance: (trackId) => {
      const state = get();
      if (!canRemoveTrackInstance(state, trackId)) return null;

      const removedIndex = state.trackOrder.indexOf(trackId);
      const nextTrackOrder = state.trackOrder.filter((id) => id !== trackId);
      const removedClipIds = state.clips.ids.filter(
        (clipId) => state.clips.byId[clipId]?.trackId === trackId,
      );
      const removedClipIdSet = new Set(removedClipIds);
      const nextClipById = Object.fromEntries(
        Object.entries(state.clips.byId).filter(([, clip]) => clip.trackId !== trackId),
      );
      const nextActiveTrackId = state.activeTrackId === trackId
        ? nextTrackOrder[Math.min(removedIndex, nextTrackOrder.length - 1)] ?? nextTrackOrder[0]
        : state.activeTrackId;
      const removedType = getTrackType(state, trackId);
      const remainingChordIds = removedType === 'chord'
        ? getTrackInstanceIdsByType({
          ...state,
          trackOrder: nextTrackOrder,
        }, 'chord')
        : [];
      const nextPrimaryChordTrackId = state.primaryChordTrackId === trackId
        ? remainingChordIds
          .map((id) => state.trackInstancesById[id])
          .sort((a, b) => a.createdIndex - b.createdIndex)[0]?.id ?? null
        : state.primaryChordTrackId;

      set({
        activeTrackId: nextActiveTrackId,
        clips: {
          ids: state.clips.ids.filter((clipId) => !removedClipIdSet.has(clipId)),
          byId: nextClipById,
        },
        matrix: removeObjectKey(state.matrix, trackId),
        mutedTracks: removeObjectKey(state.mutedTracks, trackId),
        primaryChordTrackId: nextPrimaryChordTrackId,
        selectedClipId: removedClipIdSet.has(state.selectedClipId) ? null : state.selectedClipId,
        trackInstancesById: removeObjectKey(state.trackInstancesById, trackId),
        trackOrder: nextTrackOrder,
        visibleTrackIds: nextTrackOrder,
        volumes: removeObjectKey(state.volumes, trackId),
      });

      return trackId;
    },
    setActiveTrackId: (activeTrackId) => set({ activeTrackId }),
    setMelodyRhythmTemplateId: (melodyRhythmTemplateId) => set({
      melodyRhythmTemplateId: normalizeMelodyStyleTemplateId(melodyRhythmTemplateId),
    }),
    setMelodyScaleId: (melodyScaleId) => set({
      melodyScaleId: normalizeMelodyScaleId(melodyScaleId),
    }),
    setMelodyTimbreId: (melodyTimbreId) => set((state) => createMelodyTimbrePatch(state, melodyTimbreId)),
    setMelodyStyleTemplate: (templateId, timbreId) => {
      const normalizedTemplateId = normalizeMelodyStyleTemplateId(templateId);
      if (!normalizedTemplateId) return false;
      const template = getMelodyStyleTemplate(normalizedTemplateId);
      set((state) => ({
        ...createMelodyTimbrePatch(state, timbreId ?? template?.recommendedTimbreId),
        melodyRhythmTemplateId: normalizedTemplateId,
        melodyScaleId: normalizedTemplateId,
      }));
      return true;
    },
    setSelectedBar: (selectedBar) => set({ selectedBar }),
    setSelectedClipId: (selectedClipId) => set({ selectedClipId }),
  };
}
