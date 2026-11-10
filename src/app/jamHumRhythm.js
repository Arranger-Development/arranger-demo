import { createDrumsCell, getDrumsCellInstruments, getDrumsCellVelocity, getDrumsCellTimingOffset } from '../domain/drumsCells.js';

function drumHits(cell) {
  return cell?.drumHits ?? getDrumsCellInstruments(cell).map(instrument => ({
    instrument, offsetSteps: getDrumsCellTimingOffset(cell, instrument), durationSteps: 1,
    velocity: getDrumsCellVelocity(cell, instrument),
  }));
}

function drumRhythm(bar, level, edited, rest) {
  const keepBaseHats = level >= 75;
  return bar.map((cell, step) => {
    if (edited(step) || rest(step)) return cell;
    const hits = drumHits(cell);
    const hatStep = level === 0 ? step % 8 === 0
      : level === 25 ? step % 4 === 2
      : level === 75 ? step % 2 === 0 : true;
    const next = hits.filter(hit => hit.instrument !== 'hihat'
      || keepBaseHats || (hatStep && hit.offsetSteps === 0));
    if (hatStep && !next.some(hit => hit.instrument === 'hihat')) {
      const velocity = step % 4 === 0 ? 0.60 : step % 2 === 0 ? 0.51 : 0.39;
      next.push({ instrument: 'hihat', offsetSteps: 0, durationSteps: 1, velocity });
    }
    return createDrumsCell(next.map(hit => hit.instrument), { drumHits: next });
  });
}

export function humDrumPatternBars(phrase, bars, level) {
  if (level === 50) return bars;
  const edited = new Set(phrase.humEditedSteps);
  const quiet = new Set(phrase.humDrumQuietSteps ?? phrase.humDrumRestSteps);
  const sounding = phrase.humDrumSoundingRanges;
  const optional = hit => hit.humOptionalAccent || (phrase.humDrumQuietSteps && hit.velocity === 0.48);
  const firstEntry = bars.flat().findIndex(cell => drumHits(cell)
    .some(hit => hit.instrument === 'kick' && !optional(hit)));
  return bars.map((bar, index) => {
    const start = index * 16;
    const hits = bar.map(drumHits);
    const available = step => !edited.has(start + step) && !quiet.has(start + step);
    const isSounding = step => sounding?.some(([from, to]) => start + step >= from && start + step < to);
    const add = (step, instrument, velocity) => {
      if (available(step) && !hits[step].some(hit => hit.instrument === instrument)) {
        hits[step] = [...hits[step], { instrument, offsetSteps: 0, durationSteps: 1, velocity }];
      }
    };
    if (level <= 25) {
      for (let step = 0; step < 16; step++) {
        if (edited.has(start + step)) continue;
        hits[step] = hits[step].filter(hit => hit.instrument !== 'snare'
          && (hit.instrument !== 'kick' || !optional(hit)));
      }
      if (level === 25) add(8, 'snare', 0.74);
    } else if (level === 75) {
      for (const half of [0, 8]) {
        const step = [half + 2, half + 6].find(at => available(at) && isSounding(at)
          && !hits[at].some(hit => hit.instrument === 'kick')
          && firstEntry >= 0 && start + at > firstEntry);
        if (step !== undefined) add(step, 'kick', 0.49);
      }
    } else {
      for (const step of [4, 12]) {
        if (hits[step].some(hit => hit.instrument === 'snare')) add(step - 1, 'snare', 0.34);
      }
    }
    return bar.map((cell, step) => edited.has(start + step) ? cell
      : createDrumsCell(hits[step].map(hit => hit.instrument), { drumHits: hits[step] }));
  });
}

function onsetOffset(cell) {
  const first = Object.values(cell?.notePerformances ?? {})[0]?.[0];
  return first?.offsetSteps ?? cell?.timingOffset ?? 0;
}

function pitchedCell(cell, duration, notes = cell.notes ?? [cell.note], gain = 1, offsetSteps = 0) {
  const notePerformances = Object.fromEntries(notes.map(note => [note, [{ offsetSteps, durationSteps: duration,
    velocity: (cell.notePerformances?.[note]?.[0]?.velocity ?? cell.velocity ?? 0.65) * gain }]]));
  return { ...cell, ...(cell.notes ? { notes } : {}), durationSteps: duration, notePerformances };
}

function pitchedRhythm(bar, track, level, edited) {
  const next = [...bar];
  for (const start of [0, 8]) {
    const first = bar.slice(start, start + 8).findIndex(cell => track === 'chord' ? cell?.notes?.length : cell?.note);
    const onset = start + first;
    const root = first < 0 ? null : bar[onset];
    // Keep hand-authored material in its harmonic window intact, including removed steps.
    const touched = Array.from({ length: 8 }, (_, offset) => edited(start + offset)).some(Boolean);
    const crossesFromFirstHalf = start === 8 && bar.slice(0, 8).some((cell, step) => edited(step) && cell &&
      step + Math.max(cell.durationSteps ?? 0, ...Object.values(cell.notePerformances ?? {}).flat().map(hit => hit.offsetSteps + hit.durationSteps)) > 8);
    if (!root || touched || crossesFromFirstHalf) continue;
    const offset = onsetOffset(root);
    if (track === 'bass') {
      // A fixed chord phrase can change root inside this half-bar.
      if (bar.slice(start + 1, start + 8).some(cell => cell?.harmonyAnchor)) continue;
      const saved = bar.slice(start, start + 8).flatMap((cell, i) => cell?.note && i > first ? [i] : []);
      const late = root.humRhythmEntry && saved.length ? saved : [6];
      const accents = level === 0 ? [] : level === 25 ? late.filter(i => bar[start + i]) : level === 75 ? late : [3, ...late];
      const windowEnd = root.humRhythmEntry ? Math.min(start + 8, Math.max(...[first, ...saved].map(i => {
        const cell = bar[start + i];
        return start + i + onsetOffset(cell) + cell.durationSteps + 0.2;
      }))) : start + 8;
      const positions = [...new Set([first, ...accents.filter(i => i > first && start + i + onsetOffset(bar[start + i]) < windowEnd - 0.15)])]
        .sort((a, b) => a - b).map(i => ({ step: start + i, offset: onsetOffset(bar[start + i]) }));
      for (let i = onset; i < start + 8; i++) next[i] = null;
      positions.forEach(({ step, offset }, index) => {
        const nextHit = positions[index + 1];
        const end = nextHit ? nextHit.step + nextHit.offset : windowEnd;
        const room = end - step - offset;
        const length = Math.min(index ? 1.6 : level === 25 ? 5 : 7.8, room - Math.min(0.2, room * 0.15));
        const cell = bar[step]?.harmonyLink ? bar[step] : root;
        next[step] = pitchedCell(cell, length, [cell.note], index && cell === root ? 0.78 : 1, offset);
      });
    } else if (root.notes?.length) {
      const windowEnd = root.humRhythmEntry ? Math.min(start + 8, onset + offset + root.durationSteps) : start + 8 - 0.2;
      const room = Math.max(1, Math.ceil(windowEnd - onset));
      const place = (step, duration, notes = root.notes, gain = 1) => {
        const hitOffset = step === onset ? offset : 0;
        const length = Math.min(duration, windowEnd - step - hitOffset);
        if (length > 0) next[step] = pitchedCell(root, length, notes, gain, hitOffset);
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

function melodyFollowingBars(phrase, level) {
  const base = phrase.bars.flat(), next = [...base];
  const editedHalves = new Set((phrase.humEditedSteps ?? []).map(step => Math.floor(step / 8)));
  const editable = step => !editedHalves.has(Math.floor(step / 8));
  const chord = phrase.trackId === 'chord';
  if (level === 0) return phrase.bars.map((bar, index) => bar.map((cell, step) => {
    const optionalVelocity = chord ? 0.31 : 0.48;
    const firstHit = Object.values(cell?.notePerformances ?? {})[0]?.[0];
    return editable(index * 16 + step)
      && (cell?.humOptionalAccent || cell?.harmonyLink || firstHit?.velocity === optionalVelocity) ? null : cell;
  }));

  for (const [step, cell] of base.entries()) {
    if (!cell || !editable(step)) continue;
    const offset = onsetOffset(cell), end = step + offset + cell.durationSteps;
    const notes = cell.notes ?? [cell.note];
    if (level === 25) {
      next[step] = pitchedCell(cell, Math.min(cell.durationSteps, chord ? 3.1 : 2.2), notes, 1, offset);
      continue;
    }
    const fills = [];
    const firstFill = step + (level === 100 ? 1 : 2);
    const halfEnd = (Math.floor(step / 8) + 1) * 8;
    for (let at = firstFill; at < Math.min(end - 0.15, halfEnd); at++) {
      if (base[at] || !editable(at)) continue;
      if (level === 75 && at % 4 !== 2) continue;
      if (!chord && level === 100 && at % 2 !== 1) continue;
      const range = phrase.humSoundingRanges.find(([start, stop]) => at >= start && at < stop - 0.15);
      if (!range) continue;
      fills.push({ at, end: Math.min(end, range[1]) });
      if (!chord || level === 75 || fills.length >= notes.length - 1) break;
    }
    if (!fills.length) continue;
    const firstLength = fills[0].at - step - offset;
    if (chord && level === 100) {
      next[step] = pitchedCell(cell, firstLength, notes.slice(0, 1), 1, offset);
      fills.forEach(({ at, end }, index) => {
        const voices = index === fills.length - 1 ? notes.slice(index + 1) : notes.slice(index + 1, index + 2);
        next[at] = pitchedCell(cell, Math.min(2.6, end - at), voices, 0.8);
      });
    } else {
      next[step] = pitchedCell(cell, firstLength, notes, 1, offset);
      const [fill] = fills;
      next[fill.at] = pitchedCell(cell, Math.min(1.6, fill.end - fill.at), notes, 0.7);
    }
  }
  return phrase.bars.map((bar, index) => next.slice(index * 16, index * 16 + bar.length));
}

export function humRhythmBars(phrase, level) {
  if (level === 50 || phrase.trackId === 'melody') return phrase.bars;
  if (phrase.humSoundingRanges) return melodyFollowingBars(phrase, level);
  const touched = new Set(phrase.humEditedSteps);
  const rests = new Set(phrase.humDrumQuietSteps ?? phrase.humDrumRestSteps);
  return phrase.bars.map((bar, index) => {
    const edited = step => touched.has(index * 16 + step);
    return phrase.trackId === 'drums' ? drumRhythm(bar, level, edited, step => rests.has(index * 16 + step)) : pitchedRhythm(bar, phrase.trackId, level, edited);
  });
}
