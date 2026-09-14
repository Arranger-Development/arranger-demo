import { getTotalBars } from '../../domain/projectLength.js';
import createInitialMatrix, { createEmptyTrackMatrix } from '../createInitialMatrix.js';

function hasTrack(matrix, trackId) {
  return Object.hasOwn(matrix, trackId);
}

export default function createMatrixSlice(set, get) {
  return {
    matrix: createInitialMatrix(),

    setCell: (trackId, barIndex, stepIndex, cellData) => set((state) => {
      if (!hasTrack(state.matrix, trackId)) return {};

      if (!Number.isInteger(barIndex) || barIndex < 0 || barIndex >= getTotalBars(state)
        || !Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= 16) return {};
      const nextBar = [...state.matrix[trackId][barIndex]];
      nextBar[stepIndex] = cellData;

      const nextTrack = [...state.matrix[trackId]];
      nextTrack[barIndex] = nextBar;

      return {
        matrix: {
          ...state.matrix,
          [trackId]: nextTrack,
        },
      };
    }),

    setTrackMatrix: (trackId, trackMatrix) => set((state) => {
      if (!hasTrack(state.matrix, trackId) || !Array.isArray(trackMatrix)) return state;

      return {
        matrix: {
          ...state.matrix,
          [trackId]: trackMatrix.map((bar) => [...bar]),
        },
      };
    }),

    clearStep: (trackId, barIndex, stepIndex) => {
      const { matrix, setCell } = get();
      if (!hasTrack(matrix, trackId)) return;

      setCell(trackId, barIndex, stepIndex, null);
    },

    clearTrack: (trackId) => set((state) => {
      if (!hasTrack(state.matrix, trackId)) return {};

      return {
        matrix: {
          ...state.matrix,
          [trackId]: createEmptyTrackMatrix(getTotalBars(state)),
        },
      };
    }),

    clearMatrix: () => set((state) => ({
      matrix: Object.fromEntries(Object.keys(state.matrix).map((trackId) => (
        [trackId, createEmptyTrackMatrix(getTotalBars(state))]
      ))),
    })),
  };
}
