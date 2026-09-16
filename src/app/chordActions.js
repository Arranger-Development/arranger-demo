import {
  BEATS_PER_BAR,
  STEPS_PER_BAR,
} from '../domain/musicConstants.js';
import {
  CHORD_TEMPLATES,
  createChordCell,
  createChordNoteCell,
  createChordNotesCell,
  createChordTonePitches,
  createPassingChordCell,
  getDoowopPassingTargetChord,
  getChordCellNotes,
  getChordRemovedTonePitches,
  getChordSpanStep,
  isPassingChordCell,
  toggleChordNoteCell,
} from '../domain/chordCells.js';
import { hasExistingTrackClipContent } from './trackContent.js';

const PASSING_CHORD_SOURCE_SPAN_INDEX = BEATS_PER_BAR - 1;

function getChordCell(matrix, barIndex, spanIndex) {
  const step = getChordSpanStep(spanIndex);
  if (step === null) return null;

  return matrix?.chord?.[barIndex]?.[step] ?? null;
}

function getChordStepCell(matrix, barIndex, spanIndex, columnIndex) {
  const step = getChordSpanStep(spanIndex);
  if (step === null || !Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= 4) return null;

  return matrix?.chord?.[barIndex]?.[step + columnIndex] ?? null;
}

function setChordCell(matrix, barIndex, spanIndex, root) {
  const step = getChordSpanStep(spanIndex);
  if (step === null) return matrix;
  const firstCell = createChordCellWithPreviousNotes(root, getMatrixChordStep(matrix, barIndex, step));
  if (!firstCell) return matrix;

  const nextCells = {
    [step]: firstCell,
  };
  const staleSecondCell = getMatrixChordStep(matrix, barIndex, step + 1);
  if (staleSecondCell?.type === 'chord' && !staleSecondCell.grooveTemplateId) {
    nextCells[step + 1] = null;
  }

  return setChordStepCells(matrix, barIndex, nextCells);
}

function setChordTemplateCell(matrix, barIndex, spanIndex, root) {
  const step = getChordSpanStep(spanIndex);
  if (step === null) return matrix;
  const firstCell = createChordCell(root);
  if (!firstCell) return matrix;

  const nextCells = {
    [step]: firstCell,
  };
  const staleSecondCell = getMatrixChordStep(matrix, barIndex, step + 1);
  if (staleSecondCell?.type === 'chord' && !staleSecondCell.grooveTemplateId) {
    nextCells[step + 1] = null;
  }

  return setChordStepCells(matrix, barIndex, nextCells);
}

function replaceChordBeat(matrix, barIndex, spanIndex, cells) {
  const step = getChordSpanStep(spanIndex);
  if (step === null || !matrix?.chord?.[barIndex]) return matrix;

  const nextBar = [...matrix.chord[barIndex]];
  for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
    nextBar[step + columnIndex] = cells[columnIndex] ?? null;
  }

  const nextChord = [...matrix.chord];
  nextChord[barIndex] = nextBar;

  return {
    ...matrix,
    chord: nextChord,
  };
}

function getMatrixChordStep(matrix, barIndex, step) {
  return matrix?.chord?.[barIndex]?.[step] ?? null;
}

function createChordCellWithPreviousNotes(root, previousCell) {
  const cell = createChordCell(root);
  if (!cell) return null;

  return mergeChordManualNotes(cell, previousCell);
}

function mergeChordManualNotes(cell, previousCell) {
  const addedNotes = getChordCellNotes(previousCell);
  const tonePitches = createChordTonePitches(cell.root, cell.toneRoots, cell.tonePitches);
  const removedTonePitches = getChordRemovedTonePitches(previousCell)
    .filter((pitch) => tonePitches.includes(pitch));

  return {
    ...cell,
    ...(addedNotes.length ? { addedNotes } : {}),
    ...(removedTonePitches.length ? { removedTonePitches } : {}),
  };
}

function setChordStepCells(matrix, barIndex, cellsByStep) {
  if (!matrix?.chord?.[barIndex]) return matrix;

  const nextBar = [...matrix.chord[barIndex]];
  Object.entries(cellsByStep).forEach(([stepKey, cell]) => {
    const step = Number(stepKey);
    if (Number.isInteger(step) && step >= 0 && step < nextBar.length) {
      nextBar[step] = cell;
    }
  });

  const nextChord = [...matrix.chord];
  nextChord[barIndex] = nextBar;

  return {
    ...matrix,
    chord: nextChord,
  };
}

function setChordNoteCell(matrix, barIndex, spanIndex, columnIndex, note) {
  const step = getChordSpanStep(spanIndex);
  const cell = createChordNoteCell(note);
  if (step === null || !cell || !Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= 4) {
    return matrix;
  }

  return setChordStepCells(matrix, barIndex, {
    [step + columnIndex]: cell,
  });
}

function toggleChordNoteStep(matrix, barIndex, spanIndex, columnIndex, note) {
  const currentCell = getChordStepCell(matrix, barIndex, spanIndex, columnIndex);
  const nextCell = toggleChordNoteCell(currentCell, note);
  const step = getChordSpanStep(spanIndex);
  if (step === null || !Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= 4) return matrix;

  return setChordStepCells(matrix, barIndex, {
    [step + columnIndex]: nextCell,
  });
}

function setChordStepChord(matrix, barIndex, stepIndex, chordName) {
  const cell = createPassingChordCell(chordName);
  if (
    !cell
    || !matrix?.chord?.[barIndex]
    || !Number.isInteger(stepIndex)
    || stepIndex < 0
    || stepIndex >= STEPS_PER_BAR
  ) {
    return matrix;
  }

  return setChordStepCells(matrix, barIndex, {
    [stepIndex]: cell,
  });
}

function getChordTonePitches(chordName) {
  const cell = createChordCell(chordName);
  return cell ? createChordTonePitches(cell.root, cell.toneRoots, cell.tonePitches) : [];
}

function octaveUp(note) {
  const match = /^([A-G]#?)([0-9])$/.exec(note);
  if (!match) return note;

  return `${match[1]}${Number(match[2]) + 1}`;
}

function getGrooveNoteAt(notes, index) {
  if (!notes.length) return null;
  return notes[index] ?? octaveUp(notes[index % notes.length]);
}

function getGrooveHitIndex(bar, step, grooveTemplateId) {
  return bar
    .map((cell, cellStep) => ({ cell, step: cellStep }))
    .filter(({ cell }) => (
      cell?.grooveTemplateId === grooveTemplateId
      && cell?.sourceChordLabel
      && !isPassingChordCell(cell)
    ))
    .findIndex((hit) => hit.step === step);
}

function createEnrichedGrooveCell(previousCell, chordName, hitIndex) {
  if (!previousCell?.grooveTemplateId) return null;

  if (previousCell.type === 'chord') {
    const chordCell = createChordCellWithPreviousNotes(chordName, previousCell);
    if (!chordCell) return null;

    return {
      ...chordCell,
      ...(previousCell.duration ? { duration: previousCell.duration } : {}),
      grooveTemplateId: previousCell.grooveTemplateId,
      sourceChordLabel: chordCell.label,
    };
  }

  if (previousCell.type === 'notes') {
    const chordCell = createChordCell(chordName);
    if (!chordCell) return null;

    const note = getGrooveNoteAt(getChordTonePitches(chordName), hitIndex);
    const noteCell = note ? createChordNotesCell([note]) : null;
    return noteCell ? {
      ...noteCell,
      grooveTemplateId: previousCell.grooveTemplateId,
      sourceChordLabel: chordCell.label,
    } : null;
  }

  return null;
}

function setChordEnrichTarget(matrix, barIndex, spanIndex, chordName) {
  const step = getChordSpanStep(spanIndex);
  if (step === null || !matrix?.chord?.[barIndex]) return matrix;

  const bar = matrix.chord[barIndex];
  const grooveCellsByStep = {};
  for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
    const currentStep = step + columnIndex;
    const cell = bar[currentStep];
    if (!cell?.sourceChordLabel || isPassingChordCell(cell)) continue;

    const hitIndex = getGrooveHitIndex(bar, currentStep, cell.grooveTemplateId);
    const nextCell = createEnrichedGrooveCell(cell, chordName, Math.max(0, hitIndex));
    if (!nextCell) return matrix;
    grooveCellsByStep[currentStep] = nextCell;
  }

  if (Object.keys(grooveCellsByStep).length) {
    return setChordStepCells(matrix, barIndex, grooveCellsByStep);
  }

  return setChordCell(matrix, barIndex, spanIndex, chordName);
}

function clearChordCell(matrix, barIndex, spanIndex) {
  const step = getChordSpanStep(spanIndex);
  if (step === null) return matrix;

  return replaceChordBeat(matrix, barIndex, spanIndex, []);
}

function clearChordBar(matrix, barIndex) {
  if (!matrix?.chord?.[barIndex]) return matrix;

  const nextChord = [...matrix.chord];
  nextChord[barIndex] = Array.from({ length: STEPS_PER_BAR }, () => null);

  return {
    ...matrix,
    chord: nextChord,
  };
}

function getExistingChordClipBars(clips) {
  return (clips?.ids ?? [])
    .map((id) => clips.byId?.[id])
    .filter((clip) => clip?.trackId === 'chord' && Number.isInteger(clip.bar))
    .map((clip) => clip.bar)
    .sort((a, b) => a - b);
}

function getNextChordClipBar(clips, selectedBar) {
  const bars = getExistingChordClipBars(clips);
  if (bars.length < 2 || !Number.isInteger(selectedBar)) return null;

  const currentIndex = bars.indexOf(selectedBar);
  if (currentIndex === -1) return null;

  return bars[(currentIndex + 1) % bars.length] ?? null;
}

function getPassingChordContext(matrix, clips, selectedBar) {
  const currentChord = getChordSpanDisplayLabel(matrix, selectedBar, PASSING_CHORD_SOURCE_SPAN_INDEX)
    ?? getChordBarDisplayLabel(matrix, selectedBar);
  const nextBar = getNextChordClipBar(clips, selectedBar);
  const nextChord = nextBar === null ? null : getChordBarDisplayLabel(matrix, nextBar);

  return {
    currentChord,
    targetChord: nextChord ?? getDoowopPassingTargetChord(currentChord),
  };
}

function hasExistingChordClipContent(matrix, clips) {
  return hasExistingTrackClipContent(matrix, clips, 'chord');
}

function applyChordTemplateToExistingClips(matrix, clips, templateId) {
  const template = CHORD_TEMPLATES[templateId];
  if (!template) return matrix;

  return getExistingChordClipBars(clips).reduce((nextMatrix, barIndex, index) => (
    setChordTemplateCell(nextMatrix, barIndex, 0, template.chords[index % template.chords.length])
  ), matrix);
}

function getChordBarDisplayLabel(matrix, barIndex) {
  return getChordSpanDisplayLabel(matrix, barIndex, 0)
    ?? getChordBeatDisplaySegments(matrix, barIndex).find((segment) => segment.label)?.label
    ?? null;
}

function getChordSpanDisplayLabel(matrix, barIndex, spanIndex) {
  const cells = getChordBeatCells(matrix, barIndex, spanIndex);
  const sourceLabel = getChordBeatSourceLabel(cells);
  if (sourceLabel) return sourceLabel;

  const mainCell = getChordCell(matrix, barIndex, spanIndex);
  if (mainCell?.type !== 'chord') return null;

  return mainCell.label;
}

function getChordEnrichTargetLabel(matrix, barIndex, spanIndex) {
  const cells = getChordBeatCells(matrix, barIndex, spanIndex);
  const sourceLabel = getChordBeatSourceLabel(cells);
  if (sourceLabel) return sourceLabel;

  const mainCell = getChordCell(matrix, barIndex, spanIndex);
  return mainCell?.type === 'chord' ? mainCell.label : null;
}

function getChordBeatCells(matrix, barIndex, spanIndex) {
  return Array.from({ length: 4 }, (_, columnIndex) => (
    getChordStepCell(matrix, barIndex, spanIndex, columnIndex)
  ));
}

function getChordBeatSourceLabel(cells) {
  return cells.find((cell) => (
    cell?.sourceChordLabel && !isPassingChordCell(cell)
  ))?.sourceChordLabel ?? null;
}

function getChordBeatFallbackNoteLabel(cells) {
  const noteLabels = cells.reduce((notes, cell) => {
    if (isPassingChordCell(cell)) return notes;
    if (cell?.sourceChordLabel) return notes;
    getChordCellNotes(cell).forEach((note) => {
      if (!notes.includes(note)) notes.push(note);
    });
    return notes;
  }, []);

  return noteLabels.length ? noteLabels.join('/') : null;
}

function getChordBeatMergeKey(cells, label) {
  if (!label) return null;

  const arpeggioCell = cells.find((cell) => (
    cell?.type === 'notes' && cell.sourceChordLabel && cell.grooveTemplateId && !isPassingChordCell(cell)
  ));
  return arpeggioCell ? `${arpeggioCell.grooveTemplateId}:${label}` : null;
}

function getPassingChordDisplayLabel(matrix, barIndex, stepIndex) {
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= STEPS_PER_BAR) return null;

  const cell = matrix?.chord?.[barIndex]?.[stepIndex];
  if (!isPassingChordCell(cell)) return null;

  return cell.sourceChordLabel ?? cell.label ?? null;
}

function getChordBeatDisplayInfo(matrix, barIndex, spanIndex) {
  const cells = getChordBeatCells(matrix, barIndex, spanIndex);
  const chordCell = getChordCell(matrix, barIndex, spanIndex);
  const chordLabel = getChordSpanDisplayLabel(matrix, barIndex, spanIndex);
  const label = chordLabel ?? getChordBeatFallbackNoteLabel(cells);

  return {
    hasChord: chordCell?.type === 'chord',
    hasValue: Boolean(label),
    label,
    mergeKey: getChordBeatMergeKey(cells, label),
  };
}

function getChordBeatDisplaySegments(matrix, barIndex) {
  const beatInfos = Array.from({ length: BEATS_PER_BAR }, (_, spanIndex) => (
    getChordBeatDisplayInfo(matrix, barIndex, spanIndex)
  ));
  const segments = [];

  beatInfos.forEach((info, spanIndex) => {
    const previous = segments[segments.length - 1];
    if (info.mergeKey && previous?.mergeKey === info.mergeKey) {
      previous.span += 1;
      return;
    }

    segments.push({
      startBeat: spanIndex,
      span: 1,
      label: info.label,
      hasValue: info.hasValue,
      hasChord: info.hasChord,
      mergeKey: info.mergeKey,
    });
  });

  return segments;
}

export {
  applyChordTemplateToExistingClips,
  clearChordBar,
  clearChordCell,
  getChordBeatDisplaySegments,
  getChordStepCell,
  getChordCell,
  getChordBarDisplayLabel,
  getChordEnrichTargetLabel,
  getPassingChordContext,
  getChordSpanDisplayLabel,
  getPassingChordDisplayLabel,
  hasExistingChordClipContent,
  getExistingChordClipBars,
  setChordCell,
  setChordEnrichTarget,
  setChordNoteCell,
  setChordStepChord,
  toggleChordNoteStep,
};
