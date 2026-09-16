import { createClipRecord } from '../domain/clipHelpers.js';
import {
  CORE_TRACK_IDS,
  ROOT_KEY,
  SCALE,
  TOTAL_BARS,
  TRACK_IDS,
} from '../domain/musicConstants.js';
import { createDefaultTrackState } from '../domain/trackInstances.js';
import {
  RECOMMENDED_BPM,
  normalizeBpm,
} from '../domain/bpm.js';
import createInitialMatrix from '../store/createInitialMatrix.js';
import { createChillTutorialMatrix } from '../tutorial/chillTutorialScore.js';

const MULTIMODAL_MEDIA_LIMITS = Object.freeze({
  image: 20 * 1024 * 1024,
  video: 200 * 1024 * 1024,
});

const MULTIMODAL_IMAGE_TYPES = Object.freeze([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MULTIMODAL_VIDEO_TYPES = Object.freeze([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const MULTIMODAL_ACCEPT = [
  ...MULTIMODAL_IMAGE_TYPES,
  ...MULTIMODAL_VIDEO_TYPES,
  '.mov',
].join(',');

const MULTIMODAL_ANALYSIS_STAGES = Object.freeze([
  '读取画面构图与动态',
  '识别色彩、场景与情绪',
  '匹配调式、和声与配器',
]);

const MULTIMODAL_RECOMMENDATION_TRACKS = Object.freeze([
  Object.freeze({
    id: 'drums',
    label: 'Drums',
    timbres: Object.freeze([
      Object.freeze({ id: 'soft-electronic-kit', label: 'Soft Electronic Kit' }),
      Object.freeze({ id: 'dusty-tape-kit', label: 'Dusty Tape Kit' }),
      Object.freeze({ id: 'clean-digital-kit', label: 'Clean Digital Kit' }),
    ]),
  }),
  Object.freeze({
    id: 'chord',
    label: 'Chord',
    timbres: Object.freeze([
      Object.freeze({ id: 'warm-electric-piano', label: 'Warm Electric Piano' }),
      Object.freeze({ id: 'muted-rhodes', label: 'Muted Rhodes' }),
      Object.freeze({ id: 'glass-electric-keys', label: 'Glass Electric Keys' }),
    ]),
  }),
  Object.freeze({
    id: 'bass',
    label: 'Bass',
    timbres: Object.freeze([
      Object.freeze({ id: 'round-electric-bass', label: 'Round Electric Bass' }),
      Object.freeze({ id: 'soft-sub-bass', label: 'Soft Sub Bass' }),
      Object.freeze({ id: 'fm-round-bass', label: 'FM Round Bass' }),
    ]),
  }),
  Object.freeze({
    id: 'melody',
    label: 'Melody',
    timbres: Object.freeze([
      Object.freeze({ id: 'airy-synth-lead', label: 'Airy Synth Lead' }),
      Object.freeze({ id: 'hazy-bell-lead', label: 'Hazy Bell Lead' }),
      Object.freeze({ id: 'soft-pluck-lead', label: 'Soft Pluck Lead' }),
    ]),
  }),
  Object.freeze({
    id: 'pad',
    label: 'Pad',
    timbres: Object.freeze([
      Object.freeze({ id: 'rain-glow-pad', label: 'Rain Glow Pad' }),
      Object.freeze({ id: 'tape-bloom-pad', label: 'Tape Bloom Pad' }),
      Object.freeze({ id: 'glass-air-pad', label: 'Glass Air Pad' }),
    ]),
  }),
  Object.freeze({
    id: 'sample',
    label: 'Sampler',
    timbres: Object.freeze([
      Object.freeze({ id: 'rain-street-texture', label: 'Rain Street Texture' }),
      Object.freeze({ id: 'vinyl-room-texture', label: 'Vinyl Room Texture' }),
      Object.freeze({ id: 'city-field-ambience', label: 'City Field Ambience' }),
    ]),
  }),
]);

const MULTIMODAL_RECOMMENDATION = Object.freeze({
  style: Object.freeze({
    defaultId: 'chill-rainy-street',
    options: Object.freeze([
      Object.freeze({ id: 'chill-rainy-street', label: 'Chill 雨夜街头' }),
      Object.freeze({ id: 'lofi-night-walk', label: 'Lofi 夜行' }),
      Object.freeze({ id: 'city-pop-afterglow', label: 'City Pop 余晖' }),
    ]),
  }),
  mode: Object.freeze({
    defaultId: 'c-ionian',
    options: Object.freeze([
      Object.freeze({ id: 'c-ionian', label: 'C Major · Ionian' }),
      Object.freeze({ id: 'a-aeolian', label: 'A Minor · Aeolian' }),
      Object.freeze({ id: 'd-dorian', label: 'D Minor · Dorian' }),
    ]),
  }),
  harmony: Object.freeze({
    defaultId: 'maj7-home',
    options: Object.freeze([
      Object.freeze({ id: 'maj7-home', label: 'Cmaj7 → Am7 → Fmaj7 → G7' }),
      Object.freeze({ id: 'minor-loop', label: 'Am7 → Fmaj7 → Cmaj7 → G' }),
      Object.freeze({ id: 'dorian-loop', label: 'Dm7 → G → Cmaj7 → Am7' }),
    ]),
  }),
  tracks: MULTIMODAL_RECOMMENDATION_TRACKS,
  timeSignature: '4 / 4',
  structure: '8 小节 · 前奏 / 两句主题 / 收束',
});

function createDefaultTrackTimbreSelections() {
  return Object.fromEntries(
    MULTIMODAL_RECOMMENDATION_TRACKS.map((track) => [track.id, track.timbres[0].id]),
  );
}

function toggleRecommendationTrackSelection(selectedTrackIds, trackId) {
  const validTrackIds = new Set(MULTIMODAL_RECOMMENDATION_TRACKS.map((track) => track.id));
  const selectedIds = Array.isArray(selectedTrackIds)
    ? selectedTrackIds.filter((id, index, values) => (
      validTrackIds.has(id) && values.indexOf(id) === index
    ))
    : [...CORE_TRACK_IDS];

  if (!validTrackIds.has(trackId)) return selectedIds;
  if (selectedIds.includes(trackId)) {
    return selectedIds.length > 1
      ? selectedIds.filter((id) => id !== trackId)
      : selectedIds;
  }

  return MULTIMODAL_RECOMMENDATION_TRACKS
    .map((track) => track.id)
    .filter((id) => selectedIds.includes(id) || id === trackId);
}

function selectRecommendationTrackTimbre(timbreByTrackId, trackId, timbreId) {
  const track = MULTIMODAL_RECOMMENDATION_TRACKS.find((item) => item.id === trackId);
  if (!track?.timbres.some((timbre) => timbre.id === timbreId)) return timbreByTrackId;

  return {
    ...timbreByTrackId,
    [trackId]: timbreId,
  };
}

function getMultimodalMediaKind(file) {
  const type = String(file?.type ?? '').toLowerCase();
  const name = String(file?.name ?? '').toLowerCase();

  if (
    MULTIMODAL_IMAGE_TYPES.includes(type)
    || /\.(gif|jpe?g|png|webp)$/.test(name)
  ) return 'image';
  if (
    MULTIMODAL_VIDEO_TYPES.includes(type)
    || /\.(mov|mp4|webm)$/.test(name)
  ) return 'video';
  return null;
}

function validateMultimodalMediaFile(file) {
  if (!file) {
    return {
      error: '请选择一张图片或一段视频。',
      kind: null,
      valid: false,
    };
  }

  const kind = getMultimodalMediaKind(file);
  if (!kind) {
    return {
      error: '暂时支持 JPEG、PNG、WebP、GIF、MP4、WebM 和 MOV。',
      kind: null,
      valid: false,
    };
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size < 0 || size > MULTIMODAL_MEDIA_LIMITS[kind]) {
    return {
      error: kind === 'image'
        ? '图片不能超过 20MB。'
        : '视频不能超过 200MB。',
      kind,
      valid: false,
    };
  }

  return {
    error: null,
    kind,
    valid: true,
  };
}

function createMultimodalClips() {
  const records = CORE_TRACK_IDS.flatMap((trackId) => (
    Array.from({ length: TOTAL_BARS }, (_, bar) => createClipRecord(trackId, bar))
  ));

  return {
    ids: records.map((clip) => clip.id),
    byId: Object.fromEntries(records.map((clip) => [clip.id, clip])),
  };
}

function createMultimodalRecommendationAppState({ bpm = RECOMMENDED_BPM } = {}) {
  const matrix = createInitialMatrix();
  return {
    ...createDefaultTrackState(),
    totalBars: TOTAL_BARS,
    activeTrackId: 'drums',
    bpm: normalizeBpm(bpm),
    clips: createMultimodalClips(),
    currentBar: 0,
    currentStep: 0,
    isPlaying: false,
    matrix: {
      ...matrix,
      ...createChillTutorialMatrix(),
    },
    melodyRhythmTemplateId: null,
    melodyScaleId: 'chinese',
    melodyTimbreId: 'piano',
    mutedTracks: Object.fromEntries(CORE_TRACK_IDS.map((trackId) => [trackId, false])),
    rootKey: ROOT_KEY,
    scale: SCALE,
    seekBar: 0,
    seekStep: 0,
    selectedBar: 0,
    selectedClipId: 'drums-bar-0',
    visibleTrackIds: [...CORE_TRACK_IDS],
    volumes: Object.fromEntries(TRACK_IDS.map((trackId) => [trackId, 0])),
  };
}

function createInitialRecommendationSelections() {
  return {
    activeTrackId: 'drums',
    harmony: MULTIMODAL_RECOMMENDATION.harmony.defaultId,
    mode: MULTIMODAL_RECOMMENDATION.mode.defaultId,
    selectedTrackIds: [...CORE_TRACK_IDS],
    style: MULTIMODAL_RECOMMENDATION.style.defaultId,
    timbreByTrackId: createDefaultTrackTimbreSelections(),
  };
}

export {
  MULTIMODAL_ACCEPT,
  MULTIMODAL_ANALYSIS_STAGES,
  MULTIMODAL_MEDIA_LIMITS,
  MULTIMODAL_RECOMMENDATION,
  createInitialRecommendationSelections,
  createMultimodalRecommendationAppState,
  selectRecommendationTrackTimbre,
  toggleRecommendationTrackSelection,
  getMultimodalMediaKind,
  validateMultimodalMediaFile,
};
