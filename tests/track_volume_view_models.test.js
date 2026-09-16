import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_TRACK_VOLUME_DB,
  MIN_TRACK_VOLUME_DB,
  clampTrackVolume,
  createTrackVolumeView,
  formatTrackVolumeLabel,
} from '../src/app/trackVolumeViewModels.js';

test('clampTrackVolume keeps track volume inside the supported dB range', () => {
  assert.equal(clampTrackVolume(MIN_TRACK_VOLUME_DB - 20), MIN_TRACK_VOLUME_DB);
  assert.equal(clampTrackVolume(MAX_TRACK_VOLUME_DB + 20), MAX_TRACK_VOLUME_DB);
  assert.equal(clampTrackVolume(-6), -6);
  assert.equal(clampTrackVolume(Number.NaN), 0);
});

test('createTrackVolumeView converts dB values into slider display data', () => {
  assert.deepEqual(createTrackVolumeView(0), {
    value: 0,
    level: 80,
    label: '0dB',
  });
  assert.equal(formatTrackVolumeLabel(3), '+3dB');
  assert.deepEqual(createTrackVolumeView(MIN_TRACK_VOLUME_DB), { value: -24, level: 0, label: '静音' });
  assert.equal(formatTrackVolumeLabel(-23), '-23dB');
  assert.equal(createTrackVolumeView(MAX_TRACK_VOLUME_DB).level, 100);
});
