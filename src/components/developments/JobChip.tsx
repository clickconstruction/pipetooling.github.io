/**
 * A job's blue number as a press with a hover card (v2.6353): *JP1091* anywhere on the Development page
 * (the Jobs & bids table, the Money look, the Plans look's job chips, a History line and its window, a
 * question's About, the rows of the count tiles' and the *not in it* chips' cards) looks like the
 * `LinkButton` it replaces and still opens the job on a press. Rest the pointer on it and, after a beat, a
 * card floats off the pointer with the job's full name, its address and its details (`jobHoverCard.ts`); it
 * follows the pointer along the chip and leaves with it. Keyboard focus shows the card under the chip, and
 * the card rides with the chip when the window scrolls, which is what a Tab onto a chip past the window's
 * edge does; Escape and blur hide it. On a phone nothing hovers: press and hold (`useLongPress`, the app's
 * one hold, where a finger that travels is a scroll) and the card shows under the chip as the finger lifts,
 * until a tap elsewhere or a scroll; a plain tap still opens the job.
 *
 * The card takes no pointer events, so it never stands between the pointer and the chip's press, and it is
 * drawn through a portal at the body with a fixed place, so a table's scroll box or a card's edge never
 * clips it. The words come from the page's provider (`JobCardsProvider`), which holds the rows the page
 * read; with no provider, or a job the page does not hold, the chip is the plain press it was. Nothing is
 * fetched on a hover.
 */
import { createContext, Fragment, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick'
import { useLongPress } from '../../hooks/useLongPress'
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
/** A browser focuses a tapped press just after the finger lifts; that focus is the tap's, not a keyboard's. */
const TOUCH_FOCUS_MS = 700
/** Above the dock (700) and the History line's window (760), which draws a chip; the job's own window stands higher, and the press closes the card first. */
const JOB_CARD_Z = 770
const CARD_WIDTH = 300

type Anchor = { kind: 'pointer' } | { kind: 'chip'; held: boolean }

const isTouch = (e: ReactPointerEvent) => e.pointerType === 'touch'

export function JobChip({ jobId, onOpen, children, strong, nowrap, testId }: { jobId: string; onOpen: () => void; children: ReactNode; strong?: boolean; nowrap?: boolean; testId?: string }) {
  const cardFor = useContext(JobCardsContext)
  const card = cardFor ? cardFor(jobId) : null
  const cardId = useId()
  const chipRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<Anchor | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const enterTimer = useRef<number | null>(null)
  const raf = useRef<number | null>(null)
  const pressing = useRef(false)
  const touching = useRef(false)
  const lastTouchAt = useRef(0)
  const hold = useLongPress(() => setOpen({ kind: 'chip', held: true }), { disabled: !card })

  const clearTimers = useCallback(() => {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    if (raf.current) window.cancelAnimationFrame(raf.current)
    enterTimer.current = null
    raf.current = null
  }, [])
  const close = useCallback(() => {
    clearTimers()
    setOpen(null)
  }, [clearTimers])
  useEffect(() => clearTimers, [clearTimers])
  // A press elsewhere, or Escape, closes: the phone's way out after a hold, the desk's Escape.
  useCloseOnOutsideClick(chipRef, open !== null, close)

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

  // The window scrolling under an open card. A keyboard's card rides with its chip: a Tab onto a chip past the window's edge scrolls just after the focus. The chip moves out from under a resting pointer, and a finger scrolling has moved on, so those two cards go.
  useEffect(() => {
    if (!open) return
    const onScroll = () => {
      if (open.kind === 'chip' && !open.held) place()
      else close()
    }
    window.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', onScroll, { capture: true })
  }, [open, close, place])

  const onPointerEnter = (e: ReactPointerEvent) => {
    if (!card || isTouch(e)) return
    pointer.current = { x: e.clientX, y: e.clientY }
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    enterTimer.current = window.setTimeout(() => {
      enterTimer.current = null
      setOpen({ kind: 'pointer' })
    }, JOB_CARD_ENTER_MS)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (isTouch(e)) {
      hold.handlers.onPointerMove(e)
      return
    }
    pointer.current = { x: e.clientX, y: e.clientY }
    if (!open || open.kind !== 'pointer' || raf.current) return
    raf.current = window.requestAnimationFrame(() => {
      raf.current = null
      place()
    })
  }
  const onPointerLeave = () => {
    pressing.current = false
    touching.current = false
    hold.handlers.onPointerLeave()
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    enterTimer.current = null
    setOpen((o) => (o && o.kind === 'pointer' ? null : o))
  }
  // Only a finger's hold is a hold: a slow press with a mouse is still a press, and opens the job.
  const onPointerDown = (e: ReactPointerEvent) => {
    pressing.current = true
    touching.current = isTouch(e)
    if (isTouch(e)) {
      lastTouchAt.current = Date.now()
      hold.handlers.onPointerDown(e)
    } else {
      hold.consumeLongPress()
    }
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    pressing.current = false
    touching.current = false
    if (isTouch(e)) {
      lastTouchAt.current = Date.now()
      hold.handlers.onPointerUp()
    }
  }
  const onPointerCancel = () => {
    pressing.current = false
    touching.current = false
    hold.handlers.onPointerCancel()
  }
  // A press focuses the chip on its way to the click: that focus draws no card of its own.
  const onFocus = () => {
    if (!card || pressing.current || Date.now() - lastTouchAt.current < TOUCH_FOCUS_MS) return
    clearTimers()
    setOpen({ kind: 'chip', held: false })
  }
  const onClick = () => {
    // The tap that ends a hold is the hold's own, not a press.
    if (hold.consumeLongPress()) return
    close()
    onOpen()
  }
  // No callout or menu while a finger holds the chip; a right press at a desk keeps its menu.
  const onContextMenu = (e: SyntheticEvent) => {
    if (touching.current) hold.handlers.onContextMenu(e)
  }

  const chipStyle: CSSProperties = { ...linkButtonStyle(strong, nowrap), userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }
  const showing = open !== null && card !== null

  return (
    <>
      <button
        type="button"
        ref={chipRef}
        onClick={onClick}
        onPointerEnter={onPointerEnter}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onFocus={onFocus}
        onBlur={close}
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
