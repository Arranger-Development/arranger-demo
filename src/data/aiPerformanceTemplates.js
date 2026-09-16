// Drums/bass transcribed from Notion “表演模式 Demo 1”, 2026-09-13.
// Melody: 未命名表格.xlsx, 2026-09-14; sheet order preserved, B2/G#2 omitted.
// Green cells mark sixteenth-grid attacks; melody samples have natural tails.
// Repeated steps are simultaneous pitches.
// https://app.notion.com/p/3dad48cb1eee8092a4c9d9dfd29fb135
// Steps are zero-based sixteenths. Repeated pitches in the grids are separate hits.
export const AI_PERFORMANCE_PROFILE_ID = 'ai-demo-1';
export const AI_PERFORMANCE_DEFAULT_BPM = 100;

const drum = (slug, name, bars) => ({ id: `ai-demo-1-drums-${slug}`, name, bars, barCount: bars.length });
const pitched = (track, slug, name, bars) => ({
  id: `ai-demo-1-${track}-${slug}`, name, bars, barCount: bars.length,
});

export const AI_PERFORMANCE_TEMPLATES = {
  drums: [
    drum('pulse', '悸动节奏', [{ kick: [0, 12], snare: [], hihat: [0, 1, 2, 4, 6, 10, 14] }]),
    drum('march', '摇摆行进', [{ kick: [0, 1, 4, 12], snare: [8], hihat: [0, 1, 2, 4, 6, 10, 14] }]),
    drum('street', '街头舞步', [{ kick: [0, 3, 6, 12], snare: [8], hihat: [0, 1, 2, 3, 4, 6, 8, 9, 10, 12, 13, 14] }]),
    drum('slow', '放慢脚步', [{ kick: [0, 6], snare: [8], hihat: [0, 1, 2, 4, 6, 8, 9, 10, 12, 14] }]),
    drum('focus', '凝神屏气', [{ kick: [], snare: [], hihat: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15] }]),
    drum('full', '全力以赴', [
      { kick: [0, 3, 7, 8, 14], snare: [4, 12], hihat: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 14, 15] },
      { kick: [0, 2, 3, 7, 10], snare: [4, 12], hihat: [0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    ]),
  ],
  bass: [
    pitched('bass', 'careful', '小心翼翼', [[[0, 'C#1'], [8, 'C#1'], [10, 'D#1'], [13, 'E1']]]),
    pitched('bass', 'flying', '飞扬贝斯', [[[0, 'G#0'], [3, 'G#0'], [6, 'G#0'], [8, 'B0'], [10, 'C#1'], [12, 'G#1']]]),
    pitched('bass', 'abyss', '凝视深渊', [[[0, 'C#1'], [8, 'C#1'], [12, 'E1']]]),
    pitched('bass', 'celebrate', '庆典时刻', [[[0, 'C#1'], [1, 'B0'], [4, 'C#1'], [6, 'C#1'], [8, 'C#1'], [9, 'G#1'], [10, 'C#1'], [12, 'C#1'], [14, 'B0']]]),
  ],
  melody: [
    pitched('melody', 'ripple-1', '婉约涟漪1', [
      [[0, 'B3'], [0, 'F#3'], [0, 'E3'], [0, 'C#3'], [8, 'B3'], [8, 'F#3'], [8, 'E3'], [8, 'C#3'], [13, 'E3']],
      [[0, 'D#3'], [0, 'C#3'], [8, 'C#4'], [12, 'B3']],
      [[0, 'G#3'], [0, 'C#3'], [8, 'E3'], [12, 'B3']],
      [[0, 'G#3'], [0, 'C#3'], [10, 'B3'], [10, 'G#3'], [10, 'E3'], [10, 'C#3'], [12, 'D#3']],
    ]),
    pitched('melody', 'ripple-2', '婉约涟漪2', [
      [[0, 'E3'], [0, 'C#3'], [8, 'F#3'], [12, 'B3']],
      [[0, 'D#3'], [8, 'F#3'], [12, 'B3']],
      [[0, 'E3'], [0, 'C#3'], [8, 'E3'], [12, 'D#3']],
      [[0, 'E3'], [10, 'C#4'], [11, 'G#3'], [12, 'E3'], [14, 'F#3']],
    ]),
    pitched('melody', 'ripple-3', '婉约涟漪3', [
      [[0, 'E3'], [0, 'C#3']],
      [[0, 'D#3'], [12, 'B3']],
      [[0, 'E3'], [0, 'C#3'], [8, 'E3'], [12, 'D#3']],
      [[0, 'E3'], [12, 'F#3'], [14, 'E3']],
    ]),
    pitched('melody', 'heartbeat', '怦然心动', [
      [[0, 'B3'], [0, 'F#3'], [0, 'E3'], [0, 'C#3'], [2, 'B3'], [2, 'E3'], [2, 'C#3'], [8, 'B3'], [8, 'F#3'], [8, 'E3'], [8, 'C#3'], [12, 'E3']],
      [[0, 'D#3'], [0, 'C#3'], [8, 'C#4'], [12, 'B3']],
      [[0, 'C#4'], [0, 'F#3'], [0, 'E3'], [0, 'C#3'], [2, 'B3'], [2, 'F#3'], [2, 'E3'], [2, 'C#3'], [8, 'B3'], [8, 'F#3'], [8, 'E3'], [8, 'C#3'], [12, 'C#4'], [12, 'E3']],
      [[0, 'G#3'], [0, 'F#3'], [0, 'E3'], [0, 'C#3'], [10, 'C#4'], [10, 'B3'], [10, 'G#3'], [10, 'D#3'], [13, 'B3'], [13, 'G#3'], [13, 'D#3']],
    ]),
  ],
};
