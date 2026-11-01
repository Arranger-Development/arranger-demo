// Pointer state is independent of React and persistence. Preview never changes
// saved positions; one valid release produces one insertion request.
export function createJamReorderController({ read, scroll, preview, commit }) {
  let pointer = null, suppressClick = false;
  function update() {
    if (!pointer?.active) return;
    const g = read(pointer.source.trackId), { x, y } = pointer;
    const inside = g && x >= g.left && x < g.right && y >= g.top && y < g.bottom;
    const to = inside ? Math.max(0, Math.min(g.columns - 1,
      Math.floor((x - g.origin + g.scrollLeft + g.gap / 2) / g.pitch))) : null;
    pointer.to = to;
    preview({ ...pointer.source, to, x, y, dx: x - pointer.startX, valid: to !== null,
      targetLeft: to === null ? null : g.origin - g.scrollLeft + to * g.pitch, targetTop: g?.top, targetHeight: g ? g.bottom - g.top : 0 });
  }
  function cancel() {
    const id = pointer?.id;
    suppressClick ||= Boolean(pointer?.active);
    pointer = null; preview(null); return id;
  }
  return {
    begin(event, source) {
      if (pointer || event.button !== 0 || event.isPrimary === false) return false;
      suppressClick = false;
      if (!source) return false;
      pointer = { id: event.pointerId, source, startX: event.clientX, startY: event.clientY,
        x: event.clientX, y: event.clientY, active: false, to: null };
      return true;
    },
    move(event) {
      if (!pointer || event.pointerId !== pointer.id) return false;
      if (event.pointerType === 'mouse' && event.buttons === 0) { cancel(); return false; }
      pointer.x = event.clientX; pointer.y = event.clientY;
      if (!pointer.active) {
        const dx = Math.abs(pointer.x - pointer.startX), dy = Math.abs(pointer.y - pointer.startY);
        if (dy > 8 && dy >= dx) { suppressClick = true; cancel(); return false; }
        if (dx <= 8 || dx <= dy) return false;
        pointer.active = true;
      }
      update(); return true;
    },
    tick(milliseconds) {
      if (!pointer?.active) return;
      const g = read(pointer.source.trackId);
      if (!g || pointer.y < g.top || pointer.y >= g.bottom || pointer.x < g.left || pointer.x >= g.right) return;
      const margin = Math.min(36, (g.right - g.left) / 3);
      const direction = pointer.x < g.left + margin ? -1 : pointer.x > g.right - margin ? 1 : 0;
      if (direction) {
        const distance = direction < 0 ? pointer.x - g.left : g.right - pointer.x;
        scroll(g.scrollLeft + direction * (1 - distance / margin) * 700 * Math.min(milliseconds, 50) / 1000);
        update();
      }
    },
    refresh: update,
    end(event, cancelled = false) {
      if (!pointer || event.pointerId !== pointer.id) return false;
      if (cancelled) { cancel(); return false; }
      pointer.x = event.clientX; pointer.y = event.clientY; update();
      const p = pointer;
      cancel();
      if (!p.active || p.to === null || p.to === p.source.from) return false;
      return commit({ trackId: p.source.trackId, from: p.source.from, to: p.to }, p.source);
    },
    cancel,
    active: () => Boolean(pointer?.active),
    pointerId: () => pointer?.id,
    suppress(detail) { if (detail === 0) return false; const result = suppressClick; suppressClick = false; return result; },
  };
}
