import { useEffect, useState, type ReactNode } from 'react'
import { formatCurrency } from '../../lib/format'

export type BreakdownSlice = { key: string; name: string; color: string; share: number }

type Props = {
  /** Remembers the fold per device under this key. */
  storageKey: string
  title: string
  sub?: ReactNode
  /** The shares of the price, in order; they draw the bar and the donut. */
  slices: ReadonlyArray<BreakdownSlice>
  /** The bid line, shown folded: cost · price · profit · margin. */
  totals: { cost: number; price: number; profit: number | null; margin: number | null }
  marginColor: (m: number | null) => string
  /** The table and notes, shown open. */
  children: ReactNode
  /** A line under the table either way (the amber note, the two-tags note). */
  footer?: ReactNode
}

const money = (n: number | null) => (n == null ? '—' : `$${formatCurrency(n)}`)
const pct = (m: number | null) => (m == null ? '—' : `${Math.round(m * 1000) / 10}%`)

/** A 28 px ring of the slices — the glance-able shape in the folded line; the bar does the reading. */
function Donut({ slices }: { slices: ReadonlyArray<BreakdownSlice> }) {
  const r = 11
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden style={{ flex: 'none' }}>
      <circle cx="14" cy="14" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
      {slices.map((s) => {
        if (s.share <= 0) return null
        const len = c * Math.min(s.share, 1)
        const el = <circle key={s.key} cx="14" cy="14" r={r} fill="none" stroke={s.color} strokeWidth="5" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 14 14)" />
        offset += len
        return el
      })}
    </svg>
  )
}

/**
 * The breakdown cards' one shell (punch list #128): folded, a line — the chevron, the title, a
 * donut, the share bar and the bid line; open, the table. The fold is remembered per device.
 */
export function BreakdownCardShell({ storageKey, title, sub, slices, totals, marginColor, children, footer }: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) !== 'folded'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, open ? 'open' : 'folded')
    } catch {
      /* per-device convenience only */
    }
  }, [open, storageKey])
  const bar = (
    <div role="img" aria-label={slices.map((s) => `${s.name} ${pct(s.share)}`).join(', ')} style={{ display: 'flex', height: 10, borderRadius: 4, overflow: 'hidden', background: 'var(--border)', flex: '1 1 160px', minWidth: 120 }}>
      {slices.map((s) => (s.share <= 0 ? null : <div key={s.key} title={`${s.name} ${pct(s.share)}`} style={{ width: `${s.share * 100}%`, background: s.color }} />))}
    </div>
  )
  const totalsLine = (
    <span style={{ display: 'inline-flex', gap: '0.9rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
      <span title="Cost">{money(totals.cost)}</span>
      <span title="Price" style={{ fontWeight: 700 }}>{money(totals.price)}</span>
      <span title="Profit">{money(totals.profit)}</span>
      <span title="Margin" style={{ fontWeight: 700, color: marginColor(totals.margin) }}>{pct(totals.margin)}</span>
    </span>
  )
  return (
    <div data-breakdown-card={storageKey} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0.9rem 0.6rem', marginTop: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Fold to one line' : 'Open the table'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', font: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-strong)' }}
        >
          <span aria-hidden style={{ display: 'inline-block', width: '0.9rem', fontSize: '0.6rem', color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}>
            ▶
          </span>
          {!open ? <Donut slices={slices} /> : null}
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{title}</span>
        </button>
        {sub ? <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{sub}</span> : null}
        {!open ? (
          <>
            {bar}
            <span style={{ marginLeft: 'auto' }}>{totalsLine}</span>
          </>
        ) : null}
      </div>
      {open ? (
        <>
          <div style={{ display: 'flex', marginTop: '0.5rem' }}>{bar}</div>
          {children}
          {footer}
        </>
      ) : null}
    </div>
  )
}
