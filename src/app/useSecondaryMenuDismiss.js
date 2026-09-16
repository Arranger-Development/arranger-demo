import { useEffect } from 'react';

function isSecondaryMenuInteractionInside(target, elements) {
  if (!target) return false;
  return elements.some((element) => element?.contains?.(target));
}

function useSecondaryMenuDismiss({
  active,
  dismissOnEscape = true,
  isIgnoredTarget,
  menuRef,
  onDismiss,
  triggerRef,
}) {
  useEffect(() => {
    if (!active) return undefined;

    const handleMouseDown = (event) => {
      if (isIgnoredTarget?.(event.target)) return;
      if (isSecondaryMenuInteractionInside(event.target, [
        menuRef?.current,
        triggerRef?.current,
      ])) {
        return;
      }
      onDismiss();
    };
    const handleKeyDown = (event) => {
      if (dismissOnEscape && event.key === 'Escape') onDismiss();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, dismissOnEscape, isIgnoredTarget, menuRef, onDismiss, triggerRef]);
}

export {
  isSecondaryMenuInteractionInside,
  useSecondaryMenuDismiss,
};
