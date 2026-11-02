import { jamCombinationSnapshot } from './jamTemplateProjects.js';
import { hasJamNotes } from './jamDraftActions.js';

// Solo editing owns an overlay; mix editing changes only its own saved phrase.
export function createJamAudition(playback, { readWorkspace, readDraft, onSoloChange = () => {}, onMixChange = () => {}, stopArp = () => {} }) {
  let track = null, resumeCombination = false, editor = false, paused = false, empty = false, revision = 0;
  let mode = 'solo', phraseId = null, autoJoinBlocked = false;
  const idOf = draft => draft?.editingTemplateId ?? draft?.id ?? null;
  function mixChanged(restoreSound = false) {
    onMixChange({ selection: playback.getDesiredPhraseIds(), trackId: track, restoreSound });
  }
  function updateMix(draft, restart) {
    const w = readWorkspace(), id = idOf(draft);
    if (!id || id !== phraseId) return;
    const desired = playback.getDesiredPhraseIds()[track];
    const queued = playback.getQueuedPhraseIds?.()?.[track];
    const audible = playback.getProgress()?.snapshot.phraseIds[track];
    if (empty) {
      if (desired === id || queued === id || audible === id) {
        playback.removeTrack(track,id); mixChanged();
      }
      return;
    }
    const snapshot = jamCombinationSnapshot(w,draft,true);
    if (queued === id) {
      playback.updatePhrase(snapshot,track,id,{queuedOnly:true});
    } else if (desired === id) {
      if (restart) playback.toggleTrack(snapshot,track,w.bpm,{restart:true});
      else playback.updatePhrase(snapshot,track,id);
    } else if (!paused && !autoJoinBlocked) {
      playback.toggleTrack(snapshot,track,w.bpm,{restart:true}); mixChanged(true);
    } else if (audible === id && !restart) playback.updatePhrase(snapshot,track,id);
  }
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
  function open(draft, { mode: requestedMode } = {}) {
    if (!draft) return;
    const nextMode = requestedMode ?? (editor && mode === 'mix' && phraseId === idOf(draft) ? 'mix' : 'solo');
    if (editor && mode === 'solo' && nextMode === 'mix') playback.resumeJam?.();
    if (mode === 'mix' && nextMode === 'solo') {
      resumeCombination = playback.isActive();
      if (resumeCombination) paused = false;
    }
    if (phraseId !== idOf(draft)) {
      autoJoinBlocked = false;
      if (nextMode === 'mix' && playback.isActive()) paused = false;
    }
    if (!editor) { resumeCombination = playback.isActive(); paused = false; }
    mode = nextMode; phraseId = idOf(draft);
    editor = true; track = draft.trackId; empty = !hasJamNotes(draft);
    if (mode === 'mix') { onSoloChange(false); return; }
    stopArp(); onSoloChange(true);
    // An empty editor silences an existing mix without starting an empty transport.
    if (!paused && (!empty || playback.isActive())) playDraft(draft, true);
  }
  function release({ resume = true } = {}) {
    if (!track) return;
    const wasMix = mode === 'mix';
    track = null;
    editor = paused = empty = false;
    mode = 'solo'; phraseId = null; autoJoinBlocked = false;
    revision++;
    onSoloChange(false);
    if (wasMix) { resumeCombination = false; return; }
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
    getMode: () => track ? mode : null,
    getPhraseId: () => phraseId,
    getRevision: () => revision,
    isPlaying: () => mode === 'mix' ? Boolean(track && !empty && playback.isActive()
      && playback.getProgress()?.snapshot.phraseIds[track] === phraseId
      && !readWorkspace().mutedTracks?.[track] && (readWorkspace().volumes?.[track] ?? 0) > -24)
      : Boolean(track && !paused && !empty && playback.isActive()),
    wasPlaying: () => mode === 'mix' ? playback.isActive() : resumeCombination,
    holdMix(trackId = track) { if (mode === 'mix' && trackId === track) autoJoinBlocked = true; },
    release,
    pause,
    open,
    update(draft, { restart = false } = {}) {
      if (!editor || track !== draft?.trackId) return;
      const wasEmpty = empty; empty = !hasJamNotes(draft);
      if (mode === 'mix') { updateMix(draft,restart); return; }
      if (!paused && (!empty || playback.isActive())) playDraft(draft, restart || wasEmpty);
    },
    toggleEditor(draft) {
      if (mode === 'mix' && editor && track === draft?.trackId) {
        if (playback.isActive()) { pause(); return; }
        const w = readWorkspace(), snapshot = jamCombinationSnapshot(w);
        paused = autoJoinBlocked = false;
        if (snapshot) playback.launch(snapshot,w.bpm,{edit:true,quantize:'step',preservePhase:true});
        return;
      }
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
      mode = 'solo'; phraseId = idOf(draft);
      track = draft.trackId;
      stopArp(); onSoloChange(true);
      empty = !hasJamNotes(draft);
      playDraft(draft, true);
    },
    stop() { release({resume:false}); playback.stop(); stopArp(); },
  };
}
