import { useEffect, useRef, useState } from 'react'

/**
 * GC mode design spike: the jump strip's two behaviors (the owner, 2026-10-04). Pressing a pill
 * scrolls its section's heading under the strip; scrolling lights the pill of the section in view.
 * The Project Board and Trade partners both use it.
 *
 * `keys` are the sections in page order and `idOf` gives each one's heading id. Both are read
 * fresh on every scroll, so the watcher subscribes once per `resetKey` (a new grouping, say).
 */
export function useJumpStrip(enabled: boolean, keys: string[], idOf: (key: string) => string, resetKey = ''): { active: string | null; jumpTo: (key: string) => void } {
  const [active, setActive] = useState<string | null>(null)
  const keysRef = useRef(keys)
  keysRef.current = keys
  const idRef = useRef(idOf)
  idRef.current = idOf
  // The pressed pill stays lit while the jump scrolls, even when the page ends before it reaches the top.
  const lock = useRef<{ key: string; until: number } | null>(null)

  const jumpTo = (key: string) => {
    setActive(key)
    // A long jump can take a few seconds to scroll; the pressed pill holds until it lands.
    lock.current = { key, until: Date.now() + 3000 }
    const id = idRef.current(key)
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }

  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const look = () => {
      frame = 0
      const held = lock.current
      if (held && Date.now() < held.until) {
        setActive(held.key)
        return
      }
      let current: string | null = null
      // At the end of the page the last headings cannot reach the strip: count the top half instead.
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      const reach = atEnd ? window.innerHeight / 2 : 90
      for (const key of keysRef.current) {
        const el = document.getElementById(idRef.current(key))
        if (el && el.getBoundingClientRect().top <= reach) current = key
      }
      setActive(current ?? keysRef.current[0] ?? null)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(look)
    }
    lock.current = null
    look()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled, resetKey])

  return { active, jumpTo }
}
