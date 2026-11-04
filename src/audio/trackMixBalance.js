import { getTrackTypeFromInstanceId } from '../domain/trackInstances.js';

// Gentle, fixed track dynamics. No per-note normalization or automatic fader moves.
export const TRACK_MIX_DYNAMICS = Object.freeze({
  drums: Object.freeze({ threshold:-14, knee:12, ratio:2.5, attack:.015, release:.12, outputTrimDb:-3 }),
  chord: Object.freeze({ threshold:-14, knee:12, ratio:1.6, attack:.02, release:.18, outputTrimDb:0 }),
  bass: Object.freeze({ threshold:-18, knee:12, ratio:4, attack:.012, release:.15, outputTrimDb:-7 }),
  melody: Object.freeze({ threshold:-18, knee:12, ratio:2, attack:.012, release:.18, outputTrimDb:0 }),
});
const outputs=new WeakMap();

export function createTrackMixOutput(context, trackId, destination) {
  const settings=TRACK_MIX_DYNAMICS[getTrackTypeFromInstanceId(trackId)];
  if (!settings || !context?.createDynamicsCompressor || !context?.createGain) return destination;
  const dynamics=context.createDynamicsCompressor();
  const {outputTrimDb,...parameters}=settings;
  for (const [name,value] of Object.entries(parameters)) dynamics[name].value=value;
  // Native compressors have their own makeup behaviour. Calibrate the entire
  // channel after compression so quiet stems aren't boosted unintentionally.
  const output=context.createGain();output.gain.value=10**(outputTrimDb/20);
  dynamics.connect(output).connect(destination);
  outputs.set(dynamics,output);
  return dynamics;
}

export function disposeTrackMixOutput(input) {
  const output=input&&outputs.get(input);
  if (!output) return;
  input.disconnect();output.disconnect();outputs.delete(input);
}
