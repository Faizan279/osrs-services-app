export function wouldCreateRecommendationCycle(
  edges: ReadonlyMap<string, readonly string[]>,
  ownerServiceId: string,
  recommendedServiceId: string,
) {
  if (ownerServiceId === recommendedServiceId) return true;
  const visited = new Set<string>();
  const pending = [recommendedServiceId];
  while (pending.length) {
    const current = pending.pop()!;
    if (current === ownerServiceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(edges.get(current) ?? []));
  }
  return false;
}
