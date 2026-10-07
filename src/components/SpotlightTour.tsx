import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { placeTourCard, spotlightHole, type TourRect } from '../lib/spotlightTourPlacement'

export type SpotlightTourStep = {
  /** Matches a `data-tour="<anchor>"` attribute on the page. */
  anchor: string
  title: string
  body: string
  /**
   * v2.4067: when set, a step whose anchor is not on the page is still shown — the card
   * centers over the dimmed page and this line says what will appear and when. Without
   * it the caller should drop absent steps with `spotlightTourStepsPresent`.
   */
  missingBody?: string
  /**
   * A stop about no one control (2026-10-04): the card centers over the dimmed page, with no
   * hole and nothing "missing". The anchor is only its name.
   */
  center?: boolean
  /** Words and what they mean, listed under the body: a page of terms before the stops that use them. */
  terms?: ReadonlyArray<{ word: string; means: string }>
  /**
   * Short lines shown as a list under the body, one idea each: a stop that names several things.
   * A line that starts with a label and a colon ("Building: the crews work") shows the label in bold.
   */
  bullets?: string[]
  /** Number the bullets 1, 2, 3 instead of dots: for things that come in order. */
  numbered?: boolean
  /**
   * Other parts of the page to mark while this step shows: each gets a highlight and its label
   * ("1", "2", "3") in a badge, so a numbered list in the card points at what it names.
   */
  marks?: { anchor: string; label: string }[]
}

/** A step's list: numbered or dotted, with a leading "Label:" in bold. */
function TourBullets({ lines, numbered }: { lines: string[]; numbered: boolean }) {
  const List = numbered ? 'ol' : 'ul'
  return (
    <List style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.2rem' }}>
      {lines.map((line) => {
        const colon = line.indexOf(': ')
        return (
          <li key={line}>
            {colon > 0 ? (
              <>
                <strong>{line.slice(0, colon)}</strong>
                {line.slice(colon)}
              </>
            ) : (
              line
            )}
          </li>
        )
      })}
    </List>
  )
}

/** A step's marks: a highlight and a numbered badge on each anchor, following it as the page moves. */
function TourMarks({ marks }: { marks: { anchor: string; label: string }[] }) {
  const [rects, setRects] = useState<(TourRect | null)[]>([])
  useEffect(() => {
    const measure = () => {
      const next = marks.map((m) => {
        const el = document.querySelector(`[data-tour="${m.anchor}"]`)
        if (!(el instanceof HTMLElement)) return null
        const r = el.getBoundingClientRect()
        return { top: r.top, left: r.left, width: r.width, height: r.height }
      })
      setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    measure()
    const interval = window.setInterval(measure, 120)
    window.addEventListener('resize', measure)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('resize', measure)
    }
  }, [marks])
  return (
    <>
      {marks.map((m, i) => {
        const r = rects[i]
        if (!r) return null
        return (
          <div
            key={m.anchor}
            data-testid="tour-mark"
            style={{
              position: 'fixed',
              top: r.top - 4,
              left: r.left - 6,
              width: r.width + 12,
              height: r.height + 8,
              borderRadius: 8,
              border: '2px solid #f59e0b',
              background: 'rgba(250, 204, 21, 0.18)',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -11,
                left: -11,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: '#f59e0b',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              {m.label}
            </span>
          </div>
        )
      })}
    </>
  )
}

type SpotlightTourProps = {
  steps: SpotlightTourStep[]
  onClose: () => void
  /** Optional footer deep link (e.g. the surface's full help guide). */
  guideHref?: string
  guideLabel?: string
  /** The stop to open on (v2.4125): a `?` on a page section starts the tour at that section's stop. */
  startIndex?: number
  /**
   * The page hears each stop just before it shows (GC mode, the tour's round five): on open, and
   * from Next, Back and the arrow keys, so a page can open the tab a stop's anchor is on and both
   * draw together. A tour with it also looks again for a missing anchor for about a second before
   * it says Missing, for a tab that draws a moment late. Without it, a tour behaves as before.
   */
  onStep?: (index: number) => void
}

/** A tour with `onStep` looks again for a missing anchor this many times, this far apart, before Missing. */
const ANCHOR_LOOKS = 8
const ANCHOR_LOOK_MS = 120

const CARD_WIDTH = 400
/** A stop that lists terms reads as a short page, not a caption. */
const TERMS_CARD_WIDTH = 520
const CARD_EST_HEIGHT = 170

/**
 * Spotlight coach-marks tour (v2.2021, first used on the Pricing Workbench):
 * dims the page, cuts a hole over the current step's `data-tour` anchor, and
 * walks Next/Back through the steps with a caption card. Look-don't-touch —
 * the overlay blocks clicks on the page while open; Esc or Done closes. Anchors that
 * aren't in the DOM when the tour opens should be filtered out by the caller
 * (`spotlightTourStepsPresent`).
 *
 * The page still scrolls under it (v2.4121): the overlay carries
 * `data-page-scroll="allow"` so the app-wide body scroll lock (v2.2186, which
 * pins the body under any viewport-covering fixed layer) leaves it alone —
 * locked, the anchor's scrollIntoView could not move the page and every stop
 * below the fold was out of reach, and the wheel did nothing.
 */
export function SpotlightTour({ steps, onClose, guideHref, guideLabel, startIndex = 0, onStep }: SpotlightTourProps) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(steps.length - 1, 0)))
  const [anchorRect, setAnchorRect] = useState<TourRect | null>(null)
  const [anchorMissing, setAnchorMissing] = useState(false)
  const [cardHeight, setCardHeight] = useState(CARD_EST_HEIGHT)
  // How many times this stop has looked again for its anchor: a tour with onStep only, so 0 for every other tour.
  const [looks, setLooks] = useState(0)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const step = steps[index]

  /** Go to a stop. The page hears it first (onStep), so a tab it opens draws with the stop. */
  const go = useCallback(
    (next: number) => {
      onStep?.(next)
      setLooks(0)
      setIndex(next)
    },
    [onStep],
  )

  // The page hears the stop the tour opens on, too.
  useEffect(() => {
    onStep?.(index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Follow the anchor: scroll it into view, then re-measure on a short cadence
  // (covers the smooth scroll settling, sticky headers, and viewport resizes).
  useEffect(() => {
    if (!step) return
    if (step.center) {
      setAnchorRect(null)
      setAnchorMissing(false)
      return
    }
    const el = document.querySelector(`[data-tour="${step.anchor}"]`)
    if (!(el instanceof HTMLElement)) {
      setAnchorRect(null)
      // A tour that opens tabs on the way (onStep) looks again before it says Missing: the tab the
      // page just opened may draw a moment after the stop.
      if (onStep && looks < ANCHOR_LOOKS) {
        setAnchorMissing(false)
        const again = window.setTimeout(() => setLooks((n) => n + 1), ANCHOR_LOOK_MS)
        return () => window.clearTimeout(again)
      }
      setAnchorMissing(true)
      return
    }
    setAnchorMissing(false)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // An anchor taller than the screen (a whole board) lines up at its top: centered, its top,
    // where the stop starts, would be scrolled out of sight.
    const block: ScrollLogicalPosition = el.getBoundingClientRect().height > window.innerHeight * 0.8 ? 'start' : 'center'
    el.scrollIntoView({ block, behavior: reduced ? 'auto' : 'smooth' })
    // Smooth scrolling rides requestAnimationFrame, which never fires in a
    // hidden/backgrounded tab — if the anchor hasn't arrived shortly, jump.
    const settle = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      const off = block === 'start' ? Math.abs(r.top) > 80 : r.top < 0 || r.bottom > window.innerHeight
      if (off) el.scrollIntoView({ block, behavior: 'auto' })
    }, 700)
    const measure = () => {
      const r = el.getBoundingClientRect()
      setAnchorRect((prev) =>
        prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      )
    }
    measure()
    const interval = window.setInterval(measure, 120)
    window.addEventListener('resize', measure)
    return () => {
      window.clearTimeout(settle)
      window.clearInterval(interval)
      window.removeEventListener('resize', measure)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.anchor, step?.center, looks])

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight)
  }, [index, anchorRect == null])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && index < steps.length - 1) go(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, steps.length, onClose, go])

  useEffect(() => {
    // preventScroll: a plain focus() scrolls the focused element into view,
    // which cancels the anchor's in-flight smooth scroll.
    cardRef.current?.focus({ preventScroll: true })
  }, [index])

  if (!step) return null

  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const hole = anchorRect ? spotlightHole(anchorRect, viewport) : null
  const cardWidth = Math.min(step.terms ? TERMS_CARD_WIDTH : CARD_WIDTH, viewport.width - 16)
  const placement = hole
    ? placeTourCard(hole, viewport, { width: cardWidth, height: cardHeight })
    : { top: viewport.height / 2 - cardHeight / 2, left: viewport.width / 2 - cardWidth / 2, side: 'below' as const }
  const last = index === steps.length - 1

  const navBtn: CSSProperties = {
    font: 'inherit',
    fontSize: '0.8rem',
    padding: '0.35rem 0.75rem',
    borderRadius: 6,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-muted)',
    color: 'var(--text-strong)',
    cursor: 'pointer',
  }

  return createPortal(
    // status-bar: allow — the hole and the card are placed from the control they point at, not from this layer
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={onClose} data-page-scroll="allow" data-testid="spotlight-tour-overlay">
      {hole ? (
        <div
          style={{
            position: 'fixed',
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            borderRadius: 12,
            // The dim IS this hole's shadow, so the hole stays crisp.
            boxShadow: '0 0 0 200vmax rgba(0,0,0,0.55)',
            border: '2px solid #3b82f6',
            pointerEvents: 'none',
            transition: 'top 0.15s, left 0.15s, width 0.15s, height 0.15s',
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      )}
      {step.marks && step.marks.length > 0 ? <TourMarks marks={step.marks} /> : null}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: placement.top,
          left: placement.left,
          width: cardWidth,
          background: 'var(--surface)',
          color: 'var(--text-strong)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 14px 40px rgba(0,0,0,0.4)',
          padding: '0.8rem 1rem',
          outline: 'none',
          transition: 'top 0.15s, left 0.15s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.6rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>{step.title}</strong>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {index + 1} of {steps.length}
          </span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-700)', margin: '0.35rem 0 0.7rem' }}>
          {step.body}
          {step.terms ? (
            // The list scrolls inside the card on a short screen; the title and the buttons hold still.
            <dl data-testid="tour-terms" style={{ margin: '0.5rem 0 0', display: 'grid', gridTemplateColumns: 'minmax(5.5rem, auto) 1fr', gap: '0.3rem 0.75rem', maxHeight: 'calc(100vh - 15rem)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {step.terms.map((t) => (
                <Fragment key={t.word}>
                  <dt style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{t.word}</dt>
                  <dd style={{ margin: 0 }}>{t.means}</dd>
                </Fragment>
              ))}
            </dl>
          ) : null}
          {step.bullets && step.bullets.length > 0 ? <TourBullets lines={step.bullets} numbered={step.numbered ?? false} /> : null}
          {anchorMissing && step.missingBody ? (
            <div data-testid="tour-missing" style={{ marginTop: '0.4rem', fontSize: '0.76rem', color: 'var(--text-muted)', borderLeft: '2px solid var(--border-strong)', paddingLeft: '0.5rem' }}>
              {step.missingBody}
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} style={{ ...navBtn, border: 'none', background: 'none', color: 'var(--text-muted)', paddingLeft: 0 }}>
            {last ? '' : 'Skip tour'}
          </button>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {index > 0 ? (
              <button type="button" onClick={() => go(index - 1)} style={navBtn}>
                ← Back
              </button>
            ) : null}
            {last ? (
              <button type="button" onClick={onClose} style={{ ...navBtn, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600 }}>
                Done
              </button>
            ) : (
              <button type="button" onClick={() => go(index + 1)} style={{ ...navBtn, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600 }}>
                Next →
              </button>
            )}
          </div>
        </div>
        {last && guideHref ? (
          <div style={{ marginTop: '0.55rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            <Link to={guideHref} onClick={onClose} style={{ fontSize: '0.78rem', color: 'var(--text-link)' }}>
              {guideLabel ?? 'Read the full guide →'}
            </Link>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/** The steps whose anchors are actually on the page right now, plus the ones that carry a `missingBody`. */
export function spotlightTourStepsPresent(steps: SpotlightTourStep[]): SpotlightTourStep[] {
  return steps.filter((s) => s.center === true || s.missingBody != null || document.querySelector(`[data-tour="${s.anchor}"]`) != null)
}
