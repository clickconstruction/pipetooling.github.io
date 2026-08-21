import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { placeTourCard, spotlightHole, type TourRect } from '../lib/spotlightTourPlacement'

export type SpotlightTourStep = {
  /** Matches a `data-tour="<anchor>"` attribute on the page. */
  anchor: string
  title: string
  body: string
}

type SpotlightTourProps = {
  steps: SpotlightTourStep[]
  onClose: () => void
  /** Optional footer deep link (e.g. the surface's full help guide). */
  guideHref?: string
  guideLabel?: string
}

const CARD_WIDTH = 400
const CARD_EST_HEIGHT = 170

/**
 * Spotlight coach-marks tour (v2.2021, first used on the Pricing Workbench):
 * dims the page, cuts a hole over the current step's `data-tour` anchor, and
 * walks Next/Back through the steps with a caption card. Look-don't-touch —
 * the overlay blocks the page while open; Esc or Done closes. Anchors that
 * aren't in the DOM when the tour opens should be filtered out by the caller
 * (`spotlightTourStepsPresent`).
 */
export function SpotlightTour({ steps, onClose, guideHref, guideLabel }: SpotlightTourProps) {
  const [index, setIndex] = useState(0)
  const [anchorRect, setAnchorRect] = useState<TourRect | null>(null)
  const [cardHeight, setCardHeight] = useState(CARD_EST_HEIGHT)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const step = steps[index]

  // Follow the anchor: scroll it into view, then re-measure on a short cadence
  // (covers the smooth scroll settling, sticky headers, and viewport resizes).
  useEffect(() => {
    if (!step) return
    const el = document.querySelector(`[data-tour="${step.anchor}"]`)
    if (!(el instanceof HTMLElement)) {
      setAnchorRect(null)
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    // Smooth scrolling rides requestAnimationFrame, which never fires in a
    // hidden/backgrounded tab — if the anchor hasn't arrived shortly, jump.
    const settle = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'auto' })
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
  }, [step?.anchor])

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight)
  }, [index, anchorRect == null])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' && index < steps.length - 1) setIndex(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, steps.length, onClose])

  useEffect(() => {
    // preventScroll: a plain focus() scrolls the focused element into view,
    // which cancels the anchor's in-flight smooth scroll.
    cardRef.current?.focus({ preventScroll: true })
  }, [index])

  if (!step) return null

  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const hole = anchorRect ? spotlightHole(anchorRect, viewport) : null
  const cardWidth = Math.min(CARD_WIDTH, viewport.width - 16)
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={onClose}>
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
        <div style={{ fontSize: '0.82rem', color: 'var(--text-700)', margin: '0.35rem 0 0.7rem' }}>{step.body}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <button type="button" onClick={onClose} style={{ ...navBtn, border: 'none', background: 'none', color: 'var(--text-muted)', paddingLeft: 0 }}>
            {last ? '' : 'Skip tour'}
          </button>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            {index > 0 ? (
              <button type="button" onClick={() => setIndex(index - 1)} style={navBtn}>
                ← Back
              </button>
            ) : null}
            {last ? (
              <button type="button" onClick={onClose} style={{ ...navBtn, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600 }}>
                Done
              </button>
            ) : (
              <button type="button" onClick={() => setIndex(index + 1)} style={{ ...navBtn, background: '#3b82f6', color: '#fff', border: 'none', fontWeight: 600 }}>
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

/** The steps whose anchors are actually on the page right now. */
export function spotlightTourStepsPresent(steps: SpotlightTourStep[]): SpotlightTourStep[] {
  return steps.filter((s) => document.querySelector(`[data-tour="${s.anchor}"]`) != null)
}
