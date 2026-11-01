import { jamCombinationSnapshot } from './jamTemplateProjects.js';
import { hasJamNotes } from './jamDraftActions.js';

// Editor playback owns a temporary solo overlay; saved Jam requests keep their clocks underneath.
export function createJamAudition(playback, { readWorkspace, readDraft, onSoloChange = () => {}, stopArp = () => {} }) {
  let track = null, resumeCombination = false, editor = false, paused = false, empty = false, revision = 0;
  function playDraft(draft, restart) {
    const w = readWorkspace(), snapshot = jamCombinationSnapshot(w,draft,true);
    if (!snapshot) return;
    snapshot.editorRevision = ++revision;
    if (playback.audition) playback.audition(snapshot, w.bpm, { restart });
    else playback.launch(snapshot,w.bpm,{edit:true,quantize:'step',preservePhase:!restart});
  }
  function pause({ stop = true } = {}) {
    paused = true; resumeCombination = false;
    if (stop) playback.stop();
    stopArp();
  }
  function open(draft) {
    if (!draft) return;
    if (!editor) { resumeCombination = playback.isActive(); paused = false; }
    editor = true; track = draft.trackId; empty = !hasJamNotes(draft);
    stopArp(); onSoloChange(true);
    // An empty editor silences an existing mix without starting an empty transport.
    if (!paused && (!empty || playback.isActive())) playDraft(draft, true);
  }
  function release({ resume = true } = {}) {
    if (!track) return;
    track = null;
    editor = paused = empty = false;
    revision++;
    onSoloChange(false);
    stopArp();
    const w = readWorkspace();
    if (resume && resumeCombination) {
      if (playback.resumeJam) { playback.resumeJam(); resumeCombination = false; return; }
      const draft = readDraft();
      const override = draft?.editingTemplateId && w.selection[draft.trackId] === draft.editingTemplateId ? draft : null;
      const snapshot = jamCombinationSnapshot(w, override);
      if (snapshot) playback.launch(snapshot, w.bpm, {edit:true,quantize:'step',preservePhase:true});
      else playback.stop();
    } else playback.stop();
    resumeCombination = false;
  }
  return {
    getTrack: () => track,
    getRevision: () => revision,
    isPlaying: () => Boolean(track && !paused && !empty && playback.isActive()),
    wasPlaying: () => resumeCombination,
    release,
    pause,
    open,
    update(draft, { restart = false } = {}) {
      if (!editor || track !== draft?.trackId) return;
      const wasEmpty = empty; empty = !hasJamNotes(draft);
      if (!paused && (!empty || playback.isActive())) playDraft(draft, restart || wasEmpty);
    },
    toggleEditor(draft) {
      if (!editor || track !== draft?.trackId) {
        open(draft); return;
      }
      if (!paused && !empty && playback.isActive()) { pause(); return; }
      paused = false; empty = !hasJamNotes(draft);
      if (!empty) playDraft(draft, true);
    },
    toggle(draft) {
      if (!draft) return;
      if (track === draft.trackId) { release(); return; }
      if (!track) resumeCombination = playback.isActive();
      track = draft.trackId;
      stopArp(); onSoloChange(true);
      empty = !hasJamNotes(draft);
      playDraft(draft, true);
    },
    stop() { release({resume:false}); playback.stop(); stopArp(); },
  };
}
