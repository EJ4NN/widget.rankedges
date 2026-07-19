"use client"

import { useState, useTransition } from "react"
import { updateLeaderboardColumns } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Check, Eye, EyeOff } from "lucide-react"
import {
  COLUMN_LABELS,
  resolveColumns,
  type LeaderboardColumns,
} from "@/lib/leaderboard-columns"

// Order shown in the admin panel. Private fields are grouped at the end.
const METRIC_KEYS: (keyof LeaderboardColumns)[] = [
  "gain",
  "absoluteGain",
  "lots",
  "equity",
  "deposits",
  "withdrawals",
  "drawdown",
]
const PRIVATE_KEYS: (keyof LeaderboardColumns)[] = ["realName", "account"]

function Toggle({
  label,
  checked,
  onToggle,
  hint,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  hint?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        checked ? "border-primary/50 bg-primary/10" : "border-border bg-background/40 hover:bg-muted/40",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  )
}

export function LeaderboardColumnsCard({
  contestId,
  initial,
}: {
  contestId: number
  initial: Partial<LeaderboardColumns> | null
}) {
  const [cols, setCols] = useState<LeaderboardColumns>(resolveColumns(initial))
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function toggle(key: keyof LeaderboardColumns) {
    setCols((c) => ({ ...c, [key]: !c[key] }))
    setSaved(false)
  }

  function save() {
    startTransition(async () => {
      const res = await updateLeaderboardColumns(contestId, cols)
      if (res?.ok) {
        setSaved(true)
        toast.success("Leaderboard display updated")
      } else {
        toast.error("Could not save display settings")
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Eye className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-semibold text-foreground">Leaderboard display</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose which columns appear on the public leaderboard for this contest.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {METRIC_KEYS.map((key) => (
          <Toggle key={key} label={COLUMN_LABELS[key]} checked={cols[key]} onToggle={() => toggle(key)} />
        ))}
      </div>

      <div className="mt-4 mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <EyeOff className="h-3.5 w-3.5" aria-hidden />
        Private fields — off by default
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {PRIVATE_KEYS.map((key) => (
          <Toggle
            key={key}
            label={COLUMN_LABELS[key]}
            checked={cols[key]}
            onToggle={() => toggle(key)}
            hint={key === "realName" ? "Shows trader's real name" : "Shows MT4/MT5 account number"}
          />
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {saved ? <Check className="mr-1.5 h-4 w-4" /> : null}
          {pending ? "Saving..." : "Save display"}
        </Button>
      </div>
    </div>
  )
}
