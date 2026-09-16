import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { test } from 'node:test';

import {
  DEFAULT_MELODY_TIMBRE_ID,
  getMelodyTimbre,
  MELODY_TIMBRE_IDS,
  normalizeMelodyTimbreId,
} from '../src/data/melodyTimbres.js';

test('Melody timbres expose Piano plus the two approved template recommendations', () => {
  assert.equal(DEFAULT_MELODY_TIMBRE_ID, 'piano');
  assert.deepEqual(MELODY_TIMBRE_IDS, ['piano', 'yangqin', 'blues']);
  assert.equal(getMelodyTimbre('piano').gainDb, 0);
  assert.equal(getMelodyTimbre('yangqin').gainDb, -1);
  assert.equal(getMelodyTimbre('blues').gainDb, -3);
  assert.equal(normalizeMelodyTimbreId('unknown'), 'piano');
  assert.equal(normalizeMelodyTimbreId(null), 'piano');
});

test('Melody timbre sample maps align provided 2–4 labels with UI octaves 3–5', () => {
  const piano = getMelodyTimbre('piano').sampleFiles;
  const yangqin = getMelodyTimbre('yangqin').sampleFiles;
  const blues = getMelodyTimbre('blues').sampleFiles;

  assert.equal(Object.keys(piano).length, 21);
  assert.equal(Object.keys(yangqin).length, 21);
  assert.equal(Object.keys(blues).length, 18);
  assert.equal(yangqin.C3, 'samples/Melody/Yangqin/Yangqin_C2.wav');
  assert.equal(yangqin.B5, 'samples/Melody/Yangqin/Yangqin_B4.wav');
  assert.equal(blues['D#3'], 'samples/Melody/Blues/Blues_DSharp2.wav');
  assert.equal(blues['D#5'], 'samples/Melody/Blues/Blues_DSharp4.wav');
  assert.equal(blues.F3, undefined);
  assert.equal(blues.C2, undefined);
  assert.equal(yangqin.C2, undefined);
});

test('all configured non-Piano Melody samples exist in public assets', async () => {
  const sampleFiles = ['yangqin', 'blues'].flatMap((timbreId) => (
    Object.values(getMelodyTimbre(timbreId).sampleFiles)
  ));

  await Promise.all(sampleFiles.map((sampleFile) => (
    access(new URL(`../public/${sampleFile}`, import.meta.url))
  )));
});
