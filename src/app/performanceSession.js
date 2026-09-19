import { PERFORMANCE_TRACKS as TRACKS, emptySelection, performanceTemplates, createPerformanceMatrix, normalizePerformanceBpm, performanceStorageKey } from './performanceModel.js';
import { MAX_PROJECT_BARS } from '../domain/projectLength.js';

export const SESSION_VERSION = 4;
export const MAIN_PHRASE_SLOTS = 10;
export const TRANSITION_PHRASE_SLOTS = 4;
export const clone = (value) => structuredClone(value);
const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const TIMBRE_OPTIONS = {
  drums: ['soft-electronic-kit', 'dusty-tape-kit', 'clean-digital-kit'],
  chord: ['warm-electric-piano', 'muted-rhodes', 'glass-electric-keys'],
  bass: ['round-electric-bass', 'soft-sub-bass', 'fm-round-bass'],
  melody: ['airy-synth-lead', 'hazy-bell-lead', 'soft-pluck-lead'],
};
export const defaultTimbres = () => Object.fromEntries(TRACKS.map((id) => [id, TIMBRE_OPTIONS[id][0]]));
export const sessionKey = (genre, profile) => `arranger-performance:v4:${profile ?? genre}`;
export function createSection(kind = 'main', number = 1, timbres = defaultTimbres()) {
  return { id: uid(), name: `${kind === 'transition' ? '转场' : '段落'} ${number}`, kind, selection: emptySelection(), timbres: { ...timbres } };
}
export function nextSectionNumber(sections, kind) {
  const prefix = kind === 'transition' ? '转场' : '段落';
  return Math.max(0, ...sections.filter((s) => s.kind === kind).map((s) => {
    const match = s.name.match(new RegExp(`^${prefix}\\s*(\\d+)$`));
    return match ? Number(match[1]) : 0;
  })) + 1;
}
export function fixedPerformancePads(catalog) {
  return Object.fromEntries(TRACKS.map((track) => [track, Array.from({ length: MAIN_PHRASE_SLOTS + TRANSITION_PHRASE_SLOTS }, (_, i) => (
    catalog[track].filter((p) => (p.kind ?? 'main') === (i < MAIN_PHRASE_SLOTS ? 'main' : 'transition'))[i < MAIN_PHRASE_SLOTS ? i : i - MAIN_PHRASE_SLOTS] ?? null
  ))]));
}
export const EXTRA_PHRASE_PLACEHOLDERS = Array.from({ length: 10 }, (_, i) => ({ id: `placeholder-${i + 1}`, name: `Placeholder ${i + 1}` }));
export function createSession(genre, profile, bpm = 100) {
  const catalog = performanceTemplates(genre, profile);
  const timbres = defaultTimbres();
  return {
    version: SESSION_VERSION, bpm: normalizePerformanceBpm(bpm),
    pads: Object.fromEntries(TRACKS.map((track) => [track, Array.from({ length: MAIN_PHRASE_SLOTS + TRANSITION_PHRASE_SLOTS }, (_, i) => (
      catalog[track].filter((p) => (p.kind ?? 'main') === (i < MAIN_PHRASE_SLOTS ? 'main' : 'transition'))[i < MAIN_PHRASE_SLOTS ? i : i - MAIN_PHRASE_SLOTS]?.id ?? null
    ))])),
    sections: Array.from({ length: 5 }, (_, i) => createSection('main', i + 1, timbres)),
    columns: [], volumes: Object.fromEntries(TRACKS.map((id) => [id, 0])),
    mutedTracks: Object.fromEntries(TRACKS.map((id) => [id, false])),
  };
}
export function readSession(storage, genre, profile, bpm) {
  const base = createSession(genre, profile, bpm);
  try {
    const value = JSON.parse(storage?.getItem(sessionKey(genre, profile)) ?? 'null');
    if (value?.version === SESSION_VERSION && Array.isArray(value.sections) && value.sections.length && Array.isArray(value.columns)) {
      const catalog = performanceTemplates(genre, profile);
      const normalizeSection = (s, i) => ({ ...createSection(s.kind === 'transition' ? 'transition' : 'main', i + 1), ...s,
        id: typeof s.id === 'string' ? s.id : uid(), name: String(s.name || `段落 ${i + 1}`),
        selection: Object.fromEntries(TRACKS.map((t) => [t, catalog[t].some((p) => p.id === s.selection?.[t]) ? s.selection[t] : null])),
        timbres: { ...defaultTimbres(), ...s.timbres },
      });
      return { ...base, ...value, bpm: normalizePerformanceBpm(value.bpm),
        sections: value.sections.map(normalizeSection),
        pads: Object.fromEntries(TRACKS.map((t) => [t, base.pads[t].map((fallback, i) => {
          const id = value.pads?.[t]?.[i];
          if (id === null) return null;
          return catalog[t].some((p) => p.id === id && (p.kind ?? 'main') === (i < MAIN_PHRASE_SLOTS ? 'main' : 'transition')) ? id : fallback;
        })])),
        volumes: Object.fromEntries(TRACKS.map((t) => [t, Math.max(-24, Math.min(6, Number(value.volumes?.[t]) || 0))])),
        columns: value.columns.filter((c) => c && typeof c.id === 'string').map((c) => ({ ...c, name: String(c.name || '段落'),
          repeat: c.repeat === null ? null : Math.max(1, Math.floor(Number(c.repeat) || 1)),
          snapshot: validSnapshot(c.snapshot) ? c.snapshot : null,
        })),
      };
    }
  } catch { /* Try the legacy save when the new session cannot be read. */ }
  try {
    // Read old saves without deleting or rewriting their keys.
    const old = JSON.parse(storage?.getItem(performanceStorageKey(genre, profile)) ?? 'null');
    if (old?.version === 1 && Array.isArray(old.saved)) {
      base.bpm = normalizePerformanceBpm(old.bpm ?? bpm);
      base.sections = base.sections.map((s, i) => ({ ...s, selection: Object.fromEntries(TRACKS.map((t) => [t,
        performanceTemplates(genre, profile)[t].some((p) => p.id === old.saved[i]?.[t]) ? old.saved[i][t] : null,
      ])) }));
    }
  } catch { /* A damaged or unavailable save never prevents opening the workspace. */ }
  return base;
}
export function writeSession(storage, genre, profile, session) {
  try { if (!storage) return false; storage.setItem(sessionKey(genre, profile), JSON.stringify(session)); return true; }
  catch { return false; }
}
export function validSnapshot(s) {
  return s && Number.isInteger(s.totalBars) && s.totalBars > 0 && s.totalBars <= MAX_PROJECT_BARS
    && TRACKS.every((t) => Array.isArray(s.matrix?.[t]) && s.matrix[t].length === s.totalBars
      && s.matrix[t].every((bar) => Array.isArray(bar) && bar.length === 16));
}
export function snapshotSection(section, genre, profile) {
  const catalog = performanceTemplates(genre, profile);
  const selected = TRACKS.map((t) => catalog[t].find((p) => p.id === section.selection[t]));
  if (!selected.some(Boolean)) return null;
  let matrix = createPerformanceMatrix(section.selection, genre, profile);
  const totalBars = Math.max(section.kind === 'transition' ? 1 : 2, ...selected.map((p) => p?.barCount ?? (p ? 2 : 0)));
  matrix = Object.fromEntries(TRACKS.map((t) => [t, Array.from({ length: totalBars }, (_, b) => clone(matrix[t][b % matrix[t].length]))]));
  for (const t of TRACKS) for (const bar of matrix[t]) for (const cell of bar) {
    if (!cell) continue;
    cell.requestedTimbreId = section.timbres[t];
    // Placeholder choice stays intact; real sample banks can be bound later.
  }
  return { id: section.id, name: section.name, kind: section.kind, matrix, totalBars, timbres: { ...section.timbres },
    phraseNames: Object.fromEntries(TRACKS.map((t, i) => [t, selected[i]?.name ?? '静音'])),
    phraseBars: Object.fromEntries(TRACKS.map((t, i) => [t, selected[i]?.barCount ?? 2])),
  };
}
export function createSessionEditor(initial) {
  let state = { session: clone(initial), drafts: Object.fromEntries(initial.sections.map((s) => [s.id, clone(s)])), editingId: initial.sections[0].id };
  const listeners = new Set();
  const update = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); return state; };
  const sessionPatch = (patch) => update({ session: { ...state.session, ...patch } });
  return {
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state,
    select: (id) => state.drafts[id] && update({ editingId: id }),
    edit: (patch) => update({ drafts: { ...state.drafts, [state.editingId]: { ...state.drafts[state.editingId], ...patch } } }),
    save() { return sessionPatch({ sections: state.session.sections.map((s) => s.id === state.editingId ? clone(state.drafts[s.id]) : s) }); },
    add(kind) {
      const s = createSection(kind, nextSectionNumber(Object.values(state.drafts), kind), state.drafts[state.editingId]?.timbres);
      return update({ session: { ...state.session, sections: [...state.session.sections, s] }, drafts: { ...state.drafts, [s.id]: clone(s) }, editingId: s.id });
    },
    remove(id) {
      if (state.session.sections.length <= 1) return state;
      const sections = state.session.sections.filter((s) => s.id !== id);
      const drafts = { ...state.drafts }; delete drafts[id];
      return update({ session: { ...state.session, sections }, drafts, editingId: state.editingId === id ? sections[0].id : state.editingId });
    },
    patch: sessionPatch,
    columns(columns) { return sessionPatch({ columns: clone(columns) }); },
  };
}
