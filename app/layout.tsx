import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Space_Grotesk, Rajdhani, JetBrains_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
})
const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-rajdhani",
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-jetbrains-mono",
})

const SITE_NAME = "RankEdges Trading Arena"
const SITE_DESCRIPTION =
  "The esports-style arena for forex traders. Join live MT4/MT5 trading contests, connect your account, and climb the RankEdges leaderboard for real prizes."

// Prefer the live deployment URL; fall back to the production domain.
const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://rankedges.com"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Live MT4/MT5 Trading Contests`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "trading contest",
    "forex contest",
    "MT4",
    "MT5",
    "trading leaderboard",
    "demo trading competition",
    "RankEdges",
    "AIMS",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Live MT4/MT5 Trading Contests`,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Live MT4/MT5 Trading Contests`,
    description: SITE_DESCRIPTION,
  },
  generator: "v0.app",
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#050708",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-background font-sans antialiased">
        {children}
        <Toaster />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
