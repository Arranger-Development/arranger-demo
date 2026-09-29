export function insertLoop(loops, id, targetId, side = 'before') {
  if (id === targetId) return loops;
  const source = loops.find(loop => loop.id === id);
  if (!source || !loops.some(loop => loop.id === targetId)) return loops;
  const next = loops.filter(loop => loop.id !== id);
  next.splice(next.findIndex(loop => loop.id === targetId) + (side === 'after' ? 1 : 0), 0, source);
  return next.every((loop, index) => loop === loops[index]) ? loops : next;
}
export function loopRepeat(section) {
  if (section.repeat === null) return null;
  return Number.isSafeInteger(section.repeat) && section.repeat > 0 ? section.repeat : section.kind === 'transition' ? 1 : null;
}
