import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePeopleAccess } from '../../hooks/usePeopleAccess'
import { useDashboardOverheadSnapshot } from '../../hooks/useDashboardOverheadSnapshot'
import { buildDashboardOverheadCardModel } from '../../lib/dashboardOverheadCard'
import { OverheadLensModal } from '../people/OverheadLensModal'
import type { OverheadLensKey } from '../../lib/overheadLensSeries'
import type { UserRole } from '../../hooks/useAuth'

/**
 * Dashboard Overhead card (v2.2676): the fourth tile in the finance row,
 * speaking the same grammar as AR / AP / Not Billed Out — a money headline
 * (the 90-day burn per day), the three lenses in one breath, the trend pill,
 * and the composition bar in the slot where the neighbours show aging.
 *
 * Gate: dev, or a master with pay approval — the SAME rule as People →
 * Overhead (`canAccessOverheadTab`), so nobody sees a number here they can't
 * drill into there. Self-gating: renders nothing otherwise. Data loads only
 * once the card scrolls into view, then sits behind a one-hour session cache.
 * Click a lens to open its modal (the tab's own); the whole card opens A.
 */

const SERIES_COLOR: Record<'office' | 'bid' | 'parts', string> = {
  office: '#8b5cf6',
  bid: 'var(--text-blue-500)',
  parts: '#f59e0b',
}

export function DashboardOverheadCard({ authUserId, role }: { authUserId: string | null | undefined; role: UserRole | null }) {
  const { canAccessPay } = usePeopleAccess(authUserId ?? undefined)
  const allowed = role === 'dev' || (role === 'master_technician' && canAccessPay)

  // Defer the scan until the card is actually on screen.
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!allowed || inView) return
    const el = hostRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setInView(true)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [allowed, inView])

  const { payload, loading, failed } = useDashboardOverheadSnapshot(allowed && inView, authUserId)
  const [openLens, setOpenLens] = useState<OverheadLensKey | null>(null)

  if (!allowed) return null

  const model = payload
    ? buildDashboardOverheadCardModel({
        avg90DailyUsd: payload.avg90DailyUsd,
        rates: payload.rates,
        poolTotals: payload.poolTotals,
        trend: payload.trend,
      })
    : null
  const trendColor =
    model?.trend?.tone === 'up' ? 'var(--text-amber-800)' : model?.trend?.tone === 'down' ? 'var(--text-green-700)' : 'var(--text-faint)'
  const lensButton = (lens: OverheadLensKey, label: string) => (
    <button
      key={lens}
      type="button"
      onClick={() => setOpenLens(lens)}
      title={`Method ${lens} — click for the math`}
      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
    >
      {label}
    </button>
  )

  return (
    <div
      ref={hostRef}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.85rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '0.25rem',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>Overhead</span>
        <Link to="/people?tab=overhead" style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-blue-500)', textDecoration: 'none' }}>
          Open tab ›
        </Link>
      </span>
      {failed ? (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Couldn’t load — open the Overhead tab.</span>
      ) : !model ? (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{loading || !inView ? 'Loading…' : '—'}</span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setOpenLens('A')}
            title="90-day overhead pool ÷ 90 calendar days. Click for the math behind the rates."
            style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
          >
            <span style={{ display: 'block', fontSize: '1.35rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{model.headline}</span>
          </button>
          {model.segments.length > 0 ? (
            <span aria-hidden style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--bg-muted)', margin: '0.1rem 0 0.15rem' }}>
              {model.segments.map((s) => (
                <span key={s.key} style={{ width: `${s.pct}%`, background: SERIES_COLOR[s.key] }} />
              ))}
            </span>
          ) : null}
          <span style={{ fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', color: trendColor }}>
            {model.trend ? model.trend.text : 'No prior span to compare yet'}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {lensButton('A', `A ${payload!.rates.methodA == null ? '—' : `$${payload!.rates.methodA.toFixed(2)}/hr`}`)}
            <span>·</span>
            {lensButton('B', `B ${payload!.rates.methodB == null ? '—' : `${(payload!.rates.methodB * 100).toFixed(1)}%`}`)}
            <span>·</span>
            {lensButton('C', `C ${payload!.rates.methodC == null ? '—' : `$${payload!.rates.methodC.toFixed(2)}/$1`}`)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums' }}>{model.compositionLine}</span>
        </>
      )}
      {openLens && payload ? (
        <OverheadLensModal
          lens={openLens}
          windowLabel={`${payload.windowStart} → ${payload.windowEnd}`}
          pool={payload.poolTotals}
          rates={{ A: payload.rates.methodA, B: payload.rates.methodB, C: payload.rates.methodC }}
          detail={payload.lensDetail}
          onClose={() => setOpenLens(null)}
        />
      ) : null}
    </div>
  )
}
