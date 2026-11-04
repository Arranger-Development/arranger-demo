import { jamCombinationSnapshot } from './jamTemplateProjects.js';
import { hasJamNotes } from './jamDraftActions.js';

// Also used by deferred knob edits after their editor has switched or collapsed.
export function applyJamMixEdit(playback, workspace, draft, { restart = false, canJoin = false, preserveEffects = false } = {}) {
  const track = draft.trackId, id = draft.editingTemplateId ?? draft.id;
  const desired = playback.getDesiredPhraseIds()[track];
  const queued = playback.getQueuedPhraseIds?.()?.[track];
  const audible = playback.getProgress()?.snapshot.phraseIds[track];
  if (!hasJamNotes(draft)) {
    if (desired !== id && queued !== id && audible !== id) return null;
    playback.removeTrack(track,id); return { restoreSound:false };
  }
  const snapshot = jamCombinationSnapshot(workspace,draft,true);
  if (queued === id) playback.updatePhrase(snapshot,track,id,{queuedOnly:true,preserveEffects});
  else if (desired === id) {
    if (restart) playback.toggleTrack(snapshot,track,workspace.bpm,{restart:true});
    else playback.updatePhrase(snapshot,track,id,{preserveEffects});
  } else if (canJoin) {
    playback.toggleTrack(snapshot,track,workspace.bpm,{restart:true}); return { restoreSound:true };
  } else if (audible === id && !restart) playback.updatePhrase(snapshot,track,id,{preserveEffects});
  return null;
}

// Solo editing owns an overlay; mix editing changes only its own saved phrase.
export function createJamAudition(playback, { readWorkspace, readDraft, onSoloChange = () => {}, onMixChange = () => {}, stopArp = () => {} }) {
  let track = null, resumeCombination = false, editor = false, paused = false, empty = false, revision = 0;
  let mode = 'solo', phraseId = null, autoJoinBlocked = false;
  const idOf = draft => draft?.editingTemplateId ?? draft?.id ?? null;
  function mixChanged(restoreSound = false) {
    onMixChange({ selection: playback.getDesiredPhraseIds(), trackId: track, restoreSound });
  }
  function updateMix(draft, restart, preserveEffects) {
    const w = readWorkspace(), id = idOf(draft);
    if (!id || id !== phraseId) return;
    const changed = applyJamMixEdit(playback,w,draft,{restart,canJoin:!paused&&!autoJoinBlocked,preserveEffects});
    if (changed) mixChanged(changed.restoreSound);
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
  function open(draft, { mode: requestedMode, autoStart = false } = {}) {
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
    if (mode === 'mix') {
      onSoloChange(false);
      // The first populated editor uses the same real track runtime as later
      // layers. Opening another editor in a running mix never adds its track.
      if (autoStart && !paused && !empty && !playback.isActive()) updateMix(draft, false);
      return;
    }
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
    canJoin: () => !paused && !autoJoinBlocked,
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
    // A phrase press has already issued its playback command. Only bind the
    // editor here: no overlay, transport request, or implicit audition.
    follow(draft) {
      if (!draft) return;
      track = draft.trackId; phraseId = idOf(draft); mode = 'mix'; editor = true;
      empty = !hasJamNotes(draft); resumeCombination = false; paused = !playback.isActive();
      autoJoinBlocked = playback.getDesiredPhraseIds()[track] !== phraseId
        && playback.getQueuedPhraseIds?.()?.[track] !== phraseId;
      revision++; onSoloChange(false);
    },
    update(draft, { restart = false, preserveEffects = false, updateAudio = true } = {}) {
      if (!editor || track !== draft?.trackId) return;
      const wasEmpty = empty; empty = !hasJamNotes(draft);
      if (!updateAudio) return;
      if (mode === 'mix') { updateMix(draft,restart,preserveEffects); return; }
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
