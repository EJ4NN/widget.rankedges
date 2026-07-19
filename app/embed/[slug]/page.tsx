import { ContestWidget } from "@/components/widget/contest-widget"
import { EmbedAutoHeight } from "@/components/widget/embed-auto-height"

export const dynamic = "force-dynamic"

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <main className="bg-background p-4">
      <EmbedAutoHeight />
      <div className="mx-auto w-full max-w-4xl">
        <ContestWidget slug={slug} />
      </div>
    </main>
  )
}
