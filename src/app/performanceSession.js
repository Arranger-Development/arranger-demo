import { DEEP_AUTUMN_DRUMS, DEEP_AUTUMN_CHORD, withPerformanceTimbre } from '../data/performanceTimbres.js';
import { UNDO_HISTORY_LIMIT } from './undoHistory.js';
import { PERFORMANCE_TRACKS as TRACKS, emptySelection, performanceTemplates, createPerformanceMatrix, normalizePerformanceBpm, performanceStorageKey, hasSelection } from './performanceModel.js';
import { createDefaultTrackState } from '../domain/trackInstances.js';
import { createClipRecord } from '../domain/clipHelpers.js';
import { MAX_PROJECT_BARS } from '../domain/projectLength.js';

export const SESSION_VERSION = 4;
export const MAIN_PHRASE_SLOTS = 6;
export const TRANSITION_PHRASE_SLOTS = 2;
export const clone = (value) => structuredClone(value);
const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const TIMBRE_OPTIONS = {
  drums: ['soft-electronic-kit', DEEP_AUTUMN_DRUMS],
  chord: ['warm-electric-piano', DEEP_AUTUMN_CHORD],
  bass: ['round-electric-bass', 'soft-sub-bass', 'fm-round-bass'],
  melody: ['airy-synth-lead', 'hazy-bell-lead', 'soft-pluck-lead'],
};
export const defaultTimbres = () => Object.fromEntries(TRACKS.map((id) => [id, TIMBRE_OPTIONS[id][0]]));
export const sessionKey = (genre, profile) => `arranger-performance:v4:${profile ?? genre}`;
export function createForm(preset = 'screenshot') {
  return (preset === 'blank' ? [] : [['前奏', 2], ['主歌1', 2], ['主歌2', 2], ['转场1', 1], ['副歌', 2], ['桥段', 1], ['副歌', null], ['结尾', 4]])
    .map(([name, repeat]) => ({ id: uid(), name, repeat, snapshot: null }));
}
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
    columns: createForm(), volumes: Object.fromEntries(TRACKS.map((id) => [id, 0])),
    mutedTracks: Object.fromEntries(TRACKS.map((id) => [id, recommendation ? !recommendation.selectedTrackIds.includes(id) : false])),
  };
}
export function readSession(storage, genre, profile, bpm, recommendation) {
  const base = createSession(genre, profile, bpm, recommendation);
  try {
    const value = JSON.parse(storage?.getItem(sessionKey(genre, profile)) ?? 'null');
    if (value?.version === SESSION_VERSION && Array.isArray(value.sections) && Array.isArray(value.columns)) {
      const catalog = performanceTemplates(genre, profile);
      const normalizeSection = (s, i) => ({ ...createSection(s.kind === 'transition' ? 'transition' : 'main', i + 1), ...s,
        id: typeof s.id === 'string' ? s.id : uid(), name: String(s.name || `段落 ${i + 1}`),
        selection: Object.fromEntries(TRACKS.map((t) => [t, catalog[t].some((p) => p.id === s.selection?.[t]) ? s.selection[t] : null])),
        timbres: { ...defaultTimbres(), ...s.timbres },
      });
      return { ...base, ...value, bpm: normalizePerformanceBpm(value.bpm),
        sections: value.sections.map(normalizeSection).filter((s) => hasSelection(s.selection)),
        pads: normalizePadBindings(catalog, value.pads),
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
      base.sections = old.saved.map((_, i) => ({ ...createSection('main', i + 1), selection: Object.fromEntries(TRACKS.map((t) => [t,
        performanceTemplates(genre, profile)[t].some((p) => p.id === old.saved[i]?.[t]) ? old.saved[i][t] : null,
      ])) })).filter((s) => hasSelection(s.selection));
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

export function replaceLiveColumnTrack(column, track, templateId, genre, profile) {
  if (!TRACKS.includes(track) || !performanceTemplates(genre, profile)[track].some((p) => p.id === templateId)) return column;
  const previous = validSnapshot(column.snapshot) ? column.snapshot : null;
  const replacement = snapshotSection({
    id: previous?.id ?? column.id, name: previous?.name ?? column.name,
    kind: previous?.kind ?? 'main', timbres: { ...defaultTimbres(), ...previous?.timbres },
    selection: { ...emptySelection(), [track]: templateId },
  }, genre, profile);
  const next = clone(previous ?? replacement);
  next.matrix[track] = replacement.matrix[track];
  next.phraseNames[track] = replacement.phraseNames[track];
  next.phraseBars[track] = replacement.phraseBars[track];
  next.timbres[track] = replacement.timbres[track];

  // Keep each untouched track's stored notes, including rests and timbre metadata.
  // Only repeat/crop its existing phrase when the longest phrase changes the cycle.
  const lengths = Object.fromEntries(TRACKS.map((t) => [t,
    Math.min(next.matrix[t].length, Math.max(1, next.phraseBars[t] ?? next.matrix[t].length)),
  ]));
  next.totalBars = Math.max(next.kind === 'transition' ? 1 : 2, ...TRACKS.map((t) => (
    next.matrix[t].some((bar) => bar.some(Boolean)) ? lengths[t] : 0
  )));
  next.matrix = Object.fromEntries(TRACKS.map((t) => [t,
    Array.from({ length: next.totalBars }, (_, bar) => clone(next.matrix[t][bar % lengths[t]])),
  ]));
  const result = { ...column, snapshot: next };
  return JSON.stringify(result) === JSON.stringify(column) ? column : result;
}

export function resolveLiveColumns(columns, counts = {}) {
  return columns.filter((c) => validSnapshot(c.snapshot)).map((c) => {
    const repeat = c.repeat === null ? Number(counts[c.id]) : c.repeat;
    if (!Number.isSafeInteger(repeat) || repeat < 1) throw new Error(`请填写「${c.name}」的有限循环次数。`);
    return { ...c, repeat };
  });
}
export function liveExportLength(columns, counts) {
  return resolveLiveColumns(columns, counts).reduce((n, c) => n + c.snapshot.totalBars * c.repeat, 0);
}
export function createLiveImport(session, counts = {}) {
  const columns = resolveLiveColumns(session.columns, counts);
  const totalBars = liveExportLength(session.columns, counts);
  if (!totalBars) throw new Error('请先将已保存段落放入曲式。');
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
    editingId: NEW_COMBINATION_ID, liveUndo: [], liveRedo: [], livePosition: null };
  const listeners = new Set();
  const update = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()); return state; };
  const sessionPatch = (patch) => update({ session: { ...state.session, ...patch } });
  let transaction = null;
  const capture = (position = state.livePosition) => clone({
    columns: state.session.columns, bpm: state.session.bpm, volumes: state.session.volumes,
    mutedTracks: state.session.mutedTracks, position,
  });
  const changed = (a, b) => ['columns', 'bpm', 'volumes', 'mutedTracks'].some(key => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
  const checkpoint = (before) => {
    if (!changed(before, capture())) return state;
    return update({ liveUndo: [...state.liveUndo, before].slice(-UNDO_HISTORY_LIMIT), liveRedo: [] });
  };
  const commitLiveEdit = () => {
    const before = transaction; transaction = null;
    return before ? checkpoint(before) : state;
  };
  const editLive = (patch, position = state.livePosition) => {
    const before = capture(position);
    sessionPatch(clone(patch));
    if (!transaction) checkpoint(before);
    return state;
  };
  const restore = (snapshot) => {
    const { position, ...patch } = clone(snapshot);
    return update({ session: { ...state.session, ...patch }, livePosition: position });
  };
  const patchOutsideLive = (patch) => {
    commitLiveEdit();
    const previous = state.session;
    const session = { ...previous, ...clone(patch) };
    // Modal edits are not Live operations. Rebase both history branches so a
    // later undo/redo cannot restore a shared value from before the modal edit.
    const rebase = (snapshot) => {
      const next = clone(snapshot);
      for (const key of ['columns', 'bpm']) {
        if (JSON.stringify(previous[key]) !== JSON.stringify(session[key])) next[key] = clone(session[key]);
      }
      for (const key of ['volumes', 'mutedTracks']) {
        for (const track of TRACKS) {
          if (previous[key][track] !== session[key][track]) next[key][track] = session[key][track];
        }
      }
      return next;
    };
    const rebaseHistory = (history) => {
      let adjacent = session;
      return history.map(rebase).reverse().filter((snapshot) => {
        if (!changed(snapshot, adjacent)) return false;
        adjacent = snapshot;
        return true;
      }).reverse();
    };
    return update({ session, liveUndo: rebaseHistory(state.liveUndo), liveRedo: rebaseHistory(state.liveRedo) });
  };
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
      const saved = { ...clone(draft), kind, id: existing?.id ?? uid(),
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
    patch: patchOutsideLive,
    beginLiveEdit(position) { if (!transaction) transaction = capture(position); },
    commitLiveEdit,
    editLive,
    columns(columns, position) { return editLive({ columns }, position); },
    undoLive(position = state.livePosition) {
      commitLiveEdit();
      if (!state.liveUndo.length) return state;
      const before = state.liveUndo.at(-1); const current = capture(position);
      update({ liveUndo: state.liveUndo.slice(0, -1), liveRedo: [...state.liveRedo, current].slice(-UNDO_HISTORY_LIMIT) });
      return restore(before);
    },
    redoLive(position = state.livePosition) {
      commitLiveEdit();
      if (!state.liveRedo.length) return state;
      const after = state.liveRedo.at(-1); const current = capture(position);
      update({ liveRedo: state.liveRedo.slice(0, -1), liveUndo: [...state.liveUndo, current].slice(-UNDO_HISTORY_LIMIT) });
      return restore(after);
    },
  };
}
