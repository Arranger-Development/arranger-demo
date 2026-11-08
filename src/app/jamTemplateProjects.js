import { PERFORMANCE_TRACKS as TRACKS } from './performanceModel.js';
import { createJamProjects } from './jamProjects.js';
import { snapshotSection, TIMBRE_OPTIONS } from './performanceSession.js';
import { DEEP_AUTUMN_DRUMS, DEEP_AUTUMN_CHORD, DEEP_AUTUMN_BASS, DEEP_AUTUMN_MELODY, HUM_SUSTAIN, withPerformanceTimbre } from '../data/performanceTimbres.js';
import { normalizeBpm } from '../domain/bpm.js';
import { createClipRecord } from '../domain/clipHelpers.js';
import { MAX_PROJECT_BARS } from '../domain/projectLength.js';
import { normalizeJamSlots, firstEmptyJamSlot, removeJamSlot, moveJamSlots, relocateJamDraft, jamLauncherColumnCount } from './jamTemplateSlots.js';
import { isEmptyJamPhrase } from './jamPhraseContent.js';
import { jamTrackParameters } from './jamPerformanceState.js';
import { HUM_SOURCE, humPlaybackBars } from './jamHumExpression.js';

const copy = value => structuredClone(value);
const uid = () => globalThis.crypto.randomUUID();
const byTrack = make => Object.fromEntries(TRACKS.map(t => [t, make(t)]));
export const defaultJamTimbres = () => ({ drums: DEEP_AUTUMN_DRUMS, chord: DEEP_AUTUMN_CHORD,
  bass: DEEP_AUTUMN_BASS, melody: DEEP_AUTUMN_MELODY });
function reconcileDraftLocation(draft, templates) {
  if (!draft || !templates[draft.trackId]) return draft;
  const row = templates[draft.trackId];
  if (draft.editingTemplateId) {
    const saved = row.find(p => p.id === draft.editingTemplateId);
    if (saved) return { ...draft, slotIndex: saved.slotIndex };
    const detached = { ...draft, dirty: true };
    for (const key of ['id', 'editingTemplateId', 'slotIndex', 'targetSlot']) delete detached[key];
    return detached;
  }
  return row.some(p => p.slotIndex === draft.targetSlot)
    ? { ...draft, targetSlot: firstEmptyJamSlot(row) } : draft;
}
export function upgradeJamSlotLayout(w) {
  if (w.slotLayoutVersion === 1) return w;
  const templates = byTrack(t => normalizeJamSlots(w.templates[t]));
  return { ...w, slotLayoutVersion: 1, templates,
    draft: reconcileDraftLocation(w.draft, templates),
    draftsByTrack: Object.fromEntries(Object.entries(w.draftsByTrack ?? {}).map(([t, draft]) => [t, reconcileDraftLocation(draft, templates)])),
  };
}
export function jamTemplateRemoval(w, t, id) {
  if (!TRACKS.includes(t)) return null;
  const row = removeJamSlot(w.templates[t], id);
  if (!row) return null;
  const templates = { ...w.templates, [t]: row };
  const reconcile = draft => w.liveEditingVersion===1 && draft?.editingTemplateId===id ? null
    : draft?.trackId === t ? reconcileDraftLocation(draft, templates) : draft;
  return { templates,
    selection: { ...w.selection, [t]: w.selection[t] === id ? null : w.selection[t] },
    draft: reconcile(w.draft), draftsByTrack: { ...w.draftsByTrack, ...(w.draftsByTrack?.[t] ? { [t]: reconcile(w.draftsByTrack[t]) } : {}) },
  };
}
export function jamTemplateReorder(w, move) {
  const { trackId, from, to } = move;
  if (trackId != null && !TRACKS.includes(trackId) || !Number.isSafeInteger(from) || !Number.isSafeInteger(to)
    || from < 0 || to < 0 || from === to || Math.max(from, to) >= jamLauncherColumnCount(w.templates)) return null;
  const affected = trackId ? [trackId] : TRACKS;
  if (!affected.some(t => normalizeJamSlots(w.templates[t]).some(p => p.slotIndex === from))) return null;
  const templates = { ...w.templates, ...Object.fromEntries(affected.map(t => [t, moveJamSlots(w.templates[t], from, to)])) };
  return { templates, draft: relocateJamDraft(w.draft, move, templates),
    draftsByTrack: Object.fromEntries(Object.entries(w.draftsByTrack ?? {}).map(([t, draft]) => [t, relocateJamDraft(draft, move, templates)])) };
}
export const jamTemplateProjectsKey = (genre, profile) => `arranger-jam-projects:v2:${profile ?? genre}`;
// Creation-mode sorting never changes the saved Jam slotIndex bindings.
export function sortUserTemplatesForCreation(templates) {
  const savedAt = template => Number.isSafeInteger(template.savedAt) && template.savedAt > 0 ? template.savedAt : 0;
  return templates.filter(p => !isEmptyJamPhrase(p)).map((template, index) => ({ template, index }))
    .sort((a, b) => savedAt(b.template) - savedAt(a.template) || b.index - a.index)
    .map(({ template }) => template.name ? template : {...template,name:'未命名乐句'});
}
export function validTemplate(template) {
  return TRACKS.includes(template?.trackId) && typeof template.id === 'string'
    && Array.isArray(template.bars) && template.bars.length > 0 && template.bars.length <= MAX_PROJECT_BARS
    && template.bars.every(bar => Array.isArray(bar) && bar.length === 16);
}
const workspace = bpm => ({ bpm: normalizeBpm(bpm), slotLayoutVersion: 1, templates: byTrack(() => []), selection: byTrack(() => null),
  volumes: byTrack(() => 0), mutedTracks: byTrack(() => false), timbres: byTrack(() => null), draft: null, draftsByTrack: {} });

function phraseEdit(w, draft, { create = false, slotIndex, migrate = false } = {}) {
  const t = draft?.trackId;
  if (!TRACKS.includes(t)) return null;
  const row = normalizeJamSlots(w.templates[t]);
  const id = draft.editingTemplateId ?? draft.id;
  const existing = row.find(p => p.id === id);
  if (id && !existing && !create) return null;
  const label = {drums:'鼓',chord:'和弦',bass:'贝斯',melody:'旋律'}[t];
  let number=1; while (row.some(p=>p.name===`${label}${number}`)) number++;
  let destination=existing?.slotIndex ?? slotIndex ?? draft.targetSlot ?? firstEmptyJamSlot(row);
  if (!Number.isSafeInteger(destination) || destination<0) return null;
  if (row.some(p=>p.slotIndex===destination && p.id!==existing?.id)) {
    if (!migrate) return null;
    destination=firstEmptyJamSlot(row);
  }
  const phrase={...copy(draft),id:existing?.id??uid(),slotIndex:destination,
    params:jamTrackParameters(draft.params,t),
    name:existing ? String(draft.name??existing.name??'').slice(0,80) : draft.name?.trim()||`${label}${number}`,
    timbreId:w.timbres?.[t]??draft.timbreId??defaultJamTimbres()[t],barCount:draft.bars?.length,
    savedAt:existing ? existing.savedAt : row.reduce((n,p)=>Math.max(n,Number.isSafeInteger(p.savedAt)?p.savedAt:0),0)+1};
  for (const field of ['editingTemplateId','targetSlot','dirty']) delete phrase[field];
  if (!validTemplate(phrase)) return null;
  const at=row.findIndex(p=>p.id===phrase.id);
  if (at<0) row.push(phrase); else row[at]=phrase;
  const view={...copy(phrase),editingTemplateId:phrase.id,dirty:false};
  return {phrase,before:existing,workspace:{...w,liveEditingVersion:1,templates:{...w.templates,[t]:row},draft:view,draftsByTrack:{...w.draftsByTrack,[t]:view}}};
}
export function createJamTemplateProjects(storage, genre, profile, bpm = 100) {
  const key = jamTemplateProjectsKey(genre, profile), listeners = new Set();
  let unreadable = false, state, liveEditing = false;
  const migrationHistory = [];
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
        for (const t of TRACKS) {
          if (!Array.isArray(p.workspace.templates[t]) || !p.workspace.templates[t].every(x => validTemplate(x) && x.trackId === t)) throw new Error('Invalid templates');
          p.workspace.templates[t] = normalizeJamSlots(p.workspace.templates[t]);
        }
        p.workspace = { ...workspace(bpm), ...p.workspace, slotLayoutVersion: p.workspace.slotLayoutVersion ?? 0, bpm: normalizeBpm(p.workspace.bpm) };
        p.workspace.timbres = byTrack(t => TIMBRE_OPTIONS[t].includes(p.workspace.timbres?.[t]) || (t === 'melody' && p.workspace.timbres?.[t] === HUM_SUSTAIN) ? p.workspace.timbres[t] : null);
        p.workspace.draftsByTrack ??= {};
        if (TRACKS.includes(p.workspace.draft?.trackId) && !p.workspace.draftsByTrack[p.workspace.draft.trackId]) {
          p.workspace.draftsByTrack = { ...p.workspace.draftsByTrack, [p.workspace.draft.trackId]: p.workspace.draft };
        }
        for (const t of TRACKS) if (!p.workspace.templates[t].some(x => x.id === p.workspace.selection[t])) p.workspace.selection[t] = null;
        p.workspace = upgradeJamSlotLayout(p.workspace);
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
  for (const p of state.projects) for (const t of TRACKS) p.workspace.templates[t] = normalizeJamSlots(p.workspace.templates[t]);
  const current = () => state.projects.find(p => p.id === state.activeId);
  function commit(next, retainOnFailure = true) {
    let error;
    try {
      if (!storage || unreadable) throw new Error('Storage unavailable');
      storage.setItem(key, JSON.stringify({ version: 2, activeId: next.activeId, projects: next.projects }));
    } catch {
      error = liveEditing || next.projects.find(p=>p.id===next.activeId)?.workspace.liveEditingVersion===1
        ? '自动保留失败，最新修改仍在当前页面，请勿刷新；恢复浏览器存储后重试。'
        : '项目保存失败，当前内容已保留，请检查浏览器存储后重试。';
    }
    state = { ...(error && !retainOnFailure ? state : next), error }; listeners.forEach(fn => fn()); return !error;
  }
  function patch(value) {
    return commit({ ...state, projects: state.projects.map(p => p.id === state.activeId ? { ...p, workspace: { ...p.workspace, ...copy(value) } } : p) });
  }
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state, current,
    initialize: () => commit(state), save: () => commit(state), patch,
    enableLiveEditing() {
      if (liveEditing) return;
      liveEditing=true;
      const projects=state.projects.map(p=>{
        let w={...p.workspace,liveEditingVersion:1};
        const activeTrack=w.draft?.trackId;
        const drafts={...w.draftsByTrack,...(TRACKS.includes(activeTrack)?{[activeTrack]:w.draft}:{})};
        for (const draft of Object.values(drafts)) {
          if (!TRACKS.includes(draft?.trackId)) continue;
          const old=w.templates[draft.trackId].find(x=>x.id===(draft.editingTemplateId??draft.id));
          if (old && !draft.dirty) continue;
          const next=phraseEdit(w,draft,{create:!old,migrate:true});
          if (!next) continue;
          w=next.workspace;
          if (next.before) migrationHistory.push({projectId:p.id,before:next.before,after:next.phrase});
        }
        if (activeTrack && w.draftsByTrack[activeTrack]) w={...w,draft:w.draftsByTrack[activeTrack]};
        return {...p,workspace:w};
      });
      if (JSON.stringify(projects)!==JSON.stringify(state.projects)) commit({...state,projects});
    },
    takeMigrationHistory() { return migrationHistory.splice(0); },
    commitPhraseEdit(draft, { projectId, create = false, slotIndex } = {}) {
      const p=current();
      if (projectId!==undefined && projectId!==p.id) return null;
      const next=phraseEdit(p.workspace,draft,{create,slotIndex});
      if (!next) return null;
      commit({...state,projects:state.projects.map(item=>item.id===p.id?{...p,workspace:next.workspace}:item)});
      return next.phrase;
    },
    insertHumPhrases(phrases, { projectId, melodyId, bpm } = {}) {
      const project = current();
      if (project.id !== projectId) return null;
      const w = project.workspace;
      const melody = melodyId && w.templates.melody.find(phrase => phrase.id === melodyId && phrase.sourcePresetId === HUM_SOURCE);
      if (melodyId && !melody) return null;
      const occupied = track => new Set([
        ...w.templates[track].map(phrase => phrase.slotIndex),
        w.draftsByTrack?.[track]?.targetSlot,
        w.draft?.trackId === track ? w.draft.targetSlot : undefined,
      ]);
      const occupiedByTrack = byTrack(occupied);
      let slotIndex = melody?.slotIndex ?? 0;
      if (!melody) while (TRACKS.some(track => occupiedByTrack[track].has(slotIndex))) slotIndex++;
      let next = w;
      const inserted = [];
      for (const phrase of phrases) {
        if (occupiedByTrack[phrase.trackId].has(slotIndex)) return null;
        const entry = phraseEdit(next, { ...phrase, ...(phrase.trackId === 'melody' ? { timbreId: HUM_SUSTAIN } : {}), sourcePresetId: HUM_SOURCE }, { create: true, slotIndex });
        if (!entry) return null;
        next = entry.workspace;
        inserted.push(entry.phrase);
      }
      if (!inserted.length) return null;
      const tempo = bpm != null && TRACKS.every(track => w.templates[track].length === 0) ? normalizeBpm(bpm, w.bpm) : w.bpm;
      patch({ templates: next.templates, bpm: tempo });
      return inserted;
    },
    setDraft(draft) {
      if (!TRACKS.includes(draft?.trackId)) return false;
      draft = reconcileDraftLocation(draft, current().workspace.templates);
      return patch({ draft, draftsByTrack: { ...current().workspace.draftsByTrack, [draft.trackId]: draft } });
    },
    discardDraft(t, { projectId, targetSlot, expectedDraft } = {}) {
      const p = current(), w = p.workspace, draft = w.draftsByTrack?.[t];
      if (!TRACKS.includes(t) || !draft || draft.editingTemplateId
        || projectId !== undefined && projectId !== p.id
        || targetSlot !== undefined && targetSlot !== draft.targetSlot
        || expectedDraft && expectedDraft !== draft) return false;
      const draftsByTrack = { ...w.draftsByTrack };
      delete draftsByTrack[t];
      return commit({ ...state, projects: state.projects.map(item => item.id === p.id
        ? { ...item, workspace: { ...w, draftsByTrack, draft: w.draft?.trackId === t ? null : w.draft } } : item) }, false);
    },
    setTimbre(t, timbreId) {
      if (!TIMBRE_OPTIONS[t]?.includes(timbreId) && !(t === 'melody' && timbreId === HUM_SUSTAIN)) return false;
      return patch({timbres:{...current().workspace.timbres,[t]:timbreId}});
    },
    saveTemplate(draft, name, id = null, { slotIndex } = {}) {
      const t = draft.trackId;
      if (!TRACKS.includes(t) || !draft.bars?.some(bar => bar.some(Boolean))) return null;
      const label = {drums:'鼓',chord:'和弦',bass:'贝斯',melody:'旋律'}[t];
      const names = new Set(current().workspace.templates[t].map(p => p.name));
      let number = 1;
      while (names.has(`${label}${number}`)) number++;
      const savedAt = current().workspace.templates[t].reduce((latest, p) => (
        Number.isSafeInteger(p.savedAt) && p.savedAt > 0 ? Math.max(latest, p.savedAt) : latest
      ), 0) + 1;
      const row = normalizeJamSlots(current().workspace.templates[t]);
      const existing = id && row.find(p => p.id === id);
      const requestedSlot = slotIndex ?? draft.targetSlot;
      const destination = existing?.slotIndex ?? (Number.isSafeInteger(requestedSlot) && requestedSlot >= 0 ? requestedSlot : firstEmptyJamSlot(row));
      if (row.some(p => p.slotIndex === destination && p.id !== id)) return null;
      const template = { ...copy(draft), slotIndex: destination, timbreId:current().workspace.timbres?.[t] ?? draft.timbreId ?? defaultJamTimbres()[t], id: id ?? uid(), name: name.trim() || `${label}${number}`, barCount: draft.bars.length, savedAt };
      delete template.targetSlot;
      if (!validTemplate(template)) return null;
      const before = current().workspace.templates;
      const templates = copy(before);
      templates[t] = row;
      const at = templates[t].findIndex(p => p.id === template.id);
      if (at >= 0) templates[t][at] = template; else templates[t].push(template);
      if (!patch({ templates })) {
        state = { ...state, projects: state.projects.map(p => p.id === state.activeId ? { ...p, workspace: { ...p.workspace, templates: before } } : p) };
        listeners.forEach(fn => fn()); return null;
      }
      return template;
    },
    removeTemplate(t, id) {
      const change = jamTemplateRemoval(current().workspace, t, id);
      return change ? patch(change) : false;
    },
    moveSlots(move, { projectId, templates } = {}) {
      const p = current();
      if (projectId !== undefined && projectId !== p.id || templates && templates !== p.workspace.templates) return false;
      const change = jamTemplateReorder(p.workspace, move);
      if (!change) return false;
      return commit({ ...state, projects: state.projects.map(item => item.id === p.id
        ? { ...item, workspace: { ...item.workspace, ...change } } : item) }, false);
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
function setTemplateTimbre(cell, track, id, gated = false) {
  cell.requestedTimbreId = id;
  const resolved = withPerformanceTimbre({ type: track, ...(gated ? { playbackMode: 'gated' } : {}) }, id);
  if (resolved.timbreId) cell.timbreId = resolved.timbreId;
  else if (track === 'drums' || track === 'bass') delete cell.timbreId;
  else { cell.timbreId = 'piano'; cell.playbackMode = gated ? 'gated' : 'natural'; }
  if (resolved.playbackMode) cell.playbackMode = resolved.playbackMode;
}
export function jamCombinationSnapshot(w, override = null, solo = false) {
  const selected = selectedJamTemplates(w, override);
  for (const t of TRACKS) if (isEmptyJamPhrase(selected[t]) && !(solo && override?.trackId===t)) selected[t]=null;
  if (solo) for (const t of TRACKS) if (t !== override?.trackId) selected[t] = null;
  if (!Object.values(selected).some(Boolean)) return null;
  const gcd = (a,b) => b ? gcd(b,a%b) : a;
  const totalBars = Object.values(selected).reduce((length,p) => length * (p?.bars.length ?? 1) / gcd(length,p?.bars.length ?? 1),1);
  // Long, uneven legacy phrases can have an enormous common cycle. Keep their
  // individual loops compact rather than allocating that entire cycle.
  const phraseBars = totalBars > MAX_PROJECT_BARS ? byTrack(t => selected[t]?.bars.length ?? 1) : null;
  const bars = byTrack(t => selected[t] ? humPlaybackBars(selected[t]) : [Array(16).fill(null)]);
  const matrix = byTrack(t => Array.from({ length: phraseBars?.[t] ?? totalBars }, (_, b) => copy(bars[t][b % bars[t].length])));
  const timbres = byTrack(t => w.timbres?.[t] ?? selected[t]?.timbreId ?? defaultJamTimbres()[t]);
  for (const t of TRACKS) for (const bar of matrix[t]) for (const cell of bar) if (cell) {
    const gated = (t === 'melody' || t === 'chord') && selected[t]?.sourcePresetId === HUM_SOURCE;
    setTemplateTimbre(cell, t, timbres[t], gated);
  }
  return { id: 'jam-current-combination', matrix, totalBars, phraseBars: byTrack(t => selected[t]?.bars.length ?? 1), repeat: null, kind: 'main', timbres, phraseIds: byTrack(t => selected[t] ? selected[t].id ?? selected[t].editingTemplateId ?? 'draft' : null) };
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
