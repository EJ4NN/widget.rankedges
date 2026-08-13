"use client"

import { useState, useTransition } from "react"
import { assignContest, unassignContest } from "@/app/actions/admin"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Users, Crown } from "lucide-react"

type AccessRow = {
  id: string
  name: string
  email: string
  isOwner: boolean
  assigned: boolean
}

export function ContestAccessCard({ contestId, rows }: { contestId: number; rows: AccessRow[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(rows.map((r) => [r.id, r.assigned])),
  )
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function toggle(row: AccessRow) {
    if (row.isOwner) return // owner access is permanent
    const next = !state[row.id]
    setState((s) => ({ ...s, [row.id]: next }))
    setBusyId(row.id)
    startTransition(async () => {
      const res = next
        ? await assignContest(contestId, row.id)
        : await unassignContest(contestId, row.id)
      if (res?.ok) {
        toast.success(next ? `Granted access to ${row.name}` : `Removed ${row.name}'s access`)
      } else {
        // Roll back optimistic state on failure.
        setState((s) => ({ ...s, [row.id]: !next }))
        toast.error("Could not update access")
      }
      setBusyId(null)
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-semibold text-foreground">Contest access</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Choose which sub-admins can manage this contest. The owner always has access.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-background/40 px-3 py-6 text-center text-sm text-muted-foreground">
          No sub-admins yet. Create one in the Admins tab to assign contest access.
        </p>
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => {
            const checked = row.isOwner || state[row.id]
            return (
              <div
                key={row.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                  checked ? "border-primary/50 bg-primary/10" : "border-border bg-background/40",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {row.name}
                    {row.isOwner && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                        <Crown className="h-3 w-3" aria-hidden /> Owner
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{row.email}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  aria-label={`Toggle access for ${row.name}`}
                  disabled={row.isOwner || (pending && busyId === row.id)}
                  onClick={() => toggle(row)}
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    checked ? "bg-primary" : "bg-muted-foreground/30",
                    row.isOwner ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
                      checked ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
