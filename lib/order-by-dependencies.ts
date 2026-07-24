/**
 * Topologically order items so each one appears after every item it depends on
 * (blockers first, dependents after). Kahn's algorithm over the in-set
 * dependency edges; original order breaks ties, and any cycle leftovers are
 * appended in original order so nothing is ever dropped.
 *
 * `depsByItem` maps an item id → the items it depends on (its blockers). Only
 * edges that point at another item in `rows` are considered.
 */
export function orderByDependencies<T extends { id: string }>(
  rows: T[],
  depsByItem: Map<string, { id: string }[]>
): T[] {
  const idx = new Map(rows.map((r, i) => [r.id, i]));
  const inSet = new Set(rows.map((r) => r.id));
  const blockersOf = (id: string) =>
    (depsByItem.get(id) ?? []).filter((d) => inSet.has(d.id));

  const inDegree = new Map(rows.map((r) => [r.id, blockersOf(r.id).length]));
  const dependents = new Map<string, string[]>(rows.map((r) => [r.id, []]));
  for (const r of rows) {
    for (const b of blockersOf(r.id)) dependents.get(b.id)!.push(r.id);
  }

  const byIndex = (a: string, b: string) => idx.get(a)! - idx.get(b)!;
  const ready = rows
    .filter((r) => inDegree.get(r.id) === 0)
    .map((r) => r.id)
    .sort(byIndex);

  const order: string[] = [];
  const placed = new Set<string>();
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    placed.add(id);
    for (const dep of dependents.get(id) ?? []) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) - 1);
      if (inDegree.get(dep) === 0) ready.push(dep);
    }
    ready.sort(byIndex);
  }
  for (const r of rows) if (!placed.has(r.id)) order.push(r.id);

  const byId = new Map(rows.map((r) => [r.id, r]));
  return order.map((id) => byId.get(id)!);
}
