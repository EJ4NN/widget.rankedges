"use client"

import { useEffect, useRef } from "react"

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  hue: "gold" | "sky"
  alpha: number
  twinkle: number
}

// Brand hues (AIMS gold + sky-blue), matching the RankEdges front page.
const GOLD = "240, 176, 46" // hsl(41 90% 58%)
const SKY = "64, 195, 251" // hsl(199 96% 62%)

/**
 * Ambient particle field rendered on a fixed, full-viewport canvas behind all
 * content. Gold/blue motes drift slowly upward like sparks over the navy-black
 * base, echoing the trading-arena front page. Respects reduced-motion and
 * pauses when the tab is hidden.
 */
export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let width = 0
    let height = 0
    let dpr = 1
    let particles: Particle[] = []
    let rafId = 0
    let running = true

    const makeParticle = (seedY?: number): Particle => {
      const hue: Particle["hue"] = Math.random() > 0.5 ? "gold" : "sky"
      return {
        x: Math.random() * width,
        y: seedY ?? Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(0.08 + Math.random() * 0.28),
        size: 0.6 + Math.random() * 1.8,
        hue,
        alpha: 0.15 + Math.random() * 0.45,
        twinkle: Math.random() * Math.PI * 2,
      }
    }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Density scales with viewport area, capped for performance.
      const target = Math.min(90, Math.round((width * height) / 22000))
      particles = Array.from({ length: target }, () => makeParticle())
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.twinkle += 0.02
        // Recycle particles that drift off the top or sides.
        if (p.y < -10 || p.x < -10 || p.x > width + 10) {
          Object.assign(p, makeParticle(height + 10))
        }
        const flicker = 0.7 + Math.sin(p.twinkle) * 0.3
        const a = p.alpha * flicker
        const rgb = p.hue === "gold" ? GOLD : SKY
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${a})`
        ctx.shadowBlur = p.size * 4
        ctx.shadowColor = `rgba(${rgb}, ${a * 0.8})`
        ctx.fill()
      }
      ctx.shadowBlur = 0
      if (running) rafId = requestAnimationFrame(draw)
    }

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height)
      for (const p of particles) {
        const rgb = p.hue === "gold" ? GOLD : SKY
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb}, ${p.alpha})`
        ctx.fill()
      }
    }

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(rafId)
      } else if (!reducedMotion) {
        running = true
        rafId = requestAnimationFrame(draw)
      }
    }

    resize()
    if (reducedMotion) {
      drawStatic()
    } else {
      rafId = requestAnimationFrame(draw)
    }

    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
