import { validateMultimodalMediaFile } from './multimodalRecommendation.js';

export const MULTIMODAL_TEXT_LIMIT = 2000;
export const MULTIMODAL_INPUT_MODES = Object.freeze([
  { id: 'text', label: '文字' },
  { id: 'audio', label: '音频', accept: '.mp3,.wav,.m4a,.ogg,.flac,audio/mpeg,audio/wav,audio/mp4,audio/ogg,audio/flac', formats: 'MP3 / WAV / M4A / OGG / FLAC', limit: '音频最多 50 MB' },
  { id: 'video', label: '视频', accept: '.mp4,.webm,.mov,video/mp4,video/webm,video/quicktime', formats: 'MP4 / WebM / MOV', limit: '视频最多 200 MB' },
  { id: 'image', label: '图片', accept: '.jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif', formats: 'JPEG / PNG / WebP / GIF', limit: '图片最多 20 MB' },
]);

export function validateMultimodalInput({ mode, text = '', file = null }) {
  const inputMode = MULTIMODAL_INPUT_MODES.find((item) => item.id === mode);
  if (!inputMode) return { valid: false, error: '请选择一种输入方式。' };
  if (mode === 'text') {
    if (!text.trim()) return { valid: false, error: '请描述你想要的音乐。' };
    if (text.length > MULTIMODAL_TEXT_LIMIT) return { valid: false, error: `文字不能超过 ${MULTIMODAL_TEXT_LIMIT} 字。` };
    return { valid: true, error: null };
  }
  const validation = validateMultimodalMediaFile(file);
  if (!validation.valid) return validation;
  if (validation.kind !== mode) return { valid: false, error: `请选择${inputMode.label}文件。` };
  return validation;
}

export function getMultimodalAnalysisStages(mode) {
  if (mode === 'text') return ['读取音乐创作描述', '整理风格、情绪与节奏', '匹配调式、和声与配器'];
  if (mode === 'audio') return ['读取音频素材', '整理节奏与音色方向', '匹配调式、和声与配器'];
  return ['读取画面构图与动态', '识别色彩、场景与情绪', '匹配调式、和声与配器'];
}
