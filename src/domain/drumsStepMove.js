import { STEPS_PER_BAR } from './musicConstants.js';
import {
  createDrumsCell,
  getDrumsCellInstruments,
} from './drumsCells.js';

function createRejectedDrumsMove() {
  return {
    allowed: false,
    nextMatrixPatch: [],
  };
}

function isValidStep(step) {
  return Number.isInteger(step) && step >= 0 && step < STEPS_PER_BAR;
}

function createDrumsStepMovePatch({
  bar,
  fromStep,
  instrument,
  matrix,
  toStep,
} = {}) {
  if (!Number.isInteger(bar) || !isValidStep(fromStep) || !isValidStep(toStep)) {
    return createRejectedDrumsMove();
  }
  if (fromStep === toStep) return createRejectedDrumsMove();

  const sourceCell = matrix?.drums?.[bar]?.[fromStep] ?? null;
  const targetCell = matrix?.drums?.[bar]?.[toStep] ?? null;
  const sourceInstruments = getDrumsCellInstruments(sourceCell);
  const targetInstruments = getDrumsCellInstruments(targetCell);

  if (!sourceInstruments.includes(instrument) || targetInstruments.includes(instrument)) {
    return createRejectedDrumsMove();
  }

  const targetVelocities = { ...(targetCell?.velocities ?? {}) };
  const targetTimingOffsets = { ...(targetCell?.timingOffsets ?? {}) };
  if (Object.hasOwn(sourceCell?.velocities ?? {}, instrument)) {
    targetVelocities[instrument] = sourceCell.velocities[instrument];
  }
  if (Object.hasOwn(sourceCell?.timingOffsets ?? {}, instrument)) {
    targetTimingOffsets[instrument] = sourceCell.timingOffsets[instrument];
  }

  return {
    allowed: true,
    nextMatrixPatch: [
      {
        bar,
        cell: createDrumsCell(
          sourceInstruments.filter((item) => item !== instrument),
          sourceCell,
        ),
        step: fromStep,
      },
      {
        bar,
        cell: createDrumsCell([...targetInstruments, instrument], {
          timingOffsets: targetTimingOffsets,
          velocities: targetVelocities,
        }),
        step: toStep,
      },
    ],
  };
}

export { createDrumsStepMovePatch };
