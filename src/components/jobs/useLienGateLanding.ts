import { useEffect, useRef, useState, type RefObject } from 'react'
import { LAND_ON_HOLD_MS, lightLanded, prefersReducedMotion } from '../../lib/landOn'
import { lienGateLandingScrollTop, type LienGateLanding } from '../../lib/jobs/lienGateLanding'
import { lienPaneHeadOffsets, lienPaneSectionScrollTop } from '../../lib/jobs/lienPaneSections'

/**
 * A press on a Lien affidavits list row lands on the row's open gate (v2.8472, punch list #364): the wiring around
 * `lienGateLanding.ts`. The desk keeps the ask, one per press on a row; the pane answers it once, since a pane that
 * mounts again later (the Board opens the same job) must open as it always did.
 */

/** One press on a list row. A new object per press, so pressing the picked row again asks again. */
export type LienGateAsk = { jobId: string }

/** The desk's side: the ask the last row press left, and the press that leaves it. Any other way of picking a job clears it. */
export function useLienGateAsk(): { ask: LienGateAsk | null; askFor: (jobId: string | null) => void } {
  const [ask, setAsk] = useState<LienGateAsk | null>(null)
  return { ask, askFor: (jobId) => setAsk(jobId ? { jobId } : null) }
}

// The asks already answered. An ask is an object the desk made for one press; it is answered once, by whichever pane is on the page for its job.
const answered = new WeakSet<LienGateAsk>()

export type LienGateLandingAt = {
  /** The gates section's place among the pane's heads, and how many heads the pane has. */
  index: number
  count: number
  phone: boolean
  /** A test's stand-in for the reader's reduced-motion setting. */
  reducedMotion?: boolean
}

/**
 * Bring the gate's row into view inside the pane, put the keyboard on it when it is a live press, and light it for
 * a moment (`[data-landed]`, the app's one landing light). Only the pane scrolls, never the page around it. Under
 * reduced motion the pane jumps with no glide and the light stands still. Answers the undo, or null when the row is
 * not on the page.
 */
export function landOnLienGate(pane: HTMLElement | null, landing: LienGateLanding, at: LienGateLandingAt): (() => void) | null {
  const row = pane?.querySelector<HTMLElement>(`[data-lien-gate-row="${landing.key}"]`)
  if (!pane || !row) return null
  const host: HTMLElement = pane
  const reduced = at.reducedMotion ?? prefersReducedMotion()
  const head = lienPaneHeadOffsets(at.index, at.count, 0, at.phone)
  let placedAt: number | null = null
  const place = () => {
    const hostTop = host.getBoundingClientRect().top
    const inPane = (el: HTMLElement) => el.getBoundingClientRect().top - hostTop + host.scrollTop
    const body = host.querySelector<HTMLElement>('[data-lien-pane-body="gates"]')
    const rowTop = inPane(row)
    const top = lienGateLandingScrollTop({
      rowTop,
      rowHeight: row.getBoundingClientRect().height,
      scrollTop: host.scrollTop,
      viewHeight: host.clientHeight,
      topInset: head.top + head.height,
      bottomInset: typeof head.bottom === 'number' ? head.bottom : 0,
      sectionTop: lienPaneSectionScrollTop(body ? inPane(body) : rowTop, at.index, 0, at.phone),
    })
    if (top == null || top === placedAt) return
    placedAt = top
    if (typeof host.scrollTo === 'function') host.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
    else host.scrollTop = top
  }
  place()
  if (landing.focus) {
    try {
      // preventScroll: the pane has done the scrolling, and the page around the desk must not move with the keyboard.
      row.focus({ preventScroll: true })
    } catch {
      // A row that cannot take the keyboard is still brought into view.
    }
  }
  const lightOff = lightLanded(row, reduced)
  // A pane just opened is still settling: the job's path over the gates measures its own width and re-lays itself a frame
  // or two later, 8 to 53 px taller on the harness. While the light holds, a section that changes size places the row again.
  let watch: ResizeObserver | null = null
  let watchOff = 0
  if (typeof ResizeObserver === 'function') {
    watch = new ResizeObserver(place)
    for (const child of Array.from(host.children)) watch.observe(child)
    watchOff = window.setTimeout(() => watch?.disconnect(), LAND_ON_HOLD_MS)
  }
  return () => {
    window.clearTimeout(watchOff)
    watch?.disconnect()
    lightOff()
  }
}

/**
 * The pane's side: answer the desk's ask once. `landing` is read when the ask arrives, so it sees the gates as the
 * pane draws them now; null (every gate clear) leaves the pane as it opened.
 */
export function useLienGateLanding({ ask, jobId, paneRef, landing, at }: { ask: LienGateAsk | null | undefined; jobId: string; paneRef: RefObject<HTMLElement | null>; landing: () => LienGateLanding | null; at: LienGateLandingAt }): void {
  const undo = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!ask || ask.jobId !== jobId || answered.has(ask)) return
    answered.add(ask)
    const to = landing()
    if (!to) return
    undo.current?.()
    undo.current = landOnLienGate(paneRef.current, to, at)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the ask is the signal; the gates and the heads are read as they stand when it arrives
  }, [ask])
  useEffect(
    () => () => {
      undo.current?.()
      undo.current = null
    },
    [],
  )
}
