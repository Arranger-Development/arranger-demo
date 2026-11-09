const sampleRate = 22050;
const envelopeSize = 110;
const minShortSeconds = 0.048;
const maxShortSeconds = 0.19;
const midiPeriod = midi => sampleRate / (440 * 2 ** ((midi - 69) / 12));
const minLag = Math.floor(midiPeriod(89));
const maxLag = Math.ceil(midiPeriod(35));
const correlationHalfWindow = 198;
const pitchMargin = correlationHalfWindow + Math.ceil(maxLag / 2);

function voicedRegions(samples) {
  const levels = [];
  for (let offset = 0; offset < samples.length; offset += envelopeSize) {
    let energy = 0;
    const end = Math.min(offset + envelopeSize, samples.length);
    for (let i = offset; i < end; i++) energy += samples[i] ** 2;
    levels.push(Math.sqrt(energy / (end - offset)));
  }
  const peak = Math.max(...levels);
  const noise = levels.toSorted((a, b) => a - b)[Math.floor(levels.length / 10)];
  const floor = Math.max(0.0025, peak * 0.04, Math.min(noise * 2.5, peak * 0.12));
  const regions = [];
  let first = -1, last = -1;
  const finish = () => {
    if (first >= 0) regions.push({ start: first * envelopeSize / sampleRate,
      end: Math.min((last + 1) * envelopeSize, samples.length) / sampleRate });
  };
  for (let frame = 0; frame < levels.length; frame++) {
    const before = Math.max(0, ...levels.slice(Math.max(0, frame - 5), frame));
    const after = Math.max(0, ...levels.slice(frame + 1, frame + 6));
    const dipFloor = Math.min(before, after) * 0.18;
    if (levels[frame] < Math.max(floor, dipFloor)) continue;
    const silence = frame - last === 2 && levels[last + 1] < floor * 0.6;
    if (first < 0 || frame - last > 2 || silence) {
      finish();
      first = frame;
    }
    last = frame;
  }
  finish();
  return regions;
}

function correlation(samples, center, lag) {
  const start = center - correlationHalfWindow - Math.floor(lag / 2);
  const end = start + correlationHalfWindow * 2;
  let xSum = 0, ySum = 0, xx = 0, yy = 0, xy = 0;
  for (let i = start; i < end; i += 2) {
    const x = samples[i], y = samples[i + lag];
    xSum += x;
    ySum += y;
    xx += x * x;
    yy += y * y;
    xy += x * y;
  }
  const count = correlationHalfWindow;
  const variance = (xx - xSum * xSum / count) * (yy - ySum * ySum / count);
  return variance > 0 ? (xy - xSum * ySum / count) / Math.sqrt(variance) : 0;
}

function pitchAt(samples, center) {
  const scores = [];
  for (let lag = minLag; lag <= maxLag; lag++) scores.push(correlation(samples, center, lag));
  const threshold = Math.max(0.85, Math.max(...scores) - 0.045);
  // Repeated peaks also occur at multiples of the fundamental period.
  for (let i = 1; i < scores.length - 1; i++) {
    const [left, value, right] = [scores[i - 1], scores[i], scores[i + 1]];
    if (value < threshold || value <= left || value < right) continue;
    const offset = (right - left) / (2 * (2 * value - left - right));
    return 69 + 12 * Math.log2(sampleRate / ((minLag + i + offset) * 440));
  }
  return null;
}

function settledPitch(samples, { start, end }) {
  const earliest = Math.ceil(start * sampleRate) + pitchMargin;
  const latest = Math.floor(end * sampleRate) - pitchMargin;
  if (latest <= earliest) return null;
  const estimates = [0.35, 0.6, 0.85].map(fraction =>
    pitchAt(samples, Math.round(earliest + fraction * (latest - earliest)))).filter(Number.isFinite);
  if (estimates.length < 2) return null;
  const sorted = estimates.toSorted((a, b) => a - b);
  const center = sorted[Math.floor(sorted.length / 2)];
  return estimates.filter(pitch => Math.abs(pitch - center) <= 0.4).length >= 2 ? center : null;
}

const overlap = (a, b) => Math.min(a.end, b.end) - Math.max(a.start, b.start);

function connectedShortNotes(samples, region, notes) {
  // Only revisit compact runs the model already heard as several short notes.
  if (region.end - region.start > 1.25) return [];
  const source = notes.filter(note => overlap(note, region) >= minShortSeconds);
  if (source.length < 2 || source.some(note => note.end - note.start > maxShortSeconds + 0.025)) return [];

  const hop = Math.round(0.008 * sampleRate);
  const first = Math.ceil(region.start * sampleRate) + pitchMargin;
  const last = Math.floor(region.end * sampleRate) - pitchMargin;
  const runs = [];
  for (let frame = first; frame <= last; frame += hop) {
    const center = pitchAt(samples, frame);
    const pitch = Math.round(center);
    if (center === null || pitch < 36 || pitch > 88 || Math.abs(center - pitch) > 0.29) continue;
    const run = runs.at(-1);
    if (run?.pitch === pitch && frame === run.last + hop) {
      run.last = frame;
      run.count++;
      run.low = Math.min(run.low, center);
      run.high = Math.max(run.high, center);
    } else runs.push({ pitch, first: frame, last: frame, count: 1, low: center, high: center });
  }
  const stable = runs.filter(run => run.count >= 4 && run.high - run.low <= 0.34);
  // A glide spends most of its time between pitches, with no quick transition
  // between separate steady plateaus. Keep the model result when the run is unclear.
  if (stable.length < 2 || (stable[0].first - first) / sampleRate > 0.024
    || (last - stable.at(-1).last) / sampleRate > 0.024
    || stable.some((run, i) => i > 0 &&
      (run.pitch === stable[i - 1].pitch || (run.first - stable[i - 1].last) / sampleRate > 0.036))) return [];

  const boundary = index => (stable[index - 1].last + stable[index].first) / (2 * sampleRate);
  const recovered = stable.map((run, i) => {
    const start = i === 0 ? region.start : boundary(i);
    const end = i === stable.length - 1 ? region.end : boundary(i + 1);
    const model = source.find(note => note.pitch === run.pitch && overlap(note, { start, end }) >= minShortSeconds);
    return { start, end, pitch: run.pitch, pitchCenter: run.pitch, amplitude: model?.amplitude ?? 0.7, shortAttack: true };
  });
  return recovered.every(note => note.end - note.start >= minShortSeconds) ? recovered : [];
}

export function recoverShortHumNotes(notes, samples) {
  if (!samples?.length) return notes;
  const regions = voicedRegions(samples);
  const recovered = new Map();
  for (const region of regions) {
    const length = region.end - region.start;
    if (length < minShortSeconds) continue;
    if (length > maxShortSeconds) {
      const connected = connectedShortNotes(samples, region, notes);
      if (connected.length) recovered.set(region, connected);
      continue;
    }
    const pitchCenter = settledPitch(samples, region);
    if (pitchCenter === null) continue;
    const pitch = Math.round(pitchCenter);
    if (pitch < 36 || pitch > 88) continue;
    const model = notes.find(note => note.pitch === pitch && overlap(note, region) >= length / 2);
    recovered.set(region, [{ ...region, pitch, pitchCenter, amplitude: model?.amplitude ?? 0.7, shortAttack: true }]);
  }
  if (!recovered.size) return notes;

  const recoveredRegions = [...recovered.keys()];
  const remaining = notes.flatMap(note => {
    const voiced = regions.filter(region => overlap(note, region) > 0);
    const meetsRecovery = voiced.some(region => recovered.has(region));
    if (!meetsRecovery) {
      // A model note beside a recovered syllable can be a prediction over silence.
      const nearRecovery = recoveredRegions.some(region => overlap(note, region) >= -0.08);
      return voiced.length || !nearRecovery ? [note] : [];
    }
    return voiced.flatMap(region => {
      if (recovered.has(region) || overlap(note, region) < 0.065) return [];
      return [{ ...note, start: Math.max(note.start, region.start), end: Math.min(note.end, region.end) }];
    });
  });
  return [...remaining, ...[...recovered.values()].flat()].sort((a, b) => a.start - b.start);
}
