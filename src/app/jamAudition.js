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
      const snapshot = jamCombinationSnapshot(w, readDraft());
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
      playback.launch(jamCombinationSnapshot(w,draft,true),w.bpm,{edit:true,quantize:'step',preservePhase:true});
    },
    stop() { release({resume:false}); playback.stop(); stopArp(); },
  };
}
