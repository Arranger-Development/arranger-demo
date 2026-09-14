import {
  createClipId,
  createClipRecord,
  formatClipName,
} from '../../domain/clipHelpers.js';
import { createProjectLengthPatch, getTimelineBars, getTotalBars } from '../../domain/projectLength.js';
import { STEPS_PER_BAR } from '../../domain/musicConstants.js';
import { getTrackType } from '../../domain/trackInstances.js';

function createEmptyBarLike(bar) {
  return Array.from({ length: bar.length }, () => null);
}

function cloneBar(bar) {
  return [...bar];
}

function cloneCell(cell) {
  if (cell === null || typeof cell !== 'object') return cell;
  if (Array.isArray(cell)) return cell.map((item) => cloneCell(item));

  return Object.fromEntries(
    Object.entries(cell).map(([key, value]) => [key, cloneCell(value)]),
  );
}

function cloneBarData(bar) {
  return bar.map((cell) => cloneCell(cell));
}

function moveClipRecordToBar(clip, bar) {
  return {
    ...clip,
    id: createClipId(clip.trackId, bar),
    bar,
    name: clip.customName ? clip.name : formatClipName(clip.trackId, bar),
  };
}

function isValidClipLocation(state, trackId, bar) {
  return Boolean(state?.trackInstancesById?.[trackId])
    && Array.isArray(state?.matrix?.[trackId])
    && Number.isInteger(bar)
    && bar >= 0
    && bar < getTimelineBars(state);
}

function createInitialClips() {
  const initialClips = [
    createClipRecord('drums', 0),
  ];

  return {
    ids: initialClips.map((clip) => clip.id),
    byId: Object.fromEntries(initialClips.map((clip) => [clip.id, clip])),
  };
}

function findClipForTrackBar(clips, trackId, bar) {
  const ids = clips?.ids ?? [];
  const byId = clips?.byId ?? {};

  return ids
    .map((id) => byId[id])
    .find((clip) => clip?.trackId === trackId && clip.bar === bar) ?? null;
}

function createPastedClipRecord(state, snapshot, targetTrackId, targetBar) {
  const clip = createClipRecord(targetTrackId, targetBar);
  if (snapshot?.customName === true) {
    return {
      ...clip,
      customName: true,
      name: snapshot.name,
    };
  }

  return clip;
}

function createClipClipboardData(state, clip) {
  const barData = state.matrix[clip.trackId]?.[clip.bar];
  if (!Array.isArray(barData)) return null;

  return {
    sourceClipId: clip.id,
    trackId: clip.trackId,
    trackType: getTrackType(state, clip.trackId),
    sourceBar: clip.bar,
    name: clip.name,
    customName: clip.customName === true,
    barData: cloneBarData(barData),
  };
}

export default function createClipsSlice(set, get) {
  return {
    clips: createInitialClips(),

    getClipForTrackBar: (trackId, bar) => findClipForTrackBar(get().clips, trackId, bar),

    createClipClipboardSnapshot: (clipId = get().selectedClipId) => {
      const state = get();
      const clip = state.clips.byId[clipId];
      if (!clip) return null;

      return createClipClipboardData(state, clip);
    },

    createTimelineClipboardSnapshot: (selection) => {
      if (
        !selection
        || !Number.isInteger(selection.startBar)
        || !Number.isInteger(selection.endBar)
        || selection.startBar < 0
        || selection.endBar >= getTimelineBars(get())
        || selection.startBar > selection.endBar
        || !Array.isArray(selection.trackIds)
        || selection.trackIds.length === 0
        || selection.trackIds.some((trackId) => !get().trackInstancesById?.[trackId])
      ) {
        return null;
      }

      const state = get();
      const items = state.clips.ids
        .map((clipId) => state.clips.byId[clipId])
        .filter((clip) => (
          clip
          && selection.trackIds.includes(clip.trackId)
          && clip.bar >= selection.startBar
          && clip.bar <= selection.endBar
        ))
        .map((clip) => ({
          ...createClipClipboardData(state, clip),
          barOffset: clip.bar - selection.startBar,
        }))
        .filter((item) => Array.isArray(item.barData));

      if (items.length === 0) return null;

      return {
        kind: 'timeline-range',
        sourceStartBar: selection.startBar,
        sourceEndBar: selection.endBar,
        trackIds: [...selection.trackIds],
        items,
      };
    },

    pasteClipClipboardSnapshot: (snapshot, targetTrackId, targetBar) => {
      const state = get();
      if (
        !snapshot
        || (snapshot.trackType ?? getTrackType(state, snapshot.trackId))
          !== getTrackType(state, targetTrackId)
        || !isValidClipLocation(state, targetTrackId, targetBar)
        || !Array.isArray(snapshot.barData)
      ) {
        return null;
      }

      if (snapshot.barData.length !== STEPS_PER_BAR) return null;
      const lengthPatch = createProjectLengthPatch(state, targetBar + 1);
      const matrix = lengthPatch.matrix ?? state.matrix;
      const trackMatrix = matrix[targetTrackId];

      const targetClip = findClipForTrackBar(state.clips, targetTrackId, targetBar);
      const pastedClip = createPastedClipRecord(state, snapshot, targetTrackId, targetBar);
      const nextTrackMatrix = [...trackMatrix];
      nextTrackMatrix[targetBar] = cloneBarData(snapshot.barData);

      set({
        ...lengthPatch,
        activeTrackId: targetTrackId,
        selectedBar: targetBar,
        selectedClipId: pastedClip.id,
        clips: {
          ids: targetClip ? state.clips.ids : [...state.clips.ids, pastedClip.id],
          byId: {
            ...state.clips.byId,
            [pastedClip.id]: pastedClip,
          },
        },
        matrix: {
          ...matrix,
          [targetTrackId]: nextTrackMatrix,
        },
      });

      return pastedClip;
    },

    pasteTimelineClipboardSnapshot: (snapshot, targetStartBar) => {
      const barCount = snapshot?.sourceEndBar - snapshot?.sourceStartBar + 1;
      if (
        snapshot?.kind !== 'timeline-range'
        || !Number.isInteger(targetStartBar)
        || targetStartBar < 0
        || !Number.isInteger(barCount)
        || barCount < 1
        || targetStartBar + barCount > getTimelineBars(get())
        || !Array.isArray(snapshot.trackIds)
        || snapshot.trackIds.length === 0
        || !Array.isArray(snapshot.items)
        || snapshot.items.length === 0
      ) {
        return null;
      }

      const state = get();
      if (snapshot.items.some((item) => (
        !Number.isInteger(item.barOffset) || item.barOffset < 0 || item.barOffset >= barCount
        || !isValidClipLocation(state, item.trackId, targetStartBar + item.barOffset)
        || !Array.isArray(item.barData) || item.barData.length !== STEPS_PER_BAR
      ))) return null;
      const lastClipBar = Math.max(...snapshot.items.map((item) => targetStartBar + item.barOffset));
      const lengthPatch = createProjectLengthPatch(state, lastClipBar + 1);
      const nextById = { ...state.clips.byId };
      const nextIds = [...state.clips.ids];
      const nextMatrix = { ...(lengthPatch.matrix ?? state.matrix) };
      const nextTrackMatrices = new Map();
      const pastedClips = [];

      for (const item of snapshot.items) {
        const targetBar = targetStartBar + item.barOffset;
        if (
          !isValidClipLocation(state, item.trackId, targetBar)
          || !Array.isArray(item.barData)
        ) {
          return null;
        }

        const trackMatrix = nextTrackMatrices.get(item.trackId)
          ?? [...nextMatrix[item.trackId]];
        const targetBarData = trackMatrix[targetBar];
        if (!Array.isArray(targetBarData) || targetBarData.length !== item.barData.length) {
          return null;
        }

        const targetClip = findClipForTrackBar(state.clips, item.trackId, targetBar);
        const pastedClip = createPastedClipRecord(state, item, item.trackId, targetBar);
        trackMatrix[targetBar] = cloneBarData(item.barData);
        nextTrackMatrices.set(item.trackId, trackMatrix);
        nextById[pastedClip.id] = pastedClip;
        if (!targetClip) nextIds.push(pastedClip.id);
        pastedClips.push(pastedClip);
      }

      for (const [trackId, trackMatrix] of nextTrackMatrices) {
        nextMatrix[trackId] = trackMatrix;
      }

      set({
        ...lengthPatch,
        activeTrackId: snapshot.trackIds[0],
        selectedBar: targetStartBar,
        selectedClipId: null,
        clips: {
          ids: nextIds,
          byId: nextById,
        },
        matrix: nextMatrix,
      });

      return {
        clips: pastedClips,
        startBar: targetStartBar,
        endBar: targetStartBar + barCount - 1,
        trackIds: [...snapshot.trackIds],
      };
    },

    selectClip: (clipId) => {
      const clip = get().clips.byId[clipId];
      if (!clip) return null;

      set({
        activeTrackId: clip.trackId,
        selectedBar: clip.bar,
        selectedClipId: clip.id,
      });

      return clip;
    },

    createClip: (trackId, bar) => {
      const state = get();
      if (!isValidClipLocation(state, trackId, bar)) return null;

      const existingClip = get().getClipForTrackBar(trackId, bar);
      if (existingClip) {
        get().selectClip(existingClip.id);
        return existingClip;
      }

      const clip = createClipRecord(trackId, bar);
      set((state) => ({
        ...createProjectLengthPatch(state, bar + 1),
        activeTrackId: clip.trackId,
        selectedBar: clip.bar,
        selectedClipId: clip.id,
        clips: {
          ids: [...state.clips.ids, clip.id],
          byId: {
            ...state.clips.byId,
            [clip.id]: clip,
          },
        },
      }));

      return clip;
    },

    createEmptyClipsForTrack: (trackId) => {
      const state = get();
      if (!isValidClipLocation(state, trackId, 0)) return [];
      const createdClips = Array.from({ length: getTimelineBars(state) }, (_, bar) => bar)
        .filter((bar) => !findClipForTrackBar(state.clips, trackId, bar))
        .map((bar) => createClipRecord(trackId, bar));
      const selectedClip = findClipForTrackBar(state.clips, trackId, 0)
        ?? createdClips.find((clip) => clip.bar === 0)
        ?? null;

      if (!createdClips.length) {
        if (selectedClip) get().selectClip(selectedClip.id);
        return createdClips;
      }

      set({
        ...createProjectLengthPatch(state, getTimelineBars(state)),
        activeTrackId: trackId,
        selectedBar: selectedClip?.bar ?? 0,
        selectedClipId: selectedClip?.id ?? null,
        clips: {
          ids: [...state.clips.ids, ...createdClips.map((clip) => clip.id)],
          byId: {
            ...state.clips.byId,
            ...Object.fromEntries(createdClips.map((clip) => [clip.id, clip])),
          },
        },
      });

      return createdClips;
    },

    ensureMelodyClipsInRange: (
      startBar,
      endBar = getTotalBars(get()) - 1,
      trackId = get().activeTrackId,
    ) => {
      if (
        !Number.isInteger(startBar)
        || !Number.isInteger(endBar)
        || startBar < 0
        || endBar >= getTimelineBars(get())
        || startBar > endBar
      ) {
        return [];
      }

      const state = get();
      const melodyTrackId = getTrackType(state, trackId) === 'melody'
        ? trackId
        : state.trackOrder.find((id) => getTrackType(state, id) === 'melody');
      if (!melodyTrackId) return [];
      const createdClips = Array.from(
        { length: endBar - startBar + 1 },
        (_, offset) => startBar + offset,
      )
        .filter((bar) => !findClipForTrackBar(state.clips, melodyTrackId, bar))
        .map((bar) => createClipRecord(melodyTrackId, bar));

      if (!createdClips.length) return createdClips;

      set({
        ...createProjectLengthPatch(state, endBar + 1),
        clips: {
          ids: [...state.clips.ids, ...createdClips.map((clip) => clip.id)],
          byId: {
            ...state.clips.byId,
            ...Object.fromEntries(createdClips.map((clip) => [clip.id, clip])),
          },
        },
      });

      return createdClips;
    },

    renameClip: (clipId, name) => {
      if (typeof name !== 'string') return null;

      const state = get();
      const clip = state.clips.byId[clipId];
      if (!clip) return null;

      const renamedClip = {
        ...clip,
        customName: true,
        name,
      };

      set({
        clips: {
          ids: state.clips.ids,
          byId: {
            ...state.clips.byId,
            [clip.id]: renamedClip,
          },
        },
      });

      return renamedClip;
    },

    deleteClip: (clipId) => {
      const state = get();
      const clip = state.clips.byId[clipId];
      if (!clip) return null;

      const nextById = { ...state.clips.byId };
      delete nextById[clip.id];

      const trackMatrix = state.matrix[clip.trackId];
      const nextMatrix = { ...state.matrix };
      if (trackMatrix?.[clip.bar]) {
        const nextTrackMatrix = [...trackMatrix];
        nextTrackMatrix[clip.bar] = createEmptyBarLike(trackMatrix[clip.bar]);
        nextMatrix[clip.trackId] = nextTrackMatrix;
      }

      set({
        activeTrackId: clip.trackId,
        selectedBar: clip.bar,
        selectedClipId: null,
        clips: {
          ids: state.clips.ids.filter((id) => id !== clip.id),
          byId: nextById,
        },
        matrix: nextMatrix,
      });

      return clip;
    },

    deleteSelectedClip: () => {
      const { selectedClipId } = get();
      if (!selectedClipId) return null;
      return get().deleteClip(selectedClipId);
    },

    deleteClipsByIds: (clipIds) => {
      if (!Array.isArray(clipIds) || clipIds.length === 0) return [];

      const state = get();
      const deletedClips = [...new Set(clipIds)]
        .map((clipId) => state.clips.byId[clipId])
        .filter(Boolean);
      if (deletedClips.length === 0) return deletedClips;

      const nextById = { ...state.clips.byId };
      const nextMatrix = { ...state.matrix };
      const nextTrackMatrices = new Map();

      for (const clip of deletedClips) {
        delete nextById[clip.id];
        const trackMatrix = nextTrackMatrices.get(clip.trackId)
          ?? [...state.matrix[clip.trackId]];
        if (Array.isArray(trackMatrix[clip.bar])) {
          trackMatrix[clip.bar] = createEmptyBarLike(trackMatrix[clip.bar]);
        }
        nextTrackMatrices.set(clip.trackId, trackMatrix);
      }

      for (const [trackId, trackMatrix] of nextTrackMatrices) {
        nextMatrix[trackId] = trackMatrix;
      }

      const deletedIds = new Set(deletedClips.map((clip) => clip.id));
      set({
        selectedClipId: deletedIds.has(state.selectedClipId) ? null : state.selectedClipId,
        clips: {
          ids: state.clips.ids.filter((clipId) => !deletedIds.has(clipId)),
          byId: nextById,
        },
        matrix: nextMatrix,
      });

      return deletedClips;
    },

    moveClipToBar: (clipId, targetBar) => {
      const state = get();
      const sourceClip = state.clips.byId[clipId];
      if (!sourceClip || !isValidClipLocation(state, sourceClip.trackId, targetBar)) return null;

      if (sourceClip.bar === targetBar) {
        get().selectClip(sourceClip.id);
        return sourceClip;
      }

      const lengthPatch = createProjectLengthPatch(state, targetBar + 1);
      const matrix = lengthPatch.matrix ?? state.matrix;
      const trackMatrix = matrix[sourceClip.trackId];
      if (!trackMatrix?.[sourceClip.bar] || !trackMatrix?.[targetBar]) return null;

      const targetClip = findClipForTrackBar(state.clips, sourceClip.trackId, targetBar);
      const sourceBarData = cloneBar(trackMatrix[sourceClip.bar]);
      const targetBarData = cloneBar(trackMatrix[targetBar]);
      const nextTrackMatrix = [...trackMatrix];
      const nextById = { ...state.clips.byId };
      let nextIds = state.clips.ids;
      let selectedClip;

      if (targetClip) {
        const nextSourceClip = moveClipRecordToBar(targetClip, sourceClip.bar);
        const nextTargetClip = moveClipRecordToBar(sourceClip, targetBar);
        nextById[nextSourceClip.id] = nextSourceClip;
        nextById[nextTargetClip.id] = nextTargetClip;
        nextTrackMatrix[sourceClip.bar] = targetBarData;
        nextTrackMatrix[targetBar] = sourceBarData;
        selectedClip = nextTargetClip;
      } else {
        const nextTargetClip = moveClipRecordToBar(sourceClip, targetBar);
        delete nextById[sourceClip.id];
        nextById[nextTargetClip.id] = nextTargetClip;
        nextIds = state.clips.ids.map((id) => (id === sourceClip.id ? nextTargetClip.id : id));
        nextTrackMatrix[sourceClip.bar] = createEmptyBarLike(sourceBarData);
        nextTrackMatrix[targetBar] = sourceBarData;
        selectedClip = nextTargetClip;
      }

      set({
        ...lengthPatch,
        activeTrackId: selectedClip.trackId,
        selectedBar: selectedClip.bar,
        selectedClipId: selectedClip.id,
        clips: {
          ids: nextIds,
          byId: nextById,
        },
        matrix: {
          ...matrix,
          [selectedClip.trackId]: nextTrackMatrix,
        },
      });

      return selectedClip;
    },
  };
}

export {
  createInitialClips,
  findClipForTrackBar,
};
