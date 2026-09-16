import {
  createChordTonePitches,
  getChordDefinition,
} from '../domain/chordCells.js';

const CHORD_STYLE_GENRES = Object.freeze({
  pop: Object.freeze({ id: 'pop', label: '80年代复古流行' }),
  'hip-hop': Object.freeze({ id: 'hip-hop', label: 'City Pop' }),
  'r-and-b': Object.freeze({ id: 'r-and-b', label: '现代独立流行' }),
  'electronic-edm': Object.freeze({ id: 'electronic-edm', label: 'Lofi电子' }),
  rock: Object.freeze({ id: 'rock', label: '复古摇滚' }),
});

const DEFAULT_CHORD_STYLE_GENRE_ID = 'pop';

const CHORD_STYLE_FEELS = Object.freeze({
  pop: Object.freeze({ label: '明亮扩展 · 直拍', lateOffset: 0, swing: 0, velocity: 0.8, voicing: 'standard' }),
  'hip-hop': Object.freeze({ label: '七和弦 · 轻 Swing', lateOffset: 0, swing: 0.1, velocity: 0.72, voicing: 'standard' }),
  'r-and-b': Object.freeze({ label: '开放排列 · 留白', lateOffset: 0, swing: 0.04, velocity: 0.66, voicing: 'open' }),
  'electronic-edm': Object.freeze({ label: '低位和声 · 重 Swing', lateOffset: 0.08, swing: 0.2, velocity: 0.56, voicing: 'low' }),
  rock: Object.freeze({ label: '强力和弦 · 直拍', lateOffset: 0, swing: 0, velocity: 0.94, voicing: 'power' }),
});

function createChordTemplate({
  chords,
  default: isDefault = false,
  description,
  genreId,
  id,
  name,
}) {
  return Object.freeze({
    chords: Object.freeze([...chords]),
    default: isDefault,
    description,
    genreId,
    id,
    name,
    voicing: CHORD_STYLE_FEELS[genreId].voicing,
  });
}

const CHORD_STYLE_CHORD_TEMPLATES = Object.freeze([
  createChordTemplate({ id: 'pop-neon-home', genreId: 'pop', name: '霓虹归航', default: true, chords: ['Cmaj7', 'Am7', 'Fmaj7', 'G7'], description: '明亮七和弦铺底，形成80年代合成器色彩。' }),
  createChordTemplate({ id: 'pop-synth-axis', genreId: 'pop', name: '合成器轴心', chords: ['C', 'G', 'Am', 'F'], description: '经典轴心进行，适合稳定推进的主歌。' }),
  createChordTemplate({ id: 'pop-canon-glow', genreId: 'pop', name: '卡农微光', chords: ['C', 'G/B', 'Am7', 'Em'], description: '转位低音连续下行，营造闪烁的卡农感。' }),
  createChordTemplate({ id: 'pop-night-descent', genreId: 'pop', name: '夜色下行', chords: ['Am7', 'G', 'Fmaj7', 'E7'], description: '小调下行与副属和弦，把复古夜色推向下一轮循环。' }),
  createChordTemplate({ id: 'pop-chorus-lift', genreId: 'pop', name: '副歌抬升', chords: ['F', 'G', 'Em', 'Am'], description: '从四级起步逐步抬升，适合进入副歌。' }),

  createChordTemplate({ id: 'city-major7-cruise', genreId: 'hip-hop', name: '都会巡航', default: true, chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'], description: '完整七和弦连接，构成顺滑的都会巡航感。' }),
  createChordTemplate({ id: 'city-midnight-2516', genreId: 'hip-hop', name: '午夜 2-5-1-6', chords: ['Dm7', 'G7', 'Cmaj7', 'A7'], description: '2-5-1 后接副属六级，循环方向明确而华丽。' }),
  createChordTemplate({ id: 'city-sea-breeze', genreId: 'hip-hop', name: '海风分解', chords: ['Fmaj7', 'G7', 'Em7', 'Am7'], description: '连续七和弦连接，轻盈且富有流动感。' }),
  createChordTemplate({ id: 'city-neon-secondary', genreId: 'hip-hop', name: '霓虹副属', chords: ['Cmaj7', 'A7', 'Dm7', 'G7'], description: 'A7 副属和弦制造霓虹般的转折。' }),
  createChordTemplate({ id: 'city-rooftop-sunset', genreId: 'hip-hop', name: '天台落日', chords: ['Am9', 'Dm7', 'G7', 'Cmaj7'], description: '九和弦起步并回到大七和弦，松弛地完成归航。' }),

  createChordTemplate({ id: 'indie-bedroom-open', genreId: 'r-and-b', name: '卧室开放', default: true, chords: ['Cadd9', 'Gsus2', 'Amadd9', 'Fmaj7'], description: '开放排列与附加音，为卧室质感留下空气。' }),
  createChordTemplate({ id: 'indie-half-time-space', genreId: 'r-and-b', name: '半拍留白', chords: ['Amadd9', 'Fmaj7', 'Cadd9', 'Gsus4'], description: '宽阔悬置和弦，重心沉静克制。' }),
  createChordTemplate({ id: 'indie-guitar-inversions', genreId: 'r-and-b', name: '吉他转位', chords: ['C', 'G/B', 'Am7', 'F/A'], description: '平滑低音转位，模拟独立吉他织体。' }),
  createChordTemplate({ id: 'indie-hazy-suspension', genreId: 'r-and-b', name: '朦胧悬置', chords: ['Csus2', 'Em', 'Amadd9', 'Fmaj7'], description: '悬置音与附加音形成轻微漂浮感。' }),
  createChordTemplate({ id: 'indie-chorus-lift', genreId: 'r-and-b', name: '独立副歌', chords: ['Fadd9', 'C/E', 'Gsus4', 'Am7'], description: '开放附加音增强副歌，但不过度饱和。' }),

  createChordTemplate({ id: 'lofi-dusty-maj7', genreId: 'electronic-edm', name: '灰尘七和弦', default: true, chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'], description: '低位七和弦形成温暖的磁带循环感。' }),
  createChordTemplate({ id: 'lofi-rainy-loop', genreId: 'electronic-edm', name: '雨夜循环', chords: ['Am9', 'Fmaj9', 'Cmaj7', 'Gsus2'], description: '九和弦低位铺陈，适合雨夜氛围。' }),
  createChordTemplate({ id: 'lofi-late-night-251', genreId: 'electronic-edm', name: '深夜 2-5-1', chords: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'], description: '2-5-1 在主和弦上多停留一轮。' }),
  createChordTemplate({ id: 'lofi-tape-descent', genreId: 'electronic-edm', name: '磁带下行', chords: ['Am7', 'Am/G', 'Fmaj7', 'E7'], description: '下行低音像轻微拖慢的旧磁带。' }),
  createChordTemplate({ id: 'lofi-empty-room', genreId: 'electronic-edm', name: '空房间', chords: ['Cmaj7', 'Em7', 'Fmaj7', 'Fm6'], description: '借用小四级制造朦胧转折，并保留大片空间。' }),

  createChordTemplate({ id: 'rock-straight-power', genreId: 'rock', name: '直拍强奏', default: true, chords: ['C5', 'G5', 'A5', 'F5'], description: '强力和弦构成最直接的摇滚骨架。' }),
  createChordTemplate({ id: 'rock-garage-loop', genreId: 'rock', name: '车库循环', chords: ['C5', 'F5', 'G5', 'F5'], description: 'I-IV-V 回摆带出粗粝车库感。' }),
  createChordTemplate({ id: 'rock-punk-sprint', genreId: 'rock', name: '朋克冲刺', chords: ['A5', 'F5', 'C5', 'G5'], description: '强力和弦持续冲刺，适合高速段落。' }),
  createChordTemplate({ id: 'rock-classic-drive', genreId: 'rock', name: '经典推进', chords: ['C', 'G', 'F', 'G'], description: '开放大三和弦与经典 I-V-IV-V 稳定推进。' }),
  createChordTemplate({ id: 'rock-dark-descent', genreId: 'rock', name: '暗色下行', chords: ['Am', 'G', 'F', 'E5'], description: '小调下行与强力属和弦形成暗色收束。' }),
]);

function createGrooveTemplate({
  default: isDefault = false,
  duration,
  genreId,
  mode,
  name,
  sourcePresetId,
  steps,
}) {
  const feel = CHORD_STYLE_FEELS[genreId];
  return Object.freeze({
    default: isDefault,
    duration,
    genreId,
    id: `${sourcePresetId}-groove`,
    lateOffset: feel.lateOffset,
    mode,
    name,
    sourcePresetId,
    steps: Object.freeze([...steps]),
    swing: feel.swing,
    velocity: feel.velocity,
  });
}

const CHORD_STYLE_GROOVE_TEMPLATES = Object.freeze([
  createGrooveTemplate({ sourcePresetId: 'pop-neon-home', genreId: 'pop', name: '霓虹双拍', default: true, mode: 'block', steps: [0, 8], duration: '8n' }),
  createGrooveTemplate({ sourcePresetId: 'pop-synth-axis', genreId: 'pop', name: '合成器四拍', mode: 'block', steps: [0, 4, 8, 12], duration: '8n' }),
  createGrooveTemplate({ sourcePresetId: 'pop-canon-glow', genreId: 'pop', name: '卡农闪烁', mode: 'arp', steps: [0, 2, 4, 6, 8, 10, 12, 14], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'pop-night-descent', genreId: 'pop', name: '夜行切分', mode: 'block', steps: [0, 6, 12], duration: '8n' }),
  createGrooveTemplate({ sourcePresetId: 'pop-chorus-lift', genreId: 'pop', name: '副歌抬升', mode: 'block', steps: [0, 6, 10, 12], duration: '8n' }),

  createGrooveTemplate({ sourcePresetId: 'city-major7-cruise', genreId: 'hip-hop', name: '都会五击', default: true, mode: 'block', steps: [0, 3, 6, 10, 14], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'city-midnight-2516', genreId: 'hip-hop', name: '午夜推进', mode: 'block', steps: [0, 6, 9, 12], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'city-sea-breeze', genreId: 'hip-hop', name: '海风分解', mode: 'arp', steps: [0, 2, 3, 6, 7, 10, 11, 14], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'city-neon-secondary', genreId: 'hip-hop', name: '霓虹尾拍', mode: 'block', steps: [0, 4, 7, 10, 12, 15], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'city-rooftop-sunset', genreId: 'hip-hop', name: '落日回摆', mode: 'block', steps: [0, 5, 8, 11, 14], duration: '16n' }),

  createGrooveTemplate({ sourcePresetId: 'indie-bedroom-open', genreId: 'r-and-b', name: '卧室开放', default: true, mode: 'arp', steps: [0, 4, 7, 12], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'indie-half-time-space', genreId: 'r-and-b', name: '半拍留白', mode: 'block', steps: [0, 8], duration: '8n' }),
  createGrooveTemplate({ sourcePresetId: 'indie-guitar-inversions', genreId: 'r-and-b', name: '吉他错位', mode: 'arp', steps: [0, 2, 6, 10, 14], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'indie-hazy-suspension', genreId: 'r-and-b', name: '朦胧悬置', mode: 'block', steps: [0, 7, 12], duration: '8n' }),
  createGrooveTemplate({ sourcePresetId: 'indie-chorus-lift', genreId: 'r-and-b', name: '独立副歌', mode: 'block', steps: [0, 6, 12], duration: '8n' }),

  createGrooveTemplate({ sourcePresetId: 'lofi-dusty-maj7', genreId: 'electronic-edm', name: '灰尘后拍', default: true, mode: 'block', steps: [0, 7, 12], duration: '8n' }),
  createGrooveTemplate({ sourcePresetId: 'lofi-rainy-loop', genreId: 'electronic-edm', name: '雨夜分解', mode: 'arp', steps: [0, 3, 6, 10, 14], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'lofi-late-night-251', genreId: 'electronic-edm', name: '深夜稀疏', mode: 'arp', steps: [0, 5, 9, 13], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'lofi-tape-descent', genreId: 'electronic-edm', name: '磁带尾击', mode: 'block', steps: [0, 6, 10, 15], duration: '8n' }),
  createGrooveTemplate({ sourcePresetId: 'lofi-empty-room', genreId: 'electronic-edm', name: '空房留白', mode: 'block', steps: [0, 8, 14], duration: '8n' }),

  createGrooveTemplate({ sourcePresetId: 'rock-straight-power', genreId: 'rock', name: '直拍强奏', default: true, mode: 'block', steps: [0, 4, 8, 12], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'rock-garage-loop', genreId: 'rock', name: '车库回摆', mode: 'block', steps: [0, 6, 8, 12], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'rock-punk-sprint', genreId: 'rock', name: '朋克冲刺', mode: 'block', steps: [0, 2, 4, 6, 8, 10, 12, 14], duration: '16n' }),
  createGrooveTemplate({ sourcePresetId: 'rock-classic-drive', genreId: 'rock', name: '经典延音', mode: 'block', steps: [0, 4, 8, 12], duration: '8n' }),
  createGrooveTemplate({ sourcePresetId: 'rock-dark-descent', genreId: 'rock', name: '暗色连击', mode: 'block', steps: [0, 6, 8, 10, 12, 14], duration: '16n' }),
]);

const CHORD_STYLE_CHORD_TEMPLATES_BY_GENRE = Object.freeze(Object.fromEntries(
  Object.keys(CHORD_STYLE_GENRES).map((genreId) => [
    genreId,
    Object.freeze(CHORD_STYLE_CHORD_TEMPLATES.filter((template) => template.genreId === genreId)),
  ]),
));

const CHORD_STYLE_GROOVE_TEMPLATES_BY_GENRE = Object.freeze(Object.fromEntries(
  Object.keys(CHORD_STYLE_GENRES).map((genreId) => [
    genreId,
    Object.freeze(CHORD_STYLE_GROOVE_TEMPLATES.filter((template) => template.genreId === genreId)),
  ]),
));

const CHORD_STYLE_PRESETS = Object.freeze(CHORD_STYLE_CHORD_TEMPLATES.map((chordTemplate) => {
  const groove = CHORD_STYLE_GROOVE_TEMPLATES.find(
    (candidate) => candidate.sourcePresetId === chordTemplate.id,
  );
  return Object.freeze({
    ...chordTemplate,
    feel: Object.freeze({
      ...CHORD_STYLE_FEELS[chordTemplate.genreId],
      duration: groove.duration,
    }),
    groove: Object.freeze({
      duration: groove.duration,
      mode: groove.mode,
      steps: groove.steps,
    }),
  });
}));

function noteToMidi(note) {
  const match = /^([A-G])(#?)(-?\d+)$/.exec(note ?? '');
  if (!match) return null;
  const pitchClasses = { A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7 };
  return (Number(match[3]) + 1) * 12 + pitchClasses[match[1]] + (match[2] ? 1 : 0);
}

function midiToNote(midi) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) return null;
  const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${roots[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function transformVoicing(notes, profile) {
  const midiNotes = notes.map(noteToMidi).filter(Number.isInteger);
  if (profile === 'open' && midiNotes.length > 1) midiNotes[1] += 12;
  if (profile === 'low') {
    midiNotes.forEach((midi, index) => {
      if (midi - 12 >= 48) midiNotes[index] = midi - 12;
    });
  }
  return [...new Set(midiNotes)]
    .sort((left, right) => left - right)
    .map(midiToNote)
    .filter(Boolean);
}

function normalizeChordStyleGenreId(genreId) {
  return CHORD_STYLE_GENRES[genreId]?.id ?? DEFAULT_CHORD_STYLE_GENRE_ID;
}

function getChordStyleChordTemplatesForGenre(genreId) {
  return CHORD_STYLE_CHORD_TEMPLATES_BY_GENRE[normalizeChordStyleGenreId(genreId)];
}

function getChordStyleGrooveTemplatesForGenre(genreId) {
  return CHORD_STYLE_GROOVE_TEMPLATES_BY_GENRE[normalizeChordStyleGenreId(genreId)];
}

function getChordStylePresetsForGenre(genreId) {
  const normalizedGenreId = normalizeChordStyleGenreId(genreId);
  return CHORD_STYLE_PRESETS.filter((preset) => preset.genreId === normalizedGenreId);
}

function getChordStyleGenre(genreId) {
  return CHORD_STYLE_GENRES[normalizeChordStyleGenreId(genreId)];
}

function getChordStyleChordTemplate(templateId) {
  return CHORD_STYLE_CHORD_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

function getChordStyleGrooveTemplate(templateId) {
  return CHORD_STYLE_GROOVE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

function getChordStylePreset(presetId) {
  return CHORD_STYLE_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

function getChordStyleChordTemplateNotes(templateOrId, chordIndex) {
  const template = typeof templateOrId === 'string'
    ? getChordStyleChordTemplate(templateOrId)
    : templateOrId;
  const chordName = template?.chords?.[chordIndex % 4];
  const definition = getChordDefinition(chordName);
  if (!template || !definition) return [];
  const notes = createChordTonePitches(
    definition.root,
    definition.toneRoots,
    definition.tonePitches,
  );
  return transformVoicing(notes, template.voicing ?? template.feel?.voicing);
}

function getChordStyleGrooveHitFeel(templateOrId, step, hitIndex = 0) {
  const template = typeof templateOrId === 'string'
    ? getChordStyleGrooveTemplate(templateOrId)
    : templateOrId;
  if (!template?.steps.includes(step)) return { timingOffset: 0, velocity: 1 };
  const timingOffset = template.lateOffset + (step % 2 === 1 ? template.swing : 0);
  const velocity = Math.min(1, template.velocity + (hitIndex === 0 ? 0.12 : 0));
  return {
    timingOffset: Number(Math.min(0.45, timingOffset).toFixed(3)),
    velocity: Number(velocity.toFixed(3)),
  };
}

function getChordStylePresetNotes(presetOrId, chordIndex) {
  const preset = typeof presetOrId === 'string' ? getChordStylePreset(presetOrId) : presetOrId;
  return getChordStyleChordTemplateNotes(preset?.id, chordIndex);
}

function getChordStylePresetHitFeel(presetOrId, step, hitIndex = 0) {
  const preset = typeof presetOrId === 'string' ? getChordStylePreset(presetOrId) : presetOrId;
  return getChordStyleGrooveHitFeel(`${preset?.id}-groove`, step, hitIndex);
}

export {
  CHORD_STYLE_CHORD_TEMPLATES,
  CHORD_STYLE_FEELS,
  CHORD_STYLE_GENRES,
  CHORD_STYLE_GROOVE_TEMPLATES,
  CHORD_STYLE_PRESETS,
  DEFAULT_CHORD_STYLE_GENRE_ID,
  getChordStyleChordTemplate,
  getChordStyleChordTemplateNotes,
  getChordStyleChordTemplatesForGenre,
  getChordStyleGenre,
  getChordStyleGrooveHitFeel,
  getChordStyleGrooveTemplate,
  getChordStyleGrooveTemplatesForGenre,
  getChordStylePreset,
  getChordStylePresetHitFeel,
  getChordStylePresetNotes,
  getChordStylePresetsForGenre,
  normalizeChordStyleGenreId,
};
