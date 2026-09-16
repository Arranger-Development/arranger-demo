import {
  BEATS_PER_BAR,
  CHORD_SPAN,
} from './musicConstants.js';

const CHORD_ROOTS = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
const CHORD_GRID_ROOTS = Object.freeze(['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C']);
const CHORD_GRID_OCTAVES = Object.freeze([5, 4, 3]);
const DEFAULT_CHORD_GRID_OCTAVE = 4;
const CHORD_GRID_PITCHES = Object.freeze(
  CHORD_GRID_OCTAVES.flatMap((octave) => (
    CHORD_GRID_ROOTS.map((root) => Object.freeze({
      label: `${root}${octave}`,
      rootName: root,
      octave,
      sharp: root.includes('#'),
      root: root === 'C',
    }))
  )),
);
const MAJOR_TRIAD_INTERVALS = Object.freeze([0, 4, 7]);
const PASSING_CHORD_GROOVE_ID = 'passing-shortcut';
const DIATONIC_CHORD_OPTIONS = Object.freeze([
  Object.freeze({ name: 'C', roman: 'I', desc: '调式中心，最稳定、最有归属感的主和弦。' }),
  Object.freeze({ name: 'Dm', roman: 'ii', desc: '柔和的下属功能，常推向 V 形成自然过渡。' }),
  Object.freeze({ name: 'Em', roman: 'iii', desc: '介于 I 与 V 之间，听感温和、略带忧郁。' }),
  Object.freeze({ name: 'F', roman: 'IV', desc: '稳定的下属功能，色彩温暖明亮。' }),
  Object.freeze({ name: 'G', roman: 'V', desc: '最强解决倾向，强力推动回到主和弦。' }),
  Object.freeze({ name: 'Am', roman: 'vi', desc: 'C 大调的关系小调，常用于忧郁段落。' }),
  Object.freeze({ name: 'Bdim', roman: 'vii°', desc: '导和弦，强烈的不稳定感，色彩独特。' }),
]);
const PASSING_CHORD_DEFAULT_OPTIONS = Object.freeze([
  Object.freeze({ name: 'C/B', desc: '常见的转位和弦，让低音线更平滑。' }),
  Object.freeze({ name: 'D7', desc: '副属和弦色彩，制造短暂的方向性张力。' }),
  Object.freeze({ name: 'Em', desc: '调内三级和弦，作为衔接更柔和。' }),
]);
const PASSING_CHORD_OPTIONS = Object.freeze({
  'C→Am': Object.freeze([
    Object.freeze({ name: 'E7', desc: '用 E7 作为 Am 的副属和弦，带来明确解决感。', toneRoots: Object.freeze(['E', 'B', 'D', 'G#']), tonePitches: Object.freeze(['E3', 'B2', 'D3', 'G#3']) }),
    Object.freeze({ name: 'Bø', desc: '半减七经过色彩，强化 C 到 Am 的张力。', toneRoots: Object.freeze(['B', 'D', 'F', 'A']), tonePitches: Object.freeze(['B2', 'D3', 'F3', 'A3']) }),
  ]),
  'Am→F': Object.freeze([
    Object.freeze({ name: 'Am/G', desc: '下行低音 G 连接 Am 与 F，过渡更顺。', toneRoots: Object.freeze(['G', 'A', 'C', 'E']), tonePitches: Object.freeze(['G2', 'A3', 'C3', 'E3']) }),
    Object.freeze({ name: 'E7', desc: '用 E7 作为 Am 的副属和弦，带来明确解决感。', toneRoots: Object.freeze(['E', 'B', 'D', 'G#']), tonePitches: Object.freeze(['E3', 'B2', 'D3', 'G#3']) }),
  ]),
  'F→G': Object.freeze([
    Object.freeze({ name: 'D7', desc: 'D7 作为 G 的副属和弦，推动感更强。', toneRoots: Object.freeze(['D', 'A', 'C', 'F#']), tonePitches: Object.freeze(['D4', 'C4', 'A3', 'F#3']) }),
    Object.freeze({ name: 'F#ø', desc: '半减经过和弦，以 F# 引向 G。', toneRoots: Object.freeze(['F#', 'A', 'C', 'E']), tonePitches: Object.freeze(['F#3', 'A3', 'C4', 'E4']) }),
  ]),
  'G→C': Object.freeze([
    Object.freeze({ name: 'bA', desc: '半音上行色彩，制造回到 C 前的亮点。', toneRoots: Object.freeze(['G#', 'C', 'D#']), tonePitches: Object.freeze(['G#3', 'C4', 'D#3']) }),
    Object.freeze({ name: 'Bm7(no5)', desc: '省略五音的小七色彩，让 B 到 C 的解决更清晰。', toneRoots: Object.freeze(['B', 'D', 'A']), tonePitches: Object.freeze(['B2', 'D3', 'A3']) }),
  ]),
});
const CHORD_TEMPLATES = Object.freeze({
  axis: Object.freeze({
    id: 'axis',
    name: '轴心',
    tag: 'I-V-vi-IV',
    chords: Object.freeze(['C', 'G', 'Dm', 'F']),
    desc: '流行音乐中最具代表性的四和弦进行之一，适合循环段落。',
    songs: Object.freeze(['The Beatles · Hey Jude', 'Adele · Someone Like You']),
  }),
  doowop: Object.freeze({
    id: 'doowop',
    name: 'Doo-wop',
    tag: 'I-vi-IV-V',
    chords: Object.freeze(['C', 'Am', 'F', 'G']),
    desc: '清晰的离家与归家旅程，适合抒情流行与复古段落。',
    songs: Object.freeze(['Ben E. King · Stand By Me', 'Sean Kingston · Beautiful Girls']),
  }),
  andalusian: Object.freeze({
    id: 'andalusian',
    name: '安达卢西亚',
    tag: 'i-VII-VI-V',
    chords: Object.freeze(['Am', 'G', 'F', 'E']),
    desc: '下行级进带来忧郁与张力，适合西语流行和影视感段落。',
    songs: Object.freeze(['Ray Charles · Hit the Road Jack', 'Michael Jackson · Smooth Criminal']),
  }),
  canon: Object.freeze({
    id: 'canon',
    name: '卡农进行',
    tag: 'I-V-vi-iii',
    chords: Object.freeze(['C', 'G', 'Am', 'Em']),
    desc: '平稳流畅的经典下行走向，适合抒情铺垫。',
    songs: Object.freeze(['Pachelbel · Canon in D', 'Green Day · Basket Case']),
  }),
  blues: Object.freeze({
    id: 'blues',
    name: '12 小节布鲁斯',
    tag: 'I-IV-I-V',
    chords: Object.freeze(['C7', 'F7', 'C7', 'G7']),
    desc: '围绕 I-IV-V 的基础循环，用七度色彩制造摇摆感。',
    songs: Object.freeze(['B.B. King · The Thrill Is Gone', 'Chuck Berry · Johnny B. Goode']),
  }),
  jazz251: Object.freeze({
    id: 'jazz251',
    name: 'ii-V-I 爵士',
    tag: 'ii-V-I',
    chords: Object.freeze(['Dm7', 'G7', 'Cmaj7', 'Cmaj7']),
    desc: '下属功能到属功能再回到主功能，爵士终止式核心循环。',
    songs: Object.freeze(['Miles Davis · Autumn Leaves', 'John Coltrane · Giant Steps']),
  }),
});
const CHORD_VARIANTS = Object.freeze({
  C: Object.freeze([
    Object.freeze({ name: 'Cmaj7', desc: '柔和忧郁，常见于爵士与流行。' }),
    Object.freeze({ name: 'Csus2', desc: '明亮清澈，悬而未决。' }),
    Object.freeze({ name: 'Csus4', desc: '清新欢快，有悬置感。' }),
    Object.freeze({ name: 'Cadd9', desc: '温暖开阔，适合民谣流行。' }),
  ]),
  Am: Object.freeze([
    Object.freeze({ name: 'Am7', desc: '细腻内敛，适合抒情段落。' }),
    Object.freeze({ name: 'Am9', desc: '梦幻忧郁，为小三和弦增加空气感。' }),
    Object.freeze({ name: 'Amadd9', desc: '开阔明净，为小三和弦加入九度色彩。' }),
  ]),
  F: Object.freeze([
    Object.freeze({ name: 'Fmaj7', desc: '温柔克制的下属功能延伸。' }),
    Object.freeze({ name: 'Fmaj9', desc: '更开阔的下属功能延伸，带空气感。' }),
    Object.freeze({ name: 'F6', desc: '慵懒复古，有柔和爵士感。' }),
  ]),
  G: Object.freeze([
    Object.freeze({ name: 'G7', desc: '属七和弦，推动回到主和弦。' }),
    Object.freeze({ name: 'Gsus2', desc: '明亮清澈，常用于民谣流行。' }),
    Object.freeze({ name: 'Gsus4', desc: '强烈悬置，适合 V 到 I 前。' }),
  ]),
});
const EXTRA_CHORD_DEFINITIONS = Object.freeze({
  'C/B': Object.freeze({ root: 'B', chordRoot: 'C', quality: 'slash', toneRoots: Object.freeze(['B', 'C', 'E', 'G']) }),
  'C/E': Object.freeze({ root: 'C', chordRoot: 'C', quality: 'slash', toneRoots: Object.freeze(['C', 'E', 'G']), tonePitches: Object.freeze(['E3', 'G3', 'C4']) }),
  C: Object.freeze({ root: 'C', chordRoot: 'C', quality: 'maj', toneRoots: Object.freeze(['C', 'E', 'G']), tonePitches: Object.freeze(['C3', 'E3', 'G3']) }),
  C7: Object.freeze({ root: 'C', chordRoot: 'C', quality: '7', toneRoots: Object.freeze(['C', 'E', 'G', 'A#']) }),
  Cmaj7: Object.freeze({ root: 'C', chordRoot: 'C', quality: 'maj7', toneRoots: Object.freeze(['C', 'E', 'G', 'B']), tonePitches: Object.freeze(['C3', 'E3', 'G3', 'B3']) }),
  Csus2: Object.freeze({ root: 'C', chordRoot: 'C', quality: 'sus2', toneRoots: Object.freeze(['C', 'D', 'G']), tonePitches: Object.freeze(['C3', 'D3', 'G3']) }),
  Csus4: Object.freeze({ root: 'C', chordRoot: 'C', quality: 'sus4', toneRoots: Object.freeze(['C', 'F', 'G']), tonePitches: Object.freeze(['C3', 'F3', 'G3']) }),
  Cadd9: Object.freeze({ root: 'C', chordRoot: 'C', quality: 'add9', toneRoots: Object.freeze(['C', 'E', 'G', 'D']), tonePitches: Object.freeze(['C3', 'E3', 'G3', 'D3']) }),
  D7: Object.freeze({ root: 'D', chordRoot: 'D', quality: '7', toneRoots: Object.freeze(['D', 'A', 'C', 'F#']), tonePitches: Object.freeze(['D4', 'C4', 'A3', 'F#3']) }),
  C5: Object.freeze({ root: 'C', chordRoot: 'C', quality: '5', toneRoots: Object.freeze(['C', 'G']), tonePitches: Object.freeze(['C3', 'G3', 'C4']) }),
  Dm: Object.freeze({ root: 'D', chordRoot: 'Dm', quality: 'min', toneRoots: Object.freeze(['D', 'F', 'A']), tonePitches: Object.freeze(['D3', 'F3', 'A3']) }),
  'Dm/F': Object.freeze({ root: 'D', chordRoot: 'Dm', quality: 'slash', toneRoots: Object.freeze(['D', 'F', 'A']) }),
  Dm7: Object.freeze({ root: 'D', chordRoot: 'Dm', quality: 'm7', toneRoots: Object.freeze(['D', 'F', 'A', 'C']), tonePitches: Object.freeze(['D3', 'F3', 'A3', 'C4']) }),
  E7: Object.freeze({ root: 'E', chordRoot: 'E', quality: '7', toneRoots: Object.freeze(['E', 'B', 'D', 'G#']), tonePitches: Object.freeze(['E3', 'B2', 'D3', 'G#3']) }),
  E5: Object.freeze({ root: 'E', chordRoot: 'E', quality: '5', toneRoots: Object.freeze(['E', 'B']), tonePitches: Object.freeze(['E3', 'B3', 'E4']) }),
  Em: Object.freeze({ root: 'E', chordRoot: 'Em', quality: 'min', toneRoots: Object.freeze(['E', 'G', 'B']), tonePitches: Object.freeze(['E3', 'G3', 'B3']) }),
  Em7: Object.freeze({ root: 'E', chordRoot: 'Em', quality: 'm7', toneRoots: Object.freeze(['E', 'G', 'B', 'D']), tonePitches: Object.freeze(['E3', 'G3', 'B3', 'D4']) }),
  F: Object.freeze({ root: 'F', chordRoot: 'F', quality: 'maj', toneRoots: Object.freeze(['F', 'A', 'C']), tonePitches: Object.freeze(['F3', 'A3', 'C3']) }),
  F6: Object.freeze({ root: 'F', chordRoot: 'F', quality: '6', toneRoots: Object.freeze(['F', 'A', 'C', 'D']), tonePitches: Object.freeze(['F3', 'A3', 'C4', 'D3']) }),
  F5: Object.freeze({ root: 'F', chordRoot: 'F', quality: '5', toneRoots: Object.freeze(['F', 'C']), tonePitches: Object.freeze(['F3', 'C4', 'F4']) }),
  'F/A': Object.freeze({ root: 'F', chordRoot: 'F', quality: 'slash', toneRoots: Object.freeze(['F', 'A', 'C']), tonePitches: Object.freeze(['A2', 'C3', 'F3']) }),
  'F/C': Object.freeze({ root: 'F', chordRoot: 'F', quality: 'slash', toneRoots: Object.freeze(['F', 'A', 'C']) }),
  F7: Object.freeze({ root: 'F', chordRoot: 'F', quality: '7', toneRoots: Object.freeze(['F', 'A', 'C', 'D#']) }),
  Fmaj7: Object.freeze({ root: 'F', chordRoot: 'F', quality: 'maj7', toneRoots: Object.freeze(['F', 'A', 'C', 'E']), tonePitches: Object.freeze(['F3', 'A3', 'C4', 'E3']) }),
  Fmaj9: Object.freeze({ root: 'F', chordRoot: 'F', quality: 'maj9', toneRoots: Object.freeze(['F', 'G', 'A', 'C', 'E']), tonePitches: Object.freeze(['F3', 'G3', 'A3', 'C4', 'E3']) }),
  Fsus2: Object.freeze({ root: 'F', chordRoot: 'F', quality: 'sus2', toneRoots: Object.freeze(['F', 'G', 'C']) }),
  Fadd9: Object.freeze({ root: 'F', chordRoot: 'F', quality: 'add9', toneRoots: Object.freeze(['F', 'A', 'C', 'G']), tonePitches: Object.freeze(['F3', 'A3', 'C4', 'G4']) }),
  Fm6: Object.freeze({ root: 'F', chordRoot: 'Fm', quality: 'm6', toneRoots: Object.freeze(['F', 'G#', 'C', 'D']), tonePitches: Object.freeze(['F3', 'G#3', 'C4', 'D4']) }),
  'G/B': Object.freeze({ root: 'G', chordRoot: 'G', quality: 'slash', toneRoots: Object.freeze(['G', 'B', 'D']), tonePitches: Object.freeze(['B2', 'D3', 'G3']) }),
  G: Object.freeze({ root: 'G', chordRoot: 'G', quality: 'maj', toneRoots: Object.freeze(['G', 'B', 'D']), tonePitches: Object.freeze(['G3', 'B3', 'D4']) }),
  G5: Object.freeze({ root: 'G', chordRoot: 'G', quality: '5', toneRoots: Object.freeze(['G', 'D']), tonePitches: Object.freeze(['G3', 'D4', 'G4']) }),
  G7: Object.freeze({ root: 'G', chordRoot: 'G', quality: '7', toneRoots: Object.freeze(['G', 'B', 'D', 'F']), tonePitches: Object.freeze(['G3', 'B3', 'D4', 'F3']) }),
  Gsus2: Object.freeze({ root: 'G', chordRoot: 'G', quality: 'sus2', toneRoots: Object.freeze(['G', 'A', 'D']), tonePitches: Object.freeze(['G3', 'A3', 'D4']) }),
  Gsus4: Object.freeze({ root: 'G', chordRoot: 'G', quality: 'sus4', toneRoots: Object.freeze(['G', 'C', 'D']), tonePitches: Object.freeze(['G3', 'C3', 'D4']) }),
  Gadd9: Object.freeze({ root: 'G', chordRoot: 'G', quality: 'add9', toneRoots: Object.freeze(['G', 'B', 'D', 'A']) }),
  A5: Object.freeze({ root: 'A', chordRoot: 'A', quality: '5', toneRoots: Object.freeze(['A', 'E']), tonePitches: Object.freeze(['A3', 'E4', 'A4']) }),
  A7: Object.freeze({ root: 'A', chordRoot: 'A', quality: '7', toneRoots: Object.freeze(['A', 'C#', 'E', 'G']), tonePitches: Object.freeze(['A3', 'C#4', 'E4', 'G3']) }),
  Am: Object.freeze({ root: 'A', chordRoot: 'Am', quality: 'min', toneRoots: Object.freeze(['A', 'C', 'E']), tonePitches: Object.freeze(['A3', 'C4', 'E3']) }),
  'Am/G': Object.freeze({ root: 'G', chordRoot: 'Am', quality: 'slash', toneRoots: Object.freeze(['G', 'A', 'C', 'E']), tonePitches: Object.freeze(['G2', 'A3', 'C3', 'E3']) }),
  Am6: Object.freeze({ root: 'A', chordRoot: 'Am', quality: 'm6', toneRoots: Object.freeze(['A', 'C', 'E', 'F#']) }),
  Am7: Object.freeze({ root: 'A', chordRoot: 'Am', quality: 'm7', toneRoots: Object.freeze(['A', 'C', 'E', 'G']), tonePitches: Object.freeze(['A3', 'C4', 'E3', 'G3']) }),
  Am9: Object.freeze({ root: 'A', chordRoot: 'Am', quality: 'm9', toneRoots: Object.freeze(['A', 'B', 'C', 'E', 'G']), tonePitches: Object.freeze(['A3', 'B3', 'C3', 'E3', 'G3']) }),
  Amadd9: Object.freeze({ root: 'A', chordRoot: 'Am', quality: 'madd9', toneRoots: Object.freeze(['A', 'C', 'E', 'B']), tonePitches: Object.freeze(['A3', 'C3', 'E3', 'B3']) }),
  Asus2: Object.freeze({ root: 'A', chordRoot: 'Am', quality: 'sus2', toneRoots: Object.freeze(['A', 'B', 'E']) }),
  B7: Object.freeze({ root: 'B', chordRoot: 'B', quality: '7', toneRoots: Object.freeze(['B', 'D#', 'F#', 'A']) }),
  Bdim: Object.freeze({ root: 'B', chordRoot: 'Bdim', quality: 'dim', toneRoots: Object.freeze(['B', 'D', 'F']) }),
  'Bø': Object.freeze({ root: 'B', chordRoot: 'Bdim', quality: 'half-dim7', toneRoots: Object.freeze(['B', 'D', 'F', 'A']), tonePitches: Object.freeze(['B2', 'D3', 'F3', 'A3']) }),
  'Bm7(no5)': Object.freeze({ root: 'B', chordRoot: 'Bm', quality: 'm7-no5', toneRoots: Object.freeze(['B', 'D', 'A']), tonePitches: Object.freeze(['B2', 'D3', 'A3']) }),
  'F#ø': Object.freeze({ root: 'F#', chordRoot: 'F#dim', quality: 'half-dim7', toneRoots: Object.freeze(['F#', 'A', 'C', 'E']), tonePitches: Object.freeze(['F#3', 'A3', 'C4', 'E4']) }),
  bA: Object.freeze({ root: 'G#', chordRoot: 'bA', quality: 'maj', toneRoots: Object.freeze(['G#', 'C', 'D#']), tonePitches: Object.freeze(['G#3', 'C4', 'D#3']) }),
});

function isChordRoot(root) {
  return CHORD_ROOTS.includes(root);
}

function isChordTonePitch(note) {
  if (typeof note !== 'string') return false;

  const match = /^([A-G]#?)([0-9])$/.exec(note);
  if (!match) return false;

  return isChordRoot(match[1]);
}

function parseChordGridPitch(note) {
  if (typeof note !== 'string') return null;

  const match = /^([A-G]#?)([0-9])$/.exec(note);
  if (!match) return null;

  const [, root, octaveText] = match;
  const octave = Number(octaveText);
  if (!isChordRoot(root) || !CHORD_GRID_OCTAVES.includes(octave)) return null;

  return { label: `${root}${octave}`, octave, root };
}

function isChordGridPitch(note) {
  return Boolean(parseChordGridPitch(note));
}

function isChordNoteLabel(note) {
  return isChordRoot(note) || isChordGridPitch(note);
}

function getChordNoteRoot(note) {
  const pitch = parseChordGridPitch(note);
  if (pitch) return pitch.root;
  return isChordRoot(note) ? note : null;
}

function getChordNoteOctave(note) {
  return parseChordGridPitch(note)?.octave ?? null;
}

function getChordNotePitch(note) {
  const root = getChordNoteRoot(note);
  if (!root) return null;

  return `${root}${getChordNoteOctave(note) ?? DEFAULT_CHORD_GRID_OCTAVE}`;
}

function doChordNotesMatch(currentNote, candidateNote) {
  if (isChordRoot(candidateNote)) return getChordNoteRoot(currentNote) === candidateNote;

  const currentPitch = getChordNotePitch(currentNote);
  const candidatePitch = getChordNotePitch(candidateNote);
  return Boolean(currentPitch && candidatePitch && currentPitch === candidatePitch);
}

function normalizeChordTonePitches(tonePitches) {
  if (!Array.isArray(tonePitches)) return [];

  return tonePitches.reduce((uniquePitches, pitch) => {
    if (isChordTonePitch(pitch) && !uniquePitches.includes(pitch)) uniquePitches.push(pitch);
    return uniquePitches;
  }, []);
}

function createChordTonePitches(root, toneRoots, tonePitches = null) {
  const fixedTonePitches = normalizeChordTonePitches(tonePitches);
  if (fixedTonePitches.length) return fixedTonePitches;

  if (root && !isChordRoot(root)) return [];
  if (!toneRoots.length) return [];

  return toneRoots
    .map((toneRoot) => (isChordRoot(toneRoot) ? `${toneRoot}${DEFAULT_CHORD_GRID_OCTAVE}` : null))
    .filter(Boolean);
}

function createPassingChordTonePitches(toneRoots, tonePitches = null) {
  return createChordTonePitches(null, toneRoots, tonePitches);
}

function normalizeRemovedTonePitches(notes, allowedTonePitches = null) {
  if (!Array.isArray(notes)) return [];

  return notes.reduce((uniquePitches, note) => {
    const pitch = getChordNotePitch(note);
    if (!pitch || !isChordGridPitch(pitch)) return uniquePitches;
    if (allowedTonePitches && !allowedTonePitches.includes(pitch)) return uniquePitches;
    if (!uniquePitches.includes(pitch)) uniquePitches.push(pitch);
    return uniquePitches;
  }, []);
}

function getChordBaseTonePitches(cell) {
  if (cell?.type !== 'chord') return [];

  const fixedTonePitches = normalizeChordTonePitches(cell.tonePitches);
  if (fixedTonePitches.length) return fixedTonePitches;

  const toneRoots = cell.toneRoots ?? getChordToneRoots(cell.label);
  return createChordTonePitches(cell.root, toneRoots);
}

function getChordRemovedTonePitches(cell) {
  if (cell?.type !== 'chord') return [];

  return normalizeRemovedTonePitches(cell.removedTonePitches, getChordBaseTonePitches(cell));
}

function getChordEffectiveTonePitches(cell) {
  if (cell?.type !== 'chord') return [];

  const removedTonePitches = getChordRemovedTonePitches(cell);
  return getChordBaseTonePitches(cell).filter((pitch) => !removedTonePitches.includes(pitch));
}

function createMajorDefinition(root) {
  const rootIndex = CHORD_ROOTS.indexOf(root);
  if (rootIndex === -1) return null;

  return {
    root,
    chordRoot: root,
    quality: 'maj',
    toneRoots: MAJOR_TRIAD_INTERVALS.map((interval) => (
      CHORD_ROOTS[(rootIndex + interval) % CHORD_ROOTS.length]
    )),
  };
}

function getChordDefinition(chordName) {
  return EXTRA_CHORD_DEFINITIONS[chordName] ?? createMajorDefinition(chordName);
}

function isChordName(chordName) {
  return Boolean(getChordDefinition(chordName));
}

function getChordRootName(chordName) {
  return getChordDefinition(chordName)?.chordRoot ?? null;
}

function getDoowopPassingTargetChord(chordName) {
  const chordRoot = getChordRootName(chordName);
  const doowopChords = CHORD_TEMPLATES.doowop.chords;
  const chordIndex = doowopChords.indexOf(chordRoot);
  if (chordIndex === -1) return null;

  return doowopChords[(chordIndex + 1) % doowopChords.length];
}

function createPassingChordCell(chordName) {
  const cell = createChordCell(chordName);
  if (!cell) return null;

  return {
    ...cell,
    duration: '16n',
    grooveTemplateId: PASSING_CHORD_GROOVE_ID,
    sourceChordLabel: cell.label,
  };
}

function isPassingChordCell(cell) {
  return cell?.grooveTemplateId === PASSING_CHORD_GROOVE_ID;
}

function getPassingChordOptions(fromName, toName) {
  const fromRoot = getChordRootName(fromName);
  const toRoot = getChordRootName(toName);
  const key = fromRoot && toRoot ? `${fromRoot}→${toRoot}` : null;

  return key && PASSING_CHORD_OPTIONS[key]
    ? [...PASSING_CHORD_OPTIONS[key]]
    : [...PASSING_CHORD_DEFAULT_OPTIONS];
}

function getChordVariantOptions(chordName) {
  const chordRoot = getChordRootName(chordName);
  return chordRoot && CHORD_VARIANTS[chordRoot] ? [...CHORD_VARIANTS[chordRoot]] : [];
}

function isChordSpan(spanIndex) {
  return Number.isInteger(spanIndex) && spanIndex >= 0 && spanIndex < BEATS_PER_BAR;
}

function getChordSpanStep(spanIndex) {
  if (!isChordSpan(spanIndex)) return null;
  return spanIndex * CHORD_SPAN;
}

function createChordCell(root) {
  const definition = getChordDefinition(root);
  if (!definition) return null;
  const tonePitches = normalizeChordTonePitches(definition.tonePitches);

  return {
    type: 'chord',
    root: definition.root,
    chordRoot: definition.chordRoot,
    quality: definition.quality,
    label: root,
    toneRoots: [...definition.toneRoots],
    ...(tonePitches.length ? { tonePitches } : {}),
  };
}

function toggleChordCell(cell, root) {
  if (!isChordName(root)) return null;
  if (cell?.type === 'chord' && cell.label === root) return null;

  const nextCell = createChordCell(root);
  const addedNotes = getChordCellNotes(cell);
  return addedNotes.length ? { ...nextCell, addedNotes } : nextCell;
}

function normalizeChordNotes(notes) {
  if (!Array.isArray(notes)) return [];

  return notes.reduce((uniqueNotes, note) => {
    if (isChordNoteLabel(note) && !uniqueNotes.includes(note)) uniqueNotes.push(note);
    return uniqueNotes;
  }, []);
}

function createChordNotesCell(notes) {
  const normalizedNotes = normalizeChordNotes(notes);
  if (!normalizedNotes.length) return null;

  return {
    type: 'notes',
    notes: normalizedNotes,
    label: normalizedNotes.join('/'),
  };
}

function createChordNoteCell(note) {
  return createChordNotesCell([note]);
}

function getChordCellNotes(cell) {
  if (cell?.type === 'note' && isChordNoteLabel(cell.note)) return [cell.note];
  if (cell?.type === 'notes') return normalizeChordNotes(cell.notes);
  if (cell?.type === 'chord') return normalizeChordNotes(cell.addedNotes);

  return [];
}

function withChordManualNotes(cell, notes, removedTonePitches) {
  const normalizedNotes = normalizeChordNotes(notes);
  const normalizedRemovedTonePitches = normalizeRemovedTonePitches(
    removedTonePitches,
    getChordBaseTonePitches(cell),
  );
  const baseCell = { ...cell };
  delete baseCell.addedNotes;
  delete baseCell.chordStyleChordTemplateId;
  delete baseCell.chordStylePresetId;
  delete baseCell.removedTonePitches;

  return {
    ...baseCell,
    ...(normalizedNotes.length ? { addedNotes: normalizedNotes } : {}),
    ...(normalizedRemovedTonePitches.length ? { removedTonePitches: normalizedRemovedTonePitches } : {}),
  };
}

function toggleChordNoteCell(cell, note) {
  if (!isChordNoteLabel(note)) return null;

  if (cell?.type === 'chord') {
    const notePitch = getChordNotePitch(note);
    const baseTonePitches = getChordBaseTonePitches(cell);
    if (notePitch && baseTonePitches.includes(notePitch)) {
      const removedTonePitches = getChordRemovedTonePitches(cell);
      const nextRemovedTonePitches = removedTonePitches.includes(notePitch)
        ? removedTonePitches.filter((pitch) => pitch !== notePitch)
        : [...removedTonePitches, notePitch];
      const nextNotes = getChordCellNotes(cell).filter((currentNote) => (
        !doChordNotesMatch(currentNote, notePitch)
      ));

      return withChordManualNotes(cell, nextNotes, nextRemovedTonePitches);
    }
  }

  const currentNotes = getChordCellNotes(cell);
  const nextNotes = currentNotes.some((currentNote) => doChordNotesMatch(currentNote, note))
    ? currentNotes.filter((currentNote) => !doChordNotesMatch(currentNote, note))
    : [...currentNotes, note];

  if (cell?.type === 'chord') return withChordManualNotes(cell, nextNotes, getChordRemovedTonePitches(cell));
  return createChordNotesCell(nextNotes);
}

function getChordToneRoots(root) {
  const definition = getChordDefinition(root);
  return definition ? [...definition.toneRoots] : [];
}

function isChordCellActive(cell, root, columnIndex = 0) {
  if (cell?.type === 'note' || cell?.type === 'notes') {
    return Number.isInteger(columnIndex)
      && getChordCellNotes(cell).some((note) => doChordNotesMatch(note, root));
  }
  if (cell?.type !== 'chord') return false;

  if (isChordGridPitch(root)) return getChordEffectiveTonePitches(cell).includes(root);
  const toneRoots = getChordEffectiveTonePitches(cell)
    .map((pitch) => getChordNoteRoot(pitch))
    .filter(Boolean);
  return toneRoots.includes(root);
}

function isChordAddedNoteActive(cell, root) {
  return getChordCellNotes(cell).some((note) => doChordNotesMatch(note, root));
}

export {
  CHORD_GRID_OCTAVES,
  CHORD_GRID_PITCHES,
  CHORD_GRID_ROOTS,
  DEFAULT_CHORD_GRID_OCTAVE,
  DIATONIC_CHORD_OPTIONS,
  PASSING_CHORD_DEFAULT_OPTIONS,
  PASSING_CHORD_OPTIONS,
  CHORD_TEMPLATES,
  CHORD_VARIANTS,
  CHORD_ROOTS,
  createChordCell,
  createChordNoteCell,
  createChordNotesCell,
  createPassingChordCell,
  createPassingChordTonePitches,
  createChordTonePitches,
  getChordDefinition,
  getChordCellNotes,
  getChordEffectiveTonePitches,
  getChordRemovedTonePitches,
  getDoowopPassingTargetChord,
  getChordNoteOctave,
  getChordNotePitch,
  getChordRootName,
  getChordToneRoots,
  getChordVariantOptions,
  getPassingChordOptions,
  getChordSpanStep,
  isChordAddedNoteActive,
  isChordCellActive,
  isChordGridPitch,
  isChordName,
  isPassingChordCell,
  isChordRoot,
  isChordSpan,
  toggleChordCell,
  toggleChordNoteCell,
};
