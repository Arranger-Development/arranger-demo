import {
  BASS_NOTE_IDS,
} from '../data/bassNotes.js';
import {
  CHORD_SPAN,
  STEPS_PER_BAR,
} from '../domain/musicConstants.js';
import {
  getChordDefinition,
} from '../domain/chordCells.js';
import { hasExistingTrackClipContent } from './trackContent.js';

const DEFAULT_BASS_NOTE = 'C1';
const LOW_BASS_OCTAVE_ROOTS = new Set(['F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

const BASS_GROOVE_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'bass-8th-basic',
    name: '八分音符基础律动',
    default: true,
    hitLabel: '4 hits / bar · 8th',
    desc: '最基础的弹奏律动，适合在这个基础上做进一步的微调。',
    detail: '在每小节的 1/16、5/16、9/16、13/16 处放置一个对应位置主和弦的根音的八分音符。',
    duration: '8n',
    steps: Object.freeze([0, 4, 8, 12]),
  }),
  Object.freeze({
    id: 'bass-8th-swing',
    name: '八分音符摇摆感切分律动',
    hitLabel: '4 hits / bar · syncopated',
    desc: '通过切分音创造具备更多摇摆感的低音律动。',
    detail: '在每小节的 1/16、5/16、11/16、15/16 处放置一个对应位置主和弦的根音。',
    duration: '8n',
    steps: Object.freeze([0, 4, 10, 14]),
  }),
  Object.freeze({
    id: 'bass-16th-swing',
    name: '十六分音符摇摆感切分律动',
    hitLabel: '5 hits / bar · 16th',
    desc: '音符更加密集，律动感更强，适合整体更为活泼的乐段。',
    detail: '在每小节的 1/16、4/16、7/16、9/16、13/16 处放置一个对应位置主和弦的根音的十六分音符。',
    duration: '16n',
    steps: Object.freeze([0, 3, 6, 8, 12]),
  }),
]);

function getBassGrooveTemplate(templateId) {
  return BASS_GROOVE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

function isValidBassNote(note) {
  return BASS_NOTE_IDS.includes(note);
}

function createBassCell(note, duration = '16n', grooveTemplateId = null) {
  if (!isValidBassNote(note)) return null;

  return {
    type: 'bass',
    note,
    duration,
    ...(grooveTemplateId ? { grooveTemplateId } : {}),
  };
}

function cloneBassMatrix(matrix) {
  return {
    ...matrix,
    bass: matrix.bass.map((bar) => [...bar]),
  };
}

function isBassCellActive(matrix, bar, step, note) {
  return matrix?.bass?.[bar]?.[step]?.note === note && isValidBassNote(note);
}

function toggleBassCell(matrix, bar, step, note) {
  if (!matrix?.bass?.[bar] || !Number.isInteger(step) || step < 0 || step >= STEPS_PER_BAR) {
    return matrix;
  }

  const nextMatrix = cloneBassMatrix(matrix);
  nextMatrix.bass[bar][step] = isBassCellActive(matrix, bar, step, note)
    ? null
    : createBassCell(note);
  return nextMatrix;
}

function getBassCellToggleResult(matrix, bar, step, note) {
  const removingExistingNote = isBassCellActive(matrix, bar, step, note);
  const nextMatrix = toggleBassCell(matrix, bar, step, note);
  const nextCell = nextMatrix?.bass?.[bar]?.[step];

  return {
    auditionNote: !removingExistingNote && nextCell?.note === note
      ? note
      : null,
    nextMatrix,
  };
}

function clearBassBar(matrix, bar) {
  if (!matrix?.bass?.[bar]) return matrix;

  const nextMatrix = cloneBassMatrix(matrix);
  nextMatrix.bass[bar] = nextMatrix.bass[bar].map(() => null);
  return nextMatrix;
}

function normalizeChordRoot(cell) {
  if (!cell || typeof cell !== 'object') return null;

  const candidates = [
    cell.sourceChordLabel,
    cell.label,
    cell.chordRoot,
    cell.root,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const definition = getChordDefinition(candidate);
    if (definition?.root) return definition.root;
  }

  return null;
}

function getChordRootInStepRange(chordBar, startStep, endStep) {
  for (let step = startStep; step < endStep; step += 1) {
    const root = normalizeChordRoot(chordBar?.[step]);
    if (root) return root;
  }

  return null;
}

function getFirstChordRoot(matrix, bar) {
  return getChordRootInStepRange(matrix?.chord?.[bar] ?? [], 0, STEPS_PER_BAR);
}

function getBeatChordRoot(matrix, bar, step) {
  const beatStart = Math.floor(step / CHORD_SPAN) * CHORD_SPAN;
  return getChordRootInStepRange(matrix?.chord?.[bar] ?? [], beatStart, beatStart + CHORD_SPAN);
}

function chordRootToBassNote(root) {
  const octave = LOW_BASS_OCTAVE_ROOTS.has(root) ? 0 : 1;
  const note = `${root}${octave}`;
  return isValidBassNote(note) ? note : DEFAULT_BASS_NOTE;
}

function getBassNoteForStep(matrix, bar, step) {
  return chordRootToBassNote(
    getBeatChordRoot(matrix, bar, step)
      ?? getFirstChordRoot(matrix, bar)
      ?? 'C',
  );
}

function createTemplateCell(matrix, bar, step, template) {
  return createBassCell(
    getBassNoteForStep(matrix, bar, step),
    template.duration,
    template.id,
  );
}

function applyBassGrooveTemplateToBar(matrix, bar, templateId) {
  const template = getBassGrooveTemplate(templateId);
  if (!template || !matrix?.bass?.[bar]) return matrix;

  const nextMatrix = clearBassBar(matrix, bar);
  template.steps.forEach((step) => {
    nextMatrix.bass[bar][step] = createTemplateCell(matrix, bar, step, template);
  });

  return nextMatrix;
}

function getExistingBassClipBars(clips) {
  return (clips?.ids ?? [])
    .map((id) => clips.byId?.[id])
    .filter((clip) => clip?.trackId === 'bass')
    .map((clip) => clip.bar)
    .sort((a, b) => a - b);
}

function hasExistingBassClipContent(matrix, clips) {
  return hasExistingTrackClipContent(matrix, clips, 'bass');
}

function getExistingChordClipBarSet(clips) {
  return new Set((clips?.ids ?? [])
    .map((id) => clips.byId?.[id])
    .filter((clip) => clip?.trackId === 'chord')
    .map((clip) => clip.bar));
}

function applyBassGrooveTemplateToExistingClips(matrix, clips, templateId) {
  const template = getBassGrooveTemplate(templateId);
  if (!template) return matrix;

  const chordClipBars = getExistingChordClipBarSet(clips);
  return getExistingBassClipBars(clips).reduce((nextMatrix, bar) => (
    chordClipBars.has(bar)
      ? applyBassGrooveTemplateToBar(nextMatrix, bar, template.id)
      : clearBassBar(nextMatrix, bar)
  ), matrix);
}

function createBassPreviewEvents(matrix, bar, templateId) {
  const template = getBassGrooveTemplate(templateId);
  if (!template) return [];

  return template.steps.map((step) => ({
    step,
    note: getBassNoteForStep(matrix, bar, step),
    duration: template.duration,
  }));
}

export {
  BASS_GROOVE_TEMPLATES,
  applyBassGrooveTemplateToExistingClips,
  applyBassGrooveTemplateToBar,
  clearBassBar,
  createBassCell,
  createBassPreviewEvents,
  getBassCellToggleResult,
  getBassGrooveTemplate,
  hasExistingBassClipContent,
  isBassCellActive,
  isValidBassNote,
  toggleBassCell,
};
