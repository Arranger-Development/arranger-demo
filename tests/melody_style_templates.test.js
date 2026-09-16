import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MELODY_STYLE_TEMPLATE_IDS,
  MELODY_STYLE_TEMPLATES,
  normalizeMelodyProjectState,
  normalizeMelodyScaleId,
} from '../src/data/melodyStyleTemplates.js';

test('Melody style templates contain the approved scales and rhythms only', () => {
  assert.deepEqual(MELODY_STYLE_TEMPLATE_IDS, ['chinese', 'blues']);
  assert.deepEqual(MELODY_STYLE_TEMPLATES.chinese.highlightedPitchClasses, [
    'C', 'D', 'E', 'G', 'A',
  ]);
  assert.deepEqual(MELODY_STYLE_TEMPLATES.chinese.rhythmSteps, [2, 4, 8, 12, 14]);
  assert.equal(MELODY_STYLE_TEMPLATES.chinese.recommendedTimbreId, 'yangqin');
  assert.deepEqual(MELODY_STYLE_TEMPLATES.blues.highlightedPitchClasses, [
    'C', 'D', 'D#', 'E', 'G', 'A',
  ]);
  assert.deepEqual(MELODY_STYLE_TEMPLATES.blues.rhythmSteps, [2, 4, 6, 10, 11, 12, 14]);
  assert.equal(MELODY_STYLE_TEMPLATES.blues.recommendedTimbreId, 'blues');
});

test('legacy Melody state falls back to Chinese and drops per-clip rhythms', () => {
  const legacyState = {
    clips: {
      ids: ['melody-bar-0'],
      byId: {
        'melody-bar-0': {
          bar: 0,
          id: 'melody-bar-0',
          melodyRhythmTemplateId: 'syncopation',
          name: 'Legacy melody',
          trackId: 'melody',
        },
      },
    },
    melodyRhythmTemplateId: 'dotted',
    melodyScaleId: 'major',
  };
  const normalized = normalizeMelodyProjectState(legacyState);

  assert.equal(normalized.melodyScaleId, 'chinese');
  assert.equal(normalized.melodyRhythmTemplateId, null);
  assert.equal(normalized.melodyTimbreId, 'piano');
  assert.equal(
    Object.hasOwn(normalized.clips.byId['melody-bar-0'], 'melodyRhythmTemplateId'),
    false,
  );
  assert.equal(normalized.clips.byId['melody-bar-0'].name, 'Legacy melody');
  assert.equal(normalizeMelodyScaleId('pentatonic'), 'chinese');
  assert.equal(normalizeMelodyScaleId('unknown'), 'chinese');
});
