const copy = value => structuredClone(value);
const EMPTY = Object.freeze({ undo: [], redo: [] });
const keyFor = (projectId, id) => JSON.stringify([projectId,id]);
function content(phrase) {
  if (!phrase) return null;
  const { id,editingTemplateId,slotIndex,targetSlot,savedAt,dirty,barCount,...value } = phrase;
  void [id,editingTemplateId,slotIndex,targetSlot,savedAt,dirty,barCount];
  return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
}
const changed = (before, after) => JSON.stringify(content(before)) !== JSON.stringify(content(after));

// Session-only history belongs to phrase IDs, never a track's last opened editor or its slot.
export function createJamPhraseHistory(readPhrase) {
  const histories = new Map(), listeners = new Set();
  let version = 0, gesture = null;
  const notify = () => { version++; listeners.forEach(fn => fn()); };
  function record(projectId, before, after) {
    if (!before || !after || !changed(before,after)) return;
    const key = keyFor(projectId,after.id), h = histories.get(key) ?? EMPTY;
    histories.set(key,{undo:[...h.undo,copy(before)].slice(-50),redo:[]}); notify();
  }
  function end() {
    const previous = gesture; gesture = null;
    if (previous) { record(previous.projectId,previous.before,readPhrase(previous.projectId,previous.id)); notify(); }
  }
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => version,
    get(projectId,id) {
      const h = histories.get(keyFor(projectId,id)) ?? EMPTY;
      return gesture?.projectId === projectId && gesture.id === id && changed(gesture.before,readPhrase(projectId,id))
        ? {undo:[...h.undo,gesture.before],redo:[]} : h;
    },
    begin(projectId,phrase,kind='edit') {
      if (gesture?.projectId === projectId && gesture.id === phrase?.id && gesture.kind===kind) return;
      end(); if (phrase) { gesture={projectId,id:phrase.id,kind,before:copy(phrase)}; notify(); }
    },
    end,
    record(projectId,before,after) {
      if (gesture?.projectId !== projectId || gesture.id !== after?.id) record(projectId,before,after);
    },
    seed(seeds) { for (const {projectId,before,after} of seeds) record(projectId,before,after); },
    take(projectId,current,redo=false) {
      end(); const key=keyFor(projectId,current.id), h=histories.get(key)??EMPTY, from=redo?h.redo:h.undo;
      if (!from.length) return null;
      const next=copy(from.at(-1));
      histories.set(key,redo ? {undo:[...h.undo,copy(current)].slice(-50),redo:h.redo.slice(0,-1)}
        : {undo:h.undo.slice(0,-1),redo:[...h.redo,copy(current)].slice(-50)}); notify();
      return {...next,id:current.id,trackId:current.trackId,slotIndex:current.slotIndex,savedAt:current.savedAt,editingTemplateId:current.id};
    },
    forget(projectId,id) { if (gesture?.projectId===projectId && gesture.id===id) gesture=null; histories.delete(keyFor(projectId,id)); notify(); },
  };
}
