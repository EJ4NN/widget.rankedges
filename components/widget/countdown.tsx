"use client"

import { useEffect, useState } from "react"

function diff(target: number) {
  const total = Math.max(0, target - Date.now())
  const days = Math.floor(total / (1000 * 60 * 60 * 24))
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((total / (1000 * 60)) % 60)
  const seconds = Math.floor((total / 1000) % 60)
  return { total, days, hours, minutes, seconds }
}

export function Countdown({ target, label }: { target: string; label: string }) {
  const targetMs = new Date(target).getTime()
  const [t, setT] = useState<ReturnType<typeof diff> | null>(null)

  useEffect(() => {
    setT(diff(targetMs))
    const id = setInterval(() => setT(diff(targetMs)), 1000)
    return () => clearInterval(id)
  }, [targetMs])

  const cells = [
    { v: t?.days, l: "Days" },
    { v: t?.hours, l: "Hrs" },
    { v: t?.minutes, l: "Min" },
    { v: t?.seconds, l: "Sec" },
  ]

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <div className="flex gap-2">
        {cells.map((c) => (
          <div
            key={c.l}
            className="flex min-w-14 flex-col items-center rounded-2xl border border-border bg-secondary px-3 py-2"
          >
            <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {c.v === undefined ? "--" : String(c.v).padStart(2, "0")}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
