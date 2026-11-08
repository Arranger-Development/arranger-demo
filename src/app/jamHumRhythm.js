import { createDrumsCell, getDrumsCellInstruments, getDrumsCellVelocity, getDrumsCellTimingOffset } from '../domain/drumsCells.js';

function drumRhythm(bar, level, edited) {
  return bar.map((cell, step) => {
    if (edited(step)) return cell;
    const instruments = getDrumsCellInstruments(cell);
    const hits = cell?.drumHits ?? instruments.map(instrument => ({ instrument, offsetSteps: getDrumsCellTimingOffset(cell, instrument),
      durationSteps: 1, velocity: getDrumsCellVelocity(cell, instrument) }));
    const hats = level === 0 ? step % 4 === 0 : level === 25 || level === 75 ? step % 2 === 0 : true;
    const next = hits.filter(hit => hit.instrument !== 'hihat' || hats && (level === 100 || hit.offsetSteps === 0));
    if (level > 50 && hats && !next.some(hit => hit.instrument === 'hihat')) {
      next.push({ instrument: 'hihat', offsetSteps: 0, durationSteps: 1, velocity: step % 4 ? 0.43 : 0.60 });
    }
    return createDrumsCell(next.map(hit => hit.instrument), { drumHits: next });
  });
}

function pitchedCell(cell, duration, notes = cell.notes ?? [cell.note], gain = 1) {
  const notePerformances = Object.fromEntries(notes.map(note => [note, [{ offsetSteps: 0, durationSteps: duration,
    velocity: (cell.notePerformances?.[note]?.[0]?.velocity ?? cell.velocity ?? 0.65) * gain }]]));
  return { ...cell, ...(cell.notes ? { notes } : {}), durationSteps: duration, notePerformances };
}

function pitchedRhythm(bar, track, level, edited) {
  const next = [...bar];
  for (const start of [0, 8]) {
    const first = track === 'chord' ? bar.slice(start, start + 8).findIndex(cell => cell?.notes?.length) : 0;
    const onset = start + first;
    const root = first < 0 ? null : bar[onset];
    // Keep hand-authored material in its harmonic window intact, including removed steps.
    const touched = Array.from({ length: 8 }, (_, offset) => edited(start + offset)).some(Boolean);
    const crossesFromFirstHalf = start === 8 && bar.slice(0, 8).some((cell, step) => edited(step) && cell &&
      step + Math.max(cell.durationSteps ?? 0, ...Object.values(cell.notePerformances ?? {}).flat().map(hit => hit.offsetSteps + hit.durationSteps)) > 8);
    if (!root || touched || crossesFromFirstHalf) continue;
    if (track === 'bass') {
      // A fixed chord phrase can change root inside this half-bar.
      if (bar.slice(start + 1, start + 8).some(cell => cell?.harmonyAnchor)) continue;
      const accents = level === 0 ? [] : level === 25 ? [6].filter(offset => bar[start + offset]) : level === 75 ? [6] : [3, 6];
      for (let i = 1; i < 8; i++) next[start + i] = null;
      [0, ...accents].forEach((offset, index) => {
        const end = accents[index] ?? 8;
        const length = index ? Math.min(1.6, end - offset - 0.15) : Math.min(level === 25 ? 5 : 7.8, end - 0.2);
        const cell = bar[start + offset]?.harmonyLink ? bar[start + offset] : root;
        next[start + offset] = pitchedCell(cell, length, [cell.note], index && cell === root ? 0.78 : 1);
      });
    } else if (root.notes?.length) {
      const room = start + 8 - onset;
      const place = (step, duration, notes = root.notes, gain = 1) => {
        next[step] = pitchedCell(root, Math.min(duration, start + 8 - step - 0.2), notes, gain);
      };
      if (level === 0 || level === 25) place(onset, level === 0 ? 7.8 : 3.1);
      if (level === 75) {
        place(onset, 3.2);
        if (room >= 4 && !bar[start + 6]) place(start + 6, 1.6, root.notes, 0.78);
      }
      if (level === 100 && !bar.slice(onset + 1, start + 8).some(Boolean)) {
        const spacing = room >= 6 ? 2 : 1;
        let previousStep;
        root.notes.forEach((note, index) => {
          const step = onset + Math.min(room - 1, index * spacing);
          const existing = step === previousStep ? next[step].notes : [];
          place(step, 2.6, [...existing, note]);
          previousStep = step;
        });
      }
    }
  }
  return next;
}

export function humRhythmBars(phrase, level) {
  if (level === 50 || phrase.trackId === 'melody') return phrase.bars;
  const touched = new Set(phrase.humEditedSteps);
  return phrase.bars.map((bar, index) => {
    const edited = step => touched.has(index * 16 + step);
    return phrase.trackId === 'drums' ? drumRhythm(bar, level, edited) : pitchedRhythm(bar, phrase.trackId, level, edited);
  });
}
