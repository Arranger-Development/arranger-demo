import { applyJamMixEdit } from './jamAudition.js';

export const HELD_EDIT_EFFECTS = ['repeat','chopper','brake'];

// Only audio is deferred: the caller has already saved the phrase and its undo
// history. Entries never depend on whichever editor happens to be open later.
export function createJamHeldEdits({ playback, effects, audio, readProject, onMixChange = () => {} }) {
  const pending = new Map();
  const held = track => HELD_EDIT_EFFECTS.some(parameter => effects.isHeld(track,parameter));
  const valid = entry => {
    const project = readProject();
    return playback.isActive() && playback.hasJamPlayback() && entry.sessionId === playback.getSessionId()
      && project.id === entry.projectId && project.workspace.templates[entry.track]?.some(p => p.id === entry.id);
  };
  function discard(track, release = true) {
    const entry = pending.get(track); if (!entry) return;
    pending.delete(track); entry.cancel?.();
    if (release && entry.release && playback.isActive()) audio.setPerformanceEffect(track,entry.release.values);
  }
  function clear(release = false) { for (const track of pending.keys()) discard(track,release); }
  return {
    connect() {
      const disconnect = playback.onStop(() => clear());
      effects.setHoldEditHandler({
        press(track,parameter) {
          const entry = pending.get(track);
          if (!entry?.release) return;
          entry.cancel?.(); entry.cancel = null;
          if (entry.release.parameter !== parameter) audio.setPerformanceEffect(track,entry.release.values);
          entry.release = null;
        },
        release(track,parameter,values) {
          const entry = pending.get(track);
          if (!entry) return false;
          if (!valid(entry)) { discard(track,false); return false; }
          if (held(track)) return false;
          entry.release = {parameter,values};
          entry.cancel?.();
          entry.cancel = playback.atNextStep(time => {
            if (pending.get(track) !== entry) return;
            pending.delete(track);
            audio.setPerformanceEffect(track,values,time);
            if (!valid(entry)) return;
            const w = readProject().workspace, phrase = w.templates[track].find(p => p.id === entry.id);
            const change = applyJamMixEdit(playback,w,phrase,{canJoin:entry.canJoin,preserveEffects:true});
            if (change) onMixChange({selection:playback.getDesiredPhraseIds(),trackId:track,...change});
          });
          return true;
        },
      });
      return () => { disconnect(); effects.setHoldEditHandler(null); clear(); };
    },
    defer(phrase, { canJoin = false } = {}) {
      const track = phrase.trackId;
      if (!held(track) || !playback.isActive() || !playback.hasJamPlayback()) return false;
      discard(track);
      pending.set(track,{projectId:readProject().id,sessionId:playback.getSessionId(),track,id:phrase.id,canJoin});
      return true;
    },
    cancel(track, id) {
      if (id === undefined || pending.get(track)?.id === id) discard(track);
    },
    clear,
  };
}
