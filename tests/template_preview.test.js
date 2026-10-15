import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampPreviewBar, createTemplatePreview, hitStrength } from '../src/app/templatePreview.js';

const bar = entries => Object.assign(Array(16).fill(null), entries);
const template = (trackId, ...bars) => ({ trackId, bars });

test('drum preview keeps all retriggers, their timing and individual velocities', () => {
  const saved = template('drums', bar({ 3: {
    instruments: ['kick', 'hihat'],
    drumHits: [
      { instrument: 'kick', offsetSteps: 0, durationSteps: 1, velocity: 0.95 },
      { instrument: 'hihat', offsetSteps: 0, durationSteps: 0.5, velocity: 0.35 },
      { instrument: 'hihat', offsetSteps: 0.5, durationSteps: 0.5, velocity: 0.7 },
      { instrument: 'snare', offsetSteps: 0, velocity: 1 },
    ],
  } }));
  const before = structuredClone(saved);
  const hits = createTemplatePreview(saved).bars[0].hits;
  assert.deepEqual(hits.map(({ instrument, step, offset, velocity }) => [instrument, step, offset, velocity]), [
    ['kick', 3, 0, 0.95], ['hihat', 3, 0, 0.35], ['hihat', 3, 0.5, 0.7],
  ]);
  assert.deepEqual(hits.map(hit => hitStrength(hit.velocity)), ['accent', 'ghost', 'normal']);
  assert.deepEqual(saved, before);
});

test('legacy drum cells keep early hits, swing and instrument feel', () => {
  const preview = createTemplatePreview(template('drums', bar({ 0: { instrument: 'snare', velocities: { snare: 0.4 }, timingOffsets: { snare: -0.2 } } })));
  assert.deepEqual(preview.bars[0].hits, [{ instrument: 'snare', step: 0, offset: -0.2, velocity: 0.4 }]);
});

test('literal chord preview preserves polyphony and per-note durations', () => {
  const preview = createTemplatePreview(template('chord', bar({ 4: {
    type: 'notes', notes: ['C4', 'E4', 'G4'], durationSteps: 2,
    noteDurationSteps: { C4: 1, E4: 4, G4: 8 },
  } })));
  assert.deepEqual(preview.bars[0].notes.map(n => [n.note, n.pitch, n.start, n.duration]), [
    ['C4', 60, 4, 1], ['E4', 64, 4, 4], ['G4', 67, 4, 8],
  ]);
});

test('legacy root chords resolve their actual voicing without invented pitch labels', () => {
  const preview = createTemplatePreview(template('chord', bar({ 0: { type: 'chord', root: 'C', label: 'C' } })));
  assert.equal(preview.bars[0].notes.length, 3);
  assert.deepEqual(preview.bars[0].notes.map(n => n.pitch % 12), [0, 4, 7]);
  assert.ok(preview.bars[0].notes.every(n => n.duration === 4));
});

test('melody preview keeps simultaneous pitches and sustained tails across pages', () => {
  const preview = createTemplatePreview(template('melody', bar({ 14: { type: 'melody', notes: ['C4', 'E4'], durationSteps: 6 } }), bar({}), bar({})));
  assert.deepEqual(preview.bars.map(p => p.notes.map(n => [n.note, n.start, n.duration, n.continued])), [
    [['C4', 14, 2, false], ['E4', 14, 2, false]],
    [['C4', 0, 4, true], ['E4', 0, 4, true]],
    [],
  ]);
  assert.ok(preview.maxPitch - preview.minPitch >= 12);
});

test('bass and melody notation durations retain rhythmic proportions and pitch height', () => {
  const bass = createTemplatePreview(template('bass', bar({ 0: { type: 'bass', note: 'C2', duration: '8n' }, 8: { type: 'bass', note: 'G2', duration: '4n' } })));
  assert.deepEqual(bass.bars[0].notes.map(n => [n.pitch, n.start, n.duration]), [[36, 0, 2], [43, 8, 4]]);
  const melody = createTemplatePreview(template('melody', bar({ 0: { type: 'melody', note: 'C4', duration: '8n.' }, 8: { type: 'melody', note: 'C5', duration: '8t' } })));
  assert.equal(melody.bars[0].notes[0].duration, 3);
  assert.ok(Math.abs(melody.bars[0].notes[1].duration - 4 / 3) < 1e-10);
  assert.equal(melody.maxPitch - melody.minPitch, 12);
});

test('empty pages stay empty rather than reusing the first bar or source preset', () => {
  for (const trackId of ['drums', 'chord', 'bass', 'melody']) {
    const preview = createTemplatePreview({ ...template(trackId, bar({}), bar({})), sourcePresetId: 'retro-disco' });
    assert.deepEqual(preview.bars, [{ hits: [], notes: [] }, { hits: [], notes: [] }]);
    assert.ok(Number.isFinite(preview.minPitch) && Number.isFinite(preview.maxPitch));
  }
});

test('paging stays in bounds, including after a template is resaved with fewer bars', () => {
  assert.equal(clampPreviewBar(-1, 4), 0);
  assert.equal(clampPreviewBar(2, 4), 2);
  assert.equal(clampPreviewBar(4, 4), 3);
  assert.equal(clampPreviewBar(3, 1), 0);
});
