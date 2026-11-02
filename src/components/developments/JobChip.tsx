/**
 * A job's blue number as a press with a hover card (v2.6353): *JP1091* anywhere on the Development page
 * — the Jobs & bids table, the Money look, the Plans look's job chips, a History line, a question's
 * About — looks like the `LinkButton` it replaces and still opens the job on a press. Rest the pointer
 * on it and, after a beat, a card floats off the pointer with the job's full name, its address and its
 * details (`jobHoverCard.ts`); it follows the pointer along the chip and leaves with it. Keyboard focus
 * shows the card under the chip; Escape and blur hide it. On a phone nothing hovers: press and hold for
 * half a second and the card shows under the chip until a tap elsewhere, and a plain tap still opens the
 * job.
 *
 * The card takes no pointer events, so it never stands between the pointer and the chip's press, and it
 * is drawn through a portal at the body with a fixed place, so a table's scroll box or a card's edge never
 * clips it. The words come from the page's provider (`JobCardsProvider`), which holds the rows the page
 * read; with no provider, or a job the page does not hold, the chip is the plain press it was. Nothing is
 * fetched on a hover.
 */
import { createContext, Fragment, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick'
import { NO_ADDRESS_WORDS, NO_NAME_WORDS, placeHoverCard, placeHoverCardUnder, type JobHoverCard } from '../../lib/developments/jobHoverCard'
import { capStyle, linkButtonStyle } from './developmentPageBits'

/** The page's answer to a chip: the card for a job it holds, null for one it does not. */
export type JobCardLookup = (jobId: string) => JobHoverCard | null

const JobCardsContext = createContext<JobCardLookup | null>(null)

/** Hands every job chip under it the page's cards. */
export function JobCardsProvider({ cardFor, children }: { cardFor: JobCardLookup; children: ReactNode }) {
  return <JobCardsContext.Provider value={cardFor}>{children}</JobCardsContext.Provider>
}

/** A beat before the card shows, so a pointer crossing the chip on its way elsewhere draws nothing. */
export const JOB_CARD_ENTER_MS = 150
/** How long a finger holds the chip before the card shows. */
export const JOB_CARD_HOLD_MS = 500
/** A touch's emulated mouse events arrive within this after the finger lifts; they are not a pointer resting. */
const TOUCH_SHADOW_MS = 700
/** Above the dock (700) and the page's sticky strip; the press closes the card before any window opens. */
const JOB_CARD_Z = 760
const CARD_WIDTH = 300

type Anchor = { kind: 'pointer' } | { kind: 'chip'; held: boolean }

export function JobChip({ jobId, onOpen, children, strong, nowrap, testId }: { jobId: string; onOpen: () => void; children: ReactNode; strong?: boolean; nowrap?: boolean; testId?: string }) {
  const cardFor = useContext(JobCardsContext)
  const card = cardFor ? cardFor(jobId) : null
  const cardId = useId()
  const chipRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<Anchor | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const enterTimer = useRef<number | null>(null)
  const holdTimer = useRef<number | null>(null)
  const raf = useRef<number | null>(null)
  const pointerDown = useRef(false)
  const swallowClick = useRef(false)
  const lastTouchAt = useRef(0)

  const clearTimers = useCallback(() => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    if (raf.current) window.cancelAnimationFrame(raf.current)
    enterTimer.current = null
    holdTimer.current = null
    raf.current = null
  }, [])
  const close = useCallback(() => {
    clearTimers()
    setOpen(null)
  }, [clearTimers])
  useEffect(() => clearTimers, [clearTimers])
  // A press elsewhere, or Escape, closes: the phone's way out after a hold, the desk's Escape.
  useCloseOnOutsideClick(chipRef, open !== null, close)
  // The page scrolling under an open card: the chip moves and the card would not, so it goes.
  useEffect(() => {
    if (!open) return
    const onScroll = () => close()
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [open, close])

  // Where the card sits, written straight onto the element: off the pointer, or under the chip, inside the window.
  const place = useCallback(() => {
    const el = cardRef.current
    if (!el || !open) return
    const box = { width: el.offsetWidth, height: el.offsetHeight }
    const win = { width: window.innerWidth, height: window.innerHeight }
    const chip = chipRef.current
    const at = open.kind === 'chip' && chip ? placeHoverCardUnder(chip.getBoundingClientRect(), box, win) : placeHoverCard(pointer.current, box, win)
    el.style.left = `${at.left}px`
    el.style.top = `${at.top}px`
  }, [open])
  useLayoutEffect(() => {
    place()
  }, [place])

  const inTouchShadow = () => Date.now() - lastTouchAt.current < TOUCH_SHADOW_MS

  const onMouseEnter = (e: ReactMouseEvent) => {
    if (!card || inTouchShadow()) return
    pointer.current = { x: e.clientX, y: e.clientY }
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    enterTimer.current = window.setTimeout(() => {
      enterTimer.current = null
      setOpen({ kind: 'pointer' })
    }, JOB_CARD_ENTER_MS)
  }
  const onMouseMove = (e: ReactMouseEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY }
    if (!open || open.kind !== 'pointer' || raf.current) return
    raf.current = window.requestAnimationFrame(() => {
      raf.current = null
      place()
    })
  }
  const onMouseLeave = () => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    enterTimer.current = null
    setOpen((o) => (o && o.kind === 'pointer' ? null : o))
  }
  // A mouse press focuses the chip on its way to the click: that focus draws no card of its own.
  const onMouseDown = () => {
    pointerDown.current = true
  }
  const onMouseUp = () => {
    pointerDown.current = false
  }
  const onFocus = () => {
    if (pointerDown.current) {
      pointerDown.current = false
      return
    }
    if (!card || inTouchShadow()) return
    clearTimers()
    setOpen({ kind: 'chip', held: false })
  }
  const onClick = (e: ReactMouseEvent) => {
    // The tap that ends a hold is the hold's own, not a press.
    if (swallowClick.current) {
      swallowClick.current = false
      e.preventDefault()
      return
    }
    close()
    onOpen()
  }
  // A finger: a new touch forgets the last hold; a hold of half a second shows the card and marks its own tap.
  const onTouchStart = () => {
    lastTouchAt.current = Date.now()
    swallowClick.current = false
    if (!card) return
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      swallowClick.current = true
      setOpen({ kind: 'chip', held: true })
    }, JOB_CARD_HOLD_MS)
  }
  const endHold = () => {
    lastTouchAt.current = Date.now()
    if (holdTimer.current) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
  }
  // A hold is ours, not the browser's: no callout or menu while a finger is on the chip.
  const onContextMenu = (e: ReactMouseEvent) => {
    if (holdTimer.current || inTouchShadow()) e.preventDefault()
  }

  const chipStyle: CSSProperties = { ...linkButtonStyle(strong, nowrap), userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }
  const showing = open !== null && card !== null

  return (
    <>
      <button
        type="button"
        ref={chipRef}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onFocus={onFocus}
        onBlur={close}
        onTouchStart={onTouchStart}
        onTouchEnd={endHold}
        onTouchMove={endHold}
        onTouchCancel={endHold}
        onContextMenu={onContextMenu}
        aria-describedby={showing ? cardId : undefined}
        data-job-chip={jobId}
        data-testid={testId}
        style={chipStyle}
      >
        {children}
      </button>
      {showing && open && card
        ? createPortal(
            <div
              ref={cardRef}
              id={cardId}
              role="tooltip"
              className="developmentCountCard"
              data-testid="job-hover-card"
              data-anchor={open.kind}
              data-held={open.kind === 'chip' && open.held ? '1' : undefined}
              style={{ position: 'fixed', left: 0, top: 0, zIndex: JOB_CARD_Z, width: CARD_WIDTH, maxWidth: 'calc(100vw - 16px)', pointerEvents: 'none', padding: '10px 12px', fontSize: '0.8rem', lineHeight: 1.4, color: 'var(--text-strong)' }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text-link)', whiteSpace: 'nowrap' }}>{card.number}</strong>
                <span data-testid="job-hover-card-name" style={{ fontWeight: 700, color: card.name === NO_NAME_WORDS ? 'var(--text-faint)' : 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                  {card.name}
                </span>
              </div>
              <div data-testid="job-hover-card-address" style={{ marginTop: 2, color: card.address ? 'var(--text-muted)' : 'var(--text-faint)', overflowWrap: 'anywhere' }}>
                {card.address ?? NO_ADDRESS_WORDS}
              </div>
              {card.lines.length ? (
                <dl data-testid="job-hover-card-lines" style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: '2px 10px', margin: '8px 0 0' }}>
                  {card.lines.map((l) => (
                    <Fragment key={l.label}>
                      <dt style={{ ...capStyle, lineHeight: 1.6 }}>{l.label}</dt>
                      <dd style={{ margin: 0, color: 'var(--text-700)', overflowWrap: 'anywhere' }}>{l.value}</dd>
                    </Fragment>
                  ))}
                </dl>
              ) : null}
              {open.kind === 'chip' && open.held ? <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-faint)' }}>Tap elsewhere to close. Tap the number to open the job.</div> : null}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
