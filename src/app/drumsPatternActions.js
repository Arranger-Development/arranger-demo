import { getMatrixBars, MAX_PROJECT_BARS } from '../domain/projectLength.js';
import { STEPS_PER_BAR } from '../domain/musicConstants.js';
import { createDrumsCell } from '../domain/drumsCells.js';
import {
  getDrumTemplate,
  getDrumTemplateHitFeel,
} from '../data/drumStyleTemplates.js';
import { hasExistingTrackClipContent } from './trackContent.js';

const LEGACY_BASIC_DRUMS_HITS = Object.freeze({
  hihat: Object.freeze([0, 4, 8, 12]),
  kick: Object.freeze([0]),
  snare: Object.freeze([8]),
});

function createCell(instruments) {
  return createDrumsCell(instruments);
}

function createEmptyDrumsBar() {
  return Array.from({ length: STEPS_PER_BAR }, () => null);
}

function createDrumsBarFromTemplate(templateId) {
  const template = getDrumTemplate(templateId);
  if (!template) return null;

  const bar = createEmptyDrumsBar();
  const instrumentsByStep = Array.from({ length: STEPS_PER_BAR }, () => []);
  const timingOffsetsByStep = Array.from({ length: STEPS_PER_BAR }, () => ({}));
  const velocitiesByStep = Array.from({ length: STEPS_PER_BAR }, () => ({}));
  for (const [instrument, steps] of Object.entries(template.hits)) {
    steps.forEach((step) => {
      instrumentsByStep[step].push(instrument);
      const feel = getDrumTemplateHitFeel(template, instrument, step);
      timingOffsetsByStep[step][instrument] = feel.timingOffset;
      velocitiesByStep[step][instrument] = feel.velocity;
    });
  }
  instrumentsByStep.forEach((instruments, step) => {
    if (instruments.length) {
      bar[step] = createDrumsCell(instruments, {
        timingOffsets: timingOffsetsByStep[step],
        velocities: velocitiesByStep[step],
      });
    }
  });
  return bar;
}

function createDrumTemplatePreviewEvents(templateId) {
  const template = getDrumTemplate(templateId);
  if (!template) return [];

  const instrumentsByStep = Array.from({ length: STEPS_PER_BAR }, () => []);
  for (const [instrument, steps] of Object.entries(template.hits)) {
    steps.forEach((step) => instrumentsByStep[step].push(instrument));
  }

  return instrumentsByStep.flatMap((instruments, step) => {
    if (!instruments.length) return [];
    const cell = createDrumsCell(instruments, {
      timingOffsets: Object.fromEntries(instruments.map((instrument) => (
        [instrument, getDrumTemplateHitFeel(template, instrument, step).timingOffset]
      ))),
      velocities: Object.fromEntries(instruments.map((instrument) => (
        [instrument, getDrumTemplateHitFeel(template, instrument, step).velocity]
      ))),
    });

    return [{
      instruments: cell.instruments,
      step,
      timingOffsets: cell.timingOffsets,
      velocities: cell.velocities,
    }];
  });
}

function createBasicDrumsBar() {
  const bar = createEmptyDrumsBar();
  for (const [instrument, steps] of Object.entries(LEGACY_BASIC_DRUMS_HITS)) {
    steps.forEach((step) => {
      bar[step] = createCell([
        ...(bar[step]?.instruments ?? []),
        instrument,
      ]);
    });
  }
  return bar;
}

function createBasicDrumsBarWithoutKick() {
  return createBasicDrumsBar().map((cell) => {
    const instruments = cell?.instruments?.filter((instrument) => instrument !== 'kick') ?? [];
    return instruments.length ? createCell(instruments) : null;
  });
}

function createDefaultDrumsPattern() {
  return Object.entries(LEGACY_BASIC_DRUMS_HITS).flatMap(([instrument, steps]) => (
    steps.map((step) => ({
      bar: 0,
      step,
      instrument,
    }))
  ));
}

function isValidBarIndex(barIndex, totalBars = MAX_PROJECT_BARS) {
  return Number.isInteger(barIndex) && barIndex >= 0 && barIndex < totalBars;
}

function replaceDrumsBar(matrix, barIndex, bar) {
  if (!matrix?.drums || !isValidBarIndex(barIndex, getMatrixBars(matrix))) return matrix;

  const nextDrums = [...matrix.drums];
  nextDrums[barIndex] = bar;

  return {
    ...matrix,
    drums: nextDrums,
  };
}

function applyBasicDrumsBar(matrix, barIndex) {
  return replaceDrumsBar(matrix, barIndex, createBasicDrumsBar());
}

function applyDrumsTemplateToBar(matrix, barIndex, templateId) {
  const bar = createDrumsBarFromTemplate(templateId);
  if (!bar) return matrix;
  return replaceDrumsBar(matrix, barIndex, bar);
}

function getDrumsClipBarIndexes(clips) {
  const ids = clips?.ids ?? [];
  const byId = clips?.byId ?? {};
  const barIndexes = ids
    .map((id) => byId[id])
    .filter((clip) => clip?.trackId === 'drums' && isValidBarIndex(clip.bar))
    .map((clip) => clip.bar);

  return [...new Set(barIndexes)].sort((left, right) => left - right);
}

function applyBasicDrumsAllBars(matrix, barIndexes = Array.from({ length: getMatrixBars(matrix) }, (_, index) => index)) {
  if (!matrix?.drums) return matrix;

  const targetBars = new Set(barIndexes.filter((bar) => isValidBarIndex(bar, getMatrixBars(matrix))));

  return {
    ...matrix,
    drums: Array.from({ length: getMatrixBars(matrix) }, (_, barIndex) => (
      targetBars.has(barIndex) ? createBasicDrumsBar() : createEmptyDrumsBar()
    )),
  };
}

function applyDrumsTemplateToBars(matrix, barIndexes, templateId) {
  if (!matrix?.drums) return matrix;
  const template = getDrumTemplate(templateId);
  if (!template) return matrix;

  const targetBars = new Set((barIndexes ?? []).filter((bar) => isValidBarIndex(bar, getMatrixBars(matrix))));
  if (!targetBars.size) return matrix;

  return {
    ...matrix,
    drums: matrix.drums.map((bar, barIndex) => (
      targetBars.has(barIndex) ? createDrumsBarFromTemplate(template.id) : bar
    )),
  };
}

function clearDrumsBar(matrix, barIndex) {
  return replaceDrumsBar(matrix, barIndex, createEmptyDrumsBar());
}

function hasExistingDrumsClipContent(matrix, clips) {
  return hasExistingTrackClipContent(matrix, clips, 'drums');
}

export {
  applyBasicDrumsAllBars,
  applyBasicDrumsBar,
  applyDrumsTemplateToBar,
  applyDrumsTemplateToBars,
  clearDrumsBar,
  createBasicDrumsBar,
  createBasicDrumsBarWithoutKick,
  createDefaultDrumsPattern,
  createDrumsBarFromTemplate,
  createDrumTemplatePreviewEvents,
  createEmptyDrumsBar,
  getDrumsClipBarIndexes,
  hasExistingDrumsClipContent,
};
