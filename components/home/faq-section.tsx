import { ChevronDown } from "lucide-react"

const FAQS = [
  {
    q: "What do I need to join a contest?",
    a: "A live or demo MT4/MT5 trading account with a supported broker, plus an invite or contest link from an organizer. Once connected, your trades sync automatically for the length of the arena.",
  },
  {
    q: "How is my rank calculated?",
    a: "Your rank is driven by the contest's scoring metric — usually percentage gain, with drawdown and lots traded shown alongside. Every trader is scored the same way, and the board updates live as trades close.",
  },
  {
    q: "Can brokers or partners embed the arena?",
    a: "Yes. Brokers, IBs and partners can drop the live leaderboard widget into their own site or portal with a single iframe — branded to them, with no code required.",
  },
  {
    q: "Is RankEdges only for live accounts?",
    a: "No. Contests support both live and demo MT4/MT5 accounts, depending on how the organizer sets up the arena.",
  },
  {
    q: "How do I access the admin dashboard?",
    a: "Contest organizers get an admin dashboard to manage rosters, invite codes and standings. Reach out through RankEdges to set up organizer access for your brand.",
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div>
          <p className="eyebrow-mono">FAQ</p>
          <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Questions from the field
          </h2>
        </div>

        <div className="mt-10 flex flex-col gap-3">
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              className="glass group rounded-xl [&_summary]:list-none"
              open={i === 0}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-display text-base font-semibold text-foreground">
                {f.q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
