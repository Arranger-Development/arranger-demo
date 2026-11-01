import { DIAL_PITCHED_PRESETS } from '../data/dialPitchedPresets.js';
import { jamTrackKnobs } from './jamPerformanceState.js';

// Jam's requested grid alignment is separate from the lossless Ableton source.
export function snapJamPitchedPreset(preset) {
  const bars = Array.from({length:preset.barCount},()=>Array(16).fill(null));
  const totalSteps = preset.barCount * 16;
  for(let bar=0;bar<preset.bars.length;bar++)for(let step=0;step<16;step++) {
    const source = preset.bars[bar][step];
    for(const [note,hits] of Object.entries(source?.notePerformances ?? {}))for(const hit of hits) {
      const at = bar*16+step+hit.offsetSteps, end = at+hit.durationSteps;
      const start = Math.max(0,Math.min(totalSteps-1,Math.round(at)));
      const boundary = Math.ceil((end-1e-7)/16)*16;
      const tailGap = boundary-end;
      const stop = Math.max(start+1,Math.min(totalSteps,
        tailGap>1e-7 && tailGap<1 ? boundary : Math.round(end)));
      const targetBar = Math.floor(start/16), targetStep = start%16;
      const cell = bars[targetBar][targetStep] ??= {
        type:preset.trackId==='chord'?'notes':preset.trackId,notes:[],notePerformances:{},noteDurationSteps:{},
      };
      if(!cell.notes.includes(note))cell.notes.push(note);
      (cell.notePerformances[note] ??= []).push({...hit,offsetSteps:0,durationSteps:stop-start});
      cell.noteDurationSteps[note] = Math.max(cell.noteDurationSteps[note] ?? 0,stop-start);
    }
  }
  if(preset.trackId!=='chord')for(const cell of bars.flat())if(cell?.notes.length===1) {
    cell.note=cell.notes[0];delete cell.notes;
  }
  return {...preset,bars};
}

export const JAM_PITCHED_PRESETS = DIAL_PITCHED_PRESETS.map(preset => ({
  ...snapJamPitchedPreset(preset),
  name: jamTrackKnobs(preset.trackId).map(({parameter,label}) => `${label}${preset[parameter]}`).join(' · '),
}));

export const getJamPitchedPreset = (trackId, strength, groove) => JAM_PITCHED_PRESETS
  .find(preset => preset.trackId === trackId && preset.strength === strength && preset.groove === groove);
