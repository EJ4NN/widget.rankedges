import { cn } from "@/lib/utils"

type Block =
  | { kind: "heading"; text: string }
  | { kind: "item"; marker: string; text: string }
  | { kind: "paragraph"; text: string }

const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/
const BULLET = /^\s*[-*•]\s+(.*)$/

function isHeading(line: string): boolean {
  const t = line.trim()
  if (t.endsWith(":")) return true
  // Title-style line: short, no sentence-ending punctuation.
  const words = t.split(/\s+/).length
  return words <= 6 && !/[.!?]$/.test(t)
}

function parseRules(raw: string): Block[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const numbered = line.match(NUMBERED)
      if (numbered) return { kind: "item", marker: numbered[1], text: numbered[2] } as const
      const bullet = line.match(BULLET)
      if (bullet) return { kind: "item", marker: "•", text: bullet[1] } as const
      if (isHeading(line)) return { kind: "heading", text: line } as const
      return { kind: "paragraph", text: line } as const
    })
}

export function RulesContent({ rules, className }: { rules: string; className?: string }) {
  const blocks = parseRules(rules)

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h3
              key={i}
              className={cn(
                "text-pretty text-base font-bold leading-snug tracking-tight text-foreground",
                // Extra separation above headings, except the very first block.
                i > 0 && "mt-2",
              )}
            >
              {block.text.replace(/:$/, "")}
            </h3>
          )
        }

        if (block.kind === "item") {
          return (
            <div key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-xs font-bold text-primary">
                {block.marker}
              </span>
              <p className="text-pretty leading-relaxed text-muted-foreground">{block.text}</p>
            </div>
          )
        }

        return (
          <p key={i} className="text-pretty leading-relaxed text-muted-foreground">
            {block.text}
          </p>
        )
      })}
    </div>
  )
}
