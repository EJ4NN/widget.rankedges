import { Activity, RefreshCw, BarChart3, Code2, ShieldCheck, Gauge } from "lucide-react"

const FEATURES = [
  {
    icon: Activity,
    title: "Real-time leaderboards",
    body: "Rankings update live as trades close — no lag, no manual refresh, no waiting for end-of-day reports.",
  },
  {
    icon: RefreshCw,
    title: "MT4/MT5 auto-sync",
    body: "Trading accounts connect straight through your broker and sync automatically for the length of the contest.",
  },
  {
    icon: BarChart3,
    title: "Transparent metrics",
    body: "Gain, drawdown, lots traded, and risk-adjusted score are all visible — the same numbers for every trader in the arena.",
  },
  {
    icon: Code2,
    title: "Embeddable widget",
    body: "Brokers and partners can drop the live arena widget straight into their own portal or site in a single iframe.",
  },
  {
    icon: ShieldCheck,
    title: "Invite-only control",
    body: "Contest organizers control access with invite codes and admin-managed rosters — no open sign-up spam.",
  },
  {
    icon: Gauge,
    title: "Risk-adjusted scoring",
    body: "Categories beyond raw gain reward disciplined trading, not just the biggest swings.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div>
          <p className="eyebrow-mono">Built for competition</p>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything the arena runs on
          </h2>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass glass-hover rounded-xl p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded bg-accent/10 text-accent">
                <f.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
