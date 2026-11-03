// Column order is one array of ids per table, kept whole (hidden columns included), so
// un-hiding a column puts it back where it was moved rather than at the default slot.

export function mergeOrder(saved, ids) {
  const kept = (Array.isArray(saved) ? saved : []).filter((id) => ids.includes(id));
  return [...kept, ...ids.filter((id) => !kept.includes(id))];
}

// Drop a column on another: `after` says which side of the target it lands on, which is
// the only way a column can reach the last slot — inserting before the target forever
// caps it at second-to-last.
export function moveById(order, id, targetId, after) {
  if (id === targetId) return order;
  const next = order.filter((x) => x !== id);
  const at = next.indexOf(targetId);
  if (at < 0) return order;
  next.splice(after ? at + 1 : at, 0, id);
  return next;
}

// The keyboard route for the same move — HTML5 drag is pointer-only. It steps over the
// columns you can actually see, so a hidden column sitting between two never turns the
// key into a no-op.
export function stepById(order, shownIds, id, delta) {
  const at = shownIds.indexOf(id);
  const nb = shownIds[at + (delta > 0 ? 1 : -1)];
  if (at < 0 || !nb) return order;
  return moveById(order, id, nb, delta > 0);
}
