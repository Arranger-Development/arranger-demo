import { PERFORMANCE_TRACKS as TRACKS } from './performanceModel.js';
import { createJamProjects } from './jamProjects.js';
import { snapshotSection, defaultTimbres, TIMBRE_OPTIONS } from './performanceSession.js';
import { withPerformanceTimbre } from '../data/performanceTimbres.js';
import { normalizeBpm } from '../domain/bpm.js';
import { createClipRecord } from '../domain/clipHelpers.js';
import { MAX_PROJECT_BARS } from '../domain/projectLength.js';

const copy = value => structuredClone(value);
const uid = () => globalThis.crypto.randomUUID();
const byTrack = make => Object.fromEntries(TRACKS.map(t => [t, make(t)]));
export const jamTemplateProjectsKey = (genre, profile) => `arranger-jam-projects:v2:${profile ?? genre}`;
export function validTemplate(template) {
  return TRACKS.includes(template?.trackId) && typeof template.id === 'string'
    && Array.isArray(template.bars) && template.bars.length > 0 && template.bars.length <= MAX_PROJECT_BARS
    && template.bars.every(bar => Array.isArray(bar) && bar.length === 16);
}
const workspace = bpm => ({ bpm: normalizeBpm(bpm), templates: byTrack(() => []), selection: byTrack(() => null),
  volumes: byTrack(() => 0), mutedTracks: byTrack(() => false), timbres: byTrack(() => null), draft: null, draftsByTrack: {} });
export function createJamTemplateProjects(storage, genre, profile, bpm = 100) {
  const key = jamTemplateProjectsKey(genre, profile), listeners = new Set();
  let unreadable = false, state;
  const makeProject = (name, tempo) => ({ id: uid(), name, genreId: genre, profileId: profile, workspace: workspace(tempo), arpNotes: ['C4', 'E4', 'G4'] });
  try {
    const text = storage?.getItem(key);
    if (text) {
      const value = JSON.parse(text);
      if (value.version !== 2 || !Array.isArray(value.projects) || !value.projects.length) throw new Error('Invalid template projects');
      const ids = new Set();
      for (const p of value.projects) {
        if (!p.id || ids.has(p.id) || !p.workspace?.templates) throw new Error('Invalid project');
        ids.add(p.id);
        for (const t of TRACKS) if (!Array.isArray(p.workspace.templates[t]) || !p.workspace.templates[t].every(x => validTemplate(x) && x.trackId === t)) throw new Error('Invalid templates');
        p.workspace = { ...workspace(bpm), ...p.workspace, bpm: normalizeBpm(p.workspace.bpm) };
        p.workspace.timbres = byTrack(t => TIMBRE_OPTIONS[t].includes(p.workspace.timbres?.[t]) ? p.workspace.timbres[t] : null);
        p.workspace.draftsByTrack ??= {};
        if (TRACKS.includes(p.workspace.draft?.trackId) && !p.workspace.draftsByTrack[p.workspace.draft.trackId]) {
          p.workspace.draftsByTrack = { ...p.workspace.draftsByTrack, [p.workspace.draft.trackId]: p.workspace.draft };
        }
        for (const t of TRACKS) if (!p.workspace.templates[t].some(x => x.id === p.workspace.selection[t])) p.workspace.selection[t] = null;
      }
      state = { ...value, activeId: ids.has(value.activeId) ? value.activeId : value.projects[0].id };
    }
  } catch { unreadable = true; }
  if (!state) {
    const old = createJamProjects(storage, genre, profile, bpm).getSnapshot();
    const projects = old.projects.map(p => {
      const next = { ...makeProject(p.name, p.workspace.session.bpm), id: p.id, arpNotes: p.arpNotes };
      const seen = byTrack(() => new Map());
      for (const section of p.workspace.session.sections) {
        const snap = snapshotSection(p.workspace.drafts[section.id] ?? section, genre, profile);
        if (!snap) continue;
        for (const t of TRACKS) {
          if (!section.selection[t]) continue;
          const bars = snap.matrix[t].slice(0, snap.phraseBars[t]);
          const signature = JSON.stringify([bars, snap.timbres[t]]);
          let id = seen[t].get(signature);
          if (!id) {
            id = uid(); seen[t].set(signature, id);
            next.workspace.templates[t].push({ id, trackId: t, name: `${section.name} · ${snap.phraseNames[t]}`,
              bars, barCount: bars.length, timbreId: snap.timbres[t], sourcePresetId: section.selection[t] });
          }
          next.workspace.selection[t] = id;
        }
      }
      next.workspace.volumes = { ...p.workspace.session.volumes };
      next.workspace.mutedTracks = { ...p.workspace.session.mutedTracks };
      return next;
    });
    state = { version: 2, activeId: old.activeId, projects };
  }
  const current = () => state.projects.find(p => p.id === state.activeId);
  function commit(next, retainOnFailure = true) {
    let error;
    try {
      if (!storage || unreadable) throw new Error('Storage unavailable');
      storage.setItem(key, JSON.stringify({ version: 2, activeId: next.activeId, projects: next.projects }));
    } catch { error = '项目保存失败，当前内容已保留，请检查浏览器存储后重试。'; }
    state = { ...(error && !retainOnFailure ? state : next), error }; listeners.forEach(fn => fn()); return !error;
  }
  function patch(value) {
    return commit({ ...state, projects: state.projects.map(p => p.id === state.activeId ? { ...p, workspace: { ...p.workspace, ...copy(value) } } : p) });
  }
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state, current,
    initialize: () => commit(state), save: () => commit(state), patch,
    setDraft(draft) {
      if (!TRACKS.includes(draft?.trackId)) return false;
      return patch({ draft, draftsByTrack: { ...current().workspace.draftsByTrack, [draft.trackId]: draft } });
    },
    setTimbre(t, timbreId) {
      if (!TIMBRE_OPTIONS[t]?.includes(timbreId)) return false;
      return patch({timbres:{...current().workspace.timbres,[t]:timbreId}});
    },
    saveTemplate(draft, name, id = null) {
      const t = draft.trackId;
      if (!TRACKS.includes(t) || !draft.bars?.some(bar => bar.some(Boolean))) return null;
      const label = {drums:'鼓',chord:'和弦',bass:'贝斯',melody:'旋律'}[t];
      const names = new Set(current().workspace.templates[t].map(p => p.name));
      let number = 1;
      while (names.has(`${label}${number}`)) number++;
      const template = { ...copy(draft), timbreId:current().workspace.timbres?.[t] ?? draft.timbreId, id: id ?? uid(), name: name.trim() || `${label}${number}`, barCount: draft.bars.length };
      if (!validTemplate(template)) return null;
      const before = current().workspace.templates;
      const templates = copy(before);
      const at = templates[t].findIndex(p => p.id === template.id);
      if (at >= 0) templates[t][at] = template; else templates[t].push(template);
      if (!patch({ templates })) {
        state = { ...state, projects: state.projects.map(p => p.id === state.activeId ? { ...p, workspace: { ...p.workspace, templates: before } } : p) };
        listeners.forEach(fn => fn()); return null;
      }
      return template;
    },
    removeTemplate(t, id) {
      const w = current().workspace;
      const detach = draft => draft?.editingTemplateId === id ? {...draft,editingTemplateId:undefined,dirty:true} : draft;
      return patch({ templates: { ...w.templates, [t]: w.templates[t].filter(p => p.id !== id) },
        selection: { ...w.selection, [t]: w.selection[t] === id ? null : w.selection[t] },
        draft:detach(w.draft), draftsByTrack:{...w.draftsByTrack,[t]:detach(w.draftsByTrack?.[t])} });
    },
    renameTemplate(t, id, name) {
      const w = current().workspace, nextName = name.trim().slice(0,80);
      if (!nextName) return true;
      const rename = draft => draft?.editingTemplateId === id ? {...draft,name:nextName} : draft;
      return patch({ templates: { ...w.templates, [t]: w.templates[t].map(p => p.id === id ? { ...p,name:nextName } : p) },
        draft:rename(w.draft), draftsByTrack:{...w.draftsByTrack,[t]:rename(w.draftsByTrack?.[t])} });
    },
    switchTo(id) { return state.projects.some(p => p.id === id) && commit({ ...state, activeId: id }, false); },
    create() {
      const p = makeProject(`项目 ${state.projects.length + 1}`, current().workspace.bpm);
      return commit({ ...state, activeId: p.id, projects: [...state.projects, p] }, false);
    },
    rename(name) { return Boolean(name.trim()) && commit({ ...state, projects: state.projects.map(p => p.id === state.activeId ? { ...p, name: name.trim().slice(0,80) } : p) }); },
    configureArp(notes) { return commit({ ...state, projects: state.projects.map(p => p.id === state.activeId ? { ...p, arpNotes: copy(notes) } : p) }); },
  };
}
const cachedStores = new Map();
export function getJamTemplateProjects(genre, profile, bpm) {
  let storage; try { storage = globalThis.localStorage; } catch { /* In-memory session remains usable. */ }
  try {
    const active = JSON.parse(storage?.getItem('arranger-jam-active-context:v1') ?? 'null');
    if (typeof active?.genre === 'string') { genre = active.genre; profile = active.profile ?? null; }
  } catch { /* Ignore a malformed context pointer without touching the project library. */ }
  const key = jamTemplateProjectsKey(genre, profile);
  if (!cachedStores.has(key)) {
    const store = createJamTemplateProjects(storage, genre, profile, bpm);
    const initialize = store.initialize;
    store.initialize = () => {
      const ok = initialize();
      if (ok) { try { storage.setItem('arranger-jam-active-context:v1', JSON.stringify({ genre, profile })); } catch { /* Project save already reports storage failures. */ } }
      return ok;
    };
    cachedStores.set(key, store);
  }
  return cachedStores.get(key);
}
export function selectedJamTemplates(w, override = null) {
  return byTrack(t => override?.trackId === t ? override : w.templates[t].find(p => p.id === w.selection[t]) ?? null);
}
function setTemplateTimbre(cell, track, id) {
  cell.requestedTimbreId = id;
  const resolved = withPerformanceTimbre({ type:track },id);
  if (resolved.timbreId) cell.timbreId = resolved.timbreId;
  else if (track === 'drums' || track === 'bass') delete cell.timbreId;
  else { cell.timbreId = 'piano'; cell.playbackMode = 'natural'; }
  if (resolved.playbackMode) cell.playbackMode = resolved.playbackMode;
}
export function jamCombinationSnapshot(w, override = null, solo = false) {
  const selected = selectedJamTemplates(w, override);
  if (solo) for (const t of TRACKS) if (t !== override?.trackId) selected[t] = null;
  if (!Object.values(selected).some(Boolean)) return null;
  const gcd = (a,b) => b ? gcd(b,a%b) : a;
  const totalBars = Object.values(selected).reduce((length,p) => length * (p?.bars.length ?? 1) / gcd(length,p?.bars.length ?? 1),1);
  // Long, uneven legacy phrases can have an enormous common cycle. Keep their
  // individual loops compact rather than allocating that entire cycle.
  const phraseBars = totalBars > MAX_PROJECT_BARS ? byTrack(t => selected[t]?.bars.length ?? 1) : null;
  const matrix = byTrack(t => Array.from({ length: phraseBars?.[t] ?? totalBars }, (_, b) => copy(selected[t]?.bars[b % selected[t].bars.length] ?? Array(16).fill(null))));
  const timbres = byTrack(t => w.timbres?.[t] ?? selected[t]?.timbreId ?? defaultTimbres()[t]);
  for (const t of TRACKS) for (const bar of matrix[t]) for (const cell of bar) if (cell) setTemplateTimbre(cell,t,timbres[t]);
  return { id: 'jam-current-combination', matrix, totalBars, ...(phraseBars ? { phraseBars } : {}), repeat: null, kind: 'main', timbres, phraseIds: byTrack(t => selected[t]?.id ?? 'draft') };
}
export function applyUserTemplate(state, template, startBar, trackId = template.trackId) {
  if (!validTemplate(template) || startBar + template.bars.length > MAX_PROJECT_BARS) throw new Error(`模板超出${MAX_PROJECT_BARS}小节上限`);
  const totalBars = Math.max(state.totalBars ?? 8, startBar + template.bars.length);
  const matrix = Object.fromEntries(Object.entries(state.matrix).map(([t, bars]) => [t, Array.from({ length: totalBars }, (_, b) => copy(bars[b] ?? Array(16).fill(null)))]));
  matrix[trackId] ??= Array.from({ length: totalBars }, () => Array(16).fill(null));
  const clips = copy(state.clips);
  template.bars.forEach((bar, i) => {
    const b = startBar + i;
    matrix[trackId][b] = copy(bar);
    for (const cell of matrix[trackId][b]) if (cell) setTemplateTimbre(cell,template.trackId,template.timbreId);
    const clip = { ...createClipRecord(trackId, b), name: template.name, customName: true, requestedTimbreId: template.timbreId,
      ...(template.trackId === 'chord' ? { editorMode: 'notes' } : {}) };
    if (!clips.ids.includes(clip.id)) clips.ids.push(clip.id);
    clips.byId[clip.id] = clip;
  });
  return { matrix, clips, totalBars, selectedClipId: createClipRecord(trackId, startBar).id, activeTrackId: trackId, selectedBar: startBar };
}
