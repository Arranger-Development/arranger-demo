import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMultimodalInput, getMultimodalAnalysisStages, MULTIMODAL_TEXT_LIMIT } from '../src/app/multimodalInput.js';

const file = (name, type, size = 1024) => ({ name, type, size });

test('text input requires a meaningful description within its limit', () => {
  assert.equal(validateMultimodalInput({ mode: 'text', text: ' \n ' }).valid, false);
  assert.equal(validateMultimodalInput({ mode: 'text', text: '钢琴雨夜' }).valid, true);
  assert.equal(validateMultimodalInput({ mode: 'text', text: '曲'.repeat(MULTIMODAL_TEXT_LIMIT) }).valid, true);
  assert.equal(validateMultimodalInput({ mode: 'text', text: '曲'.repeat(MULTIMODAL_TEXT_LIMIT + 1) }).valid, false);
  assert.equal(validateMultimodalInput({ mode: 'unknown' }).valid, false);
});

test('one generation uses only the selected mode', () => {
  const image = file('scene.png', 'image/png');
  assert.equal(validateMultimodalInput({ mode: 'text', file: image }).valid, false);
  assert.equal(validateMultimodalInput({ mode: 'text', text: '钢琴', file: image }).valid, true);
  assert.equal(validateMultimodalInput({ mode: 'image', text: '钢琴' }).valid, false);
  assert.equal(validateMultimodalInput({ mode: 'audio', file: image }).valid, false);
  assert.equal(validateMultimodalInput({ mode: 'image', file: image }).valid, true);
  assert.equal(validateMultimodalInput({ mode: 'video', file: file('scene.mp4', 'video/mp4') }).valid, true);
});

test('audio accepts browser MIME variants or extensions and enforces its size limit', () => {
  for (const [name, type] of [['take.WAV', ''], ['take.flac', 'audio/x-flac'], ['take.m4a', 'audio/x-m4a'], ['take.mp3', 'audio/mpeg']]) {
    assert.equal(validateMultimodalInput({ mode: 'audio', file: file(name, type) }).valid, true);
  }
  assert.equal(validateMultimodalInput({ mode: 'audio', file: file('take.wav', 'audio/wav', 50 * 1024 * 1024) }).valid, true);
  for (const size of [NaN, -1, 50 * 1024 * 1024 + 1]) {
    assert.equal(validateMultimodalInput({ mode: 'audio', file: file('take.wav', 'audio/wav', size) }).valid, false);
  }
  assert.equal(validateMultimodalInput({ mode: 'audio', file: file('document.pdf', 'application/pdf') }).valid, false);
});

test('analysis copy follows the chosen medium', () => {
  assert.match(getMultimodalAnalysisStages('text')[0], /描述/);
  assert.match(getMultimodalAnalysisStages('audio')[0], /音频/);
  assert.deepEqual(getMultimodalAnalysisStages('image'), getMultimodalAnalysisStages('video'));
});
