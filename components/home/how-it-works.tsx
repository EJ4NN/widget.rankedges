import { Link2, LineChart, Trophy } from "lucide-react"

const STEPS = [
  {
    icon: Link2,
    title: "Connect your MT4/MT5 account",
    body: "Link a live or demo trading account through your broker in minutes. RankEdges reads your trade history — no manual entry, no spreadsheets.",
  },
  {
    icon: LineChart,
    title: "Trade your strategy",
    body: "Keep trading the way you already do. Every position you open feeds directly into your contest stats — gain, drawdown, and lots, tracked automatically.",
  },
  {
    icon: Trophy,
    title: "Climb the live leaderboard",
    body: "Watch your rank move in real time as the field trades. Finish on top when the arena closes to claim prizes and arena standing.",
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-y border-border/50 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div>
          <p className="eyebrow-mono">How it works</p>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Three steps into the arena
          </h2>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="glass relative rounded-xl p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="font-mono text-sm font-bold text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
