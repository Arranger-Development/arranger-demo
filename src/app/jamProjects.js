import { createSession, readSession, sessionKey, createSessionEditor, clone, NEW_COMBINATION_ID, defaultTimbres, inferSectionKind } from './performanceSession.js';
import { performanceTemplates, PERFORMANCE_TRACKS } from './performanceModel.js';
import { normalizeEffectAutomation } from './effectAutomation.js';
import { parseArpNotes } from './jamArpeggiator.js';

export const jamProjectsKey = (genre, profile) => `arranger-jam-projects:v1:${profile ?? genre}`;
const uid = () => globalThis.crypto.randomUUID();
const defaultNotes = ['C4', 'E4', 'G4'];

// A project retains unfinished drafts separately from the saved Loop library.
// Saving a project never turns an unfinished combination into a Loop.
export function createJamProjects(storage, genre, profile, bpm, recommendation) {
  const key = jamProjectsKey(genre, profile), catalog = performanceTemplates(genre, profile);
  const listeners = new Set();
  function normalizeWorkspace(value) {
    const session = readSession({ getItem: k => k === sessionKey(genre, profile) ? JSON.stringify(value?.session) : null }, genre, profile, bpm);
    const fresh = createSessionEditor(session, { catalog, timbres: value?.drafts?.[NEW_COMBINATION_ID]?.timbres }).getSnapshot();
    for (const id of Object.keys(fresh.drafts)) {
      const draft = value?.drafts?.[id];
      if (!draft || typeof draft !== 'object') continue;
      const selection = Object.fromEntries(PERFORMANCE_TRACKS.map(t => [t, catalog[t].some(p => p.id === draft.selection?.[t]) ? draft.selection[t] : null]));
      fresh.drafts[id] = { ...fresh.drafts[id], selection, kind: ['main', 'transition'].includes(draft.kind) ? draft.kind : inferSectionKind(selection, catalog),
        timbres: Object.fromEntries(PERFORMANCE_TRACKS.map(t => [t, typeof draft.timbres?.[t] === 'string' ? draft.timbres[t] : defaultTimbres()[t]])),
        effectAutomation: normalizeEffectAutomation(draft.effectAutomation) };
    }
    fresh.editingId = fresh.drafts[value?.editingId] ? value.editingId : NEW_COMBINATION_ID;
    return fresh;
  }
  function project(name, session, timbres) {
    return { id: uid(), name, updatedAt: new Date().toISOString(),
      workspace: createSessionEditor(session, { catalog, timbres }).getSnapshot(), arpNotes: [...defaultNotes] };
  }
  let state, unreadable = false;
  try {
    const text = storage?.getItem(key);
    if (text !== null && text !== undefined) {
      const saved = JSON.parse(text);
      if (saved?.version !== 1 || !saved.projects?.length || !Array.isArray(saved.projects)) throw new Error('Invalid project library');
      const ids = new Set();
      const projects = saved.projects.map(p => {
        if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || p.workspace?.session?.version !== 4 || !Array.isArray(p.workspace?.session?.sections)) throw new Error('Invalid project');
        ids.add(p.id);
        return { id: p.id, name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0,80) : '未命名项目',
          updatedAt: p.updatedAt, workspace: normalizeWorkspace(p.workspace),
          arpNotes: p.arpNotes === null ? null : Array.isArray(p.arpNotes) ? parseArpNotes(p.arpNotes.join(' ')) ?? [...defaultNotes] : [...defaultNotes] };
      });
      state = { version: 1, activeId: ids.has(saved.activeId) ? saved.activeId : projects[0].id, projects };
    }
  } catch { unreadable = true; }
  if (!state) {
    const first = project('项目 1', readSession(storage, genre, profile, bpm, recommendation), recommendation?.timbreByTrackId);
    state = { version: 1, activeId: first.id, projects: [first] };
  }
  function failedWrite() {
    state = { ...state, error: '项目库未能写入，当前内容已保留；请检查浏览器存储后再保存。' };
    listeners.forEach(fn => fn()); return false;
  }
  function commit(next) {
    if (!storage || unreadable) return failedWrite();
    const saved = { version: next.version, activeId: next.activeId, projects: next.projects };
    try { storage.setItem(key, JSON.stringify(saved)); }
    catch { return failedWrite(); }
    state = saved; listeners.forEach(fn => fn()); return true;
  }
  function capture(workspace, arpNotes) {
    return state.projects.map(p => p.id === state.activeId ? { ...p, workspace: clone(workspace), arpNotes: clone(arpNotes), updatedAt: new Date().toISOString() } : p);
  }
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state,
    current: () => state.projects.find(p => p.id === state.activeId),
    initialize: () => commit(state),
    save(workspace, arpNotes) { return commit({ ...state, projects: capture(workspace, arpNotes) }); },
    switchTo(id, workspace, arpNotes) {
      if (id === state.activeId) return true;
      if (!state.projects.some(p => p.id === id)) return false;
      return commit({ ...state, activeId: id, projects: capture(workspace, arpNotes) });
    },
    create(workspace, arpNotes) {
      const number = Math.max(0, ...state.projects.map(p => Number(/^项目\s*(\d+)$/.exec(p.name)?.[1]) || 0)) + 1;
      const next = project(`项目 ${number}`, createSession(genre, profile, workspace.session.bpm));
      return commit({ ...state, activeId: next.id, projects: [...capture(workspace, arpNotes), next] });
    },
    rename(name) {
      const clean = name.trim().slice(0,80);
      if (!clean) return false;
      return commit({ ...state, projects: state.projects.map(p => p.id === state.activeId ? { ...p, name: clean } : p) });
    },
  };
}
