import { MELODY_STYLE_TEMPLATES } from '../data/melodyStyleTemplates.js';

const MELODY_RHYTHM_TEMPLATES = Object.freeze(
  Object.values(MELODY_STYLE_TEMPLATES).map((template) => Object.freeze({
    id: template.id,
    name: template.label,
    steps: template.rhythmSteps,
  })),
);

const MELODY_RHYTHM_TEMPLATE_IDS = Object.freeze(
  MELODY_RHYTHM_TEMPLATES.map(({ id }) => id),
);

function getMelodyRhythmTemplate(templateId) {
  return MELODY_RHYTHM_TEMPLATES.find(({ id }) => id === templateId) ?? null;
}

function normalizeMelodyRhythmTemplateId(templateId) {
  return getMelodyRhythmTemplate(templateId)?.id ?? null;
}

export {
  getMelodyRhythmTemplate,
  MELODY_RHYTHM_TEMPLATE_IDS,
  MELODY_RHYTHM_TEMPLATES,
  normalizeMelodyRhythmTemplateId,
};
