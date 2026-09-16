import { create } from 'zustand';
import createContextSlice from './slices/contextSlice.js';
import createClipsSlice from './slices/clipsSlice.js';
import createMatrixSlice from './slices/matrixSlice.js';
import createTransportSlice from './slices/transportSlice.js';

const useMusicStore = create((set, get) => ({
  ...createTransportSlice(set, get),
  ...createMatrixSlice(set, get),
  ...createContextSlice(set, get),
  ...createClipsSlice(set, get),
}));

export default useMusicStore;
