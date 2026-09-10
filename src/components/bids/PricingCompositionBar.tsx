import { useEffect, useMemo, useState } from 'react'
import {
  buildPricingComposition,
  compositionHeadline,
  type CompositionBucket,
  type CompositionKind,
  type CompositionRowInput,
} from '../../lib/bids/pricingComposition'

type Props = {
  /** The Workbench's effective rows: name, count, cost, and count × effective unit price. */
  rows: ReadonlyArray<CompositionRowInput>
  /** The strip's margin coloring, so the bar and the strip agree on green / amber / red. */
  marginColor: (m: number | null) => string
  /** Scroll a row into view and flash it (the profit bar's own jump). */
  onJumpToRow?: (rowId: string) => void
}

type Lens = 'revenue' | 'cost'
const LENS_KEY = 'pt.pricing.composition.lens'

const COLORS: Record<CompositionKind, { bg: string; ink: string }> = {
  fixture: { bg: '#3b82f6', ink: '#ffffff' },
  pipe: { bg: '#0d9488', ink: '#ffffff' },
  fitting: { bg: '#f59e0b', ink: 'var(--text-strong)' },
  other: { bg: '#94a3b8', ink: '#ffffff' },
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const pct = (n: number) => `${Math.round(n * 100)}%`

/**
 * What the bid is made of (v2.3239): fixtures · pipe · fittings · other as one
 * bar under the Workbench strip — the same grammar as "Where the profit lives",
 * one level up. Share of revenue or of cost (the toggle is the one control;
 * where the two disagree is where pricing posture lives), the counts the
 * estimator thinks in, and each bucket's margin in the strip's own colors.
 */
export function PricingCompositionBar({ rows, marginColor, onJumpToRow }: Props) {
  const [lens, setLens] = useState<Lens>(() => {
    try {
      return localStorage.getItem(LENS_KEY) === 'cost' ? 'cost' : 'revenue'
    } catch {
      return 'revenue'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(LENS_KEY, lens)
    } catch {
      /* per-device convenience only */
    }
  }, [lens])
  const [hover, setHover] = useState<CompositionKind | null>(null)

  const comp = useMemo(() => buildPricingComposition(rows), [rows])
  if (comp.buckets.length === 0) return null
  const total = lens === 'revenue' ? comp.totalRevenue : comp.totalCost
  if (total <= 0) return null
  const share = (b: CompositionBucket) => (lens === 'revenue' ? b.revenueShare : b.costShare)
  const hovered = hover ? comp.buckets.find((b) => b.kind === hover) ?? null : null

  return (
    <div data-composition-bar style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.9rem', marginTop: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>What the bid is made of</span>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{compositionHeadline(comp)}</span>
        <span role="group" aria-label="Share of" style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', fontSize: '0.72rem' }}>
          {(['revenue', 'cost'] as Lens[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lens === l}
              onClick={() => setLens(l)}
              title={l === 'revenue' ? 'Each bucket as a share of the price you are viewing' : 'Each bucket as a share of our cost — where this disagrees with revenue is where pricing posture lives'}
              style={{ padding: '0.15rem 0.6rem', border: 'none', cursor: 'pointer', font: 'inherit', fontSize: '0.72rem', background: lens === l ? '#3b82f6' : 'transparent', color: lens === l ? 'white' : 'var(--text-700)', fontWeight: lens === l ? 700 : 400 }}
            >
              {l === 'revenue' ? 'Revenue' : 'Cost'}
            </button>
          ))}
        </span>
      </div>

      <div role="img" aria-label={comp.buckets.map((b) => `${b.name} ${pct(share(b))}`).join(', ')} style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', marginTop: '0.5rem' }} onMouseLeave={() => setHover(null)}>
        {comp.buckets.map((b) => {
          const s = share(b)
          if (s <= 0) return null
          return (
            <div
              key={b.kind}
              onMouseEnter={() => setHover(b.kind)}
              title={`${b.name} ${pct(s)} of ${lens}`}
              style={{ width: `${Math.max(s * 100, 0.6)}%`, background: COLORS[b.kind].bg, color: COLORS[b.kind].ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', opacity: hover && hover !== b.kind ? 0.55 : 1, transition: 'opacity 120ms' }}
            >
              {s >= 0.12 ? `${b.name} ${pct(s)}` : s >= 0.05 ? pct(s) : ''}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comp.buckets.length}, minmax(120px, 1fr))`, gap: '0.6rem', marginTop: '0.55rem' }}>
        {comp.buckets.map((b) => (
          <div key={b.kind} onMouseEnter={() => setHover(b.kind)} onMouseLeave={() => setHover(null)} style={{ borderLeft: `3px solid ${COLORS[b.kind].bg}`, paddingLeft: '0.55rem', fontSize: '0.76rem', lineHeight: 1.35 }}>
            <div style={{ color: 'var(--text-muted)' }}>{b.name} · {b.rows} row{b.rows === 1 ? '' : 's'}</div>
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600 }}>{money(lens === 'revenue' ? b.revenue : b.cost)}</div>
            <div style={{ fontSize: '0.7rem', color: b.margin == null ? 'var(--text-faint)' : marginColor(b.margin) }}>{b.margin == null ? (b.revenue > 0 ? 'no cost on these rows' : 'unpriced') : `margin ${pct(b.margin)}`}</div>
          </div>
        ))}
      </div>

      {hovered ? (
        <div style={{ marginTop: '0.55rem', borderTop: '1px dashed var(--border)', paddingTop: '0.45rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{hovered.name} · {Math.round(hovered.count).toLocaleString()} {hovered.unit}</span>
          <span>revenue <b style={{ color: 'var(--text-strong)' }}>{money(hovered.revenue)}</b></span>
          <span>cost <b style={{ color: 'var(--text-strong)' }}>{money(hovered.cost)}</b></span>
          <span>profit <b style={{ color: 'var(--text-strong)' }}>{money(hovered.profit)}</b></span>
          <span>margin <b style={{ color: marginColor(hovered.margin) }}>{hovered.margin == null ? '—' : pct(hovered.margin)}</b></span>
          {hovered.top.length > 0 ? (
            <span>
              biggest:{' '}
              {hovered.top.map((t, i) => (
                <span key={t.id ?? t.name}>
                  {i > 0 ? ' · ' : ''}
                  {t.id && onJumpToRow ? (
                    <button type="button" onClick={() => onJumpToRow(t.id as string)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
                      {t.name}
                    </button>
                  ) : (
                    t.name
                  )}{' '}
                  {money(t.revenue)}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
