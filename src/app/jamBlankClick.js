import { NEW_COMBINATION_ID } from './performanceSession.js';

const BLANK_SURFACES = '.jam-workspace,.performance-header,.jam-body,.performance-intro,.jam-workbench,.jam-grid,.jam-row,.jam-pad-group,.jam-combination-actions,.jam-sequence,.jam-loops';

export function returnToNewCombination(editor, playback) {
  if (playback.isActive() || editor.getSnapshot().editingId === NEW_COMBINATION_ID) return;
  editor.select(NEW_COMBINATION_ID);
}

// A click must start and finish on the background. In particular, a drag released
// over the background or an outside click dismissing a menu is not a new draft.
export function bindJamBlankClick(root, { isEnabled, onClick }) {
  const win = root.ownerDocument.defaultView;
  let gesture = null;
  const cancel = () => { gesture = null; };
  const blank = target => root.contains(target) && target.matches?.(BLANK_SURFACES);
  const eligible = () => isEnabled() && !root.querySelector('dialog[open], [popover]:popover-open');
  const down = event => {
    cancel();
    if (event.button !== 0 || event.isPrimary === false || !blank(event.target) || !eligible()) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, released: false };
  };
  const move = event => {
    if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 6) cancel();
  };
  const up = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    move(event);
    if (!gesture || !blank(event.target) || !eligible()) { cancel(); return; }
    gesture.released = true;
  };
  const click = event => {
    const accepted = gesture?.released && event.button === 0 && event.detail > 0 && blank(event.target) && eligible();
    cancel();
    if (accepted) onClick();
  };
  // Touch releases its implicit capture after pointerup, before the normal click.
  const windowBlur = event => { if (event.target === win) cancel(); };
  const lostCapture = () => { if (!gesture?.released) cancel(); };
  const bindings = [
    [root, 'pointerdown', down], [win, 'pointermove', move], [win, 'pointerup', up],
    [root, 'click', click], [win, 'pointercancel', cancel], [win, 'lostpointercapture', lostCapture],
    [win, 'blur', windowBlur], [win, 'scroll', cancel], [win, 'wheel', cancel],
  ];
  const options = { capture: true };
  for (const [target, type, handler] of bindings) target.addEventListener(type, handler, options);
  return () => { cancel(); for (const [target, type, handler] of bindings) target.removeEventListener(type, handler, options); };
}
