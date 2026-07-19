import { ContestWidget } from "@/components/widget/contest-widget"

export const dynamic = "force-dynamic"

export default async function ContestPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <main className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <ContestWidget slug={slug} />
      </div>
    </main>
  )
}
