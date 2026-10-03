// One owner per track: stale releases must never stop the newest held slice.
export function createRepeatPadController(setEffect) {
  let owner = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener());
  const reset = (silent = false) => {
    if (!owner) return;
    owner = null;
    if (!silent) setEffect({ held: false });
    notify();
  };
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => owner?.division ?? null,
    press(token, division, bpm) {
      if (![4, 8, 16].includes(division) || owner?.token === token) return;
      owner = { token, division };
      setEffect({ held: true, division, bpm });
      notify();
    },
    release(token) { if (owner?.token === token) reset(); },
    releaseDivision(division) { if (owner?.division === division) reset(); },
    reset,
  };
}
