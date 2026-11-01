import { jamCombinationSnapshot } from './jamTemplateProjects.js';

// Solo is an action: it must start audio even when the transport was stopped.
export function createJamAudition(playback, { readWorkspace, readDraft, onSoloChange = () => {}, stopArp = () => {} }) {
  let track = null, resumeCombination = false;
  function release({ resume = true } = {}) {
    if (!track) return;
    track = null;
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
    wasPlaying: () => resumeCombination,
    release,
    toggle(draft) {
      if (!draft) return;
      if (track === draft.trackId) { release(); return; }
      if (!track) resumeCombination = playback.isActive();
      track = draft.trackId;
      stopArp(); onSoloChange(true);
      const w = readWorkspace();
      const snapshot = jamCombinationSnapshot(w,draft,true);
      if (playback.audition) playback.audition(snapshot, w.bpm);
      else playback.launch(snapshot,w.bpm,{edit:true,quantize:'step',preservePhase:true});
    },
    stop() { release({resume:false}); playback.stop(); stopArp(); },
  };
}
