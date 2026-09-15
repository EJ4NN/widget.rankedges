/**
 * Deterministic auto-generated trader avatar/logo.
 *
 * We use DiceBear's HTTP API with the "shapes" style so every participant gets
 * a unique abstract logo derived from their nickname — no storage needed.
 * Colors are tuned to the AIMS palette (gold / sky-blue / royal-blue on navy-black).
 * An admin-provided `override` (participant.avatarUrl) always wins.
 */
export function traderAvatar(seed: string, override?: string | null): string {
  if (override) return override
  const s = encodeURIComponent((seed || "trader").toLowerCase().trim())
  const params = new URLSearchParams({
    seed: s,
    backgroundColor: "060a12,0a0f1a,0d1420",
    shape1Color: "f0b02e,40c3fb",
    shape2Color: "3a9bfb,40c3fb",
    shape3Color: "f0b02e,3a9bfb",
  })
  return `https://api.dicebear.com/9.x/shapes/svg?${params.toString()}`
}
