import {
  getChordVariantOptions,
  getDoowopPassingTargetChord,
  getPassingChordOptions,
} from '../domain/chordCells.js';
import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import { getExistingChordClipBars } from './chordActions.js';
import {
  PASSING_CHORD_STEP_INDEX,
  getChordRhythmStepLabel,
  getChordRhythmStepSourceLabel,
  getSourceChordLabel,
} from './chordGrooveActions.js';

function getNextChordClipBar(clips, selectedBar) {
  const bars = getExistingChordClipBars(clips);
  if (bars.length < 2) return null;

  const selectedIndex = bars.indexOf(selectedBar);
  if (selectedIndex === -1) return null;
  return bars[(selectedIndex + 1) % bars.length] ?? null;
}

function normalizeEnrichOptions(sourceChordLabel) {
  return [
    { name: sourceChordLabel, restore: true },
    ...getChordVariantOptions(sourceChordLabel).map((option) => ({ name: option.name })),
  ].filter((option, index, options) => (
    option.name && options.findIndex((candidate) => candidate.name === option.name) === index
  ));
}

function createResolvedOption(mode, options, optionIndex) {
  const option = options[optionIndex];
  if (!option) return null;

  return {
    mode,
    name: option.name,
    optionIndex,
  };
}

function findOptionByName(mode, options, name) {
  const optionIndex = options.findIndex((option) => option.name === name);
  return optionIndex === -1 ? null : createResolvedOption(mode, options, optionIndex);
}

function resolveSelectedOption({
  currentIsPassing,
  currentLabel,
  enrichOptions,
  passingOptions,
  selectedOption,
}) {
  if (selectedOption?.mode === 'enrich') {
    const resolved = createResolvedOption('enrich', enrichOptions, selectedOption.optionIndex);
    if (resolved) return resolved;
  }
  if (selectedOption?.mode === 'passing') {
    const resolved = createResolvedOption('passing', passingOptions, selectedOption.optionIndex);
    if (resolved) return resolved;
  }

  const currentOption = currentIsPassing
    ? findOptionByName('passing', passingOptions, currentLabel)
      ?? findOptionByName('enrich', enrichOptions, currentLabel)
    : findOptionByName('enrich', enrichOptions, currentLabel)
      ?? findOptionByName('passing', passingOptions, currentLabel);

  return currentOption
    ?? createResolvedOption('enrich', enrichOptions, 0)
    ?? createResolvedOption('passing', passingOptions, 0);
}

function createLaunchpadChordHarmonyState({
  bar,
  clips,
  matrix,
  selectedOption,
  step,
} = {}) {
  if (
    !Number.isInteger(bar)
    || bar < 0
    || bar >= (matrix?.chord?.length ?? 0)
    || !Number.isInteger(step)
    || step < 0
    || step >= STEPS_PER_BAR
    || matrix?.chord?.[bar]?.[step]?.type !== 'chord'
  ) {
    return null;
  }

  const sourceChordLabel = getChordRhythmStepSourceLabel(matrix, bar, step);
  const currentLabel = getChordRhythmStepLabel(matrix, bar, step);
  if (!sourceChordLabel || !currentLabel) return null;

  const nextChordBar = getNextChordClipBar(clips, bar);
  const targetChordLabel = nextChordBar === null
    ? getDoowopPassingTargetChord(sourceChordLabel)
    : getSourceChordLabel(matrix, nextChordBar);
  const canApplyPassing = step === PASSING_CHORD_STEP_INDEX;
  const enrichOptions = normalizeEnrichOptions(sourceChordLabel);
  const passingOptions = canApplyPassing
    ? getPassingChordOptions(sourceChordLabel, targetChordLabel).map((option) => ({
      name: option.name,
    }))
    : [];

  return {
    bar,
    canApplyPassing,
    currentLabel,
    enrichOptions,
    passingOptions,
    selectedOption: resolveSelectedOption({
      currentIsPassing: matrix.chord[bar][step].grooveTemplateId === 'passing-shortcut',
      currentLabel,
      enrichOptions,
      passingOptions,
      selectedOption,
    }),
    sourceChordLabel,
    step,
    targetChordLabel,
  };
}

export { createLaunchpadChordHarmonyState };
