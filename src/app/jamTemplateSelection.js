import { jamCombinationSnapshot } from './jamTemplateProjects.js';

// Mouse, keyboard and hardware all toggle the same persisted track selection.
export function toggleJamTemplate({ projectStore, playback, audition, trackId, templateId, draft = null }) {
  const current = projectStore.current().workspace;
  if (!current.templates[trackId]?.some(template => template.id === templateId)) return;
  const cancel = current.selection[trackId] === templateId;
  const continuing = audition.getTrack() ? audition.wasPlaying() : playback.isActive();
  audition.release({resume:false});
  projectStore.patch({
    selection: {...current.selection,[trackId]:cancel ? null : templateId},
    ...(!cancel && {
      mutedTracks: {...current.mutedTracks,[trackId]:false},
      volumes: {...current.volumes,[trackId]:current.volumes[trackId] <= -24 ? 0 : current.volumes[trackId]},
    }),
  });
  if (cancel && !continuing) return;
  const w = projectStore.current().workspace;
  if (cancel && !Object.keys(w.selection).some(t => w.selection[t] && !w.mutedTracks[t] && w.volumes[t] > -24)) {
    playback.stop(); return;
  }
  // Retained drafts must not reinsert a track whose template was deselected.
  const override = draft && draft.trackId !== trackId && w.selection[draft.trackId] ? draft : null;
  const snapshot = jamCombinationSnapshot(w,override);
  if (!snapshot) playback.stop();
  else playback.launch(snapshot,w.bpm,{edit:true,quantize:cancel ? 'step' : 'bar',preservePhase:true});
}
