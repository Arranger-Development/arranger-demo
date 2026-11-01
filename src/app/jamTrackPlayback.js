import { PERFORMANCE_TRACKS as TRACKS } from './performanceModel.js';

// Runtime only: saved selections contain IDs, never transport positions or requests.
export function createJamTrackPlayback(nextVersion) {
  let tracks = {}, audible = {}, launches = {}, stops = {}, overlay = null, overlayRequest;
  const releases = new Map();
  let source = null, lastAudible = -1;
  const cancelled = new Set();
  const ids = entries => Object.fromEntries(TRACKS.map(t => [t, entries[t]?.id ?? null]));
  const entry = (snapshot, t, at, preserve) => snapshot?.phraseIds[t] ? {
    id: snapshot.phraseIds[t], bars: snapshot.phraseBars?.[t] ?? snapshot.totalBars,
    matrix: snapshot.matrix[t], startStep: preserve && tracks[t]?.id === snapshot.phraseIds[t] ? tracks[t].startStep : at,
    revision: nextVersion(),
  } : null;
  function invalidate(t, cancelScheduled = false) {
    if (launches[t] && (!launches[t].scheduled || cancelScheduled)) cancelled.add(launches[t].revision);
    delete launches[t];
  }
  function replace(snapshot, at, preserve = false) {
    for (const t of TRACKS) {
      if (preserve && !launches[t] && !stops[t]
        && (snapshot?.phraseIds[t] ?? null) === (tracks[t]?.id ?? null)
        && (!tracks[t] || JSON.stringify(snapshot.matrix[t].slice(0, snapshot.phraseBars?.[t] ?? snapshot.totalBars))
          === JSON.stringify(tracks[t].matrix.slice(0, tracks[t].bars)))) continue;
      invalidate(t); delete stops[t];
      const value = entry(snapshot, t, at, preserve);
      launches[t] = { entry: value, at, revision: value?.revision ?? nextVersion() };
    }
  }
  function toggle(snapshot, t, at, stopAt, restart = false) {
    const id = snapshot.phraseIds[t];
    if (!restart && launches[t]?.entry?.id === id) {
      const cancelledRequest = launches[t]; invalidate(t, true);
      // Lookahead may already have read the boundary. Restore the previously
      // audible phrase at the next schedulable step, without resetting its phase.
      if (tracks[t]?.revision === cancelledRequest.revision) {
        if (cancelledRequest.previous) tracks[t] = cancelledRequest.previous; else delete tracks[t];
        releases.set(t, stopAt);
      }
      source = null;
      return;
    }
    if (!restart && !stops[t] && (tracks[t]?.id === id || audible[t]?.id === id)) {
      stops[t] = { id, at: stopAt, revision: nextVersion() };
    } else {
      invalidate(t);
      const value = entry(snapshot, t, at, false);
      launches[t] = { entry: value, at, revision: value.revision };
    }
  }
  function remove(t, id, at) {
    if (launches[t]?.entry?.id === id) invalidate(t, true);
    if (tracks[t]?.id === id || audible[t]?.id === id) stops[t] = { id, at, revision: nextVersion() };
  }
  function snapshotFor(entries) {
    return { id: 'jam-current-combination', repeat: null, kind: 'main',
      matrix: Object.fromEntries(TRACKS.map(t => [t, entries[t]?.matrix ?? [Array(16).fill(null)]])),
      totalBars: Math.max(1, ...TRACKS.map(t => entries[t]?.bars ?? 1)),
      phraseBars: Object.fromEntries(TRACKS.map(t => [t, entries[t]?.bars ?? 1])),
      phraseIds: ids(entries),
      trackStepOffsets: Object.fromEntries(TRACKS.map(t => [t, entries[t]?.startStep ?? 0])),
    };
  }
  const hasWork = () => TRACKS.some(t => tracks[t] || launches[t]?.entry);
  function positions(entries, absolute) {
    return Object.fromEntries(TRACKS.filter(t => entries[t]).map(t => {
      const value = entries[t], localStep = Math.max(0, absolute - value.startStep), totalSteps = value.bars * 16;
      return [t, { phraseId: value.id, startStep: value.startStep, localStep, totalSteps,
        bar: Math.floor(localStep / 16) % value.bars, step: localStep % 16, fraction: (localStep % totalSteps) / totalSteps }];
    }));
  }
  return {
    replace, toggle, remove, hasWork,
    desiredIds: () => Object.fromEntries(TRACKS.map(t => [t,
      launches[t] ? launches[t].entry?.id ?? null : stops[t]?.id === tracks[t]?.id ? null : tracks[t]?.id ?? null])),
    state: () => ({ playingPhraseIds: ids(audible),
      queuedPhraseIds: Object.keys(launches).length ? Object.fromEntries(TRACKS.map(t => [t, launches[t]?.entry?.id ?? null])) : null }),
    progress: absolute => ({ snapshot: snapshotFor(audible), trackPositions: positions(audible, absolute) }),
    audition(snapshot, at) { overlayRequest = { snapshot, at }; },
    read(absolute) {
      const releaseTrackIds = new Set();
      for (const [t, at] of releases) if (absolute >= at) { releaseTrackIds.add(t); releases.delete(t); }
      for (const t of TRACKS) {
        if (stops[t] && absolute >= stops[t].at) {
          if (tracks[t]?.id === stops[t].id) { delete tracks[t]; releaseTrackIds.add(t); }
          delete stops[t]; source = null;
        }
        const request = launches[t];
        if (request && absolute >= request.at && !request.scheduled) {
          if (tracks[t]) releaseTrackIds.add(t);
          request.previous = tracks[t];
          if (request.entry) tracks[t] = request.entry; else delete tracks[t];
          request.scheduled = true; source = null;
        }
      }
      if (overlayRequest && absolute >= overlayRequest.at) {
        TRACKS.forEach(t => { if (overlay?.[t] || tracks[t]) releaseTrackIds.add(t); });
        overlay = overlayRequest.snapshot ? Object.fromEntries(TRACKS.map(t => {
          const value = entry(overlayRequest.snapshot, t, absolute, false);
          if (value && overlay?.[t]?.id === value.id) value.startStep = overlay[t].startStep;
          return [t, value];
        })) : null;
        overlayRequest = undefined; source = null;
      }
      if (!hasWork() && !overlay && !overlayRequest) return { done: true };
      const entries = { ...(overlay ?? tracks) }, requests = Object.fromEntries(Object.entries(overlay ? {} : launches)
        .filter(([, request]) => request.scheduled).map(([t, request]) => [t, request.revision]));
      source ??= snapshotFor(entries);
      return { ...source, stepOffset: 0, releaseTrackIds: [...releaseTrackIds],
        confirm() {
          if (absolute < lastAudible) return false;
          lastAudible = absolute;
          for (const t of TRACKS) {
            if (cancelled.has(entries[t]?.revision)) continue;
            if (entries[t]) audible[t] = entries[t]; else delete audible[t];
            if (requests[t] !== undefined && launches[t]?.revision === requests[t]) delete launches[t];
          }
          return true;
        }, trackPositions: positions(entries, absolute),
      };
    },
  };
}
