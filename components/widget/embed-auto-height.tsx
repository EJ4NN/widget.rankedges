"use client"

import { useEffect } from "react"

/**
 * Posts the document height to the parent window so the host page
 * (e.g. the AIMS site) can resize the <iframe> to fit the widget.
 * The host listens for messages of shape { type: "aims-contest-height", height }.
 */
export function EmbedAutoHeight() {
  useEffect(() => {
    const post = () => {
      const height = document.documentElement.scrollHeight
      window.parent?.postMessage({ type: "aims-contest-height", height }, "*")
    }

    post()

    const ro = new ResizeObserver(post)
    ro.observe(document.documentElement)

    const interval = setInterval(post, 2000)
    window.addEventListener("load", post)

    return () => {
      ro.disconnect()
      clearInterval(interval)
      window.removeEventListener("load", post)
    }
  }, [])

  return null
}
