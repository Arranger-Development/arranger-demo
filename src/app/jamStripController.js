const clamp = (value, max) => Math.max(0, Math.min(max, value));
export const JAM_STRIP_GAP = 16;
export function jamStripLayout(width, identity) {
  const pitch = Math.max(48 + JAM_STRIP_GAP, (width - identity - 6) / 12);
  const pad = Math.min(96, pitch - JAM_STRIP_GAP);
  // Once gems reach their readable maximum, wide screens add space instead of columns.
  return { pad, gap: pitch - pad };
}
export const jamStripPadSize = (width, identity) => jamStripLayout(width, identity).pad;

// DOM-independent interaction model: browsing never submits a music command.
export function createJamStripController({ read, write, onBank = () => {}, onEdges = () => {} }) {
  let bank = 0, programmaticLeft = null;
  function edges() {
    const m = read();
    onEdges({ left: m.left > .5, right: m.left < m.max - .5 });
  }
  function selectBank(value) {
    bank = clamp(Math.floor(value), Math.ceil(read().columns / 8) - 1);
    onBank(bank);
  }
  function scroll() {
    const m = read();
    if (programmaticLeft === null || Math.abs(m.left - programmaticLeft) > .5) {
      programmaticLeft = null;
      selectBank(Math.floor(Math.ceil((m.left - (m.gap ?? JAM_STRIP_GAP) - .01) / m.pitch) / 8));
    }
    edges();
  }
  function place(left, programmatic = false) {
    const target = clamp(left, read().max);
    programmaticLeft = programmatic ? target : null;
    write(target);
    scroll();
  }
  function reveal(start, end = start) {
    const m = read(), available = Math.max(m.pitch - (m.gap ?? JAM_STRIP_GAP), m.visible);
    if ((end - start + 1) * m.pitch > available) { place(start * m.pitch, true); return; }
    const left = start * m.pitch, right = (end + 1) * m.pitch;
    place(left < m.left ? left : right > m.left + available ? right - available : m.left, true);
  }
  return {
    scroll,
    getBank: () => bank,
    showBank(value) { selectBank(value); reveal(bank * 8, bank * 8 + 7); },
    revealSlot(slot) { selectBank(Math.floor(slot / 8)); reveal(slot); },
    resize(previousPitch, previousLeft = read().left) {
      const m = read();
      selectBank(bank);
      place(previousLeft / previousPitch * m.pitch, true);
    },
    reset() { selectBank(0); place(0, true); },
    moveBy(columns) { place(read().left + columns * read().pitch); },
  };
}
