export function jamTemplateState(status, track, id) {
  if (!id || status.mode === 'stopped') return 'idle';
  if (status.queuedPhraseIds?.[track] === id && status.playingPhraseIds?.[track] !== id) return 'queued';
  if (status.playingPhraseIds?.[track] === id) return 'playing';
  return 'idle';
}

export function jamColumnState(status, templates, index) {
  const entries = Object.entries(templates).filter(([, row]) => row[index] && !isEmptyJamPhrase(row[index]));
  if (!entries.length || status.mode === 'stopped') return 'idle';
  const matches = ids => ids && Object.entries(templates).every(([t, row]) => (ids[t] ?? null) === (isEmptyJamPhrase(row[index]) ? null : row[index]?.id ?? null));
  if (matches(status.queuedPhraseIds) && !matches(status.playingPhraseIds)) return 'queued';
  return matches(status.playingPhraseIds) ? 'playing' : 'idle';
}

export function jamParameterLevels(trackId, parameter) {
  return trackId === 'chord' && parameter === 'groove' ? [0, 20, 40, 60, 80, 100] : [0, 25, 50, 75, 100];
}

const chordVoicingLabels = { 0: '低位密集', 20: '紧凑转位', 40: '高位密集', 80: '宽排', 100: '叠八度' };
const drumGrooveLabels = { 0: '隔拍', 25: '反拍', 75: '八分加花', 100: '十六分' };

// Keep stored parameter keys stable: groove is Ableton's Level axis, strength
// is its Int axis. Hardware keys describe the physical left/right CC5/CC6 knobs.
export function jamTrackKnobs(trackId, humGenerated = false) {
  if (humGenerated && trackId === 'drums') return [
    { parameter: 'strength', hardwareParameter: 'strength', label: '强度', lowLabel: '温和', highLabel: '强烈' },
    { parameter: 'groove', hardwareParameter: 'groove', label: '律动', lowLabel: drumGrooveLabels[0], highLabel: drumGrooveLabels[100], valueLabels: drumGrooveLabels },
  ];
  if (humGenerated) return [
    { parameter: 'groove', hardwareParameter: 'strength', ...{
      melody: { label: '力度', lowLabel: '轻柔', highLabel: '饱满' },
      chord: { label: '声部排布', lowLabel: chordVoicingLabels[0], highLabel: chordVoicingLabels[100], valueLabels: chordVoicingLabels },
      bass: { label: '长短', lowLabel: '短促', highLabel: '连贯' },
    }[trackId] },
    { parameter: 'strength', hardwareParameter: 'groove', label: '律动', lowLabel: trackId === 'chord' ? '齐奏' : trackId === 'bass' ? '根音' : '平稳',
      highLabel: trackId === 'chord' ? '分解' : trackId === 'bass' ? '切分' : '重音' },
  ];
  if (['chord','bass','melody'].includes(trackId)) return [
    { parameter: 'groove', hardwareParameter: 'strength', label: trackId === 'chord' ? '色彩' : '旋律',
      lowLabel: trackId === 'chord' ? '清晰' : '纯净', highLabel: trackId === 'chord' ? '朦胧' : '丰富' },
    { parameter: 'strength', hardwareParameter: 'groove', label: '律动', lowLabel: '轻盈', highLabel: '激昂' },
  ];
  return [
    { parameter: 'strength', hardwareParameter: 'strength', label: '强度', lowLabel: '温和', highLabel: '强烈' },
    { parameter: 'groove', hardwareParameter: 'groove', label: '律动', lowLabel: '平稳', highLabel: '活跃' },
  ];
}

export function jamTrackParameters(params, trackId) {
  return Object.fromEntries(['strength', 'groove'].map(key => [key,
    (() => {
      const levels = jamParameterLevels(trackId, key), interval = levels[1];
      const value = Number.isFinite(params?.[key]) ? params[key] : 50;
      return levels[Math.max(0, Math.min(levels.length - 1, Math.round(value / interval)))];
    })(),
  ]));
}
import { isEmptyJamPhrase } from './jamPhraseContent.js';
