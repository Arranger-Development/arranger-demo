const DEFAULT_MELODY_TIMBRE_ID = 'piano';

const MELODY_SAMPLE_OCTAVES = Object.freeze([2, 3, 4]);
const NATURAL_SAMPLE_ROOTS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
const BLUES_SAMPLE_ROOTS = Object.freeze(['C', 'D', 'D#', 'E', 'G', 'A']);

function createSampleFiles({ roots, createFile, noteOctaveOffset = 0 }) {
  return Object.freeze(Object.fromEntries(
    MELODY_SAMPLE_OCTAVES.flatMap((octave) => roots.map((root) => {
      const note = `${root}${octave + noteOctaveOffset}`;
      return [note, createFile(root, octave)];
    })),
  ));
}

const MELODY_TIMBRES = Object.freeze({
  piano: Object.freeze({
    id: 'piano',
    label: 'Piano',
    detail: '原始钢琴音色',
    tag: '默认',
    gainDb: 0,
    sampleFiles: createSampleFiles({
      roots: NATURAL_SAMPLE_ROOTS,
      createFile: (root, octave) => `samples/Melody/Melody_${root}${octave}_v0.22.wav`,
    }),
  }),
  yangqin: Object.freeze({
    id: 'yangqin',
    label: 'Yangqin · 扬琴',
    detail: '清晰的敲弦颗粒与自然尾音',
    tag: '',
    gainDb: -1,
    sampleFiles: createSampleFiles({
      roots: NATURAL_SAMPLE_ROOTS,
      createFile: (root, octave) => `samples/Melody/Yangqin/Yangqin_${root}${octave}.wav`,
      noteOctaveOffset: 1,
    }),
  }),
  blues: Object.freeze({
    id: 'blues',
    label: 'Blues Lead · 布鲁斯主奏',
    detail: '短促、直接的布鲁斯主奏音色',
    tag: '',
    gainDb: -3,
    sampleFiles: createSampleFiles({
      roots: BLUES_SAMPLE_ROOTS,
      createFile: (root, octave) => (
        `samples/Melody/Blues/Blues_${root === 'D#' ? 'DSharp' : root}${octave}.wav`
      ),
      noteOctaveOffset: 1,
    }),
  }),
});

const MELODY_TIMBRE_IDS = Object.freeze(Object.keys(MELODY_TIMBRES));

function getMelodyTimbre(timbreId) {
  return MELODY_TIMBRES[timbreId] ?? MELODY_TIMBRES[DEFAULT_MELODY_TIMBRE_ID];
}

function normalizeMelodyTimbreId(timbreId) {
  return MELODY_TIMBRES[timbreId]?.id ?? DEFAULT_MELODY_TIMBRE_ID;
}

export {
  DEFAULT_MELODY_TIMBRE_ID,
  getMelodyTimbre,
  MELODY_SAMPLE_OCTAVES,
  MELODY_TIMBRE_IDS,
  MELODY_TIMBRES,
  normalizeMelodyTimbreId,
};
