import { useState } from 'react'
import { formatCurrency } from '../../lib/format'
import { orderListRows, orderRoundingHover, type TakeoffOrderRounding } from '../../lib/bids/takeoffOrderRounding'
import { orderIncrementChip } from '../../lib/materials/orderIncrement'

/**
 * Materials to order (v2.3409): the shopping list the sticks make. One row per
 * part with a Sold in rule — needed → ordered · packs × increment · the extra
 * it costs — most expensive rounding first, capped; the total under it. The
 * same list on the Sheet view's rail and under the One-at-a-time view. The
 * Refresh link re-reads the rule off the catalog for every line on the bid
 * (bids costed before the rule existed, or after a type's rule changed).
 */
export function TakeoffOrderListPanel({
  rounding,
  partNameById,
  onRefreshRules,
  compact,
}: {
  rounding: TakeoffOrderRounding
  partNameById: ReadonlyMap<string, string>
  /** Re-snapshot every line's rule from the catalog; resolves to the count of lines changed. */
  onRefreshRules?: (() => Promise<{ updated: number; cleared: number }>) | null
  /** Under the One-at-a-time view: folded by default. */
  compact?: boolean
}) {
  const [open, setOpen] = useState(!compact)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshNote, setRefreshNote] = useState<string | null>(null)
  const { rows, more, totalExtra } = orderListRows(rounding, partNameById, 8)
  const unitWord = (u: string) => (u === 'ft_stick' || u === 'ft_coil' ? 'ft' : '')
  const num = (n: number) => (Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString())
  const refresh = async () => {
    if (!onRefreshRules || refreshing) return
    setRefreshing(true)
    setRefreshNote(null)
    try {
      const r = await onRefreshRules()
      setRefreshNote(r.updated === 0 && r.cleared === 0 ? 'Every line already carries the catalog’s rule.' : `${r.updated} line${r.updated === 1 ? '' : 's'} updated${r.cleared > 0 ? `, ${r.cleared} cleared` : ''}.`)
    } catch (e) {
      setRefreshNote(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }
  const head = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}
      >
        Materials to order · rounded to what the house sells {compact ? (open ? '▾' : '▸') : ''}
      </button>
      {rounding.parts.length > 0 ? (
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: totalExtra > 0 ? 'var(--text-violet-700)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>+${formatCurrency(totalExtra)}</span>
      ) : null}
    </div>
  )
  return (
    <div data-testid="takeoff-order-list" style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.8rem 0.9rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {head}
      {open ? (
        rounding.parts.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            No part on this bid carries a Sold in rule yet. Set one on a Part Type (Settings → Catalogs) or on the part, then refresh.
          </p>
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
              {rows.map((r) => (
                <li
                  key={r.partId}
                  title={orderRoundingHover(r.part)}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto auto', gap: '0.5rem', alignItems: 'baseline', padding: '0.3rem 0.1rem', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}
                >
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {num(r.part.needed)} → <b>{num(r.part.ordered)}{unitWord(r.part.unit) ? ` ${unitWord(r.part.unit)}` : ''}</b>
                  </span>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {num(r.part.packs)} × {orderIncrementChip({ increment: r.part.increment, unit: r.part.unit })}
                  </span>
                  <span style={{ color: r.part.extraCost > 0 ? 'var(--text-amber-800)' : 'var(--text-muted)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {r.part.extraCost > 0 ? `+$${formatCurrency(r.part.extraCost)}` : 'exact'}
                  </span>
                </li>
              ))}
              {more > 0 ? <li style={{ padding: '0.25rem 0.1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>+ {more} more part{more === 1 ? '' : 's'} sold in packs</li> : null}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.78rem', fontWeight: 700 }}>
              <span>Extra bought for rounding</span>
              <span style={{ color: totalExtra > 0 ? 'var(--text-violet-700)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>+${formatCurrency(totalExtra)}</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fittings and fixtures are by the each and never round. Request quotes sends the ordered quantities.</p>
          </>
        )
      ) : null}
      {open && onRefreshRules ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.72rem' }}>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            title="Re-read every line's Sold in rule from the catalog — for bids costed before the rule existed, or after a Part Type's rule changed"
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-blue-500)', cursor: refreshing ? 'default' : 'pointer', textDecoration: 'underline' }}
          >
            {refreshing ? 'Refreshing…' : 'Refresh Sold in rules from the catalog'}
          </button>
          {refreshNote ? <span style={{ color: 'var(--text-muted)' }}>{refreshNote}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
