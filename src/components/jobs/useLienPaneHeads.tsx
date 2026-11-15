import { useEffect, useState, type RefObject, type UIEvent } from 'react'
import LienPaneHead from './LienPaneHead'
import { lienPaneSectionScrollTop, litLienPaneSection, type LienPaneSection } from '../../lib/jobs/lienPaneSections'

/**
 * The pinned strip a pane may draw over its heads (the notice pane's one-line strip once the gates scroll
 * away): its measured height while pinned, whether it is on the page now, the scroll past which it pins, and a
 * live read of its height for a landing. A pane with no strip passes none.
 */
export type LienPaneStrip = {
  height: number
  pinned: boolean
  foldPx: number
  measure: () => number
}

/**
 * One pane's stacked heads (v2.7320): the wiring the notice pane grew for its five sections (v2.4733), lifted so
 * the affidavit and retainage panes call the same thing — which head is lit from the pane's scroll, the press
 * that lands a section under its own head, and `head(key)` drawing `LienPaneHead` for a section. The pane is
 * the scrolling box (`paneRef`); each section's body is a sibling marked `data-lien-pane-body="<key>"`.
 */
export function useLienPaneHeads<K extends string>({
  paneRef,
  sections,
  phone,
  strip = null,
  resetKey,
}: {
  paneRef: RefObject<HTMLElement | null>
  sections: ReadonlyArray<LienPaneSection<K>>
  /** A phone pins one head, a thumb tall, in place of the stack (punch list #352, PR 6). */
  phone: boolean
  strip?: LienPaneStrip | null
  /** The lit head forgets itself when this changes — the selected job. */
  resetKey?: string | null
}) {
  const [lit, setLit] = useState<K | null>(null)
  useEffect(() => {
    setLit(null)
  }, [resetKey])
  const stripH = strip?.height ?? 0
  const bodyOf = (host: HTMLElement, key: K) => host.querySelector<HTMLElement>(`[data-lien-pane-body="${key}"]`)

  const relight = (host: HTMLElement) => {
    const bodies = sections
      .map((h) => ({ key: h.key, el: bodyOf(host, h.key) }))
      .filter((b): b is { key: K; el: HTMLElement } => b.el != null)
      .map((b) => ({ key: b.key, offsetTop: b.el.offsetTop }))
    const next = litLienPaneSection(bodies, host.scrollTop, strip && host.scrollTop > strip.foldPx ? strip.height : 0, phone)
    setLit((prev) => (prev === next ? prev : next))
  }

  const goTo = (key: K) => {
    const host = paneRef.current
    const i = sections.findIndex((h) => h.key === key)
    const body = host ? bodyOf(host, key) : null
    if (!host || !body || i < 0) return
    const scroll = (top: number, smooth: boolean) => {
      if (typeof host.scrollTo === 'function') host.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
      else host.scrollTop = top
    }
    const plain = lienPaneSectionScrollTop(body.offsetTop, i, 0, phone)
    if (!strip || plain <= strip.foldPx) {
      scroll(plain, true)
      setLit(key)
      return
    }
    const measured = () => strip.measure() || stripH
    if (strip.pinned) {
      // The strip is pinned already: its height is on the page to read.
      scroll(lienPaneSectionScrollTop(body.offsetTop, i, measured(), phone), true)
      setLit(key)
      return
    }
    // The strip will pin at the landing but is not on the page yet, so its height is a guess (the first live press
    // landed 15 px short on a wrapped strip). Step just past the fold so it mounts, read it, then land exactly.
    scroll(strip.foldPx + 1, false)
    window.setTimeout(() => {
      scroll(lienPaneSectionScrollTop(body.offsetTop, i, measured(), phone), true)
      setLit(key)
    }, 80)
  }

  const head = (key: K) => {
    const i = sections.findIndex((h) => h.key === key)
    if (i < 0) return null
    return <LienPaneHead section={sections[i]!} index={i} count={sections.length} stripHeight={stripH} lit={(lit ?? sections[0]?.key) === key} onGo={() => goTo(key)} phone={phone} />
  }

  return {
    /** The lit section; null before the first scroll (the first head is drawn lit then). */
    lit,
    head,
    goTo,
    relight,
    /** The pane's onScroll, when the pane has no other work on scroll. */
    onScroll: (ev: UIEvent<HTMLElement>) => relight(ev.currentTarget),
  }
}
