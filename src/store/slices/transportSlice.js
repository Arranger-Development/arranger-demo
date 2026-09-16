import {
  DEFAULT_BPM,
  TOTAL_BARS,
  CORE_TRACK_IDS,
  ROOT_KEY,
  SCALE,
  TRACK_IDS,
} from '../../domain/musicConstants.js';
import { clampTrackVolume } from '../../domain/trackVolume.js';

function createDefaultVolumes() {
  return Object.fromEntries(TRACK_IDS.map((trackId) => [trackId, 0]));
}

function createDefaultMutedTracks() {
  return Object.fromEntries(CORE_TRACK_IDS.map((trackId) => [trackId, false]));
}

function createTransportPositionPatch(bar, step) {
  return {
    currentBar: bar,
    currentStep: step,
    seekBar: bar,
    seekStep: step,
  };
}

export default function createTransportSlice(set) {
  return {
    totalBars: TOTAL_BARS,
    bpm: DEFAULT_BPM,
    rootKey: ROOT_KEY,
    scale: SCALE,
    isPlaying: false,
    currentBar: 0,
    currentStep: 0,
    seekBar: 0,
    seekStep: 0,
    volumes: createDefaultVolumes(),
    mutedTracks: createDefaultMutedTracks(),

    play: () => set({ isPlaying: true }),
    pause: () => set({ isPlaying: false }),
    stop: () => set({ isPlaying: false }),
    setBpm: (bpm) => set({ bpm }),
    setRootKey: (rootKey) => set({ rootKey }),
    setScale: (scale) => set({ scale }),
    setTransportPosition: (bar, step) => set(createTransportPositionPatch(bar, step)),
    setPosition: (currentBar, currentStep) => set(createTransportPositionPatch(currentBar, currentStep)),
    setSeekPosition: (seekBar, seekStep) => set(createTransportPositionPatch(seekBar, seekStep)),
    setTrackVolume: (trackId, volume) => set((state) => {
      if (!Object.hasOwn(state.volumes, trackId)) return {};

      return {
        volumes: {
          ...state.volumes,
          [trackId]: clampTrackVolume(volume),
        },
      };
    }),
    toggleTrackMute: (trackId) => set((state) => {
      if (!Object.hasOwn(state.mutedTracks, trackId)) return {};

      return {
        mutedTracks: {
          ...state.mutedTracks,
          [trackId]: !state.mutedTracks[trackId],
        },
      };
    }),
  };
}
