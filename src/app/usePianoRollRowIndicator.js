import { useCallback, useLayoutEffect, useRef } from 'react';

function getPianoRollRowTarget(host, target) {
  const rowTarget = target?.closest?.('[data-row]');
  if (!host || !rowTarget || !host.contains(rowTarget)) return null;
  return rowTarget;
}

function usePianoRollRowIndicator() {
  const pianoRollRef = useRef(null);
  const activeRowRef = useRef(null);
  const activeRowTargetRef = useRef(null);

  const positionIndicator = useCallback((rowTarget, force = false) => {
    const host = pianoRollRef.current;
    if (!host || !rowTarget) return;

    const row = rowTarget.getAttribute('data-row');
    if (row == null) return;
    if (!force && activeRowRef.current === row) return;

    activeRowRef.current = row;
    activeRowTargetRef.current = rowTarget;
    host.style.setProperty('--piano-roll-hover-y', `${rowTarget.offsetTop}px`);
    host.dataset.rowIndicatorVisible = 'true';
  }, []);

  const clearIndicator = useCallback(() => {
    const host = pianoRollRef.current;
    if (host) delete host.dataset.rowIndicatorVisible;
    activeRowRef.current = null;
    activeRowTargetRef.current = null;
  }, []);

  const showIndicatorFromTarget = useCallback((target) => {
    const host = pianoRollRef.current;
    const rowTarget = getPianoRollRowTarget(host, target);
    if (!rowTarget) return;
    positionIndicator(rowTarget);
  }, [positionIndicator]);

  const handlePointerOver = useCallback((event) => {
    showIndicatorFromTarget(event.target);
  }, [showIndicatorFromTarget]);

  const handlePointerLeave = useCallback(() => {
    clearIndicator();
  }, [clearIndicator]);

  const handleFocusCapture = useCallback((event) => {
    showIndicatorFromTarget(event.target);
  }, [showIndicatorFromTarget]);

  const handleBlurCapture = useCallback((event) => {
    const host = pianoRollRef.current;
    const nextRowTarget = getPianoRollRowTarget(host, event.relatedTarget);
    if (nextRowTarget) {
      positionIndicator(nextRowTarget);
      return;
    }
    clearIndicator();
  }, [clearIndicator, positionIndicator]);

  useLayoutEffect(() => {
    const host = pianoRollRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      if (activeRowTargetRef.current) {
        positionIndicator(activeRowTargetRef.current, true);
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [positionIndicator]);

  return {
    handleBlurCapture,
    handleFocusCapture,
    handlePointerLeave,
    handlePointerOver,
    pianoRollRef,
  };
}

export { getPianoRollRowTarget, usePianoRollRowIndicator };
