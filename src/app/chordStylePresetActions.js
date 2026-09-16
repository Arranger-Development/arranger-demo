import {
  getChordStyleChordTemplate,
  getChordStyleChordTemplateNotes,
  getChordStyleGrooveHitFeel,
  getChordStyleGrooveTemplate,
  getChordStylePreset,
} from '../data/chordStylePresets.js';
import {
  createChordCell,
  createChordNotesCell,
} from '../domain/chordCells.js';
import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import { getExistingChordClipBars } from './chordActions.js';

const CHORD_STYLE_GROOVE_PREFIX = 'style-groove:';

function createChordStyleGrooveId(grooveTemplateId) {
  return `${CHORD_STYLE_GROOVE_PREFIX}${grooveTemplateId}`;
}

function getChordStyleSelection(chordTemplateId, grooveTemplateId) {
  const chordTemplate = getChordStyleChordTemplate(chordTemplateId);
  const grooveTemplate = getChordStyleGrooveTemplate(grooveTemplateId);
  if (!chordTemplate || !grooveTemplate || chordTemplate.genreId !== grooveTemplate.genreId) {
    return null;
  }
  return { chordTemplate, grooveTemplate };
}

function createChordStyleCellMetadata(chordTemplate, grooveTemplate, chordName) {
  const grooveId = createChordStyleGrooveId(grooveTemplate.id);
  const metadata = {
    chordStyleChordTemplateId: chordTemplate.id,
    chordStyleGrooveTemplateId: grooveTemplate.id,
    grooveTemplateId: grooveId,
    selectedGrooveTemplateId: grooveId,
    sourceChordLabel: chordName,
  };
  if (grooveTemplate.sourcePresetId === chordTemplate.id) {
    metadata.chordStylePresetId = chordTemplate.id;
  }
  return metadata;
}

function createChordStyleBlockCell({
  chordName,
  chordTemplate,
  duration,
  grooveTemplate,
  notes,
  timingOffset,
  velocity,
}) {
  const cell = createChordCell(chordName);
  if (!cell || !notes.length) return null;
  return {
    ...cell,
    ...createChordStyleCellMetadata(chordTemplate, grooveTemplate, chordName),
    duration,
    timingOffset,
    tonePitches: notes,
    velocity,
  };
}

function createChordStyleArpCell({
  chordName,
  chordTemplate,
  duration,
  grooveTemplate,
  note,
  timingOffset,
  velocity,
}) {
  const cell = createChordNotesCell([note]);
  if (!cell) return null;
  return {
    ...cell,
    ...createChordStyleCellMetadata(chordTemplate, grooveTemplate, chordName),
    duration,
    timingOffset,
    velocity,
  };
}

function createChordStyleSelectionBar(chordTemplateId, grooveTemplateId, chordIndex = 0) {
  const selection = getChordStyleSelection(chordTemplateId, grooveTemplateId);
  if (!selection || !Number.isInteger(chordIndex)) return null;
  const { chordTemplate, grooveTemplate } = selection;
  const normalizedChordIndex = ((chordIndex % chordTemplate.chords.length)
    + chordTemplate.chords.length) % chordTemplate.chords.length;
  const chordName = chordTemplate.chords[normalizedChordIndex];
  const notes = getChordStyleChordTemplateNotes(chordTemplate, normalizedChordIndex);
  if (!notes.length) return null;

  const bar = Array.from({ length: STEPS_PER_BAR }, () => null);
  grooveTemplate.steps.forEach((step, hitIndex) => {
    const feel = getChordStyleGrooveHitFeel(grooveTemplate, step, hitIndex);
    const shared = {
      chordName,
      chordTemplate,
      duration: grooveTemplate.duration,
      grooveTemplate,
      timingOffset: feel.timingOffset,
      velocity: feel.velocity,
    };
    bar[step] = grooveTemplate.mode === 'arp'
      ? createChordStyleArpCell({
        ...shared,
        note: notes[hitIndex % notes.length],
      })
      : createChordStyleBlockCell({ ...shared, notes });
  });
  return bar;
}

function createChordStyleSelectionPreviewEvents(chordTemplateId, grooveTemplateId) {
  const selection = getChordStyleSelection(chordTemplateId, grooveTemplateId);
  if (!selection) return [];
  const { chordTemplate, grooveTemplate } = selection;

  return chordTemplate.chords.flatMap((unusedChordName, chordIndex) => {
    const notes = getChordStyleChordTemplateNotes(chordTemplate, chordIndex);
    return grooveTemplate.steps.map((step, hitIndex) => {
      const feel = getChordStyleGrooveHitFeel(grooveTemplate, step, hitIndex);
      return {
        duration: grooveTemplate.duration,
        notes: grooveTemplate.mode === 'arp'
          ? [notes[hitIndex % notes.length]]
          : notes,
        step: chordIndex * STEPS_PER_BAR + step,
        timingOffset: feel.timingOffset,
        velocity: feel.velocity,
      };
    });
  });
}

function applyChordStyleSelectionToExistingClips(
  matrix,
  clips,
  chordTemplateId,
  grooveTemplateId,
) {
  const selection = getChordStyleSelection(chordTemplateId, grooveTemplateId);
  const clipBars = getExistingChordClipBars(clips);
  if (!selection || !matrix?.chord || !clipBars.length) return matrix;

  const nextChord = [...matrix.chord];
  clipBars.forEach((barIndex, clipIndex) => {
    const bar = createChordStyleSelectionBar(
      selection.chordTemplate.id,
      selection.grooveTemplate.id,
      clipIndex,
    );
    if (bar) nextChord[barIndex] = bar;
  });
  return {
    ...matrix,
    chord: nextChord,
  };
}

function getCellChordTemplateId(cell) {
  return cell?.chordStyleChordTemplateId ?? cell?.chordStylePresetId ?? null;
}

function getCellGrooveTemplateId(cell) {
  if (cell?.chordStyleGrooveTemplateId) return cell.chordStyleGrooveTemplateId;
  return cell?.chordStylePresetId ? `${cell.chordStylePresetId}-groove` : null;
}

function getUniformMarker(cells, getter) {
  const populatedCells = cells.filter(Boolean);
  if (!populatedCells.length) return null;
  const values = populatedCells.map(getter);
  const candidate = values[0];
  return candidate && values.every((value) => value === candidate) ? candidate : null;
}

function getAppliedChordStyleSelection(matrix, clips) {
  const clipBars = getExistingChordClipBars(clips);
  if (!clipBars.length) return null;

  const barSelections = clipBars.map((barIndex) => {
    const cells = matrix?.chord?.[barIndex] ?? [];
    return {
      chordTemplateId: getUniformMarker(cells, getCellChordTemplateId),
      grooveTemplateId: getUniformMarker(cells, getCellGrooveTemplateId),
    };
  });
  const candidate = barSelections[0];
  const chordTemplateId = candidate?.chordTemplateId
    && barSelections.every((barSelection) => (
      barSelection.chordTemplateId === candidate.chordTemplateId
    ))
    && getChordStyleChordTemplate(candidate.chordTemplateId)
    ? candidate.chordTemplateId
    : null;
  const grooveTemplateId = candidate?.grooveTemplateId
    && barSelections.every((barSelection) => (
      barSelection.grooveTemplateId === candidate.grooveTemplateId
    ))
    && getChordStyleGrooveTemplate(candidate.grooveTemplateId)
    ? candidate.grooveTemplateId
    : null;
  if (!chordTemplateId && !grooveTemplateId) return null;
  if (
    chordTemplateId
    && grooveTemplateId
    && !getChordStyleSelection(chordTemplateId, grooveTemplateId)
  ) {
    return null;
  }
  return { chordTemplateId, grooveTemplateId };
}

function createChordStylePresetBar(presetId, chordIndex = 0) {
  const preset = getChordStylePreset(presetId);
  return preset
    ? createChordStyleSelectionBar(preset.id, `${preset.id}-groove`, chordIndex)
    : null;
}

function createChordStylePresetPreviewEvents(presetId) {
  const preset = getChordStylePreset(presetId);
  return preset
    ? createChordStyleSelectionPreviewEvents(preset.id, `${preset.id}-groove`)
    : [];
}

function applyChordStylePresetToExistingClips(matrix, clips, presetId) {
  const preset = getChordStylePreset(presetId);
  return preset
    ? applyChordStyleSelectionToExistingClips(
      matrix,
      clips,
      preset.id,
      `${preset.id}-groove`,
    )
    : matrix;
}

function getAppliedChordStylePresetId(matrix, clips) {
  const selection = getAppliedChordStyleSelection(matrix, clips);
  if (!selection || selection.grooveTemplateId !== `${selection.chordTemplateId}-groove`) {
    return null;
  }
  const clipBars = getExistingChordClipBars(clips);
  return clipBars.every((barIndex) => (
    getUniformMarker(matrix?.chord?.[barIndex] ?? [], (cell) => cell?.chordStylePresetId)
      === selection.chordTemplateId
  ))
    ? selection.chordTemplateId
    : null;
}

export {
  CHORD_STYLE_GROOVE_PREFIX,
  applyChordStylePresetToExistingClips,
  applyChordStyleSelectionToExistingClips,
  createChordStyleGrooveId,
  createChordStylePresetBar,
  createChordStylePresetPreviewEvents,
  createChordStyleSelectionBar,
  createChordStyleSelectionPreviewEvents,
  getAppliedChordStylePresetId,
  getAppliedChordStyleSelection,
};
