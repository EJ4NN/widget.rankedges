import { Link2, LineChart, Trophy } from "lucide-react"

const STEPS = [
  {
    icon: Link2,
    title: "Connect your account",
    body: "Register your live MT4 or MT5 account for a contest. No extra software — your trades sync automatically.",
  },
  {
    icon: LineChart,
    title: "Trade your strategy",
    body: "Trade the contest window your way. Gains, balance, and equity update on the leaderboard in real time.",
  },
  {
    icon: Trophy,
    title: "Climb the leaderboard",
    body: "Outperform the field on ranked metrics and claim your place among the top traders for prizes and recognition.",
  },
]

export function HowItWorks() {
  return (
    <section className="border-y border-border/50 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <p className="eyebrow-mono">How it works</p>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            From account to arena in three steps
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
