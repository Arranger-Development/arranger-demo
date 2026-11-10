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

const arrangementKnobs = {
  melody: [
    ['旋律声部', ['低八度叠奏', '低声部呼应', '单线', '高声部呼应', '高八度叠奏']],
    ['节奏变奏', ['骨架', '靠拍', '原节奏', '反拍', '复奏']],
  ],
  chord: [
    ['声部排布', ['低位密集', '紧凑转位', '高位密集', '默认排布', '宽排', '叠八度']],
    ['律动', ['齐奏', '短奏', '默认律动', '反拍重奏', '分解']],
  ],
  bass: [
    ['长短', ['极短', '短促', '标准', '连贯', '长音']],
    ['律动', ['平稳根音', '短奏', '默认律动', '反拍加花', '切分加花']],
  ],
  drums: [
    ['底鼓／军鼓打法', ['极简', '半速回拍', '标准', '底鼓切分', '军鼓加花']],
    ['踩镲律动', ['隔拍', '反拍', '默认鼓型', '八分加花', '十六分']],
  ],
};

// Stored keys retain the Ableton axes. The hardware keys describe CC5/CC6.
export function jamTrackKnobs(trackId, arranged = false) {
  if (arranged) {
    const parameters = trackId === 'drums' ? ['strength', 'groove'] : ['groove', 'strength'];
    return arrangementKnobs[trackId].map(([label, labels], index) => {
      const parameter = parameters[index];
      return {
        parameter, label, hardwareParameter: index === 0 ? 'strength' : 'groove',
        valueLabels: Object.fromEntries(jamParameterLevels(trackId, parameter).map((value, i) => [value, labels[i]])),
      };
    });
  }
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
