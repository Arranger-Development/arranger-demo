const sameHarmony = (a, b) => a.root === b.root && a.tones.every(tone => b.tones.includes(tone));
const simultaneous = (a, b) => Math.abs(a - b) < 1e-6;

function groupAttacks(events) {
  const attacks = [];
  for (const event of events) {
    const last = attacks.at(-1);
    if (last && simultaneous(event.start, last.start)) {
      last.duration = Math.max(last.duration, event.duration);
      last.velocity = Math.max(last.velocity, event.velocity);
      last.passing &&= event.passing;
    } else attacks.push({ ...event });
  }
  return attacks;
}

export function planHumPhraseRhythm(events, windows) {
  const sounding = [], entries = [], candidates = new Map();
  let phrase, harmony;
  for (const attack of groupAttacks(events)) {
    const { start, duration, velocity, passing } = attack;
    const end = start + duration;
    const previous = sounding.at(-1);
    const gap = start - (previous?.[1] ?? start);
    if (!previous || gap > 1e-6) sounding.push([start, end]);
    else previous[1] = Math.max(previous[1], end);

    const half = Math.floor(start / 8);
    const wanted = windows[half % windows.length];
    const entrance = !phrase || gap >= 2.5 - 1e-6;
    const changed = !harmony || !sameHarmony(harmony, wanted);
    if (entrance) phrase = { end };
    else phrase.end = Math.max(phrase.end, end);
    if (entrance || changed) {
      harmony = wanted;
      entries.push({ start, harmony, phrase, entrance, required: true });
    } else if (duration >= 0.4 && (!passing || duration >= 2) && (duration >= 1.25 || velocity >= 0.72)) {
      const beat = Math.round(start / 4) * 4;
      const weight = Math.min(duration, 4) + velocity + (Math.abs(start - beat) <= 0.35 ? 0.3 : 0);
      const options = candidates.get(half) ?? [];
      options.push({ start, harmony, phrase, weight, required: false });
      candidates.set(half, options);
    }
  }
  const accents = [];
  for (const options of candidates.values()) {
    const accent = options.sort((a, b) => b.weight - a.weight).find(({ start }) =>
      entries.every(entry => Math.abs(entry.start - start) >= 2 - 1e-6)
      && (!accents.length || start - accents.at(-1).start >= 2 - 1e-6));
    if (accent) accents.push(accent);
  }
  const anchors = [...entries, ...accents].sort((a, b) => a.start - b.start);
  return {
    sounding,
    anchors: anchors.map(({ phrase, ...anchor }, index) => ({
      ...anchor, end: Math.min(phrase.end, anchors[index + 1]?.start ?? Infinity),
    })),
  };
}
