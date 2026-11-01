import { useLayoutEffect, useRef, useState } from 'react';
import { createJamReorderController } from '../jamReorderController.js';
import { jamSlotAfterMove } from '../jamTemplateSlots.js';

export default function useJamReorder({ scrollRef, templates, onMove, onScroll, navigationRef, enabled }) {
  const context = useRef(null), frame = useRef(null);
  const [drag, setDrag] = useState(null);
  const [controller] = useState(() => {
    let element, latest;
    const interaction = createJamReorderController({
      read: trackId => {
        const el = element;
        if (!el) return null;
        const first = el.querySelector('[data-slot-index="0"]'), identity = el.querySelector('.studio-column-label');
        const row = trackId ? el.querySelector(`[data-track="${trackId}"]`) : el.querySelector('.studio-gallery');
        if (!first || !identity || !row) return null;
        const viewport = el.getBoundingClientRect(), bounds = row.getBoundingClientRect(), style = getComputedStyle(el);
        const pad = parseFloat(style.getPropertyValue('--jam-pad')) || 48, gap = parseFloat(style.getPropertyValue('--jam-gap')) || 16;
        return { left: identity.getBoundingClientRect().right + 4, right: viewport.right - 6,
          top: Math.max(bounds.top, viewport.top), bottom: Math.min(bounds.bottom, viewport.bottom),
          origin: el.querySelector('.studio-gallery').getBoundingClientRect().left
            + (parseFloat(style.getPropertyValue('--identity')) || 120) + gap + el.scrollLeft, scrollLeft: el.scrollLeft,
          pitch: pad + gap, gap, columns: Number(style.getPropertyValue('--jam-columns')) };
      },
      scroll: left => {
        if (element) { element.scrollLeft = left; latest.onScroll(); }
      },
      preview: setDrag,
      commit: (move, source) => latest.onMove(move, { templates: source.templates }),
    });
    return { ...interaction, attach(el, value) { element = el; latest = value; } };
  });
  useLayoutEffect(() => {
    context.current = { templates, onMove, onScroll };
    controller.attach(scrollRef.current, context.current);
  });
  useLayoutEffect(() => {
    const el = scrollRef.current;
    function cancel() {
      const id = controller.cancel();
      if (id !== undefined && el.hasPointerCapture(id)) el.releasePointerCapture(id);
      cancelAnimationFrame(frame.current); frame.current = null;
    }
    function escape(event) {
      if (event.key !== 'Escape' || controller.pointerId() === undefined) return;
      event.preventDefault(); event.stopImmediatePropagation(); cancel();
    }
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    window.addEventListener('keydown', escape, true);
    // A changed library invalidates the origin snapshot, not a playback update.
    return () => { window.removeEventListener('blur', cancel); window.removeEventListener('resize', cancel); window.removeEventListener('keydown', escape, true); cancel(); };
  }, [controller, scrollRef, templates, enabled]);
  function animate() {
    if (frame.current !== null) return;
    let previous;
    const tick = time => {
      if (!controller.active()) { frame.current = null; return; }
      controller.tick(previous === undefined ? 0 : time - previous); previous = time;
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }
  function sourceFor(target) {
    if (target.closest('.studio-template-tools,.studio-instrument-top,input,select,textarea')) return null;
    const gem = target.closest('.studio-template[data-template-id]'), header = target.closest('.studio-column-launch');
    const node = gem ?? header;
    if (!node) return null;
    const trackId = gem ? gem.closest('.studio-instrument').dataset.track : null, bounds = node.getBoundingClientRect();
    const from = Number(node.dataset.slotIndex), el = scrollRef.current;
    const rows = trackId ? [trackId] : ['drums', 'chord', 'bass', 'melody'];
    return { trackId, from, templates: context.current.templates,
      left: bounds.left, width: bounds.width,
      ghosts: rows.map(t => {
        const row = el.querySelector(`.studio-instrument[data-track="${t}"]`), cell = row.querySelector(`[data-slot-index="${from}"]`);
        const rect = cell.getBoundingClientRect();
        return { trackId: t, top: rect.top, height: rect.height,
          name: cell.querySelector('.studio-template-name')?.textContent ?? '' };
      }),
    };
  }
  return {
    drag,
    cellProps(trackId, index) {
      const affected = drag && (drag.trackId === null || trackId === drag.trackId);
      const source = affected && index === drag.from;
      const shift = affected && drag.valid && !source ? jamSlotAfterMove(index, drag.from, drag.to) - index : 0;
      return { 'data-reorder-source': Boolean(source), style: shift ? {
        transform: `translateX(calc(${shift} * (var(--jam-pad,48px) + var(--jam-gap,16px))))`,
      } : undefined };
    },
    handlers: {
      onPointerDownCapture(event) { if (enabled) controller.begin(event, sourceFor(event.target)); },
      onPointerMove(event) {
        if (!controller.move(event)) return;
        event.preventDefault();
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
        animate();
      },
      onPointerUp(event) {
        controller.end(event);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel(event) { controller.end(event, true); },
      onLostPointerCapture(event) { if (controller.pointerId() === event.pointerId) controller.cancel(); },
      onClickCapture(event) { if (controller.suppress(event.detail)) { event.preventDefault(); event.stopPropagation(); } },
      onDragStart(event) { event.preventDefault(); },
      onKeyDown(event) {
        if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        const source = sourceFor(event.target);
        if (!source) return;
        event.preventDefault(); event.stopPropagation();
        const to = source.from + (event.key === 'ArrowLeft' ? -1 : 1);
        if (context.current.onMove({ trackId: source.trackId, from: source.from, to }, { templates: source.templates })) {
          navigationRef.current?.revealSlot(to);
          const el = scrollRef.current;
          const next = event.target.closest('[data-template-id]')?.querySelector('button');
          // React commits after the event; follow a moved column's new button.
          requestAnimationFrame(() => {
            if (source.trackId) next?.focus({ preventScroll: true });
            else el.querySelector(`.studio-column-launch[data-slot-index="${to}"]`)?.focus({ preventScroll: true });
          });
        }
      },
    },
    refresh: controller.refresh,
  };
}
