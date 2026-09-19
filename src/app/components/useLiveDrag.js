import { useCallback, useEffect, useRef, useState } from 'react';

export default function useLiveDrag({ disabled, onSectionDrop, onColumnDrop }) {
  const scrollRef = useRef(null);
  const gesture = useRef(null);
  const frame = useRef(null);
  const suppressed = useRef(false);
  const [drag, setDrag] = useState(null);
  function cancel() {
    if (gesture.current?.moving) suppressed.current = true;
    gesture.current = null; cancelAnimationFrame(frame.current); setDrag(null);
  }
  useEffect(() => {
    const clear = () => {
      if (gesture.current) suppressed.current = true;
      gesture.current = null; cancelAnimationFrame(frame.current); setDrag(null);
    };
    window.addEventListener('blur', clear);
    return () => { window.removeEventListener('blur', clear); cancelAnimationFrame(frame.current); };
  }, []);
  function updateTarget() {
    const g = gesture.current; const scroll = scrollRef.current;
    if (!g?.moving || !scroll) return;
    const bounds = scroll.getBoundingClientRect();
    const left = scroll.querySelector('.pw-live-trackheads')?.getBoundingClientRect().right ?? bounds.left;
    let targetId = null; let side = null;
    if (g.y >= bounds.top && g.y <= bounds.bottom && g.x >= left && g.x <= bounds.right) {
      const columns = [...scroll.querySelectorAll('[data-live-column-id]')];
      const target = columns.find(el => el.getBoundingClientRect().right >= g.x) ?? columns.at(-1);
      if (target) {
        const rect = target.getBoundingClientRect(); targetId = target.dataset.liveColumnId;
        side = g.x < rect.left + rect.width / 2 ? 'before' : 'after';
      }
    }
    g.targetId = targetId; g.side = side;
    setDrag(previous => previous?.id === g.id && previous?.targetId === targetId && previous?.side === side
      ? previous : { id: g.id, kind: g.kind, targetId, side });
  }
  function tick() {
    const g = gesture.current; const scroll = scrollRef.current;
    if (!g?.moving || !scroll) return;
    const r = scroll.getBoundingClientRect();
    const left = scroll.querySelector('.pw-live-trackheads')?.getBoundingClientRect().right ?? r.left;
    if (g.y >= r.top && g.y <= r.bottom) {
      const speed = g.x < left + 44 ? -12 : g.x > r.right - 44 ? 12 : 0;
      if (speed) scroll.scrollLeft += speed;
    }
    updateTarget(); frame.current = requestAnimationFrame(tick);
  }
  function begin(event, kind, id) {
    if (event.button !== 0) return;
    suppressed.current = false;
    if (disabled) return;
    // Inputs and nested action buttons must retain their own interactions.
    if (event.target.closest('input,select') || (event.currentTarget.tagName !== 'BUTTON' && event.target.closest('button'))) return;
    if (document.activeElement?.matches('input,select,textarea')) document.activeElement.blur();
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.current = { id, kind, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moving: false };
  }
  function move(event) {
    const g = gesture.current; if (!g) return;
    g.x = event.clientX; g.y = event.clientY;
    if (!g.moving && Math.hypot(g.x - g.startX, g.y - g.startY) >= 6) {
      g.moving = true; suppressed.current = true; tick();
    }
    if (g.moving) updateTarget();
  }
  function end(event) {
    move(event); const g = gesture.current;
    gesture.current = null; cancelAnimationFrame(frame.current); setDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!g?.moving || disabled || !g.targetId) return;
    if (g.kind === 'section') onSectionDrop(g.targetId, g.id);
    else onColumnDrop(g.id, g.targetId, g.side);
  }
  function suppressClick(event) {
    if (event.detail > 0 && suppressed.current) { suppressed.current = false; return true; }
    return false;
  }
  const setScrollElement = useCallback(element => { scrollRef.current = element; }, []);
  return { setScrollElement, drag, begin, move, end, cancel, suppressClick };
}
