import { jamCombinationSnapshot, jamTemplateRemoval } from './jamTemplateProjects.js';
import { PERFORMANCE_TRACKS } from './performanceModel.js';
import { jamTemplatePage } from './jamTemplateSlots.js';
import { isEmptyJamPhrase } from './jamPhraseContent.js';

// Repositioning surviving gems must not retrigger them or replace a pending launch.
export function deleteJamTemplate({ projectStore, playback, audition, trackId, templateId }) {
  const before = projectStore.current().workspace;
  if (!before.templates[trackId]?.some(p => p.id === templateId)) return false;
  const editorTrack = audition.getTrack();
  const soloTrack = audition.getMode?.() === 'mix' ? null : editorTrack;
  const deletingEditor = editorTrack === trackId && before.draft?.editingTemplateId === templateId;
  const deletingSolo = soloTrack === trackId && before.draft?.editingTemplateId === templateId;
  const continuing = deletingSolo ? audition.wasPlaying() : playback.isActive();
  // Read the current reducer even when Fast Refresh retained an older store instance.
  const saved = projectStore.patch(jamTemplateRemoval(before, trackId, templateId));
  const w = projectStore.current().workspace;
  // Storage failure may still retain the deletion in memory; keep audio consistent.
  if (w.templates[trackId].some(p => p.id === templateId)) return false;
  if (deletingEditor) audition.release({ resume: continuing });
  if ((!deletingSolo && soloTrack) || !continuing) return saved;
  if (playback.removeTrack) {
    playback.removeTrack(trackId, templateId);
    projectStore.patch({ selection: playback.getDesiredPhraseIds() });
    return saved;
  }
  if (!deletingSolo && before.selection[trackId] !== templateId) return saved;
  const snapshot = jamCombinationSnapshot(w);
  if (!snapshot || !PERFORMANCE_TRACKS.some(t => w.selection[t] && !w.mutedTracks[t] && w.volumes[t] > -24)) playback.stop();
  else playback.launch(snapshot, w.bpm, { edit: true, quantize: 'step', preservePhase: true });
  return saved;
}

export function jamColumnPhrases(templates, slotIndex) {
  const page = Math.floor(slotIndex / 8), position = slotIndex % 8;
  return Object.fromEntries(PERFORMANCE_TRACKS.map(track => [track, jamTemplatePage(templates[track] ?? [], page)[position]]));
}

// A column is one atomic launch, not four toggles (which would queue partial mixes).
export function launchJamColumn({ projectStore, playback, audition, columnIndex, page = 0, slotIndex, toggle = false }) {
  if (slotIndex === undefined) {
    if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex > 7 || !Number.isInteger(page) || page < 0) return false;
    slotIndex = page * 8 + columnIndex;
  }
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0) return false;
  const w = projectStore.current().workspace;
  const selection = Object.fromEntries(Object.entries(jamColumnPhrases(w.templates, slotIndex))
    .map(([track, phrase]) => [track, phrase && !isEmptyJamPhrase(phrase) ? phrase.id : null]));
  if (!Object.values(selection).some(Boolean)) return false;
  // Explicit launches stay idempotent; the column's transport button toggles
  // either its audible mix or its pending request, including during loading.
  const matches = ids => ids && PERFORMANCE_TRACKS.every(t => (ids[t] ?? null) === selection[t]);
  const mixEditor = audition.getMode?.() === 'mix';
  const soloActive = !mixEditor && audition.getTrack();
  if (toggle && !soloActive && playback.isActive()
    && (matches(playback.getDesiredPhraseIds()) || matches(playback.getProgress()?.snapshot.phraseIds))) {
    if (mixEditor) audition.pause(); else audition.stop();
    return true;
  }
  if (!soloActive && playback.isActive() && PERFORMANCE_TRACKS.every(t => w.selection[t] === selection[t]
    && (!selection[t] || !w.mutedTracks[t] && w.volumes[t] > -24))) return false;
  if (mixEditor) audition.holdMix(); else audition.release();
  projectStore.patch({ selection,
    mutedTracks: { ...w.mutedTracks, ...Object.fromEntries(PERFORMANCE_TRACKS.filter(t => selection[t]).map(t => [t, false])) },
    volumes: { ...w.volumes, ...Object.fromEntries(PERFORMANCE_TRACKS.filter(t => selection[t]).map(t => [t, w.volumes[t] <= -24 ? 0 : w.volumes[t]])) },
  });
  playback.launch(jamCombinationSnapshot(projectStore.current().workspace), w.bpm, { edit: true, quantize: 'bar', preservePhase: false });
  return true;
}

// Mouse, keyboard and hardware share one per-track toggle. No retained draft or
// stopped historical selection can silently join this saved phrase.
export function toggleJamTemplate({ projectStore, playback, audition, trackId, templateId }) {
  const current = projectStore.current().workspace;
  if (!current.templates[trackId]?.some(template => template.id === templateId && !isEmptyJamPhrase(template))) return false;
  if (audition.getMode?.() === 'mix') audition.holdMix(trackId); else audition.release();
  const snapshot = jamCombinationSnapshot({ ...current, selection: { [trackId]: templateId } });
  const restartingCurrent = audition.getMode?.() === 'mix' && playback.getQueuedPhraseIds?.()?.[trackId] === templateId
    && playback.getProgress()?.snapshot.phraseIds[trackId] === templateId;
  if (restartingCurrent && !current.mutedTracks[trackId] && current.volumes[trackId] > -24) playback.removeTrack(trackId,templateId);
  else playback.toggleTrack(snapshot, trackId, current.bpm, { restart: current.mutedTracks[trackId] || current.volumes[trackId] <= -24 });
  if (audition.getMode?.() === 'mix' && !Object.values(playback.getDesiredPhraseIds()).some(Boolean)) audition.holdMix();
  projectStore.patch({
    selection: playback.getDesiredPhraseIds(),
    mutedTracks: {...current.mutedTracks,[trackId]:false},
    volumes: {...current.volumes,[trackId]:current.volumes[trackId] <= -24 ? 0 : current.volumes[trackId]},
  });
  return true;
}
