import type { JobProfitSummary } from '../../lib/jobs/jobProfitSummary'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

/**
 * Job Detail profit band (masters/devs only — gate with showJobDetailProfitSection):
 * sub-labor cost, tally parts cost, total bill, profit. Replaces the removed
 * dashboard "View Details" (JobBillDetailsModal) numbers.
 */
export function JobDetailProfitSection({
  loading,
  failed,
  summary,
}: {
  loading: boolean
  /** True when the labor or tally fetch failed — figures show as "—" instead of $0. */
  failed: boolean
  summary: JobProfitSummary | null
}) {
  const cell = (label: string, value: string, valueColor?: string) => (
    <div style={{ flex: '1 1 120px', minWidth: 0, textAlign: 'center' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div
        style={{
          fontSize: '0.9375rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: valueColor ?? 'var(--text-strong)',
        }}
      >
        {value}
      </div>
    </div>
  )

  const show = !loading && !failed && summary != null
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.5rem' }}>Profit</div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.65rem 0.75rem',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--bg-subtle)',
        }}
      >
        {loading ? (
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <>
            {cell('Sub Labor Cost', show ? formatCurrency(summary.laborCost) : '—')}
            {cell('Parts Cost (tally)', show ? formatCurrency(summary.partsCost) : '—')}
            {cell('Total Bill', show ? formatCurrency(summary.totalBill) : '—')}
            {cell(
              'Profit',
              show ? formatCurrency(summary.profit) : '—',
              show ? (summary.profit >= 0 ? '#16a34a' : 'var(--text-red-700)') : undefined,
            )}
          </>
        )}
      </div>
    </div>
  )
}
