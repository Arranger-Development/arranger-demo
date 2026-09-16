import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import {
  getChordStyleChordTemplate,
  getChordStyleChordTemplateNotes,
} from '../data/chordStylePresets.js';
import {
  CHORD_TEMPLATES,
  createChordCell,
  createChordNotesCell,
  createChordTonePitches,
  createPassingChordCell,
  getChordDefinition,
  getDoowopPassingTargetChord,
  getChordVariantOptions,
  getPassingChordOptions,
  isPassingChordCell,
} from '../domain/chordCells.js';
import { getExistingChordClipBars } from './chordActions.js';

const DEFAULT_GROOVE_CHORD = 'C';
const CUSTOM_CHORD_GROOVE_ID = 'custom-rhythm';
const CHORD_SOURCE_CELL_TYPE = 'chord-source';
const PASSING_CHORD_STEP_INDEX = STEPS_PER_BAR - 2;

const CHORD_GROOVE_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'block-basic',
    name: '柱式音型基础律动',
    kind: 'block',
    default: true,
    hitLabel: '1 hit / bar',
    desc: '最基础的弹奏律动，适合在这个基础上做进一步的微调。',
    detail: '在每小节的 1/16 处添加和弦的柱式音型。',
    steps: Object.freeze([0]),
  }),
  Object.freeze({
    id: 'block-syncopated',
    name: '柱式音型切分律动',
    kind: 'block',
    hitLabel: '3 hits / bar',
    desc: '在基础柱式音型上加入切分重音，创造更多律动感。',
    detail: '在每小节的第 1/16、7/16、13/16 处添加和弦的柱式音型。',
    steps: Object.freeze([0, 6, 12]),
  }),
]);

function getChordGrooveTemplate(templateId) {
  return CHORD_GROOVE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

function createChordNotes(chordName) {
  const definition = getChordDefinition(chordName);
  if (!definition) return [];

  return createChordTonePitches(definition.root, definition.toneRoots, definition.tonePitches);
}

function octaveUp(note) {
  const match = /^([A-G]#?)([0-9])$/.exec(note);
  if (!match) return note;

  return `${match[1]}${Number(match[2]) + 1}`;
}

function getArpeggioNote(notes, index) {
  if (!notes.length) return null;
  if (notes[index]) return notes[index];

  return octaveUp(notes[index % notes.length]);
}

function getSourceChordLabel(matrix, barIndex) {
  const chordBar = matrix?.chord?.[barIndex] ?? [];
  const firstCell = chordBar[0];
  if (firstCell?.type === 'chord') return firstCell.sourceChordLabel ?? firstCell.label;
  if (firstCell?.sourceChordLabel) return firstCell.sourceChordLabel;

  return chordBar.find((cell) => cell?.sourceChordLabel)?.sourceChordLabel ?? DEFAULT_GROOVE_CHORD;
}

function getChordProgressionTemplateId(matrix, barIndex) {
  return matrix?.chord?.[barIndex]?.find((cell) => cell?.progressionTemplateId)
    ?.progressionTemplateId ?? null;
}

function getChordRhythmSteps(matrix, barIndex) {
  return (matrix?.chord?.[barIndex] ?? [])
    .map((cell, step) => ({ cell, step }))
    .filter(({ cell }) => ['chord', 'note', 'notes'].includes(cell?.type))
    .map(({ step }) => step);
}

function getChordRhythmStepLabel(matrix, barIndex, stepIndex) {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= STEPS_PER_BAR) return null;

  const cell = matrix?.chord?.[barIndex]?.[stepIndex];
  return ['chord', 'note', 'notes'].includes(cell?.type)
    ? (cell.label ?? cell.sourceChordLabel ?? null)
    : null;
}

function getChordRhythmStepSourceLabel(matrix, barIndex, stepIndex) {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= STEPS_PER_BAR) return null;

  const cell = matrix?.chord?.[barIndex]?.[stepIndex];
  if (cell?.type !== 'chord') return getSourceChordLabel(matrix, barIndex);

  if (isPassingChordCell(cell)) return getSourceChordLabel(matrix, barIndex);
  return cell.sourceChordLabel ?? getSourceChordLabel(matrix, barIndex);
}

function getChordSelectedGrooveTemplateId(matrix, barIndex) {
  const chordBar = matrix?.chord?.[barIndex] ?? [];
  const selectedId = chordBar.find((cell) => cell?.selectedGrooveTemplateId)
    ?.selectedGrooveTemplateId;
  if (selectedId) return selectedId;

  const grooveIds = new Set(
    chordBar
      .filter((cell) => cell?.type === 'chord' && cell.duration === '16n')
      .map((cell) => cell.grooveTemplateId)
      .filter(Boolean),
  );

  return grooveIds.size === 1 ? [...grooveIds][0] : null;
}

function getAppliedChordProgressionTemplateId(matrix, clips, selectedBar) {
  const explicitTemplateId = getChordProgressionTemplateId(matrix, selectedBar);
  if (explicitTemplateId && CHORD_TEMPLATES[explicitTemplateId]) return explicitTemplateId;

  const bars = getExistingChordClipBars(clips);
  if (!bars.length) return null;
  const matchingIds = Object.values(CHORD_TEMPLATES)
    .filter((template) => bars.every((barIndex, index) => (
      getSourceChordLabel(matrix, barIndex) === template.chords[index % template.chords.length]
    )))
    .map((template) => template.id);

  return matchingIds.length === 1 ? matchingIds[0] : null;
}

function createChordSourceCell(
  chordName,
  progressionTemplateId = null,
  selectedGrooveTemplateId = CUSTOM_CHORD_GROOVE_ID,
  metadata = {},
) {
  const chordCell = createChordCell(chordName) ?? createChordCell(DEFAULT_GROOVE_CHORD);
  if (!chordCell) return null;

  return {
    type: CHORD_SOURCE_CELL_TYPE,
    label: chordCell.label,
    sourceChordLabel: chordCell.label,
    ...(progressionTemplateId ? { progressionTemplateId } : {}),
    ...(selectedGrooveTemplateId ? { selectedGrooveTemplateId } : {}),
    ...(metadata.chordStyleChordTemplateId
      ? { chordStyleChordTemplateId: metadata.chordStyleChordTemplateId }
      : {}),
  };
}

function createGrooveChordCell(
  chordName,
  templateId,
  progressionTemplateId = null,
  selectedGrooveTemplateId = templateId,
) {
  const cell = createChordCell(chordName) ?? createChordCell(DEFAULT_GROOVE_CHORD);
  if (!cell) return null;

  return {
    ...cell,
    duration: '16n',
    grooveTemplateId: templateId,
    sourceChordLabel: cell.label,
    ...(progressionTemplateId ? { progressionTemplateId } : {}),
    ...(selectedGrooveTemplateId ? { selectedGrooveTemplateId } : {}),
  };
}

function getChordBarMetadata(matrix, barIndex) {
  const bar = matrix?.chord?.[barIndex] ?? [];
  const chordStyleCell = bar.find((cell) => (
    cell?.chordStyleChordTemplateId || cell?.chordStylePresetId
  ));
  const grooveStyleCell = bar.find((cell) => (
    cell?.chordStyleGrooveTemplateId || cell?.chordStylePresetId
  ));
  return {
    chordStyleChordTemplateId: chordStyleCell?.chordStyleChordTemplateId
      ?? chordStyleCell?.chordStylePresetId
      ?? null,
    chordStyleGrooveTemplateId: grooveStyleCell?.chordStyleGrooveTemplateId
      ?? (grooveStyleCell?.chordStylePresetId
        ? `${grooveStyleCell.chordStylePresetId}-groove`
        : null),
    progressionTemplateId: getChordProgressionTemplateId(matrix, barIndex),
    selectedGrooveTemplateId: getChordSelectedGrooveTemplateId(matrix, barIndex),
  };
}

function getChordStepMetadata(cell, barMetadata) {
  return {
    chordStyleChordTemplateId: cell?.chordStyleChordTemplateId
      ?? cell?.chordStylePresetId
      ?? barMetadata.chordStyleChordTemplateId,
    chordStyleGrooveTemplateId: cell?.chordStyleGrooveTemplateId
      ?? (cell?.chordStylePresetId ? `${cell.chordStylePresetId}-groove` : null)
      ?? barMetadata.chordStyleGrooveTemplateId,
    duration: cell?.duration,
    progressionTemplateId: cell?.progressionTemplateId ?? barMetadata.progressionTemplateId,
    selectedGrooveTemplateId: cell?.selectedGrooveTemplateId
      ?? barMetadata.selectedGrooveTemplateId,
    timingOffset: cell?.timingOffset,
    velocity: cell?.velocity,
  };
}

function getStyleChordTonePitches(chordStyleChordTemplateId, chordName) {
  const template = getChordStyleChordTemplate(chordStyleChordTemplateId);
  const chordIndex = template?.chords.indexOf(chordName) ?? -1;
  return chordIndex >= 0 ? getChordStyleChordTemplateNotes(template, chordIndex) : [];
}

function createChordRhythmEventCell({
  chordName,
  grooveTemplateId,
  metadata,
  sourceChordLabel,
}) {
  const cell = createChordCell(chordName);
  if (!cell) return null;

  return {
    ...cell,
    duration: metadata.duration ?? '16n',
    grooveTemplateId,
    sourceChordLabel,
    ...(metadata.chordStyleChordTemplateId
      ? {
        chordStyleChordTemplateId: metadata.chordStyleChordTemplateId,
        tonePitches: getStyleChordTonePitches(metadata.chordStyleChordTemplateId, chordName),
      }
      : {}),
    ...(metadata.chordStyleGrooveTemplateId
      ? { chordStyleGrooveTemplateId: metadata.chordStyleGrooveTemplateId }
      : {}),
    ...(metadata.progressionTemplateId
      ? { progressionTemplateId: metadata.progressionTemplateId }
      : {}),
    ...(metadata.selectedGrooveTemplateId
      ? { selectedGrooveTemplateId: metadata.selectedGrooveTemplateId }
      : {}),
    ...(Number.isFinite(metadata.timingOffset)
      ? { timingOffset: metadata.timingOffset }
      : {}),
    ...(Number.isFinite(metadata.velocity) ? { velocity: metadata.velocity } : {}),
  };
}

function createGrooveNoteCell(note, templateId, chordName) {
  const cell = createChordNotesCell([note]);
  if (!cell) return null;

  return {
    ...cell,
    grooveTemplateId: templateId,
    sourceChordLabel: chordName,
  };
}

function createGrooveBar(template, chordName, progressionTemplateId = null) {
  const notes = createChordNotes(chordName);
  const sourceChordName = notes.length ? chordName : DEFAULT_GROOVE_CHORD;
  const sourceNotes = notes.length ? notes : createChordNotes(DEFAULT_GROOVE_CHORD);
  const nextBar = Array.from({ length: STEPS_PER_BAR }, () => null);

  template.steps.forEach((step, index) => {
    if (template.kind === 'block') {
      nextBar[step] = createGrooveChordCell(
        sourceChordName,
        template.id,
        progressionTemplateId,
      );
      return;
    }

    const note = getArpeggioNote(sourceNotes, index);
    nextBar[step] = note ? createGrooveNoteCell(note, template.id, sourceChordName) : null;
  });

  return nextBar;
}

function replaceChordBar(matrix, barIndex, nextBar) {
  if (!matrix?.chord?.[barIndex] || !Array.isArray(nextBar)) return matrix;

  const nextChord = [...matrix.chord];
  nextChord[barIndex] = nextBar;

  return {
    ...matrix,
    chord: nextChord,
  };
}

function applyChordTemplateWorkspaceToBar(
  matrix,
  clips,
  barIndex,
  { progressionTemplateId, grooveTemplateId } = {},
) {
  const progression = CHORD_TEMPLATES[progressionTemplateId];
  const groove = getChordGrooveTemplate(grooveTemplateId);
  const clipBars = getExistingChordClipBars(clips);
  const clipIndex = clipBars.indexOf(barIndex);
  if (!progression || !groove || clipIndex === -1 || !matrix?.chord?.[barIndex]) return matrix;

  const chordName = progression.chords[clipIndex % progression.chords.length];
  return replaceChordBar(
    matrix,
    barIndex,
    createGrooveBar(groove, chordName, progression.id),
  );
}

function applyChordTemplateWorkspaceToExistingClips(
  matrix,
  clips,
  { progressionTemplateId, grooveTemplateId } = {},
) {
  const progression = CHORD_TEMPLATES[progressionTemplateId];
  const groove = getChordGrooveTemplate(grooveTemplateId);
  if (!progression || !groove) return matrix;

  return getExistingChordClipBars(clips).reduce((nextMatrix, barIndex, index) => {
    if (!nextMatrix?.chord?.[barIndex]) return nextMatrix;
    const chordName = progression.chords[index % progression.chords.length];
    return replaceChordBar(
      nextMatrix,
      barIndex,
      createGrooveBar(groove, chordName, progression.id),
    );
  }, matrix);
}

function toggleChordRhythmStep(matrix, barIndex, stepIndex) {
  if (
    !matrix?.chord?.[barIndex]
    || !Number.isInteger(stepIndex)
    || stepIndex < 0
    || stepIndex >= STEPS_PER_BAR
  ) {
    return matrix;
  }

  const sourceChordLabel = getSourceChordLabel(matrix, barIndex);
  const barMetadata = getChordBarMetadata(matrix, barIndex);
  const activeSteps = new Set(getChordRhythmSteps(matrix, barIndex));
  if (activeSteps.has(stepIndex)) activeSteps.delete(stepIndex);
  else activeSteps.add(stepIndex);

  if (!activeSteps.size) {
    const nextBar = Array.from({ length: STEPS_PER_BAR }, () => null);
    nextBar[0] = createChordSourceCell(
      sourceChordLabel,
      barMetadata.progressionTemplateId,
      CUSTOM_CHORD_GROOVE_ID,
      { chordStyleChordTemplateId: barMetadata.chordStyleChordTemplateId },
    );
    return replaceChordBar(matrix, barIndex, nextBar);
  }

  const nextBar = Array.from({ length: STEPS_PER_BAR }, () => null);
  [...activeSteps].sort((a, b) => a - b).forEach((activeStep) => {
    const previousCell = matrix.chord[barIndex][activeStep];
    const metadata = getChordStepMetadata(previousCell, {
      ...barMetadata,
      selectedGrooveTemplateId: CUSTOM_CHORD_GROOVE_ID,
    });
    const manualRhythmMetadata = {
      ...metadata,
      chordStyleGrooveTemplateId: null,
      duration: '16n',
      timingOffset: undefined,
      velocity: undefined,
    };

    if (previousCell?.type === 'chord' && isPassingChordCell(previousCell)) {
      const manualPassingCell = {
        ...previousCell,
        chordStyleChordTemplateId: metadata.chordStyleChordTemplateId,
        duration: '16n',
        ...(metadata.progressionTemplateId
          ? { progressionTemplateId: metadata.progressionTemplateId }
          : {}),
        selectedGrooveTemplateId: CUSTOM_CHORD_GROOVE_ID,
      };
      delete manualPassingCell.chordStyleGrooveTemplateId;
      delete manualPassingCell.chordStylePresetId;
      delete manualPassingCell.timingOffset;
      delete manualPassingCell.velocity;
      nextBar[activeStep] = manualPassingCell;
      return;
    }

    const chordName = previousCell?.type === 'chord'
      ? previousCell.label
      : sourceChordLabel;
    nextBar[activeStep] = createChordRhythmEventCell({
      chordName,
      grooveTemplateId: CUSTOM_CHORD_GROOVE_ID,
      metadata: manualRhythmMetadata,
      sourceChordLabel: previousCell?.sourceChordLabel ?? sourceChordLabel,
    });
  });

  return replaceChordBar(matrix, barIndex, nextBar);
}

function applyChordRhythmStepEnrichment(matrix, barIndex, stepIndex, chordName) {
  if (
    !matrix?.chord?.[barIndex]
    || !Number.isInteger(stepIndex)
    || stepIndex < 0
    || stepIndex >= STEPS_PER_BAR
  ) {
    return matrix;
  }

  const previousCell = matrix.chord[barIndex][stepIndex];
  if (!['chord', 'note', 'notes'].includes(previousCell?.type)) return matrix;

  const sourceChordLabel = getChordRhythmStepSourceLabel(matrix, barIndex, stepIndex);
  const validChordNames = [
    sourceChordLabel,
    ...getChordVariantOptions(sourceChordLabel).map((option) => option.name),
  ];
  if (!sourceChordLabel || !validChordNames.includes(chordName)) return matrix;

  const barMetadata = getChordBarMetadata(matrix, barIndex);
  const metadata = {
    ...getChordStepMetadata(previousCell, barMetadata),
    chordStyleChordTemplateId: null,
  };
  const nextCell = createChordRhythmEventCell({
    chordName,
    grooveTemplateId: isPassingChordCell(previousCell)
      ? (barMetadata.selectedGrooveTemplateId ?? CUSTOM_CHORD_GROOVE_ID)
      : (previousCell.grooveTemplateId ?? CUSTOM_CHORD_GROOVE_ID),
    metadata,
    sourceChordLabel,
  });
  if (!nextCell) return matrix;

  return replaceChordBar(matrix, barIndex, matrix.chord[barIndex].map((cell, index) => (
    index === stepIndex ? nextCell : cell
  )));
}

function getNextChordClipBar(clips, selectedBar) {
  const bars = getExistingChordClipBars(clips);
  if (bars.length < 2) return null;

  const selectedIndex = bars.indexOf(selectedBar);
  return selectedIndex === -1 ? null : (bars[(selectedIndex + 1) % bars.length] ?? null);
}

function applyChordRhythmStepPassingChord(matrix, clips, barIndex, stepIndex, chordName) {
  if (
    !matrix?.chord?.[barIndex]
    || stepIndex !== PASSING_CHORD_STEP_INDEX
    || matrix.chord[barIndex][stepIndex]?.type !== 'chord'
  ) {
    return matrix;
  }

  const sourceChordLabel = getChordRhythmStepSourceLabel(matrix, barIndex, stepIndex);
  const nextChordBar = getNextChordClipBar(clips, barIndex);
  const targetChordLabel = nextChordBar === null
    ? getDoowopPassingTargetChord(sourceChordLabel)
    : getSourceChordLabel(matrix, nextChordBar);
  if (!getPassingChordOptions(sourceChordLabel, targetChordLabel).some((option) => option.name === chordName)) {
    return matrix;
  }

  const previousCell = matrix.chord[barIndex][stepIndex];
  const metadata = {
    ...getChordStepMetadata(previousCell, getChordBarMetadata(matrix, barIndex)),
    chordStyleChordTemplateId: null,
  };
  const nextPassingCell = createPassingChordCell(chordName);
  if (!nextPassingCell) return matrix;

  const nextBar = matrix.chord[barIndex].map((cell, index) => (
    index === stepIndex
      ? {
        ...nextPassingCell,
        ...(metadata.chordStyleGrooveTemplateId
          ? { chordStyleGrooveTemplateId: metadata.chordStyleGrooveTemplateId }
          : {}),
        ...(metadata.duration ? { duration: metadata.duration } : {}),
        ...(metadata.progressionTemplateId
          ? { progressionTemplateId: metadata.progressionTemplateId }
          : {}),
        ...(metadata.selectedGrooveTemplateId
          ? { selectedGrooveTemplateId: metadata.selectedGrooveTemplateId }
          : {}),
        ...(Number.isFinite(metadata.timingOffset)
          ? { timingOffset: metadata.timingOffset }
          : {}),
        ...(Number.isFinite(metadata.velocity) ? { velocity: metadata.velocity } : {}),
      }
      : cell
  ));
  const hasPlayableSourceChord = nextBar.some((cell) => (
    cell?.type === 'chord' && !isPassingChordCell(cell) && cell.sourceChordLabel
  ));

  if (!hasPlayableSourceChord) {
    nextBar[0] = createChordSourceCell(
      sourceChordLabel,
      metadata.progressionTemplateId,
      metadata.selectedGrooveTemplateId ?? CUSTOM_CHORD_GROOVE_ID,
    );
  }

  return replaceChordBar(matrix, barIndex, nextBar);
}

function clearChordRhythmBar(matrix, barIndex) {
  if (!matrix?.chord?.[barIndex]) return matrix;

  const currentBar = matrix.chord[barIndex];
  if (!currentBar.some(Boolean)) return matrix;

  const sourceChordLabel = getSourceChordLabel(matrix, barIndex);
  const progressionTemplateId = getChordProgressionTemplateId(matrix, barIndex);
  const nextBar = Array.from({ length: STEPS_PER_BAR }, () => null);
  nextBar[0] = createChordSourceCell(
    sourceChordLabel,
    progressionTemplateId,
    CUSTOM_CHORD_GROOVE_ID,
    { chordStyleChordTemplateId: getChordBarMetadata(matrix, barIndex).chordStyleChordTemplateId },
  );
  return replaceChordBar(matrix, barIndex, nextBar);
}

function applyChordGrooveTemplateToExistingClips(matrix, clips, templateId) {
  const template = getChordGrooveTemplate(templateId);
  if (!template) return matrix;

  return getExistingChordClipBars(clips).reduce((nextMatrix, barIndex) => {
    if (!nextMatrix?.chord?.[barIndex]) return nextMatrix;

    const sourceChordLabel = getSourceChordLabel(nextMatrix, barIndex);
    return replaceChordBar(
      nextMatrix,
      barIndex,
      createGrooveBar(
        template,
        sourceChordLabel,
        getChordProgressionTemplateId(nextMatrix, barIndex),
      ),
    );
  }, matrix);
}

function createChordGroovePreviewEvents(templateId, chordName = DEFAULT_GROOVE_CHORD) {
  const template = getChordGrooveTemplate(templateId);
  if (!template) return [];

  const notes = createChordNotes(chordName);
  const sourceNotes = notes.length ? notes : createChordNotes(DEFAULT_GROOVE_CHORD);

  return template.steps.map((step, index) => {
    const eventNotes = template.kind === 'block'
      ? sourceNotes
      : [getArpeggioNote(sourceNotes, index)].filter(Boolean);

    return {
      step,
      notes: eventNotes,
      duration: '16n',
    };
  }).filter((event) => event.notes.length);
}

function createChordTemplateWorkspacePreviewEvents({
  progressionTemplateId,
  grooveTemplateId,
} = {}) {
  const progression = CHORD_TEMPLATES[progressionTemplateId];
  const groove = getChordGrooveTemplate(grooveTemplateId);
  if (!progression || !groove) return [];

  return progression.chords.slice(0, 4).flatMap((chordName, clipIndex) => (
    createChordGroovePreviewEvents(groove.id, chordName).map((event) => ({
      ...event,
      step: event.step + clipIndex * STEPS_PER_BAR,
    }))
  ));
}

function createChordStepHarmonyPreviewEvents(chordName) {
  const notes = createChordNotes(chordName);
  if (!notes.length) return [];

  return [{
    step: 0,
    notes,
    duration: '2n',
  }];
}

export {
  CHORD_SOURCE_CELL_TYPE,
  CHORD_GROOVE_TEMPLATES,
  CUSTOM_CHORD_GROOVE_ID,
  PASSING_CHORD_STEP_INDEX,
  applyChordRhythmStepEnrichment,
  applyChordRhythmStepPassingChord,
  applyChordTemplateWorkspaceToBar,
  applyChordTemplateWorkspaceToExistingClips,
  applyChordGrooveTemplateToExistingClips,
  clearChordRhythmBar,
  createChordGroovePreviewEvents,
  createChordStepHarmonyPreviewEvents,
  createChordTemplateWorkspacePreviewEvents,
  getAppliedChordProgressionTemplateId,
  getChordGrooveTemplate,
  getChordProgressionTemplateId,
  getChordRhythmSteps,
  getChordRhythmStepLabel,
  getChordRhythmStepSourceLabel,
  getChordSelectedGrooveTemplateId,
  getSourceChordLabel,
  toggleChordRhythmStep,
};
