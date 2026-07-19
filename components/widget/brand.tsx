const DEFAULT_LOGO = "/rankedges-logo.png"

/**
 * RankEdges logo lockup — used in widget/landing headers.
 * `logoUrl` overrides the crest; `coBrandUrl` shows a partner logo (e.g. AIMS)
 * to the left, separated by a divider.
 */
export function BrandLogo({
  size = 56,
  logoUrl,
  coBrandUrl,
}: {
  size?: number
  logoUrl?: string | null
  coBrandUrl?: string | null
}) {
  const logo = logoUrl || DEFAULT_LOGO
  return (
    <div className="flex items-center gap-3.5">
      {coBrandUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coBrandUrl || "/placeholder.svg"}
            alt="Sponsor logo"
            style={{ height: size, width: "auto", maxWidth: size * 3 }}
            className="object-contain"
          />
          <span className="h-9 w-px shrink-0 bg-border" aria-hidden />
        </>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo || "/placeholder.svg"}
        alt="RankEdges Trading Arena"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
      />
      <div className="leading-none">
        <span className="font-display text-2xl font-bold tracking-tight text-foreground">
          RANK<span className="text-primary">EDGES</span>
        </span>
        <span className="mt-1 block font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Trading Arena
        </span>
      </div>
    </div>
  )
}

/** "Powered by RankEdges" footer strip. */
export function PoweredBy({ logoUrl }: { logoUrl?: string | null }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl || DEFAULT_LOGO}
        alt=""
        width={22}
        height={22}
        aria-hidden
        className="object-contain opacity-90"
      />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Powered by <span className="text-primary">RankEdges</span>
      </span>
    </div>
  )
}
