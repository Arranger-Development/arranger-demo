const sampleRate = 22050;
const envelopeSize = 110;
const minShortSeconds = 0.048;
const maxShortSeconds = 0.19;
const transitionNoteSeconds = 0.13;
const maxGlideSeconds = 0.24;
const pitchHop = Math.round(0.008 * sampleRate);
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
  return { regions, levels };
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

function pitchTrace(samples, region, start, end, cache) {
  const first = Math.max(Math.ceil(start * sampleRate), Math.ceil(region.start * sampleRate) + pitchMargin);
  const last = Math.min(Math.floor(end * sampleRate), Math.floor(region.end * sampleRate) - pitchMargin);
  const trace = [];
  for (let frame = Math.ceil(first / pitchHop) * pitchHop; frame <= last; frame += pitchHop) {
    if (!cache.has(frame)) cache.set(frame, pitchAt(samples, frame));
    trace.push({ frame, center: cache.get(frame) });
  }
  return trace;
}

function stablePitchRuns(trace) {
  const runs = [];
  for (const { frame, center } of trace) {
    const pitch = Math.round(center);
    if (center === null || pitch < 36 || pitch > 88 || Math.abs(center - pitch) > 0.29) continue;
    const run = runs.at(-1);
    if (run?.pitch === pitch && frame === run.last + pitchHop) {
      run.last = frame;
      run.count++;
      run.low = Math.min(run.low, center);
      run.high = Math.max(run.high, center);
    } else runs.push({ pitch, first: frame, last: frame, count: 1, low: center, high: center });
  }
  return runs.filter(run => run.count >= 4 && run.high - run.low <= 0.34);
}

function connectedShortNotes(samples, region, notes, cache) {
  // Only revisit compact runs the model already heard as several short notes.
  if (region.end - region.start > 1.25) return [];
  const source = notes.filter(note => overlap(note, region) >= minShortSeconds);
  if (source.length < 2 || source.some(note => note.end - note.start > maxShortSeconds + 0.025)) return [];

  const trace = pitchTrace(samples, region, region.start, region.end, cache);
  const stable = stablePitchRuns(trace);
  // A glide spends most of its time between pitches, with no quick transition
  // between separate steady plateaus. Keep the model result when the run is unclear.
  if (stable.length < 2 || (stable[0].first - trace[0].frame) / sampleRate > 0.024
    || (trace.at(-1).frame - stable.at(-1).last) / sampleRate > 0.024
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

function hasLocalAttack(levels, region, start) {
  if (start <= region.start + 0.025) return true;
  const frame = Math.round(start * sampleRate / envelopeSize);
  const before = Math.max(0, ...levels.slice(Math.max(0, frame - 3), frame));
  const after = Math.min(...levels.slice(frame, frame + 3));
  return after > before * 1.75 + 0.005;
}

function followsGlide(trace, from, to) {
  const measured = trace.filter(({ center }) => center !== null);
  if (measured.length < Math.max(4, trace.length * 0.65)) return false;
  const direction = Math.sign(to - from);
  let edge = from * direction;
  for (const { center } of measured) {
    const pitch = center * direction;
    if (pitch < edge - 0.32 || pitch > to * direction + 0.32) return false;
    edge = Math.max(edge, pitch);
  }
  return true;
}

function refineShortTransitions(notes, samples, regions, levels, cache) {
  const trace = (region, start, end) => pitchTrace(samples, region, start, end, cache);
  const reviewed = notes.map(note => {
    const middle = (note.start + note.end) / 2;
    const region = regions.find(({ start, end }) => start <= middle && middle <= end);
    if (!region || note.shortAttack || note.end - note.start > transitionNoteSeconds + 1e-6
      || region.start > note.start + 0.012 || region.end < note.end - 0.012
      || hasLocalAttack(levels, region, note.start)) return { note, region };
    const frames = trace(region, note.start, note.end);
    const stable = stablePitchRuns(frames);
    if (stable.some(run => run.pitch === note.pitch)) return { note, region };
    const supported = stable.find(run => run.count > frames.length / 2 && Math.abs(run.pitch - note.pitch) <= 2);
    if (supported) return { region, note: { ...note, pitch: supported.pitch,
      pitchCenter: (supported.low + supported.high) / 2, pitchRevised: true } };
    // With too little voiced evidence, keep the model's result.
    const unsettled = !stable.length && frames.filter(frame => frame.center !== null).length >= 4;
    return { note, region, unsettled };
  });

  const result = [];
  for (let i = 0; i < reviewed.length;) {
    const { note, region, unsettled } = reviewed[i];
    if (!unsettled) {
      result.push(note);
      i++;
      continue;
    }
    let end = i + 1;
    while (reviewed[end]?.unsettled && reviewed[end].region === region) end++;
    const left = result.at(-1), right = reviewed[end]?.note;
    if (left && right && left.pitch !== right.pitch && reviewed[i - 1]?.region === region
      && reviewed[end].region === region && !hasLocalAttack(levels, region, right.start)) {
      const low = Math.min(left.pitch, right.pitch), high = Math.max(left.pitch, right.pitch);
      const between = reviewed.slice(i, end).every(({ note }) => note.pitch > low && note.pitch < high);
      const from = stablePitchRuns(trace(region, Math.max(left.start, left.end - 0.11), note.start))
        .findLast(run => run.pitch === left.pitch);
      const to = stablePitchRuns(trace(region, right.start - 0.015, Math.min(right.end, right.start + 0.11)))
        .find(run => run.pitch === right.pitch);
      if (between && from && to && to.first > from.last && to.first - from.last <= maxGlideSeconds * sampleRate
        && followsGlide(trace(region, from.last / sampleRate, to.first / sampleRate), left.pitch, right.pitch)) {
        result[result.length - 1] = { ...left, end: right.start };
        i = end;
        continue;
      }
    }
    for (; i < end; i++) result.push(reviewed[i].note);
  }
  return result;
}

export function recoverShortHumNotes(notes, samples) {
  if (!samples?.length) return notes;
  const { regions, levels } = voicedRegions(samples);
  const cache = new Map();
  const recovered = new Map();
  for (const region of regions) {
    const length = region.end - region.start;
    if (length < minShortSeconds) continue;
    if (length > maxShortSeconds) {
      const connected = connectedShortNotes(samples, region, notes, cache);
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
  if (!recovered.size) return refineShortTransitions(notes, samples, regions, levels, cache);

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
  const combined = remaining.concat(...recovered.values()).sort((a, b) => a.start - b.start);
  return refineShortTransitions(combined, samples, regions, levels, cache);
}
