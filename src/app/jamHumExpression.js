import { getDrumsCellInstruments, getDrumsCellVelocity } from '../domain/drumsCells.js';
import { jamTrackParameters } from './jamPerformanceState.js';

export const HUM_SOURCE = 'hum-generated';

const pitchClasses = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchOrder = note => Number(note.at(-1)) * 12 + pitchClasses.indexOf(note.slice(0, -1));
const velocity = (value = 1, gain) => Math.max(0.2, Math.min(1, value * gain));

export function humPlaybackBars(phrase) {
  const { trackId, bars } = phrase;
  if (phrase.sourcePresetId !== HUM_SOURCE) return bars;
  const { strength, groove } = jamTrackParameters(phrase.params, trackId);
  const left = (groove - (trackId === 'chord' ? 60 : 50)) / 50;
  const right = (strength - 50) / 50;
  return bars.map(bar => bar.map((cell, step) => {
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
    const length = trackId === 'bass' ? 0.77 + 0.23 * left : 1;
    const notes = Object.entries(cell.notePerformances ?? {});
    if (trackId === 'chord') notes.sort(([a], [b]) => pitchOrder(a) - pitchOrder(b));
    return {
      ...cell,
      velocity: velocity(cell.velocity, gainAt(cell.timingOffset ?? 0)),
      ...(trackId === 'bass' && Number.isFinite(cell.durationSteps) ? { durationSteps: cell.durationSteps * length } : {}),
      ...(notes.length ? { notePerformances: Object.fromEntries(notes.map(([note, hits], index) => {
        const voiceGain = trackId === 'chord' && notes.length > 1 ? left * 0.38 * (2 * index / (notes.length - 1) - 1) : 0;
        return [note, hits.map(hit => ({ ...hit, velocity: velocity(hit.velocity ?? cell.velocity, gainAt(hit.offsetSteps ?? 0) + voiceGain), durationSteps: hit.durationSteps * length }))];
      })) } : {}),
    };
  }));
}
