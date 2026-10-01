import type { ArReturnCaseView } from '../../../lib/jobs/arReturnCase'

const money = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * One row of Came back, on top of To match (v2.4325, punch list #76 PR 3): the
 * amount, who it came from, where the check sits now, and its chip. Selecting it
 * opens the case in the pane.
 */
export function ArReturnCaseRow({ view, active, onSelect }: { view: ArReturnCaseView; active: boolean; onSelect: () => void }) {
  const red = view.chip.tone === 'red'
  return (
    <button
      type="button"
      data-testid="ar-return-case-row"
      aria-label={`${money(view.amount)} from ${view.payer}, ${view.chip.text}`}
      aria-pressed={active}
      onClick={onSelect}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '0.5rem',
        width: '100%',
        textAlign: 'left',
        padding: '0.55rem 0.75rem',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        background: active ? 'var(--bg-blue-tint)' : 'var(--surface)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '0.8125rem',
        boxSizing: 'border-box',
        color: 'var(--text)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{money(view.amount)}</div>
        <div style={{ color: 'var(--text-700)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{view.payer}</div>
        <div data-testid="ar-return-case-row-line" style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 2, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
          {view.rowLine}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <span
          style={{
            display: 'inline-block',
            borderRadius: 999,
            fontSize: '0.6875rem',
            padding: '1px 8px',
            whiteSpace: 'nowrap',
            background: red ? 'var(--surface)' : 'var(--bg-amber-tint)',
            color: red ? 'var(--text-red-700)' : 'var(--text-amber-800)',
            border: `1px solid ${red ? 'var(--border-red)' : 'var(--border-amber)'}`,
          }}
        >
          {view.chip.text}
        </span>
      </div>
    </button>
  )
}
