const DRUM_TEMPLATE_GENRES = Object.freeze({
  pop: Object.freeze({ id: 'pop', label: '80年代复古流行' }),
  'hip-hop': Object.freeze({ id: 'hip-hop', label: 'City Pop' }),
  'r-and-b': Object.freeze({ id: 'r-and-b', label: '现代独立流行' }),
  'electronic-edm': Object.freeze({ id: 'electronic-edm', label: 'Lofi电子' }),
  rock: Object.freeze({ id: 'rock', label: '复古摇滚' }),
});

const DEFAULT_DRUM_TEMPLATE_GENRE_ID = 'pop';
const DEFAULT_DRUM_TEMPLATE_ID = 'basic-drums-groove';
const ALL_STEPS = Object.freeze(Array.from({ length: 16 }, (_, index) => index));
const EVEN_STEPS = Object.freeze([0, 2, 4, 6, 8, 10, 12, 14]);

function freezeHits(hits = {}) {
  return Object.freeze({
    hihat: Object.freeze([...(hits.hihat ?? [])]),
    kick: Object.freeze([...(hits.kick ?? [])]),
    snare: Object.freeze([...(hits.snare ?? [])]),
  });
}

function createGenreFeel({
  label,
  lateInstruments = [],
  lateOffset = 0,
  swing = 0,
  velocities,
}) {
  return Object.freeze({
    label,
    lateInstruments: Object.freeze([...lateInstruments]),
    lateOffset,
    swing,
    velocities: Object.freeze({ ...velocities }),
  });
}

const DRUM_TEMPLATE_GENRE_FEELS = Object.freeze({
  pop: createGenreFeel({
    label: '直拍 · 明亮反拍',
    velocities: { hihat: 0.62, kick: 0.96, snare: 0.9 },
  }),
  'hip-hop': createGenreFeel({
    label: '轻 Swing · 放克切分',
    swing: 0.12,
    velocities: { hihat: 0.56, kick: 0.9, snare: 0.82 },
  }),
  'r-and-b': createGenreFeel({
    label: '稀疏 · 半拍留白',
    swing: 0.04,
    velocities: { hihat: 0.48, kick: 0.82, snare: 0.78 },
  }),
  'electronic-edm': createGenreFeel({
    label: '重 Swing · 军鼓靠后',
    lateInstruments: ['snare'],
    lateOffset: 0.16,
    swing: 0.24,
    velocities: { hihat: 0.42, kick: 0.82, snare: 0.72 },
  }),
  rock: createGenreFeel({
    label: '直拍 · 强力度推进',
    velocities: { hihat: 0.78, kick: 0.98, snare: 0.98 },
  }),
});

function createTemplate({
  accents,
  default: isDefault = false,
  description,
  genreId,
  ghosts,
  hits,
  id,
  name,
}) {
  const genreFeel = DRUM_TEMPLATE_GENRE_FEELS[genreId];
  return Object.freeze({
    default: isDefault,
    description,
    feel: Object.freeze({
      ...genreFeel,
      accentSteps: freezeHits(accents),
      ghostSteps: freezeHits(ghosts),
    }),
    genreId,
    hits: freezeHits(hits),
    id,
    name,
  });
}

const DRUM_STYLE_TEMPLATES = Object.freeze([
  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [2, 10] },
    default: true,
    description: '四踩底鼓和反拍镲直接建立80年代舞池律动。',
    genreId: 'pop',
    hits: { kick: [0, 4, 8, 12], snare: [4, 12], hihat: [2, 6, 10, 14] },
    id: DEFAULT_DRUM_TEMPLATE_ID,
    name: '复古舞池',
  }),
  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [2, 6, 10, 14] },
    description: '持续四踩配明亮八分镲，能量比默认模板更饱满。',
    genreId: 'pop',
    hits: { kick: [0, 4, 8, 12], snare: [4, 12], hihat: EVEN_STEPS },
    id: 'pop-neon-four-floor',
    name: '霓虹四拍',
  }),
  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [0, 8] },
    description: '连续切分底鼓穿过直八镲，带出合成器式弹跳感。',
    genreId: 'pop',
    hits: { kick: [0, 3, 7, 8, 11, 14], snare: [4, 12], hihat: EVEN_STEPS },
    id: 'pop-synth-bounce',
    name: '合成器跃动',
  }),
  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [2, 10] },
    description: '反拍镲保持明亮，底鼓在拍间跳动并用尾镲收口。',
    genreId: 'pop',
    ghosts: { hihat: [15] },
    hits: { kick: [0, 6, 8, 10, 14], snare: [4, 12], hihat: [2, 6, 10, 14, 15] },
    id: 'pop-retro-offbeat',
    name: '复古反拍',
  }),
  createTemplate({
    accents: { kick: [0, 4, 8, 12], snare: [4, 12, 15], hihat: [0, 8] },
    description: '密集底鼓与小节尾军鼓共同把能量推向副歌。',
    genreId: 'pop',
    hits: { kick: [0, 4, 8, 10, 12, 14], snare: [4, 12, 15], hihat: EVEN_STEPS },
    id: 'pop-chorus-drive',
    name: '副歌推进',
  }),

  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [0, 8] },
    default: true,
    description: '轻微 Swing、十六分装饰和幽灵军鼓形成都会放克感。',
    genreId: 'hip-hop',
    ghosts: { snare: [10], hihat: [3, 7, 11, 15] },
    hits: {
      kick: [0, 3, 7, 8, 11, 14],
      snare: [4, 10, 12],
      hihat: [0, 2, 3, 6, 7, 8, 10, 11, 14, 15],
    },
    id: 'city-pop-cruise',
    name: '都会巡航',
  }),
  createTemplate({
    accents: { kick: [0, 9], snare: [4, 12], hihat: [0, 8] },
    description: '后置底鼓和幽灵军鼓让夜间公路般的律动更松弛。',
    genreId: 'hip-hop',
    ghosts: { snare: [7, 15], hihat: [3, 11] },
    hits: {
      kick: [0, 6, 9, 11, 14],
      snare: [4, 7, 12, 15],
      hihat: [0, 2, 3, 6, 8, 10, 11, 14],
    },
    id: 'city-pop-midnight-drive',
    name: '午夜兜风',
  }),
  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [2, 10] },
    description: '成对十六分镲与四拍底鼓混合出轻盈都会迪斯科。',
    genreId: 'hip-hop',
    ghosts: { hihat: [3, 7, 11, 15] },
    hits: {
      kick: [0, 4, 7, 8, 12, 15],
      snare: [4, 12],
      hihat: [2, 3, 6, 7, 10, 11, 14, 15],
    },
    id: 'city-pop-sea-breeze-disco',
    name: '海风迪斯科',
  }),
  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [0, 4, 8, 12] },
    description: '连续十六分镲配密集切分底鼓，是五套里最放克的一套。',
    genreId: 'hip-hop',
    ghosts: { snare: [9], hihat: [1, 3, 5, 7, 9, 11, 13, 15] },
    hits: { kick: [0, 3, 6, 8, 11, 14], snare: [4, 9, 12], hihat: ALL_STEPS },
    id: 'city-pop-neon-sync',
    name: '霓虹切分',
  }),
  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [0, 8] },
    description: '错位底鼓与尾部幽灵军鼓，让段落自然松弛收束。',
    genreId: 'hip-hop',
    ghosts: { snare: [11, 15], hihat: [3, 11, 15] },
    hits: {
      kick: [0, 5, 8, 10, 13, 15],
      snare: [4, 11, 12, 15],
      hihat: [0, 2, 3, 6, 8, 10, 11, 14, 15],
    },
    id: 'city-pop-rooftop-sunset',
    name: '天台落日',
  }),

  createTemplate({
    accents: { kick: [0], snare: [8], hihat: [0, 12] },
    default: true,
    description: '军鼓只落第三拍，极简鼓点为卧室质感留出大块空间。',
    genreId: 'r-and-b',
    ghosts: { hihat: [7] },
    hits: { kick: [0, 8, 11], snare: [8], hihat: [0, 4, 7, 12] },
    id: 'indie-bedroom-pulse',
    name: '卧室脉冲',
  }),
  createTemplate({
    accents: { kick: [0, 10], snare: [5, 13], hihat: [0, 8] },
    description: '偏离标准反拍的军鼓和四个稀疏镲点制造朦胧摇晃感。',
    genreId: 'r-and-b',
    ghosts: { kick: [15], hihat: [3, 11] },
    hits: { kick: [0, 7, 10, 15], snare: [5, 13], hihat: [0, 3, 8, 11] },
    id: 'indie-hazy-sync',
    name: '朦胧切分',
  }),
  createTemplate({
    accents: { kick: [0], snare: [8], hihat: [0, 8] },
    description: '半拍军鼓加断续镲点，重心明显区别于流行和摇滚。',
    genreId: 'r-and-b',
    ghosts: { hihat: [2, 6, 14] },
    hits: { kick: [0, 6, 10], snare: [8], hihat: [0, 2, 6, 8, 12, 14] },
    id: 'indie-half-time-space',
    name: '半拍留白',
  }),
  createTemplate({
    accents: { kick: [0, 9], snare: [4, 11], hihat: [2, 10] },
    description: '不对称军鼓与稀疏反拍镲形成轻微漂浮的段落律动。',
    genreId: 'r-and-b',
    ghosts: { hihat: [7, 15] },
    hits: { kick: [0, 9, 14], snare: [4, 11], hihat: [2, 7, 10, 15] },
    id: 'indie-offbeat-glow',
    name: '反拍微光',
  }),
  createTemplate({
    accents: { kick: [0, 10], snare: [6, 14], hihat: [0, 8] },
    description: '宽阔四分镲配偏移军鼓，副歌变强但仍保持独立感。',
    genreId: 'r-and-b',
    ghosts: { snare: [15] },
    hits: { kick: [0, 4, 10, 13], snare: [6, 14, 15], hihat: [0, 4, 8, 12] },
    id: 'indie-chorus-lift',
    name: '独立副歌',
  }),

  createTemplate({
    accents: { kick: [0], snare: [4, 12], hihat: [0, 14] },
    default: true,
    description: '重 Swing、低力度镲和靠后军鼓形成明显磁带循环感。',
    genreId: 'electronic-edm',
    ghosts: { hihat: [3, 10] },
    hits: { kick: [0, 7, 10], snare: [4, 12], hihat: [0, 3, 6, 10, 14] },
    id: 'lofi-dusty-tape',
    name: '灰尘磁带',
  }),
  createTemplate({
    accents: { kick: [0], snare: [4, 12], hihat: [0, 8] },
    description: '断续镲点在 Swing 中前后晃动，适合舒缓雨夜氛围。',
    genreId: 'electronic-edm',
    ghosts: { hihat: [5, 13] },
    hits: { kick: [0, 6, 9], snare: [4, 12], hihat: [0, 2, 5, 8, 10, 13] },
    id: 'lofi-rainy-night',
    name: '雨夜慢拍',
  }),
  createTemplate({
    accents: { kick: [0, 9], snare: [4, 11], hihat: [2, 14] },
    description: '错位军鼓、破碎底鼓和弱镲点产生不规则闪烁。',
    genreId: 'electronic-edm',
    ghosts: { hihat: [9] },
    hits: { kick: [0, 3, 9, 14], snare: [4, 11], hihat: [2, 6, 9, 14] },
    id: 'lofi-broken-streetlight',
    name: '碎拍街灯',
  }),
  createTemplate({
    accents: { kick: [0], snare: [4, 12], hihat: [2, 10] },
    description: '最大化留白，仅用四个漂移镲点维持深夜循环。',
    genreId: 'electronic-edm',
    ghosts: { hihat: [7, 15] },
    hits: { kick: [0, 10], snare: [4, 12], hihat: [2, 7, 10, 15] },
    id: 'lofi-late-night-space',
    name: '深夜留白',
  }),
  createTemplate({
    accents: { kick: [0, 10], snare: [4, 12], hihat: [0, 12] },
    description: '六步交错脉冲配重 Swing，像略微拉伸的旧磁带。',
    genreId: 'electronic-edm',
    ghosts: { hihat: [3, 9, 15] },
    hits: { kick: [0, 6, 10, 15], snare: [4, 12], hihat: [0, 3, 6, 9, 12, 15] },
    id: 'lofi-tape-stagger',
    name: '磁带错步',
  }),

  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12], hihat: [0, 4, 8, 12] },
    default: true,
    description: '高力度直八镲、强军鼓和连续底鼓构成直接摇滚推进。',
    genreId: 'rock',
    hits: { kick: [0, 6, 8, 10], snare: [4, 12], hihat: EVEN_STEPS },
    id: 'rock-straight-eighths',
    name: '直八摇滚',
  }),
  createTemplate({
    accents: { kick: [0, 8, 14], snare: [4, 12], hihat: [0, 8] },
    description: '更多底鼓和尾镲让车库段落听起来更粗粝、更急迫。',
    genreId: 'rock',
    hits: { kick: [0, 3, 6, 8, 10, 14], snare: [4, 12], hihat: [...EVEN_STEPS, 15] },
    id: 'rock-garage-drive',
    name: '车库推进',
  }),
  createTemplate({
    accents: { kick: [0, 4, 8, 12], snare: [4, 12], hihat: [0, 4, 8, 12] },
    description: '强力度四踩配直八镲，保留现场舞台式的稳定冲击。',
    genreId: 'rock',
    hits: { kick: [0, 4, 8, 12], snare: [4, 12], hihat: EVEN_STEPS },
    id: 'rock-stage-four-floor',
    name: '舞台四踩',
  }),
  createTemplate({
    accents: { kick: [0, 8], snare: [4, 12, 14, 15], hihat: [0, 8] },
    description: '最后一拍连续军鼓形成明确的现场收尾填充。',
    genreId: 'rock',
    hits: {
      kick: [0, 6, 8, 10],
      snare: [4, 12, 13, 14, 15],
      hihat: [0, 2, 4, 6, 8, 10, 12],
    },
    id: 'rock-snare-ending',
    name: '军鼓收尾',
  }),
  createTemplate({
    accents: { kick: [0, 4, 8, 12], snare: [4, 12], hihat: [0, 4, 8, 12] },
    description: '十六分镲和八分底鼓持续冲刺，是最直接的高速模板。',
    genreId: 'rock',
    hits: { kick: EVEN_STEPS, snare: [4, 12], hihat: ALL_STEPS },
    id: 'rock-punk-sprint',
    name: '朋克冲刺',
  }),
]);

const DRUM_STYLE_TEMPLATES_BY_GENRE = Object.freeze(Object.fromEntries(
  Object.keys(DRUM_TEMPLATE_GENRES).map((genreId) => [
    genreId,
    Object.freeze(DRUM_STYLE_TEMPLATES.filter((template) => template.genreId === genreId)),
  ]),
));

function getDrumTemplate(templateId) {
  return DRUM_STYLE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

function normalizeDrumTemplateGenreId(genreId) {
  return DRUM_TEMPLATE_GENRES[genreId]?.id ?? DEFAULT_DRUM_TEMPLATE_GENRE_ID;
}

function getDrumTemplatesForGenre(genreId) {
  return DRUM_STYLE_TEMPLATES_BY_GENRE[normalizeDrumTemplateGenreId(genreId)];
}

function getDrumTemplateGenre(genreId) {
  return DRUM_TEMPLATE_GENRES[normalizeDrumTemplateGenreId(genreId)];
}

function getDrumTemplateHitFeel(templateOrId, instrument, step) {
  const template = typeof templateOrId === 'string'
    ? getDrumTemplate(templateOrId)
    : templateOrId;
  if (!template?.hits?.[instrument]?.includes(step)) {
    return { timingOffset: 0, velocity: 1 };
  }

  const baseVelocity = template.feel.velocities[instrument] ?? 1;
  const accented = template.feel.accentSteps[instrument].includes(step);
  const ghosted = template.feel.ghostSteps[instrument].includes(step);
  const velocity = ghosted
    ? Math.max(0.2, baseVelocity * 0.48)
    : accented
      ? Math.min(1, baseVelocity + 0.16)
      : baseVelocity;
  const swingOffset = step % 2 === 1 ? template.feel.swing : 0;
  const lateOffset = template.feel.lateInstruments.includes(instrument)
    ? template.feel.lateOffset
    : 0;

  return {
    timingOffset: Number(Math.min(0.45, swingOffset + lateOffset).toFixed(3)),
    velocity: Number(velocity.toFixed(3)),
  };
}

export {
  DEFAULT_DRUM_TEMPLATE_GENRE_ID,
  DEFAULT_DRUM_TEMPLATE_ID,
  DRUM_STYLE_TEMPLATES,
  DRUM_TEMPLATE_GENRES,
  DRUM_TEMPLATE_GENRE_FEELS,
  getDrumTemplate,
  getDrumTemplateGenre,
  getDrumTemplateHitFeel,
  getDrumTemplatesForGenre,
  normalizeDrumTemplateGenreId,
};
