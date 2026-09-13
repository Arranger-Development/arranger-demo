import {
  DEFAULT_TRACK_VOLUME_DB,
  MAX_TRACK_VOLUME_DB,
  MIN_TRACK_VOLUME_DB,
  clampTrackVolume,
} from '../domain/trackVolume.js';

function formatTrackVolumeLabel(volume) {
  const clampedVolume = clampTrackVolume(volume);
  if (clampedVolume === MIN_TRACK_VOLUME_DB) return '静音';
  if (clampedVolume > 0) return `+${clampedVolume}dB`;
  return `${clampedVolume}dB`;
}

function getTrackVolumeLevel(volume) {
  const clampedVolume = clampTrackVolume(volume);
  const range = MAX_TRACK_VOLUME_DB - MIN_TRACK_VOLUME_DB;
  return Math.round(((clampedVolume - MIN_TRACK_VOLUME_DB) / range) * 100);
}

function createTrackVolumeView(volume = DEFAULT_TRACK_VOLUME_DB) {
  const value = clampTrackVolume(volume);

  return {
    value,
    level: getTrackVolumeLevel(value),
    label: formatTrackVolumeLabel(value),
  };
}

export {
  DEFAULT_TRACK_VOLUME_DB,
  MAX_TRACK_VOLUME_DB,
  MIN_TRACK_VOLUME_DB,
  clampTrackVolume,
  createTrackVolumeView,
  formatTrackVolumeLabel,
  getTrackVolumeLevel,
};
