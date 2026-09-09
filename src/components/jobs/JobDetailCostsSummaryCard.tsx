import type { JobCostsSummaryCardModel } from '../../lib/jobs/jobCostsSummaryCard'

/**
 * The Job tab's compact Costs card (owner call, 2026-09-08): one line per
 * figure, the whole card a door to the Costs tab. View-model from
 * `buildJobCostsSummaryCard`; this file is layout only.
 */
export function JobDetailCostsSummaryCard({ model, onOpenCosts }: { model: JobCostsSummaryCardModel; onOpenCosts: (() => void) | null }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-700)' }}>Costs</div>
        {onOpenCosts ? (
          <button
            type="button"
            onClick={onOpenCosts}
            style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }}
          >
            Open Costs →
          </button>
        ) : null}
      </div>
      <div
        role={onOpenCosts ? 'button' : undefined}
        tabIndex={onOpenCosts ? 0 : undefined}
        aria-label={onOpenCosts ? 'Open the Costs tab' : undefined}
        onClick={onOpenCosts ?? undefined}
        onKeyDown={
          onOpenCosts
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenCosts()
                }
              }
            : undefined
        }
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-subtle)',
          padding: '0.25rem 0.75rem',
          cursor: onOpenCosts ? 'pointer' : 'default',
        }}
      >
        {model.lines.map((line, idx) => (
          <div
            key={line.key}
            title={line.title}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.45rem 0',
              borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: line.emphasis === 'margin' ? 600 : 500, color: 'var(--text-strong)' }}>{line.label}</div>
              {line.caption ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{line.caption}</div>
              ) : null}
            </div>
            <div
              style={{
                fontSize: line.emphasis === 'margin' ? '0.9375rem' : '0.875rem',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                color:
                  line.tone === 'positive' ? 'var(--text-green-600)' : line.tone === 'negative' ? 'var(--text-red-600)' : 'var(--text-strong)',
              }}
            >
              {model.loading && line.value === '—' ? '…' : line.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
