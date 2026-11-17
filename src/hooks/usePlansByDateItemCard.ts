/**
 * How the Plans look's By date card comes and goes (punch list #367, PR 2): which item it is about, whether
 * it is pinned, the handlers an item takes, and where the card stands. The box itself is
 * `components/developments/PlansByDateItemCard.tsx`, which says why it behaves this way.
 */
import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react'

/** A beat before the card shows, so a pointer crossing the chart draws nothing. */
export const PBD_CARD_ENTER_MS = 140
/** A line of the dated list waits longer: a pointer reading down the list should not raise a card on every line. */
export const PBD_CARD_ENTER_LIST_MS = 380
/** How long the card waits after the pointer leaves, so the pointer can cross the gap onto it. */
export const PBD_CARD_LEAVE_MS = 240
export const PBD_CARD_WIDTH = 320
const GAP = 8
export const PBD_CARD_MARGIN = 8
const MARGIN = PBD_CARD_MARGIN
/** Above the dock (700), level with the page's own sheets; the windows a press opens stand higher. */
export const PBD_CARD_Z = 760

export type ItemCardState = { key: string; trail: string[]; pinned: boolean }

export type ItemCardBind = {
  onMouseEnter: (e: MouseEvent<Element>) => void
  onMouseLeave: () => void
  onFocus: (e: FocusEvent<Element>) => void
  onBlur: () => void
  onClick: (e: MouseEvent<Element>) => void
  onKeyDown: (e: KeyboardEvent<Element>) => void
  'data-pbd-item': string
  /** A line of the list keeps its words in view: its card stands at the line's right end. */
  'data-pbd-align': 'centre' | 'end'
  'aria-haspopup': 'dialog'
}

/**
 * The one card of the view: which item it is about, whether it is pinned, and the handlers an item takes.
 * `sheet` is the narrow screen's mode, where only a press opens it.
 */
export function useItemCard(sheet: boolean) {
  const [state, setState] = useState<ItemCardState | null>(null)
  const stateRef = useRef<ItemCardState | null>(null)
  stateRef.current = state
  const anchorRef = useRef<Element | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const enterTimer = useRef<number | undefined>(undefined)
  const leaveTimer = useRef<number | undefined>(undefined)
  const clearTimers = useCallback(() => {
    window.clearTimeout(enterTimer.current)
    window.clearTimeout(leaveTimer.current)
  }, [])
  useEffect(() => clearTimers, [clearTimers])

  const show = useCallback(
    (key: string, el: Element, pinned: boolean) => {
      clearTimers()
      anchorRef.current = el
      setState({ key, trail: [], pinned })
    },
    [clearTimers],
  )
  const close = useCallback(
    (refocus = false) => {
      clearTimers()
      const anchor = anchorRef.current
      setState(null)
      if (refocus && anchor instanceof HTMLElement) anchor.focus()
      else if (refocus && anchor instanceof SVGElement) anchor.focus()
    },
    [clearTimers],
  )
  const leaveSoon = useCallback(() => {
    window.clearTimeout(enterTimer.current)
    window.clearTimeout(leaveTimer.current)
    if (stateRef.current && !stateRef.current.pinned) leaveTimer.current = window.setTimeout(() => setState((s) => (s && !s.pinned ? null : s)), PBD_CARD_LEAVE_MS)
  }, [])

  const bind = useCallback(
    (key: string, where: 'chart' | 'list' = 'chart'): ItemCardBind => ({
      onMouseEnter: (e) => {
        if (sheet || stateRef.current?.pinned) return
        const el = e.currentTarget
        clearTimers()
        if (stateRef.current?.key === key) return
        // Once a card is up, the next item answers at once: the reader is reading, not passing through.
        enterTimer.current = window.setTimeout(() => show(key, el, false), where === 'list' ? PBD_CARD_ENTER_LIST_MS : stateRef.current ? 40 : PBD_CARD_ENTER_MS)
      },
      onMouseLeave: () => {
        if (!sheet) leaveSoon()
      },
      onFocus: (e) => {
        if (sheet || stateRef.current?.pinned) return
        show(key, e.currentTarget, false)
      },
      onBlur: () => {
        if (!sheet) leaveSoon()
      },
      onClick: (e) => {
        e.stopPropagation()
        show(key, e.currentTarget, true)
      },
      onKeyDown: (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        show(key, e.currentTarget, true)
        // The keyboard follows the card it opened, so its presses are a Tab away.
        window.setTimeout(() => cardRef.current?.focus(), 0)
      },
      'data-pbd-item': key,
      'data-pbd-align': where === 'list' ? 'end' : 'centre',
      'aria-haspopup': 'dialog',
    }),
    [sheet, show, leaveSoon, clearTimers],
  )

  // Escape, and a press anywhere but the card or an item, put the card away.
  const open = state !== null
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close(true)
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (cardRef.current?.contains(t) || t.closest('[data-pbd-item]')) return
      close()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open, close])

  const go = useCallback((key: string) => setState((s) => (s ? { key, trail: [...s.trail, s.key], pinned: true } : s)), [])
  const back = useCallback(() => setState((s) => (s && s.trail.length ? { key: s.trail[s.trail.length - 1] ?? s.key, trail: s.trail.slice(0, -1), pinned: true } : s)), [])
  const cardHover = { onMouseEnter: clearTimers, onMouseLeave: leaveSoon }

  return { state, bind, close, go, back, anchorRef, cardRef, cardHover }
}

/** Where the card stands beside its item: above it when there is room, else below, and inside the window either way. */
export function placeItemCard(anchor: { left: number; top: number; right: number; bottom: number }, cardBox: { width: number; height: number }, win: { width: number; height: number }, align: 'centre' | 'end' = 'centre'): { left: number; top: number } {
  const above = anchor.top - GAP - cardBox.height
  const below = anchor.bottom + GAP
  const top = above >= MARGIN ? above : below + cardBox.height <= win.height - MARGIN ? below : Math.max(MARGIN, win.height - MARGIN - cardBox.height)
  const wanted = align === 'end' ? anchor.right - cardBox.width : (anchor.left + anchor.right) / 2 - cardBox.width / 2
  const left = Math.max(MARGIN, Math.min(wanted, win.width - MARGIN - cardBox.width))
  return { left, top }
}

