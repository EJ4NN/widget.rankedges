/**
 * Deterministic auto-generated trader avatar/logo.
 *
 * We use DiceBear's HTTP API with the "shapes" style so every participant gets
 * a unique abstract neon logo derived from their nickname — no storage needed.
 * Colors are tuned to the RankEdges neon palette (lime / cyan / violet on ink).
 * An admin-provided `override` (participant.avatarUrl) always wins.
 */
export function traderAvatar(seed: string, override?: string | null): string {
  if (override) return override
  const s = encodeURIComponent((seed || "trader").toLowerCase().trim())
  const params = new URLSearchParams({
    seed: s,
    backgroundColor: "0a0f0f,0d1414,101a1a",
    shape1Color: "c6ff4d,4dffd6",
    shape2Color: "4dffd6,a06bff",
    shape3Color: "c6ff4d,a06bff",
  })
  return `https://api.dicebear.com/9.x/shapes/svg?${params.toString()}`
}
