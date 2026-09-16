import { STEPS_PER_BAR } from '../domain/musicConstants.js';

function isStepInPreviewRange(step) {
  return Number.isInteger(step) && step >= 0 && step < STEPS_PER_BAR;
}

function addPreviewStep(previewSteps, step) {
  if (!isStepInPreviewRange(step)) return;
  previewSteps.add(step);
}

function getBassGroovePreviewSteps(template) {
  const previewSteps = new Set();

  for (const step of template.steps) {
    addPreviewStep(previewSteps, step);

    if (template.duration === '8n') {
      addPreviewStep(previewSteps, step + 1);
    }
  }

  return [...previewSteps].sort((a, b) => a - b);
}

export { getBassGroovePreviewSteps };
