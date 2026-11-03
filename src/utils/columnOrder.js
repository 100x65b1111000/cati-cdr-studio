// Column order is one array of ids per table, kept whole (hidden columns included), so
// un-hiding a column puts it back where it was moved rather than at the default slot.

export function mergeOrder(saved, ids) {
  const kept = (Array.isArray(saved) ? saved : []).filter((id) => ids.includes(id));
  return [...kept, ...ids.filter((id) => !kept.includes(id))];
}

// Drop a column on another: the dragged one takes that slot and everything shifts.
export function moveById(order, id, targetId) {
  if (id === targetId) return order;
  const next = order.filter((x) => x !== id);
  next.splice(next.indexOf(targetId), 0, id);
  return next;
}

// The keyboard route for the same move — HTML5 drag is pointer-only.
export function nudgeById(order, id, delta) {
  const at = order.indexOf(id);
  const to = at + delta;
  if (at < 0 || to < 0 || to >= order.length) return order;
  const next = [...order];
  next.splice(to, 0, next.splice(at, 1)[0]);
  return next;
}
