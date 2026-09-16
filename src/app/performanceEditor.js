// Synchronous snapshots keep consecutive mouse, keyboard and MIDI events atomic,
// even when React batches their renders. No audio or persistence lives here.
export function createPerformanceEditor(initialSession) {
  let state = {
    session: initialSession,
    drafts: initialSession.saved.map((selection) => ({ ...selection })),
    selectedLoop: 0,
  };
  const listeners = new Set();
  function update(next) {
    state = next;
    listeners.forEach((listener) => listener());
    return state;
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    toggleTemplate(trackId, templateId) {
      const { drafts, selectedLoop } = state;
      const draft = drafts[selectedLoop];
      const next = { ...draft, [trackId]: draft[trackId] === templateId ? null : templateId };
      update({ ...state, drafts: drafts.map((value, index) => index === selectedLoop ? next : value) });
      return next;
    },
    selectLoop(index) {
      if (!Number.isInteger(index) || index < 0 || index >= state.drafts.length) return null;
      update({ ...state, selectedLoop: index });
      return state.drafts[index];
    },
    save() {
      const { session, drafts, selectedLoop } = state;
      const next = { ...session, saved: session.saved.map((value, index) => (
        index === selectedLoop ? { ...drafts[index] } : value
      )) };
      update({ ...state, session: next });
      return next;
    },
    setBpm(bpm) {
      const next = { ...state.session, bpm };
      update({ ...state, session: next });
      return next;
    },
  };
}
