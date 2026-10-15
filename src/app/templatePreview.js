import { createMatrixPlaybackAdapter } from '../audio/matrixPlaybackAdapter.js';

const STEPS = 16;

function pitchNumber(note) {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  if (!match) return null;
  const pitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
  return (Number(match[3]) + 1) * 12 + pitch + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0);
}

function durationSteps(event, cell) {
  const explicit = event.durationSteps ?? cell?.durationSteps;
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const match = /^(\d+)(n|t|m)(\.)?$/.exec(event.duration ?? '16n');
  if (!match) return 1;
  const count = Number(match[1]);
  if (count <= 0) return 1;
  return (match[2] === 'm' ? count * STEPS : STEPS / count)
    * (match[2] === 't' ? 2 / 3 : 1) * (match[3] ? 1.5 : 1);
}

export function hitStrength(velocity = 1) {
  return velocity >= 0.9 ? 'accent' : velocity <= 0.45 ? 'ghost' : 'normal';
}

export function clampPreviewBar(index, barCount) {
  return Math.max(0, Math.min(barCount - 1, index));
}

// Use the same event extraction as audition, including legacy chords and rich drum hits.
// This is a read-only projection; saved phrases and Jam pad positions are never changed.
export function createTemplatePreview(template) {
  const bars = template.bars.map(() => ({ hits: [], notes: [] }));
  const adapter = createMatrixPlaybackAdapter({ [template.trackId]: template.bars }, { totalBars: bars.length });
  const pitches = [];
  for (let bar = 0; bar < bars.length; bar++) {
    for (let step = 0; step < STEPS; step++) {
      for (const event of adapter.getEventsForStep(bar, step)) {
        const offset = Number.isFinite(event.timingOffset) ? event.timingOffset : 0;
        if (template.trackId === 'drums') {
          // Keep early/late hits in their source step, so swing and retriggers stay visible.
          bars[bar].hits.push({ instrument: event.instrument, step, offset, velocity: event.velocity ?? 1 });
          continue;
        }
        const start = bar * STEPS + step + offset;
        const end = start + durationSteps(event, template.bars[bar][step]);
        for (const note of event.notes ?? [event.note]) {
          const pitch = pitchNumber(note);
          if (pitch === null) continue;
          pitches.push(pitch);
          // Include the visible tail of notes held over a bar boundary.
          for (let page = Math.max(0, Math.floor(start / STEPS)); page <= Math.min(bars.length - 1, Math.ceil(end / STEPS) - 1); page++) {
            const left = Math.max(0, start - page * STEPS);
            const right = Math.min(STEPS, end - page * STEPS);
            if (right > left) bars[page].notes.push({ note, pitch, start: left, duration: right - left, continued: start < page * STEPS });
          }
        }
      }
    }
  }
  // Keep the pitch scale fixed while paging. A minimum octave makes sparse phrases legible.
  const low = pitches.length ? Math.min(...pitches) : 60;
  const high = pitches.length ? Math.max(...pitches) : 72;
  const padding = Math.max(0, 12 - (high - low));
  return { bars, minPitch: low - Math.floor(padding / 2), maxPitch: high + Math.ceil(padding / 2) };
}
