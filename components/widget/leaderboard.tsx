import { formatLots, formatMoney, formatMoneyCompact, formatPct, formatPctPlain } from "@/lib/format"
import { cn } from "@/lib/utils"
import { TraderAvatar } from "@/components/widget/trader-avatar"
import { MobileStandings, type MobileRow } from "@/components/widget/mobile-standings"
import { Crown, Medal, TrendingDown, Trophy } from "lucide-react"
import {
  COLUMN_LABELS,
  DEFAULT_LEADERBOARD_COLUMNS,
  NUMERIC_COLUMN_KEYS,
  resolveColumns,
  type LeaderboardColumns,
  type NumericColumnKey,
} from "@/lib/leaderboard-columns"
import type { ReactNode } from "react"

type Row = {
  id: number
  nickname: string
  status: string
  avatarUrl: string | null
  realName?: string | null
  accountLogin?: string | null
  startingBalance: string | null
  currentBalance: string | null
  currentEquity: string | null
  profit: string | null
  profitPct: string | null
  gain: string | null
  absoluteGain: string | null
  lots: string | null
  maxDrawdown: string | null
  deposits: string | null
  withdrawals: string | null
  trades: number | null
  winRate: string | null
}

const PODIUM = [
  { ring: "accent" as const, glow: "var(--shadow-accent-glow)", label: "1st", icon: Crown, accent: "text-accent" },
  { ring: "primary" as const, glow: "var(--shadow-glow)", label: "2nd", icon: Trophy, accent: "text-primary" },
  {
    ring: "violet" as const,
    glow: "0 0 22px hsl(258 100% 74% / 0.2)",
    label: "3rd",
    icon: Medal,
    accent: "text-[var(--violet-neon)]",
  },
]

type MetricCell = { text: string; positive?: boolean; warn?: boolean }

function metricValue(r: Row, key: NumericColumnKey): MetricCell {
  switch (key) {
    case "gain": {
      const n = Number(r.gain ?? 0)
      return { text: formatPct(n), positive: n >= 0 }
    }
    case "absoluteGain": {
      const n = Number(r.absoluteGain ?? 0)
      return { text: formatPct(n), positive: n >= 0 }
    }
    case "lots":
      return { text: formatLots(r.lots) }
    case "equity":
      return { text: formatMoney(r.currentEquity) }
    case "deposits":
      return { text: formatMoney(r.deposits) }
    case "withdrawals":
      return { text: formatMoney(r.withdrawals) }
    case "drawdown":
      return { text: formatPctPlain(r.maxDrawdown), warn: true }
  }
}

function metricClass(cell: MetricCell): string {
  if (cell.warn) return "text-warning"
  if (cell.positive === true) return "text-primary"
  if (cell.positive === false) return "text-destructive"
  return "text-foreground"
}

function TraderIdentity({ row, columns }: { row: Row; columns: LeaderboardColumns }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-foreground">{row.nickname}</p>
      {columns.realName && row.realName ? (
        <p className="truncate text-[10px] text-muted-foreground">{row.realName}</p>
      ) : null}
      {columns.account && row.accountLogin ? (
        <p className="truncate font-mono text-[10px] text-muted-foreground">#{row.accountLogin}</p>
      ) : row.status === "pending" ? (
        <p className="text-[10px] text-muted-foreground">Awaiting verification</p>
      ) : (
        <p className="font-mono text-[10px] text-muted-foreground">{row.trades ?? 0} trades</p>
      )}
    </div>
  )
}

function PodiumCard({
  row,
  place,
  columns,
  primaryKey,
  subKeys,
}: {
  row: Row
  place: 0 | 1 | 2
  columns: LeaderboardColumns
  primaryKey: NumericColumnKey | null
  subKeys: NumericColumnKey[]
}) {
  const cfg = PODIUM[place]
  const Icon = cfg.icon
  const primary = primaryKey ? metricValue(row, primaryKey) : null
  return (
    <div
      className={cn(
        "glass glass-hover relative flex flex-col items-center rounded-xl p-5 text-center",
        place === 0 && "sm:-translate-y-3",
      )}
      style={{ boxShadow: cfg.glow }}
    >
      <span className={cn("eyebrow-mono absolute left-3 top-3 flex items-center gap-1", cfg.accent)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {cfg.label}
      </span>
      <TraderAvatar nickname={row.nickname} src={row.avatarUrl} size={place === 0 ? 76 : 64} ring={cfg.ring} />
      <p className="mt-3 max-w-full truncate font-display text-lg font-bold uppercase tracking-wide text-foreground">
        {row.nickname}
      </p>
      {columns.realName && row.realName ? (
        <p className="max-w-full truncate text-xs text-muted-foreground">{row.realName}</p>
      ) : null}
      {columns.account && row.accountLogin ? (
        <p className="max-w-full truncate font-mono text-[11px] text-muted-foreground">#{row.accountLogin}</p>
      ) : null}
      {primary ? (
        <p className={cn("mt-1 font-mono text-2xl font-bold tabular-nums", metricClass(primary))}>{primary.text}</p>
      ) : null}
      {subKeys.length > 0 ? (
        <div className="mt-3 grid w-full grid-cols-2 gap-2 text-left">
          {subKeys.map((key) => {
            const cell = key === "equity" ? { text: formatMoneyCompact(row.currentEquity) } : metricValue(row, key)
            return <Stat key={key} label={COLUMN_LABELS[key]} value={cell.text} tone={cell.warn ? "warn" : undefined} />
          })}
        </div>
      ) : null}
    </div>
  )
}

/** Compact runner-up row for mobile (no heavy card) — rank badge + avatar + name + headline gain. */
function PodiumMiniRow({
  row,
  place,
  columns,
  primaryKey,
}: {
  row: Row
  place: 1 | 2
  columns: LeaderboardColumns
  primaryKey: NumericColumnKey | null
}) {
  const cfg = PODIUM[place]
  const Icon = cfg.icon
  const primary = primaryKey ? metricValue(row, primaryKey) : null
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/25 px-4 py-3">
      <span className={cn("flex items-center gap-1 font-mono text-xs font-bold tabular-nums", cfg.accent)}>
        <Icon className="h-4 w-4" aria-hidden />
        {place + 1}
      </span>
      <TraderAvatar nickname={row.nickname} src={row.avatarUrl} size={40} ring={cfg.ring} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold uppercase tracking-wide text-foreground">
          {row.nickname}
        </p>
        {columns.realName && row.realName ? (
          <p className="truncate text-[11px] text-muted-foreground">{row.realName}</p>
        ) : null}
      </div>
      {primary ? (
        <p className={cn("shrink-0 font-mono text-base font-bold tabular-nums", metricClass(primary))}>
          {primary.text}
        </p>
      ) : null}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg bg-background/40 px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-xs font-semibold tabular-nums", tone === "warn" ? "text-warning" : "text-foreground")}>
        {value}
      </p>
    </div>
  )
}

export function Leaderboard({
  rows,
  columns: columnsProp,
  highlightKey,
}: {
  rows: Row[]
  columns?: LeaderboardColumns
  // When set (e.g. a batch's winning metric), this column becomes the podium headline.
  highlightKey?: NumericColumnKey
}) {
  const columns = columnsProp ? resolveColumns(columnsProp) : DEFAULT_LEADERBOARD_COLUMNS
  const enabledNumeric = NUMERIC_COLUMN_KEYS.filter((k) => columns[k])
  // Podium headline = the batch's winning metric (if shown), else gain, else the
  // first enabled numeric column.
  const primaryKey: NumericColumnKey | null =
    highlightKey && columns[highlightKey] ? highlightKey : columns.gain ? "gain" : (enabledNumeric[0] ?? null)
  const subKeys = enabledNumeric.filter((k) => k !== primaryKey).slice(0, 4)

  if (rows.length === 0) {
    return (
      <div className="glass rounded-xl p-10 text-center">
        <Trophy className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="font-medium text-foreground">No traders yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Be the first to join and top the board.</p>
      </div>
    )
  }

  const top3 = rows.slice(0, 3)
  // Visual podium order: 2nd, 1st, 3rd
  const podiumOrder: { row: Row; place: 0 | 1 | 2 }[] = []
  if (top3[1]) podiumOrder.push({ row: top3[1], place: 1 })
  if (top3[0]) podiumOrder.push({ row: top3[0], place: 0 })
  if (top3[2]) podiumOrder.push({ row: top3[2], place: 2 })

  // Give the trader column room and each metric a sensible min so columns never crush;
  // the table scrolls horizontally when there are many enabled columns.
  const gridTemplate = `2.5rem minmax(9rem,1fr) repeat(${enabledNumeric.length}, minmax(5rem,1fr))`
  const minWidth = 180 + enabledNumeric.length * 88

  // Mobile: only rank + trader + headline metric are shown; the rest expand on tap.
  const detailKeys = enabledNumeric.filter((k) => k !== primaryKey)
  const mobileRows: MobileRow[] = rows.map((r, i) => {
    const primaryCell = primaryKey ? metricValue(r, primaryKey) : null
    return {
      id: r.id,
      rank: i + 1,
      nickname: r.nickname,
      realName: columns.realName ? (r.realName ?? null) : null,
      accountLogin: columns.account ? (r.accountLogin ?? null) : null,
      avatarUrl: r.avatarUrl,
      status: r.status,
      trades: r.trades,
      primary: primaryCell
        ? { label: primaryKey ? COLUMN_LABELS[primaryKey] : "", text: primaryCell.text, className: metricClass(primaryCell) }
        : null,
      details: detailKeys.map((k) => {
        const c = metricValue(r, k)
        return { label: COLUMN_LABELS[k], text: c.text, className: metricClass(c), warn: c.warn }
      }),
    }
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Podium — desktop: 2nd · 1st · 3rd with 1st raised and centered */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-3 sm:items-end">
        {podiumOrder.map(({ row, place }) => (
          <PodiumCard
            key={row.id}
            row={row}
            place={place}
            columns={columns}
            primaryKey={primaryKey}
            subKeys={subKeys}
          />
        ))}
      </div>

      {/* Podium — mobile: champion #1 spotlighted on top, runners-up as compact rows */}
      <div className="flex flex-col gap-3 sm:hidden">
        {top3[0] ? (
          <PodiumCard row={top3[0]} place={0} columns={columns} primaryKey={primaryKey} subKeys={subKeys} />
        ) : null}
        {top3[1] ? (
          <PodiumMiniRow row={top3[1]} place={1} columns={columns} primaryKey={primaryKey} />
        ) : null}
        {top3[2] ? (
          <PodiumMiniRow row={top3[2]} place={2} columns={columns} primaryKey={primaryKey} />
        ) : null}
      </div>

      {/* Full standings — rounded capsules with a staggered entrance */}
      {/* Mobile: compact rows (rank + trader + headline metric), tap to reveal the rest */}
      <MobileStandings rows={mobileRows} className="sm:hidden" />

      {/* Desktop: full table with every metric column (scrolls horizontally if needed) */}
      <div className="hidden overflow-x-auto sm:block">
        <div style={{ minWidth }}>
          {/* Column labels */}
          <div
            className="grid items-center gap-3 px-5 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <span>#</span>
            <span>Trader</span>
            {enabledNumeric.map((key) => (
              <span key={key} className="text-right">
                {COLUMN_LABELS[key]}
              </span>
            ))}
          </div>

          <ul className="flex flex-col gap-2.5">
            {rows.map((r, i) => {
              const rank = i + 1
              const isTop = rank <= 3
              return (
                <li
                  key={r.id}
                  className={cn(
                    "rank-capsule animate-rank-in grid min-h-[68px] items-center gap-3 rounded-[30px] border px-5 py-5 text-sm",
                    isTop
                      ? "border-primary/25 bg-primary/[0.06]"
                      : "border-border/50 bg-secondary/30",
                  )}
                  style={{
                    gridTemplateColumns: gridTemplate,
                    // Cap the stagger so long lists don't wait too long.
                    animationDelay: `${Math.min(i, 14) * 45}ms`,
                  }}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg font-mono text-sm font-bold tabular-nums",
                      rank === 1
                        ? "bg-accent/15 text-accent"
                        : rank <= 3
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {String(rank).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TraderAvatar
                      nickname={r.nickname}
                      src={r.avatarUrl}
                      size={36}
                      ring={rank === 1 ? "accent" : rank <= 3 ? "primary" : "none"}
                    />
                    <TraderIdentity row={r} columns={columns} />
                  </div>
                  {enabledNumeric.map((key) => {
                    const cell = metricValue(r, key)
                    const content: ReactNode =
                      key === "drawdown" ? (
                        <span className="flex items-center justify-end gap-1">
                          <TrendingDown className="h-3 w-3" aria-hidden />
                          {cell.text}
                        </span>
                      ) : (
                        cell.text
                      )
                    return (
                      <span
                        key={key}
                        className={cn(
                          "text-right font-mono tabular-nums",
                          key === "gain" ? "font-semibold" : "",
                          metricClass(cell),
                        )}
                      >
                        {content}
                      </span>
                    )
                  })}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
