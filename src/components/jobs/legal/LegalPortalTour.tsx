import { useEffect, type CSSProperties } from 'react'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER_GREEN } from '../../../lib/portal/portalTheme'
import { portalSmall } from '../../../lib/legal/legalPortalCards'
import { tourStepWords, type TourStop } from '../../../lib/legal/legalPortalStart'

/**
 * The portal's tour (v2.4820): a strip docked at the bottom of the page. Each stop has already
 * opened its panel or tab (the page does that); the strip rings the part it means
 * (`data-legal-tour` on the page), says the stop's number and name in one or two lines, and offers
 * Back, Next and ×. Esc ends it; the arrow keys walk it when no box has the cursor.
 */
const RING = 'legalTourRing'

const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 5, border: `1px solid ${COPPER}`, color: COPPER, background: CARD, cursor: 'pointer', font: 'inherit' }
const ghost: CSSProperties = { ...btn, borderColor: HAIR, color: MUTED }

export default function LegalPortalTour({ stops, at, onGo }: { stops: ReadonlyArray<TourStop>; at: number; onGo: (index: number | null) => void }) {
  const stop = stops[at] ?? null
  const last = at >= stops.length - 1

  // Ring the part this stop means, once its panel has drawn, and bring it into view.
  useEffect(() => {
    if (!stop) return
    let el: Element | null = null
    const timer = window.setTimeout(() => {
      el = document.querySelector(`[data-legal-tour="${stop.target}"]`)
      if (!el) return
      el.classList.add(RING)
      ;(el as HTMLElement).scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }, 40)
    return () => {
      window.clearTimeout(timer)
      el?.classList.remove(RING)
    }
  }, [stop])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if (e.key === 'Escape') onGo(null)
      else if (!typing && e.key === 'ArrowRight') onGo(last ? null : at + 1)
      else if (!typing && e.key === 'ArrowLeft' && at > 0) onGo(at - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [at, last, onGo])

  if (!stop) return null
  return (
    <div className="legalTourStrip" role="region" aria-label="Portal tour" data-legal-tour-strip={stop.key} style={{ background: CARD, border: `1px solid ${HAIR}`, borderTop: `3px solid ${COPPER}`, color: INK }}>
      <div aria-hidden style={{ display: 'flex', gap: 3, gridColumn: '1 / -1' }}>
        {stops.map((s, i) => <span key={s.key} style={{ flex: 1, height: 3, borderRadius: 2, background: i < at ? PAPER_GREEN : i === at ? COPPER : HAIR }} />)}
      </div>
      <div aria-live="polite" style={{ minWidth: 0 }}>
        <div style={{ fontSize: portalSmall(11), color: FAINT, textTransform: 'uppercase', letterSpacing: '0.07em' }} data-legal-tour-step-words>{tourStepWords(at, stops.length)}</div>
        <div style={{ fontSize: 13.5, marginTop: 1 }}><b style={{ fontSize: 14 }}>{stop.title}</b> <span style={{ color: MUTED }}>{stop.text}</span></div>
      </div>
      <div className="legalTourStripButtons" style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => onGo(at - 1)} disabled={at === 0} style={{ ...ghost, opacity: at === 0 ? 0.5 : 1 }}>‹ Back</button>
        <button type="button" onClick={() => onGo(last ? null : at + 1)} style={{ ...btn, background: COPPER, color: '#fff', flex: 1 }}>{last ? 'Done' : 'Next ›'}</button>
        <button type="button" onClick={() => onGo(null)} aria-label="End the tour" style={ghost}>×</button>
      </div>
    </div>
  )
}
