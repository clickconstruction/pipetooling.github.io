/**
 * The hold gesture behind a bid mark (v2.4287): press a row and keep still for half a second
 * and the row is marked (or cleared); let go early and nothing happens; move and it cancels;
 * the release after a full hold must not also open the bid.
 *
 * `holdStep` is the pure state machine — one call per pointer event, returning the next state
 * and what the caller must do (start or stop the timer, fire, swallow the click). Rows do not
 * re-render while a hold runs, but they DO re-render when the hold fires (the mark changes),
 * so the state lives in a module map keyed by the row, never in a closure made during render:
 * `bidMarkHoldHandlers` is the DOM glue that reads and writes that map.
 *
 * Phases: idle → (primary press) holding → (timer) fired → (the click that follows) idle.
 * In `fired` a pointer-up or leave changes nothing: the click is what ends it, and on a touch
 * screen that click may never come, so the next press resets the row anyway.
 */
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'

export const BID_MARK_HOLD_MS = 500
/** A finger that moves further than this is scrolling, not holding. */
export const BID_MARK_HOLD_SLOP_PX = 8

export type HoldPhase = 'idle' | 'holding' | 'fired'
export type HoldState = { phase: HoldPhase; x: number; y: number }
export const HOLD_IDLE: HoldState = { phase: 'idle', x: 0, y: 0 }

export type HoldEvent =
  | { type: 'down'; x: number; y: number; primary: boolean }
  | { type: 'move'; x: number; y: number }
  | { type: 'up' }
  | { type: 'cancel' }
  | { type: 'timer' }
  | { type: 'click' }

export type HoldResult = {
  state: HoldState
  /** Arm the hold timer (a fresh press). */
  startTimer: boolean
  /** Disarm it (released, moved or cancelled before it fired). */
  stopTimer: boolean
  /** The hold completed: toggle the mark now. */
  fire: boolean
  /** This click is the tail of a completed hold: it must not open the row. */
  swallowClick: boolean
}

function result(state: HoldState, over: Partial<Omit<HoldResult, 'state'>> = {}): HoldResult {
  return { state, startTimer: false, stopTimer: false, fire: false, swallowClick: false, ...over }
}

export function holdStep(state: HoldState, event: HoldEvent, slopPx: number = BID_MARK_HOLD_SLOP_PX): HoldResult {
  switch (event.type) {
    case 'down':
      if (!event.primary) return result(state.phase === 'holding' ? HOLD_IDLE : state, { stopTimer: state.phase === 'holding' })
      return result({ phase: 'holding', x: event.x, y: event.y }, { startTimer: true, stopTimer: state.phase === 'holding' })
    case 'move':
      if (state.phase !== 'holding') return result(state)
      if (Math.abs(event.x - state.x) > slopPx || Math.abs(event.y - state.y) > slopPx) return result(HOLD_IDLE, { stopTimer: true })
      return result(state)
    case 'up':
    case 'cancel':
      if (state.phase === 'holding') return result(HOLD_IDLE, { stopTimer: true })
      return result(state)
    case 'timer':
      if (state.phase !== 'holding') return result(state)
      return result({ ...state, phase: 'fired' }, { fire: true })
    case 'click':
      if (state.phase === 'fired') return result(HOLD_IDLE, { swallowClick: true })
      return result(state)
  }
}

// ---- DOM glue: one entry per row key, outliving renders ----

type Entry = { state: HoldState; timer: ReturnType<typeof setTimeout> | null; el: HTMLElement | null }
const entries = new Map<string, Entry>()

function entryFor(key: string): Entry {
  let e = entries.get(key)
  if (!e) {
    e = { state: HOLD_IDLE, timer: null, el: null }
    entries.set(key, e)
  }
  return e
}

function setHoldingAttr(el: HTMLElement | null, holding: boolean) {
  if (!el) return
  if (holding) el.dataset.holding = 'true'
  else delete el.dataset.holding
}

function apply(key: string, entry: Entry, r: HoldResult, onFire: () => void, holdMs: number) {
  entry.state = r.state
  if (r.stopTimer && entry.timer != null) {
    clearTimeout(entry.timer)
    entry.timer = null
  }
  if (r.startTimer) {
    entry.timer = setTimeout(() => {
      entry.timer = null
      const fired = holdStep(entry.state, { type: 'timer' })
      apply(key, entry, fired, onFire, holdMs)
    }, holdMs)
  }
  setHoldingAttr(entry.el, entry.state.phase === 'holding')
  if (r.fire) onFire()
}

export type BidMarkHoldHandlers = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
  onClickCapture: (e: ReactMouseEvent<HTMLElement>) => void
  onContextMenu: (e: ReactMouseEvent<HTMLElement>) => void
}

/**
 * The handlers a row spreads to take the hold. `key` is the row (bid id plus the surface, so
 * the board and the picker never share an entry); `onFire` toggles the mark. The row sets
 * `data-holding="true"` while a hold runs — the CSS fill bar animates on that.
 */
export function bidMarkHoldHandlers(key: string, onFire: () => void, holdMs: number = BID_MARK_HOLD_MS): BidMarkHoldHandlers {
  const step = (event: HoldEvent, el: HTMLElement | null) => {
    const entry = entryFor(key)
    if (el) entry.el = el
    apply(key, entry, holdStep(entry.state, event), onFire, holdMs)
    return entry
  }
  return {
    onPointerDown: (e) => {
      const primary = e.isPrimary && (e.pointerType !== 'mouse' || e.button === 0)
      step({ type: 'down', x: e.clientX, y: e.clientY, primary }, e.currentTarget)
    },
    onPointerMove: (e) => {
      step({ type: 'move', x: e.clientX, y: e.clientY }, e.currentTarget)
    },
    onPointerUp: (e) => {
      step({ type: 'up' }, e.currentTarget)
    },
    onPointerLeave: (e) => {
      step({ type: 'up' }, e.currentTarget)
    },
    onPointerCancel: (e) => {
      step({ type: 'cancel' }, e.currentTarget)
    },
    onClickCapture: (e) => {
      const entry = entryFor(key)
      const r = holdStep(entry.state, { type: 'click' })
      entry.state = r.state
      if (r.swallowClick) {
        e.preventDefault()
        e.stopPropagation()
      }
    },
    onContextMenu: (e) => {
      // A touch long-press would open the system menu over the hold; a mouse right-click keeps it.
      const entry = entries.get(key)
      const touchOrHolding = ('pointerType' in e.nativeEvent && (e.nativeEvent as PointerEvent).pointerType === 'touch') || entry?.state.phase !== 'idle'
      if (touchOrHolding) e.preventDefault()
    },
  }
}

/** Tests: forget every row's hold. */
export function resetBidMarkHoldsForTests() {
  for (const e of entries.values()) if (e.timer != null) clearTimeout(e.timer)
  entries.clear()
}
