import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_DRUM_TEMPLATE_GENRE_ID,
  DEFAULT_DRUM_TEMPLATE_ID,
  DRUM_STYLE_TEMPLATES,
  DRUM_TEMPLATE_GENRE_FEELS,
  DRUM_TEMPLATE_GENRES,
  getDrumTemplate,
  getDrumTemplateGenre,
  getDrumTemplateHitFeel,
  getDrumTemplatesForGenre,
  normalizeDrumTemplateGenreId,
} from '../src/data/drumStyleTemplates.js';
import {
  applyDrumsTemplateToBar,
  applyDrumsTemplateToBars,
  createDrumTemplatePreviewEvents,
  createDrumsBarFromTemplate,
} from '../src/app/drumsPatternActions.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

const EXPECTED_TEMPLATE_IDS = Object.freeze({
  pop: [
    'basic-drums-groove',
    'pop-neon-four-floor',
    'pop-synth-bounce',
    'pop-retro-offbeat',
    'pop-chorus-drive',
  ],
  'hip-hop': [
    'city-pop-cruise',
    'city-pop-midnight-drive',
    'city-pop-sea-breeze-disco',
    'city-pop-neon-sync',
    'city-pop-rooftop-sunset',
  ],
  'r-and-b': [
    'indie-bedroom-pulse',
    'indie-hazy-sync',
    'indie-half-time-space',
    'indie-offbeat-glow',
    'indie-chorus-lift',
  ],
  'electronic-edm': [
    'lofi-dusty-tape',
    'lofi-rainy-night',
    'lofi-broken-streetlight',
    'lofi-late-night-space',
    'lofi-tape-stagger',
  ],
  rock: [
    'rock-straight-eighths',
    'rock-garage-drive',
    'rock-stage-four-floor',
    'rock-snare-ending',
    'rock-punk-sprint',
  ],
});

test('drum template catalog exposes five validated patterns for every entry style', () => {
  assert.equal(DEFAULT_DRUM_TEMPLATE_GENRE_ID, 'pop');
  assert.equal(DEFAULT_DRUM_TEMPLATE_ID, 'basic-drums-groove');
  assert.equal(DRUM_STYLE_TEMPLATES.length, 25);
  assert.deepEqual(Object.keys(DRUM_TEMPLATE_GENRES), Object.keys(EXPECTED_TEMPLATE_IDS));
  assert.equal(new Set(DRUM_STYLE_TEMPLATES.map((template) => template.id)).size, 25);

  for (const [genreId, expectedIds] of Object.entries(EXPECTED_TEMPLATE_IDS)) {
    const templates = getDrumTemplatesForGenre(genreId);
    assert.deepEqual(templates.map((template) => template.id), expectedIds);
    assert.equal(templates.filter((template) => template.default).length, 1);
    assert.equal(getDrumTemplateGenre(genreId).id, genreId);

    templates.forEach((template) => {
      assert.equal(template.genreId, genreId);
      assert.ok(template.name.length > 0);
      assert.ok(template.description.length > 0);
      assert.deepEqual(Object.keys(template.hits), ['hihat', 'kick', 'snare']);
      assert.ok(template.feel.label.length > 0);
      assert.equal(template.feel.swing, DRUM_TEMPLATE_GENRE_FEELS[genreId].swing);
      Object.values(template.hits).forEach((steps) => {
        assert.equal(new Set(steps).size, steps.length);
        assert.equal(steps.every((step) => Number.isInteger(step) && step >= 0 && step < 16), true);
      });
      for (const instrument of Object.keys(template.hits)) {
        assert.equal(
          template.feel.accentSteps[instrument].every((step) => (
            template.hits[instrument].includes(step)
          )),
          true,
        );
        assert.equal(
          template.feel.ghostSteps[instrument].every((step) => (
            template.hits[instrument].includes(step)
          )),
          true,
        );
      }
    });
  }
});

test('default templates expose clearly different rhythmic skeletons and feel', () => {
  const defaults = Object.keys(EXPECTED_TEMPLATE_IDS).map((genreId) => (
    getDrumTemplatesForGenre(genreId).find((template) => template.default)
  ));
  const signatures = defaults.map((template) => JSON.stringify(template.hits));

  assert.equal(new Set(signatures).size, defaults.length);
  assert.deepEqual(defaults.map((template) => template.feel.swing), [0, 0.12, 0.04, 0.24, 0]);
  assert.deepEqual(defaults.map((template) => template.hits.snare), [
    [4, 12],
    [4, 10, 12],
    [8],
    [4, 12],
    [4, 12],
  ]);
  assert.deepEqual(getDrumTemplateHitFeel('city-pop-cruise', 'hihat', 3), {
    timingOffset: 0.12,
    velocity: 0.269,
  });
  assert.deepEqual(getDrumTemplateHitFeel('lofi-dusty-tape', 'snare', 4), {
    timingOffset: 0.16,
    velocity: 0.88,
  });
  assert.deepEqual(getDrumTemplateHitFeel('rock-straight-eighths', 'kick', 0), {
    timingOffset: 0,
    velocity: 1,
  });
});

test('unknown drum template genres fall back to the first-page Pop style', () => {
  assert.equal(normalizeDrumTemplateGenreId('unknown'), 'pop');
  assert.equal(getDrumTemplateGenre('unknown').id, 'pop');
  assert.deepEqual(
    getDrumTemplatesForGenre('unknown').map((template) => template.id),
    EXPECTED_TEMPLATE_IDS.pop,
  );
  assert.equal(getDrumTemplate('missing-template'), null);
});

test('drum templates build normalized bars and merged one-bar preview events', () => {
  const bar = createDrumsBarFromTemplate('pop-neon-four-floor');
  const previewEvents = createDrumTemplatePreviewEvents('pop-neon-four-floor');

  assert.equal(bar.length, 16);
  assert.deepEqual(bar[4], {
    instruments: ['kick', 'snare', 'hihat'],
    timingOffsets: { hihat: 0, kick: 0, snare: 0 },
    velocities: { hihat: 0.62, kick: 0.96, snare: 1 },
  });
  assert.deepEqual(bar[2], {
    instruments: ['hihat'],
    timingOffsets: { hihat: 0 },
    velocities: { hihat: 0.78 },
  });
  assert.deepEqual(previewEvents.find((event) => event.step === 4), {
    instruments: ['kick', 'snare', 'hihat'],
    step: 4,
    timingOffsets: { hihat: 0, kick: 0, snare: 0 },
    velocities: { hihat: 0.62, kick: 0.96, snare: 1 },
  });
  assert.deepEqual(previewEvents.map((event) => event.step), [0, 2, 4, 6, 8, 10, 12, 14]);
  assert.equal(createDrumsBarFromTemplate('missing-template'), null);
  assert.deepEqual(createDrumTemplatePreviewEvents('missing-template'), []);
});

test('template application can target one bar or existing clip bars without clearing siblings', () => {
  const matrix = createInitialMatrix();
  matrix.drums[0][1] = { instruments: ['snare'] };
  matrix.drums[1][3] = { instruments: ['kick'] };
  matrix.drums[5][7] = { instruments: ['hihat'] };
  matrix.bass[1][0] = { note: 'C1' };

  const currentBarResult = applyDrumsTemplateToBar(matrix, 1, 'rock-stage-four-floor');
  assert.deepEqual(currentBarResult.drums[1][0], {
    instruments: ['kick', 'hihat'],
    timingOffsets: { hihat: 0, kick: 0 },
    velocities: { hihat: 0.94, kick: 1 },
  });
  assert.deepEqual(currentBarResult.drums[1][4], {
    instruments: ['kick', 'snare', 'hihat'],
    timingOffsets: { hihat: 0, kick: 0, snare: 0 },
    velocities: { hihat: 0.94, kick: 1, snare: 1 },
  });
  assert.equal(currentBarResult.drums[0], matrix.drums[0]);
  assert.deepEqual(currentBarResult.bass[1][0], { note: 'C1' });

  const allClipsResult = applyDrumsTemplateToBars(
    currentBarResult,
    [0, 5],
    'lofi-late-night-space',
  );
  assert.deepEqual(allClipsResult.drums[0][0], {
    instruments: ['kick'],
    timingOffsets: { kick: 0 },
    velocities: { kick: 0.98 },
  });
  assert.deepEqual(allClipsResult.drums[5][4], {
    instruments: ['snare'],
    timingOffsets: { snare: 0.16 },
    velocities: { snare: 0.88 },
  });
  assert.equal(allClipsResult.drums[1], currentBarResult.drums[1]);
  assert.equal(applyDrumsTemplateToBar(matrix, 0, 'missing-template'), matrix);
  assert.equal(applyDrumsTemplateToBars(matrix, [0], 'missing-template'), matrix);
  assert.equal(applyDrumsTemplateToBars(matrix, [], 'rock-stage-four-floor'), matrix);
});
