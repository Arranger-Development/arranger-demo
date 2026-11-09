const contourBinsPerSemitone = 3;
const contourFirstMidi = 21;
// The bundled model peaks one contour bin above the MIDI note on centered tones.
const contourCenterOffset = 1;
const stablePitchRadius = 0.27;
const pitchClass = pitch => pitch % 12;
const median = values => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
// Major and relative natural minor share the same pitch classes.
const scales = Array.from({ length: 12 }, (_, tonic) =>
  [0, 2, 4, 5, 7, 9, 11].map(interval => pitchClass(interval + tonic)));

export function humPitchCenter(contours, { startFrame, durationFrames, pitchMidi }) {
  // Measure the steady part of the note, away from attacks and releases.
  const trim = Math.floor(durationFrames / 5);
  const base = (pitchMidi - contourFirstMidi) * contourBinsPerSemitone + contourCenterOffset;
  const peaks = [];
  for (let frame = startFrame + trim; frame < startFrame + durationFrames - trim; frame++) {
    const contour = contours[frame];
    if (!contour || base < 4 || base + 4 >= contour.length) continue;
    let peak = base;
    for (let bin = base - 3; bin <= base + 3; bin++) {
      if (contour[bin] > contour[peak]) peak = bin;
    }
    const [left, center, right] = [contour[peak - 1], contour[peak], contour[peak + 1]];
    const curvature = 2 * center - left - right;
    if (center < 0.2 || curvature <= 0 || center < left || center < right) continue;
    const offset = (right - left) / (2 * curvature);
    peaks.push(pitchMidi + (peak - base + offset) / contourBinsPerSemitone);
  }
  if (peaks.length < Math.max(3, (durationFrames - 2 * trim) * 0.5)) return undefined;
  const center = median(peaks);
  const consistent = peaks.filter(pitch => Math.abs(pitch - center) <= 0.24).length;
  return consistent >= peaks.length * 0.6 ? center : undefined;
}

function repeatsNearbyPitch(notes, index, target) {
  const note = notes[index];
  if (note.end - note.start > 0.22 || Math.abs(note.pitchCenter - target) > 0.76) return false;
  const previous = notes[index - 1], next = notes[index + 1];
  const close = (left, right) => left && right && right.start - left.end <= 0.18;
  const agrees = other => other?.pitch === target
    && Math.abs(other.pitchCenter - target) <= 0.49
    && Math.abs(other.pitchCenter - note.pitchCenter) <= 0.76;
  const before = close(previous, note), after = close(note, next);
  const agreesBefore = before && agrees(previous), agreesAfter = after && agrees(next);
  if (agreesBefore && agreesAfter) return true;
  // An edge hit still has enough context if the two following or preceding hits agree.
  return (agreesBefore && !after && close(notes[index - 2], previous) && agrees(notes[index - 2]))
    || (agreesAfter && !before && close(next, notes[index + 2]) && agrees(notes[index + 2]));
}

export function correctHumPitch(notes) {
  const stable = notes.map(note => note.end - note.start >= 0.10
    && Math.abs(note.pitchCenter - note.pitch) <= stablePitchRadius);
  const anchors = new Set(notes.filter((_, index) => stable[index]).map(note => pitchClass(note.pitch)));
  const plausibleScales = anchors.size >= 3
    ? scales.filter(scale => [...anchors].every(tone => scale.includes(tone))) : [];
  return notes.map(({ pitchCenter, ...note }, index) => {
    const drift = pitchCenter - note.pitch;
    if (!Number.isFinite(drift) || Math.abs(drift) < 0.24 || Math.abs(drift) > 0.82) return note;
    const target = note.pitch + Math.sign(drift);
    if (repeatsNearbyPitch(notes, index, target)) return { ...note, pitch: target, shortAttack: true };
    if (Math.abs(drift) < 0.30 || anchors.has(pitchClass(note.pitch))) return note;
    const previous = notes[index - 1], next = notes[index + 1];
    const localRepeat = (stable[index - 1] && previous.pitch === target && note.start - previous.end <= 0.24)
      || (stable[index + 1] && next.pitch === target && next.start - note.end <= 0.24);
    const fitsScale = plausibleScales.length > 0 && plausibleScales.every(scale =>
      scale.includes(pitchClass(target)) && !scale.includes(pitchClass(note.pitch)));
    return localRepeat || fitsScale ? { ...note, pitch: target } : note;
  });
}
