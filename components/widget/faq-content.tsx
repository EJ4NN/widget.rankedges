"use client"

import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type QA = { question: string; answer: string }

/**
 * Parse free-text FAQ into Q/A pairs. Admins write alternating lines:
 *
 *   Q: How do I join?
 *   A: Click Join Contest and enter your MT4 ID.
 *   Q: When does it start?
 *   A: 17 August 2026.
 *
 * Answer lines accumulate until the next "Q:" so multi-line answers work.
 * As a fallback, a blank-line-separated block with no prefixes is treated as
 * "first line = question, rest = answer".
 */
function parseFaq(raw: string): QA[] {
  const lines = raw.split(/\r?\n/)
  const items: QA[] = []
  let current: QA | null = null
  let mode: "answer" | null = null

  const isQ = (l: string) => /^\s*q\s*[:.)-]/i.test(l)
  const isA = (l: string) => /^\s*a\s*[:.)-]/i.test(l)
  const strip = (l: string) => l.replace(/^\s*[qa]\s*[:.)-]\s*/i, "").trim()

  for (const line of lines) {
    if (isQ(line)) {
      if (current && current.question) items.push(current)
      current = { question: strip(line), answer: "" }
      mode = null
    } else if (isA(line) && current) {
      current.answer = strip(line)
      mode = "answer"
    } else if (mode === "answer" && current && line.trim()) {
      current.answer += (current.answer ? " " : "") + line.trim()
    }
  }
  if (current && current.question) items.push(current)

  // Fallback: no "Q:/A:" markers at all — split on blank lines into blocks.
  if (items.length === 0) {
    for (const block of raw.split(/\n\s*\n/)) {
      const parts = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      if (parts.length === 0) continue
      items.push({ question: parts[0], answer: parts.slice(1).join(" ") })
    }
  }

  return items
}

export function FaqContent({ faq, className }: { faq: string; className?: string }) {
  const items = parseFaq(faq)
  if (items.length === 0) {
    return <p className="text-muted-foreground">No questions have been published for this contest.</p>
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((item, i) => (
        <details
          key={i}
          className="group rounded-lg border border-border/60 bg-secondary/30 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-pretty text-sm font-semibold text-foreground">
            {item.question}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          {item.answer ? (
            <p className="text-pretty px-4 pb-4 leading-relaxed text-muted-foreground">{item.answer}</p>
          ) : null}
        </details>
      ))}
    </div>
  )
}
