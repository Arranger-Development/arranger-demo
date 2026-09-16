import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHORD_STYLE_CHORD_TEMPLATES,
  CHORD_STYLE_GROOVE_TEMPLATES,
  CHORD_STYLE_PRESETS,
  CHORD_STYLE_GENRES,
  getChordStyleChordTemplatesForGenre,
  getChordStyleGrooveHitFeel,
  getChordStyleGrooveTemplatesForGenre,
  getChordStylePreset,
  getChordStylePresetHitFeel,
  getChordStylePresetNotes,
  getChordStylePresetsForGenre,
} from '../src/data/chordStylePresets.js';
import {
  isChordName,
  toggleChordNoteCell,
} from '../src/domain/chordCells.js';
import {
  applyChordStyleSelectionToExistingClips,
  applyChordStylePresetToExistingClips,
  createChordStylePresetBar,
  createChordStylePresetPreviewEvents,
  createChordStyleSelectionBar,
  createChordStyleSelectionPreviewEvents,
  getAppliedChordStylePresetId,
  getAppliedChordStyleSelection,
} from '../src/app/chordStylePresetActions.js';
import { toggleChordRhythmStep } from '../src/app/chordGrooveActions.js';
import createInitialMatrix from '../src/store/createInitialMatrix.js';

function createClips(...clips) {
  return {
    byId: Object.fromEntries(clips.map((clip) => [clip.id, clip])),
    ids: clips.map((clip) => clip.id),
  };
}

test('chord style catalog exposes five complete presets per entry genre', () => {
  assert.equal(CHORD_STYLE_CHORD_TEMPLATES.length, 25);
  assert.equal(CHORD_STYLE_GROOVE_TEMPLATES.length, 25);
  assert.equal(CHORD_STYLE_PRESETS.length, 25);
  assert.equal(new Set(CHORD_STYLE_CHORD_TEMPLATES.map((template) => template.id)).size, 25);
  assert.equal(new Set(CHORD_STYLE_GROOVE_TEMPLATES.map((template) => template.id)).size, 25);
  assert.equal(new Set(CHORD_STYLE_PRESETS.map((preset) => preset.id)).size, 25);

  for (const genreId of Object.keys(CHORD_STYLE_GENRES)) {
    const chordTemplates = getChordStyleChordTemplatesForGenre(genreId);
    const grooveTemplates = getChordStyleGrooveTemplatesForGenre(genreId);
    const presets = getChordStylePresetsForGenre(genreId);
    assert.equal(chordTemplates.length, 5);
    assert.equal(grooveTemplates.length, 5);
    assert.equal(presets.length, 5);
    assert.equal(chordTemplates.filter((template) => template.default).length, 1);
    assert.equal(grooveTemplates.filter((template) => template.default).length, 1);
    assert.equal(presets.filter((preset) => preset.default).length, 1);
    grooveTemplates.forEach((template) => {
      assert.equal(template.id, `${template.sourcePresetId}-groove`);
      assert.equal(template.genreId, genreId);
      assert.equal(['8n', '16n'].includes(template.duration), true);
      assert.equal(['arp', 'block'].includes(template.mode), true);
      assert.equal(template.steps.every((step) => (
        Number.isInteger(step) && step >= 0 && step < 16
      )), true);
    });
    presets.forEach((preset) => {
      assert.equal(preset.genreId, genreId);
      assert.equal(preset.chords.length, 4);
      assert.equal(preset.chords.every(isChordName), true);
      assert.equal(preset.groove.steps.includes(0), true);
      assert.equal(preset.groove.steps.every((step) => (
        Number.isInteger(step) && step >= 0 && step < 16
      )), true);
      assert.equal(['arp', 'block'].includes(preset.groove.mode), true);
    });
  }

  const defaultSignatures = Object.keys(CHORD_STYLE_GENRES).map((genreId) => {
    const preset = getChordStylePresetsForGenre(genreId).find((item) => item.default);
    return `${preset.chords.join('-')}:${preset.groove.mode}:${preset.groove.steps.join(',')}`;
  });
  assert.equal(new Set(defaultSignatures).size, 5);

  const rockSignatures = getChordStyleGrooveTemplatesForGenre('rock').map((template) => (
    `${template.mode}:${template.duration}:${template.steps.join(',')}`
  ));
  assert.equal(new Set(rockSignatures).size, 5);
  assert.equal(getChordStyleGrooveTemplatesForGenre('rock')[3].name, '经典延音');
});

test('chord style voicings and feel are deterministic for every style family', () => {
  assert.deepEqual(getChordStylePresetNotes('pop-neon-home', 0), ['C3', 'E3', 'G3', 'B3']);
  assert.deepEqual(getChordStylePresetNotes('city-major7-cruise', 1), ['E3', 'G3', 'A3', 'C4']);
  assert.deepEqual(getChordStylePresetNotes('indie-bedroom-open', 0), ['C3', 'D3', 'G3', 'E4']);
  assert.deepEqual(getChordStylePresetNotes('lofi-late-night-251', 0), ['C3', 'D3', 'F3', 'A3']);
  assert.deepEqual(getChordStylePresetNotes('rock-straight-power', 0), ['C3', 'G3', 'C4']);

  assert.deepEqual(getChordStylePresetHitFeel('lofi-dusty-maj7', 0, 0), {
    timingOffset: 0.08,
    velocity: 0.68,
  });
  assert.deepEqual(getChordStylePresetHitFeel('lofi-dusty-maj7', 7, 1), {
    timingOffset: 0.28,
    velocity: 0.56,
  });
  assert.deepEqual(getChordStylePresetHitFeel('city-major7-cruise', 3, 1), {
    timingOffset: 0.1,
    velocity: 0.72,
  });
});

test('chord style presets build playable bars and four-bar previews', () => {
  const blockBar = createChordStylePresetBar('pop-neon-home', 1);
  assert.equal(blockBar.length, 16);
  assert.deepEqual(blockBar.filter(Boolean).map((cell) => cell.sourceChordLabel), ['Am7', 'Am7']);
  assert.deepEqual(blockBar[0].tonePitches, ['E3', 'G3', 'A3', 'C4']);
  assert.equal(blockBar[0].chordStylePresetId, 'pop-neon-home');
  assert.equal(blockBar[0].velocity, 0.92);

  const arpBar = createChordStylePresetBar('indie-bedroom-open', 0);
  assert.deepEqual(arpBar.filter(Boolean).map((cell) => cell.notes[0]), [
    'C3', 'D3', 'G3', 'E4',
  ]);
  assert.equal(arpBar[7].timingOffset, 0.04);

  const preview = createChordStylePresetPreviewEvents('city-midnight-2516');
  assert.equal(preview.length, 16);
  assert.deepEqual(preview.map((event) => event.step), [
    0, 6, 9, 12,
    16, 22, 25, 28,
    32, 38, 41, 44,
    48, 54, 57, 60,
  ]);
  assert.equal(preview[2].timingOffset, 0.1);
  assert.deepEqual(createChordStylePresetPreviewEvents('missing'), []);
  assert.equal(createChordStylePresetBar('missing'), null);
});

test('independent chord and groove templates combine with exact feel and reject cross-style ids', () => {
  const popWithArp = createChordStyleSelectionBar(
    'pop-neon-home',
    'pop-canon-glow-groove',
    0,
  );
  assert.deepEqual(popWithArp.filter(Boolean).map((cell) => cell.notes[0]), [
    'C3', 'E3', 'G3', 'B3', 'C3', 'E3', 'G3', 'B3',
  ]);
  assert.equal(popWithArp[0].chordStyleChordTemplateId, 'pop-neon-home');
  assert.equal(popWithArp[0].chordStyleGrooveTemplateId, 'pop-canon-glow-groove');
  assert.equal(popWithArp[0].chordStylePresetId, undefined);

  const cityPreview = createChordStyleSelectionPreviewEvents(
    'city-rooftop-sunset',
    'city-neon-secondary-groove',
  );
  assert.equal(cityPreview.length, 24);
  assert.equal(cityPreview[2].timingOffset, 0.1);
  assert.equal(cityPreview[0].velocity, 0.84);

  const lofiFeel = getChordStyleGrooveHitFeel('lofi-tape-descent-groove', 15, 3);
  assert.deepEqual(lofiFeel, { timingOffset: 0.28, velocity: 0.56 });

  const rockSustain = createChordStyleSelectionBar(
    'rock-straight-power',
    'rock-classic-drive-groove',
  );
  assert.equal(rockSustain[0].duration, '8n');
  assert.equal(rockSustain[4].duration, '8n');

  assert.equal(createChordStyleSelectionBar(
    'pop-neon-home',
    'city-major7-cruise-groove',
  ), null);
  assert.deepEqual(createChordStyleSelectionPreviewEvents('missing', 'missing-groove'), []);
});

test('style preset application cycles over sparse existing clips and preserves other tracks', () => {
  const matrix = createInitialMatrix();
  matrix.drums[2][0] = { instruments: ['kick'] };
  const clips = createClips(
    { id: 'chord-0', trackId: 'chord', bar: 0 },
    { id: 'chord-2', trackId: 'chord', bar: 2 },
    { id: 'chord-3', trackId: 'chord', bar: 3 },
    { id: 'chord-5', trackId: 'chord', bar: 5 },
    { id: 'chord-7', trackId: 'chord', bar: 7 },
    { id: 'drums-1', trackId: 'drums', bar: 1 },
  );

  const nextMatrix = applyChordStylePresetToExistingClips(
    matrix,
    clips,
    'rock-straight-power',
  );
  assert.deepEqual(
    [0, 2, 3, 5, 7].map((bar) => nextMatrix.chord[bar][0].sourceChordLabel),
    ['C5', 'G5', 'A5', 'F5', 'C5'],
  );
  assert.deepEqual(nextMatrix.drums[2][0], { instruments: ['kick'] });
  assert.equal(nextMatrix.chord[1].every((cell) => cell === null), true);
  assert.equal(getAppliedChordStylePresetId(nextMatrix, clips), 'rock-straight-power');

  const customized = structuredClone(nextMatrix);
  delete customized.chord[2][0].chordStylePresetId;
  assert.equal(getAppliedChordStylePresetId(customized, clips), null);

  const manuallyVoiced = structuredClone(nextMatrix);
  manuallyVoiced.chord[0][0] = toggleChordNoteCell(manuallyVoiced.chord[0][0], 'E4');
  assert.equal(manuallyVoiced.chord[0][0].chordStylePresetId, undefined);
  assert.equal(getAppliedChordStylePresetId(manuallyVoiced, clips), null);
  assert.equal(applyChordStylePresetToExistingClips(matrix, clips, 'missing'), matrix);
  assert.equal(getChordStylePreset('missing'), null);
});

test('selection application records both sides and manual edits clear only the changed side', () => {
  const matrix = createInitialMatrix();
  const clips = createClips({ id: 'chord-0', trackId: 'chord', bar: 0 });
  const combined = applyChordStyleSelectionToExistingClips(
    matrix,
    clips,
    'pop-neon-home',
    'pop-synth-axis-groove',
  );
  assert.deepEqual(getAppliedChordStyleSelection(combined, clips), {
    chordTemplateId: 'pop-neon-home',
    grooveTemplateId: 'pop-synth-axis-groove',
  });
  assert.equal(combined.chord[0][0].chordStylePresetId, undefined);

  const manuallyVoiced = structuredClone(combined);
  manuallyVoiced.chord[0][0] = toggleChordNoteCell(manuallyVoiced.chord[0][0], 'D4');
  assert.equal(manuallyVoiced.chord[0][0].chordStyleChordTemplateId, undefined);
  assert.equal(
    manuallyVoiced.chord[0][0].chordStyleGrooveTemplateId,
    'pop-synth-axis-groove',
  );
  assert.deepEqual(getAppliedChordStyleSelection(manuallyVoiced, clips), {
    chordTemplateId: null,
    grooveTemplateId: 'pop-synth-axis-groove',
  });

  const manuallyRhythmed = toggleChordRhythmStep(combined, 0, 2);
  assert.equal(manuallyRhythmed.chord[0][0].chordStyleChordTemplateId, 'pop-neon-home');
  assert.equal(manuallyRhythmed.chord[0][0].chordStyleGrooveTemplateId, undefined);
  assert.equal(manuallyRhythmed.chord[0][0].chordStylePresetId, undefined);
  assert.deepEqual(getAppliedChordStyleSelection(manuallyRhythmed, clips), {
    chordTemplateId: 'pop-neon-home',
    grooveTemplateId: null,
  });

  assert.equal(applyChordStyleSelectionToExistingClips(
    matrix,
    clips,
    'pop-neon-home',
    'city-major7-cruise-groove',
  ), matrix);
});
