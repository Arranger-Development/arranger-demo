import { getDrumsCellInstruments, getDrumsCellVelocity } from '../domain/drumsCells.js';
import { humRhythmBars } from './jamHumRhythm.js';
import { humChordVoicingBars } from './jamHumVoicing.js';
import { jamTrackParameters } from './jamPerformanceState.js';

export const HUM_SOURCE = 'hum-generated';

const velocity = (value = 1, gain) => Math.max(0.2, Math.min(1, value * gain));

function humSequencerBars(phrase, strength, groove) {
  const bars = humRhythmBars(phrase, phrase.trackId === 'drums' ? groove : strength);
  return phrase.trackId === 'chord' ? humChordVoicingBars(phrase, bars, groove) : bars;
}

export function isHumBacking(phrase) {
  return phrase?.sourcePresetId === HUM_SOURCE && phrase.trackId !== 'melody';
}

export function canRefreshHumHarmony(phrase) {
  return phrase?.sourcePresetId === HUM_SOURCE && ['chord', 'bass'].includes(phrase.trackId)
    && !phrase.humEditedSteps?.length;
}

export function canFollowJamMelody(phrase, melodyId) {
  return isHumBacking(phrase) && !phrase.humEditedSteps?.length
    && (!phrase.humBackingMelodyId || phrase.humBackingMelodyId === melodyId);
}

export function editJamSequencerStep(phrase, barIndex, step, editBar) {
  const baseBar = phrase.bars[barIndex];
  const bars = [...phrase.bars];
  if (!isHumBacking(phrase)) {
    bars[barIndex] = editBar(baseBar);
    return bars[barIndex] === baseBar ? phrase : { ...phrase, bars };
  }

  const { strength, groove } = jamTrackParameters(phrase.params, phrase.trackId);
  const drums = phrase.trackId === 'drums';
  const visibleRhythm = humSequencerBars(phrase, strength, groove)[barIndex];
  // Keep the rhythm around the edited pitch intact, without saving knob-dependent gain or length.
  const edited = editBar(visibleRhythm);
  if (edited === visibleRhythm) return phrase;
  const changedSteps = [step];
  edited.forEach((cell, index) => { if (cell !== visibleRhythm[index]) changedSteps.push(index); });
  const windowAt = index => drums ? index : Math.floor(index / 8);
  const windows = new Set(changedSteps.map(windowAt));
  bars[barIndex] = baseBar.map((cell, index) => windows.has(windowAt(index)) ? edited[index] : cell);
  const humEditedSteps = [...new Set([...(phrase.humEditedSteps ?? []), ...changedSteps.map(index => barIndex * 16 + index)])];
  return { ...phrase, bars, humEditedSteps };
}

export function humPlaybackBars(phrase) {
  const { trackId } = phrase;
  if (phrase.sourcePresetId !== HUM_SOURCE) return phrase.bars;
  const { strength, groove } = jamTrackParameters(phrase.params, trackId);
  const left = (groove - 50) / 50;
  const right = (strength - 50) / 50;
  const bars = humSequencerBars(phrase, strength, groove);
  const fixedSteps = new Set(phrase.humEditedSteps);
  return bars.map((bar, barIndex) => bar.map((cell, step) => {
    if (!cell) return cell;
    if (trackId === 'drums') {
      const gain = instrument => 1 + right * 0.38 + left * (instrument === 'hihat' || step % 4 !== 0 ? 0.36 : 0);
      if (cell.drumHits) return { ...cell, drumHits: cell.drumHits.map(hit => ({ ...hit, velocity: velocity(hit.velocity, gain(hit.instrument)) })) };
      return { ...cell, velocities: Object.fromEntries(getDrumsCellInstruments(cell).map(instrument => [instrument, velocity(getDrumsCellVelocity(cell, instrument), gain(instrument))])) };
    }
    const gainAt = offset => {
      const position = Math.round(step + offset) % 16;
      const accent = trackId === 'chord' ? (position === 0 ? 0.26 : -0.23)
        : position % 8 === 0 ? 0.24 : position % 4 === 0 ? 0.08 : -0.28;
      return 1 + right * (trackId === 'bass' ? -accent : accent) + (trackId === 'melody' ? left * 0.4 : 0);
    };
    const length = trackId === 'bass' && !fixedSteps.has(barIndex * 16 + step) ? 0.77 + 0.23 * left : 1;
    const notes = Object.entries(cell.notePerformances ?? {});
    return {
      ...cell,
      velocity: velocity(cell.velocity, gainAt(cell.timingOffset ?? 0)),
      ...(trackId === 'bass' && Number.isFinite(cell.durationSteps) ? { durationSteps: cell.durationSteps * length } : {}),
      ...(notes.length ? { notePerformances: Object.fromEntries(notes.map(([note, hits]) =>
        [note, hits.map(hit => ({ ...hit, velocity: velocity(hit.velocity ?? cell.velocity, gainAt(hit.offsetSteps ?? 0)), durationSteps: hit.durationSteps * length }))])) } : {}),
    };
  }));
}
