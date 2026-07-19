"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { TraderAvatar } from "@/components/widget/trader-avatar"
import { ChevronDown, TrendingDown } from "lucide-react"

export type MobileCell = { label: string; text: string; className: string; warn?: boolean }

export type MobileRow = {
  id: number
  rank: number
  nickname: string
  realName?: string | null
  accountLogin?: string | null
  avatarUrl: string | null
  status: string
  trades: number | null
  primary: MobileCell | null
  details: MobileCell[]
}

export function MobileStandings({ rows, className }: { rows: MobileRow[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {rows.map((r) => (
        <MobileStandingRow key={r.id} row={r} />
      ))}
    </ul>
  )
}

function MobileStandingRow({ row }: { row: MobileRow }) {
  const [open, setOpen] = useState(false)
  const isTop = row.rank <= 3
  const hasDetails = row.details.length > 0

  return (
    <li
      className={cn(
        "rank-capsule animate-rank-in overflow-hidden rounded-[28px] border",
        isTop ? "border-primary/25 bg-primary/[0.06]" : "border-border/50 bg-secondary/30",
      )}
    >
      <button
        type="button"
        onClick={() => hasDetails && setOpen((o) => !o)}
        aria-expanded={hasDetails ? open : undefined}
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
      >
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold tabular-nums",
            row.rank === 1
              ? "bg-accent/15 text-accent"
              : row.rank <= 3
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground",
          )}
        >
          {String(row.rank).padStart(2, "0")}
        </span>
        <TraderAvatar
          nickname={row.nickname}
          src={row.avatarUrl}
          size={36}
          ring={row.rank === 1 ? "accent" : row.rank <= 3 ? "primary" : "none"}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{row.nickname}</p>
          {row.realName ? (
            <p className="truncate text-[10px] text-muted-foreground">{row.realName}</p>
          ) : row.accountLogin ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">#{row.accountLogin}</p>
          ) : row.status === "pending" ? (
            <p className="text-[10px] text-muted-foreground">Awaiting verification</p>
          ) : (
            <p className="font-mono text-[10px] text-muted-foreground">{row.trades ?? 0} trades</p>
          )}
        </div>
        {row.primary ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={cn("font-mono text-base font-semibold tabular-nums", row.primary.className)}>
              {row.primary.text}
            </span>
            {hasDetails ? (
              <ChevronDown
                className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
                aria-hidden
              />
            ) : null}
          </div>
        ) : null}
      </button>

      {hasDetails ? (
        <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {row.details.map((d) => (
                <div key={d.label} className="rounded-xl bg-background/40 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{d.label}</p>
                  <p className={cn("font-mono text-sm font-semibold tabular-nums", d.className)}>
                    {d.warn ? (
                      <span className="flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" aria-hidden />
                        {d.text}
                      </span>
                    ) : (
                      d.text
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  )
}
