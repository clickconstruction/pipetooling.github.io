import { useMemo, useState } from 'react'
import type { StageRow } from '../../lib/jobsStagesBoard'
import {
  billedBreakdownTotal,
  buildBilledByCustomerBreakdown,
  type BilledBreakdownBill,
} from '../../lib/jobs/billedByCustomerBreakdown'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'

/**
 * WAITING ON CUSTOMERS → "Who owes what" (v2.1929): the Billed Awaiting
 * Payment rows regrouped per customer — total owed, bill count, worst age —
 * expandable to the individual bills, each with View → jump to that row on
 * the board. Same modal frame as the Capable of Being Billed breakdown.
 */
export default function BilledByCustomerBreakdownModal({
  rows,
  loading,
  canSeeCharts,
  onClose,
  onOpenBill,
  onOpenAgingChart,
  onShow90,
  onGoToBilled,
}: {
  rows: StageRow[]
  /** True while any non-paid scope is still fetching — totals can still grow. */
  loading?: boolean
  canSeeCharts: boolean
  onClose: () => void
  /** Jump the board to this bill (invoice row when invoiceId set, else the job shell row). */
  onOpenBill: (bill: BilledBreakdownBill) => void
  onOpenAgingChart: () => void
  onShow90: () => void
  onGoToBilled: () => void
}) {
  const groups = useMemo(() => buildBilledByCustomerBreakdown(rows), [rows])
  const total = billedBreakdownTotal(groups)
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())
  const cellStyle: React.CSSProperties = { padding: '0.5rem 0.75rem' }

  function ageChip(days: number | null) {
    if (days == null) return <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>no date</span>
    const style: React.CSSProperties = {
      fontSize: '0.75rem',
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      padding: '0.05rem 0.4rem',
      borderRadius: 9999,
      whiteSpace: 'nowrap',
      ...(days >= 90
        ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
        : days >= 30
          ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
          : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }),
    }
    return <span style={style}>{days}d</span>
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Waiting on Customers — Who owes what"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
    >
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, width: 'min(720px, calc(100vw - 2rem))', maxWidth: 720, maxHeight: '80vh', overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Waiting on Customers — Who owes what</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Open bills in Billed Awaiting Payment, grouped by customer. Click a customer to see their bills — oldest first.
        </p>
        {loading ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} role="status" aria-busy>
            Loading the whole board — totals can still grow…
          </p>
        ) : null}
        {groups.length === 0 ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>No open bills — nothing is waiting on customers.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ ...cellStyle, textAlign: 'left' }}>Customer</th>
                <th style={{ ...cellStyle, textAlign: 'center' }}>Bills</th>
                <th style={{ ...cellStyle, textAlign: 'center' }}>Oldest</th>
                <th style={{ ...cellStyle, textAlign: 'right' }}>Owed</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const open = openKeys.has(g.key)
                return (
                  <FragmentRows
                    key={g.key}
                    open={open}
                    onToggle={() =>
                      setOpenKeys((prev) => {
                        const next = new Set(prev)
                        if (next.has(g.key)) next.delete(g.key)
                        else next.add(g.key)
                        return next
                      })
                    }
                    group={g}
                    ageChip={ageChip}
                    cellStyle={cellStyle}
                    onOpenBill={onOpenBill}
                  />
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                <td colSpan={3} style={cellStyle}>Total</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{formatUsdNoCents(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onGoToBilled}
            style={{ padding: 0, background: 'none', border: 'none', color: 'var(--text-link)', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            take me to Billed Awaiting Payment
          </button>
          <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canSeeCharts && (
              <button type="button" onClick={onOpenAgingChart}>
                Aging chart
              </button>
            )}
            <button type="button" onClick={onShow90}>
              Show 90+ only
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

function FragmentRows({
  group: g,
  open,
  onToggle,
  ageChip,
  cellStyle,
  onOpenBill,
}: {
  group: ReturnType<typeof buildBilledByCustomerBreakdown>[number]
  open: boolean
  onToggle: () => void
  ageChip: (days: number | null) => React.ReactNode
  cellStyle: React.CSSProperties
  onOpenBill: (bill: BilledBreakdownBill) => void
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        aria-expanded={open}
      >
        <td style={cellStyle}>
          <span aria-hidden style={{ display: 'inline-block', width: '1rem', color: 'var(--text-muted)' }}>
            {open ? '▾' : '▸'}
          </span>
          {g.customerName}
        </td>
        <td style={{ ...cellStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{g.count}</td>
        <td style={{ ...cellStyle, textAlign: 'center' }}>{ageChip(g.worstAgeDays)}</td>
        <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {formatUsdNoCents(g.total)}
        </td>
      </tr>
      {open &&
        g.bills.map((b) => (
          <tr key={`${g.key}-${b.invoiceId ?? b.jobId}`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <td style={{ ...cellStyle, paddingLeft: '2rem' }}>
              <div style={{ fontSize: '0.8125rem' }}>{b.jobName}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.jobNumber}</div>
            </td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => onOpenBill(b)}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-link)', border: '1px solid #2563eb', borderRadius: 4, cursor: 'pointer' }}
              >
                View
              </button>
            </td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>{ageChip(b.ageDays)}</td>
            <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatUsdNoCents(b.amount)}</td>
          </tr>
        ))}
    </>
  )
}
