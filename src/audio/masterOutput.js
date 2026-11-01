// All voices, including preview notes and Jam effect tails, share one output.
// Leave headroom for coincident transients before applying peak compression.
export function createMasterOutput(context) {
  const input = context.createGain();
  input.gain.value = 10 ** (-6 / 20);
  const protection = context.createDynamicsCompressor();
  protection.threshold.value = -3;
  protection.knee.value = 0;
  protection.ratio.value = 20;
  protection.attack.value = 0.003;
  protection.release.value = 0.1;
  input.connect(protection).connect(context.destination);
  return input;
}
