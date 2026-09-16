import { normalizeMelodyTimbreId } from './melodyTimbres.js';

const MELODY_STYLE_TEMPLATES = Object.freeze({
  chinese: Object.freeze({
    id: 'chinese',
    label: '中国风',
    tag: '默认',
    highlightedPitchClasses: Object.freeze(['C', 'D', 'E', 'G', 'A']),
    rhythmSteps: Object.freeze([2, 4, 8, 12, 14]),
    description: '五声音阶搭配留白充足的律动，旋律简洁、清晰。',
    footLabel: '5 个音 · 5 个律动位置',
    recommendedTimbreId: 'yangqin',
  }),
  blues: Object.freeze({
    id: 'blues',
    label: '布鲁斯',
    tag: '',
    highlightedPitchClasses: Object.freeze(['C', 'D', 'D#', 'E', 'G', 'A']),
    rhythmSteps: Object.freeze([2, 4, 6, 10, 11, 12, 14]),
    description: '加入 D# 布鲁斯音，配合更密的切分律动，带来更强的摇摆感。',
    footLabel: '6 个音 · 7 个律动位置',
    recommendedTimbreId: 'blues',
  }),
});

const MELODY_STYLE_TEMPLATE_IDS = Object.freeze(Object.keys(MELODY_STYLE_TEMPLATES));

function getMelodyStyleTemplate(templateId) {
  return MELODY_STYLE_TEMPLATES[templateId] ?? null;
}

function normalizeMelodyStyleTemplateId(templateId) {
  return getMelodyStyleTemplate(templateId)?.id ?? null;
}

function normalizeMelodyScaleId(scaleId) {
  return getMelodyStyleTemplate(scaleId)?.id ?? 'chinese';
}

function stripLegacyMelodyRhythmFromClips(clips) {
  if (!clips?.byId || !Array.isArray(clips.ids)) return clips;
  let changed = false;
  const byId = Object.fromEntries(Object.entries(clips.byId).map(([clipId, clip]) => {
    if (!clip || !Object.hasOwn(clip, 'melodyRhythmTemplateId')) return [clipId, clip];
    const nextClip = { ...clip };
    delete nextClip.melodyRhythmTemplateId;
    changed = true;
    return [clipId, nextClip];
  }));
  return changed ? { ...clips, byId } : clips;
}

function normalizeMelodyProjectState(state = {}) {
  return {
    ...state,
    clips: stripLegacyMelodyRhythmFromClips(state.clips),
    melodyRhythmTemplateId: normalizeMelodyStyleTemplateId(
      state.melodyRhythmTemplateId,
    ),
    melodyScaleId: normalizeMelodyScaleId(state.melodyScaleId),
    melodyTimbreId: normalizeMelodyTimbreId(state.melodyTimbreId),
  };
}

export {
  getMelodyStyleTemplate,
  MELODY_STYLE_TEMPLATE_IDS,
  MELODY_STYLE_TEMPLATES,
  normalizeMelodyProjectState,
  normalizeMelodyScaleId,
  normalizeMelodyStyleTemplateId,
  stripLegacyMelodyRhythmFromClips,
};
