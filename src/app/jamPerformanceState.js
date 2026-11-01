export function jamTemplateState(status, track, id) {
  if (!id || status.mode === 'stopped') return 'idle';
  if (status.queuedPhraseIds?.[track] === id && status.playingPhraseIds?.[track] !== id) return 'queued';
  if (status.playingPhraseIds?.[track] === id) return 'playing';
  return 'idle';
}

export function jamColumnState(status, templates, index) {
  const entries = Object.entries(templates).filter(([, row]) => row[index]);
  if (!entries.length || status.mode === 'stopped') return 'idle';
  const matches = ids => ids && Object.entries(templates).every(([t, row]) => (ids[t] ?? null) === (row[index]?.id ?? null));
  if (matches(status.queuedPhraseIds) && !matches(status.playingPhraseIds)) return 'queued';
  return matches(status.playingPhraseIds) ? 'playing' : 'idle';
}

export function jamParameterLevels(trackId, parameter) {
  return trackId === 'chord' && parameter === 'groove' ? [0, 20, 40, 60, 80, 100] : [0, 25, 50, 75, 100];
}

export function jamTrackParameters(params, trackId) {
  return Object.fromEntries(['strength', 'groove'].map(key => [key,
    (() => {
      const levels = jamParameterLevels(trackId, key), interval = levels[1];
      const value = Number.isFinite(params?.[key]) ? params[key] : 50;
      return levels[Math.max(0, Math.min(levels.length - 1, Math.round(value / interval)))];
    })(),
  ]));
}
