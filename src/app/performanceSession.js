import { DEEP_AUTUMN_DRUMS, DEEP_AUTUMN_CHORD, DEEP_AUTUMN_BASS, DEEP_AUTUMN_MELODY, withPerformanceTimbre } from '../data/performanceTimbres.js';
import { PERFORMANCE_TRACKS as TRACKS, emptySelection, performanceTemplates, createPerformanceMatrix, normalizePerformanceBpm, performanceStorageKey, hasSelection } from './performanceModel.js';
import { createDefaultTrackState } from '../domain/trackInstances.js';
import { createClipRecord } from '../domain/clipHelpers.js';
import { insertLoop, loopRepeat } from './loopOrder.js';
import { MAX_PROJECT_BARS } from '../domain/projectLength.js';

export const SESSION_VERSION = 4;
export const MAIN_PHRASE_SLOTS = 6;
export const TRANSITION_PHRASE_SLOTS = 2;
export const clone = (value) => structuredClone(value);
const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const TIMBRE_OPTIONS = {
  drums: ['soft-electronic-kit', DEEP_AUTUMN_DRUMS],
  chord: ['warm-electric-piano', DEEP_AUTUMN_CHORD],
  bass: ['round-electric-bass', DEEP_AUTUMN_BASS],
  melody: ['airy-synth-lead', DEEP_AUTUMN_MELODY],
};
export const defaultTimbres = () => Object.fromEntries(TRACKS.map((id) => [id, TIMBRE_OPTIONS[id][0]]));
export const sessionKey = (genre, profile) => `arranger-performance:v4:${profile ?? genre}`;
export function createSection(kind = 'main', number = 1, timbres = defaultTimbres()) {
  return { id: uid(), name: `${kind === 'transition' ? '转场' : '段落'} ${number}`, kind, repeat: kind === 'transition' ? 1 : null, selection: emptySelection(), timbres: { ...timbres } };
}
export function nextSectionNumber(sections, kind) {
  const prefix = kind === 'transition' ? '转场' : '段落';
  return Math.max(0, ...sections.filter((s) => s.kind === kind).map((s) => {
    const match = s.name.match(new RegExp(`^${prefix}\\s*(\\d+)$`));
    return match ? Number(match[1]) : 0;
  })) + 1;
}
export function fixedPerformancePads(catalog, bindings) {
  return Object.fromEntries(TRACKS.map((track) => [track, Array.from({ length: MAIN_PHRASE_SLOTS + TRANSITION_PHRASE_SLOTS }, (_, i) => (
    bindings ? catalog[track].find((p) => p.id === bindings[track]?.[i]) ?? null
      : catalog[track].filter((p) => (p.kind ?? 'main') === (i < MAIN_PHRASE_SLOTS ? 'main' : 'transition'))[i < MAIN_PHRASE_SLOTS ? i : i - MAIN_PHRASE_SLOTS] ?? null
  ))]));
}
export function normalizePadBindings(catalog, bindings) {
  const defaults = fixedPerformancePads(catalog);
  return Object.fromEntries(TRACKS.map((track) => [track, defaults[track].map((fallback, index) => {
    // v4 previously stored ten main slots followed by four transition slots.
    const sourceIndex = bindings?.[track]?.length === 14 && index >= MAIN_PHRASE_SLOTS ? index - MAIN_PHRASE_SLOTS + 10 : index;
    const id = bindings?.[track]?.[sourceIndex];
    if (id === null && bindings?.[track]?.length === 8) return null;
    const kind = index < MAIN_PHRASE_SLOTS ? 'main' : 'transition';
    return catalog[track].some((p) => p.id === id && (p.kind ?? 'main') === kind) ? id : fallback?.id ?? null;
  })]));
}
export function availablePadTemplates(catalog, bindings, track, index) {
  if (!TRACKS.includes(track) || !Number.isInteger(index) || index < 0 || index >= MAIN_PHRASE_SLOTS + TRANSITION_PHRASE_SLOTS) return [];
  const kind = index < MAIN_PHRASE_SLOTS ? 'main' : 'transition';
  const used = new Set(bindings[track]);
  return catalog[track].filter((p) => (p.kind ?? 'main') === kind && !used.has(p.id));
}
export function replacePadBinding(session, catalog, track, index, templateId) {
  if (!availablePadTemplates(catalog, session.pads, track, index).some((p) => p.id === templateId)) return session;
  return { ...session, pads: { ...session.pads, [track]: session.pads[track].map((id, i) => i === index ? templateId : id) } };
}
export const EXTRA_PHRASE_PLACEHOLDERS = Array.from({ length: 10 }, (_, i) => ({ id: `placeholder-${i + 1}`, name: `Placeholder ${i + 1}` }));
export function createSession(genre, profile, bpm = 100, recommendation) {
  const catalog = performanceTemplates(genre, profile);
  return {
    version: SESSION_VERSION, bpm: normalizePerformanceBpm(bpm),
    pads: Object.fromEntries(TRACKS.map((track) => [track, Array.from({ length: MAIN_PHRASE_SLOTS + TRANSITION_PHRASE_SLOTS }, (_, i) => (
      catalog[track].filter((p) => (p.kind ?? 'main') === (i < MAIN_PHRASE_SLOTS ? 'main' : 'transition'))[i < MAIN_PHRASE_SLOTS ? i : i - MAIN_PHRASE_SLOTS]?.id ?? null
    ))])),
    sections: [],
    volumes: Object.fromEntries(TRACKS.map((id) => [id, 0])),
    mutedTracks: Object.fromEntries(TRACKS.map((id) => [id, recommendation ? !recommendation.selectedTrackIds.includes(id) : false])),
  };
}
export function readSession(storage, genre, profile, bpm, recommendation) {
  const base = createSession(genre, profile, bpm, recommendation);
  try {
    const value = JSON.parse(storage?.getItem(sessionKey(genre, profile)) ?? 'null');
    if (value?.version === SESSION_VERSION && Array.isArray(value.sections)) {
      const catalog = performanceTemplates(genre, profile);
      const normalizeSection = (s, i) => ({ ...createSection(s.kind === 'transition' ? 'transition' : 'main', i + 1), ...s,
        id: typeof s.id === 'string' ? s.id : uid(), name: String(s.name || `段落 ${i + 1}`),
        selection: Object.fromEntries(TRACKS.map((t) => [t, catalog[t].some((p) => p.id === s.selection?.[t]) ? s.selection[t] : null])),
        timbres: { ...defaultTimbres(), ...s.timbres }, repeat: loopRepeat(s),
      });
      return { ...base, bpm: normalizePerformanceBpm(value.bpm),
        sections: value.sections.map(normalizeSection).filter((s) => hasSelection(s.selection)),
        pads: normalizePadBindings(catalog, value.pads),
        volumes: Object.fromEntries(TRACKS.map((t) => [t, Math.max(-24, Math.min(6, Number(value.volumes?.[t]) || 0))])),
        mutedTracks: { ...base.mutedTracks, ...value.mutedTracks },
      };
    }
  } catch { /* Try the legacy save when the new session cannot be read. */ }
  try {
    // Read old saves without deleting or rewriting their keys.
    const old = JSON.parse(storage?.getItem(performanceStorageKey(genre, profile)) ?? 'null');
    if (old?.version === 1 && Array.isArray(old.saved)) {
      base.bpm = normalizePerformanceBpm(old.bpm ?? bpm);
      base.sections = old.saved.map((_, i) => ({ ...createSection('main', i + 1), selection: Object.fromEntries(TRACKS.map((t) => [t,
        performanceTemplates(genre, profile)[t].some((p) => p.id === old.saved[i]?.[t]) ? old.saved[i][t] : null,
      ])) })).filter((s) => hasSelection(s.selection));
    }
  } catch { /* A damaged or unavailable save never prevents opening the workspace. */ }
  return base;
}
export function writeSession(storage, genre, profile, session) {
  try { if (!storage) return false; storage.setItem(sessionKey(genre, profile), JSON.stringify({ version: SESSION_VERSION, bpm: session.bpm, pads: session.pads, sections: session.sections, volumes: session.volumes, mutedTracks: session.mutedTracks })); return true; }
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
    // Store the effective bank too so creation's note audition uses the same sound.
    const resolved = withPerformanceTimbre({ type: t }, section.timbres[t]);
    if (resolved.timbreId) cell.timbreId = resolved.timbreId;
    if (resolved.playbackMode) cell.playbackMode = resolved.playbackMode;
  }
  return { id: section.id, name: section.name, kind: section.kind, matrix, totalBars, timbres: { ...section.timbres },
    phraseNames: Object.fromEntries(TRACKS.map((t, i) => [t, selected[i]?.name ?? '静音'])),
    phraseBars: Object.fromEntries(TRACKS.map((t, i) => [t, selected[i]?.barCount ?? 2])),
  };
}

export function resolveExportEntries(columns, counts = {}) {
  return columns.filter((c) => validSnapshot(c.snapshot)).map((c) => {
    const repeat = c.repeat === null ? Number(counts[c.id]) : c.repeat;
    if (!Number.isSafeInteger(repeat) || repeat < 1) throw new Error(`请填写「${c.name}」的有限循环次数。`);
    return { ...c, repeat };
  });
}
export function arrangementExportLength(columns, counts) {
  return resolveExportEntries(columns, counts).reduce((n, c) => n + c.snapshot.totalBars * c.repeat, 0);
}
export function createArrangementImport(session, entries, counts = {}) {
  const columns = resolveExportEntries(entries, counts);
  const totalBars = arrangementExportLength(entries, counts);
  if (!totalBars) throw new Error('请先添加已保存的 Loop。');
  if (totalBars > MAX_PROJECT_BARS) throw new Error(`编曲最多支持 ${MAX_PROJECT_BARS} 小节，当前为 ${totalBars} 小节。`);
  const matrix = Object.fromEntries(TRACKS.map((t) => [t, []]));
  const records = [];
  let bar = 0;
  for (const column of columns) for (let r = 0; r < column.repeat; r++) {
    for (let b = 0; b < column.snapshot.totalBars; b++, bar++) for (const t of TRACKS) {
      const content = clone(column.snapshot.matrix[t][b]);
      matrix[t].push(content);
      if (!content.some(Boolean)) continue;
      records.push({ ...createClipRecord(t, bar), customName: true, name: `${column.name} · ${column.snapshot.phraseNames[t]}`,
        requestedTimbreId: column.snapshot.timbres[t], ...(t === 'chord' ? { editorMode: 'notes' } : {}) });
    }
  }
  const first = records[0];
  return { ...createDefaultTrackState(), totalBars, matrix,
    clips: { ids: records.map((c) => c.id), byId: Object.fromEntries(records.map((c) => [c.id, c])) },
    bpm: session.bpm, isPlaying: false, currentBar: 0, currentStep: 0, seekBar: 0, seekStep: 0,
    selectedBar: first?.bar ?? 0, selectedClipId: first?.id ?? null, activeTrackId: first?.trackId ?? 'drums',
    visibleTrackIds: [...TRACKS], volumes: { ...session.volumes }, mutedTracks: { ...session.mutedTracks },
    melodyTimbreId: matrix.melody.flat().find((c) => c?.timbreId)?.timbreId ?? 'piano',
    melodyScaleId: 'chinese', melodyRhythmTemplateId: null,
  };
}

export const NEW_COMBINATION_ID = 'draft:new';
export function inferSectionKind(selection, catalog) {
  const selected = TRACKS.filter((track) => selection[track]);
  return selected.length && selected.every((track) => catalog[track]?.find((p) => p.id === selection[track])?.kind === 'transition') ? 'transition' : 'main';
}
export function createSessionEditor(initial, { catalog = {}, timbres } = {}) {
  const freshDraft = (sounds) => ({ ...createSection('main', 1, sounds), id: NEW_COMBINATION_ID, name: '' });
  const session = { ...clone(initial), sections: initial.sections.filter((s) => hasSelection(s.selection)).map(clone) };
  let state = { session, drafts: { ...Object.fromEntries(session.sections.map((s) => [s.id, clone(s)])),
    [NEW_COMBINATION_ID]: freshDraft({ ...defaultTimbres(), ...initial.sections[0]?.timbres, ...timbres }) },
    editingId: NEW_COMBINATION_ID };
  const listeners = new Set();
  const update = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); return state; };
  const sessionPatch = (patch) => update({ session: { ...state.session, ...patch } });
  return {
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state,
    select: (id) => state.drafts[id] && update({ editingId: id }),
    edit(patch) {
      const draft = { ...state.drafts[state.editingId], ...clone(patch) };
      draft.kind = inferSectionKind(draft.selection, catalog);
      return update({ drafts: { ...state.drafts, [state.editingId]: draft } });
    },
    save(persist = () => true) {
      const draft = state.drafts[state.editingId];
      if (!hasSelection(draft.selection)) return false;
      const existing = state.session.sections.find((s) => s.id === state.editingId);
      const kind = inferSectionKind(draft.selection, catalog);
      const automaticName = !draft.name.trim() || (existing?.kind !== kind && /^(段落|转场)\s*\d+$/.test(draft.name));
      const saved = { ...clone(draft), kind, repeat: existing ? loopRepeat(existing) : (kind === 'transition' ? 1 : null), id: existing?.id ?? uid(),
        name: automaticName ? `${kind === 'transition' ? '转场' : '段落'} ${nextSectionNumber(state.session.sections, kind)}` : draft.name.trim() };
      const sections = existing ? state.session.sections.map((s) => s.id === saved.id ? saved : s) : [...state.session.sections, saved];
      const next = { ...state.session, sections };
      if (!persist(next)) return false;
      return update({ session: next, editingId: NEW_COMBINATION_ID,
        drafts: { ...state.drafts, [saved.id]: clone(saved), [NEW_COMBINATION_ID]: freshDraft(saved.timbres) } });
    },
    rename(id, name) {
      if (!name.trim() || !state.session.sections.some((s) => s.id === id)) return state;
      return update({ session: { ...state.session, sections: state.session.sections.map((s) => s.id === id ? { ...s, name: name.trim() } : s) },
        drafts: { ...state.drafts, [id]: { ...state.drafts[id], name: name.trim() } } });
    },
    remove(id) {
      if (!state.session.sections.some((s) => s.id === id)) return state;
      const sections = state.session.sections.filter((s) => s.id !== id);
      const drafts = { ...state.drafts }; delete drafts[id];
      return update({ session: { ...state.session, sections }, drafts, editingId: state.editingId === id ? NEW_COMBINATION_ID : state.editingId });
    },
    reorder(id, targetId, side) {
      const sections = insertLoop(state.session.sections, id, targetId, side);
      return sections === state.session.sections ? state : sessionPatch({ sections });
    },
    setRepeat(id, repeat) {
      if (repeat !== null && (!Number.isSafeInteger(repeat) || repeat < 1)) return state;
      if (!state.session.sections.some(s => s.id === id)) return state;
      return update({ session: { ...state.session, sections: state.session.sections.map(s => s.id === id ? { ...s, repeat } : s) },
        drafts: { ...state.drafts, [id]: { ...state.drafts[id], repeat } } });
    },
    patch: (patch) => sessionPatch(clone(patch)),
  };
}

// Export entries are disposable snapshots; they never enter local session storage.
export function createExportEntry(section, genre, profile) {
  return { id: uid(), name: section.name, repeat: loopRepeat(section),
    snapshot: snapshotSection(section, genre, profile) };
}
