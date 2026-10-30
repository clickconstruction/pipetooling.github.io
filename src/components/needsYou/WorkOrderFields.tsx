import type { CSSProperties } from 'react'
import type { WorkOrderDecision, WorkOrderFillInRow } from '../../lib/needsYou/fillInWorkOrders'

/**
 * The work-order kind's fields on the Fill them in deck (v2.6094, punch list #178): the one
 * number the assembler's price box takes, the subcontract amount, with the bid's sub-labor
 * total one tap away as the assembler offers it. The send stays on the board.
 */
const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0.45rem 0.6rem',
  font: 'inherit',
  fontSize: '0.875rem',
  fontWeight: 700,
  minHeight: 36,
}
const labelStyle: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }
const money = (n: number): string => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function WorkOrderFields({ row, decision, onChange, disabled }: { row: WorkOrderFillInRow; decision: WorkOrderDecision; onChange: (d: WorkOrderDecision) => void; disabled: boolean }) {
  return (
    <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 360 }} data-work-order-fields>
      <label>
        <span style={labelStyle}>The subcontract amount</span>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={decision.amount} disabled={disabled} onChange={(e) => onChange({ amount: e.target.value })} placeholder="0.00" style={inputStyle} aria-label="The subcontract amount" />
      </label>
      {row.hint ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ amount: String(row.hint!.total) })}
          style={{ justifySelf: 'start', background: 'none', border: '1px dashed var(--text-link)', borderRadius: 6, color: 'var(--text-link)', font: 'inherit', fontSize: '0.8125rem', padding: '0.3rem 0.65rem', cursor: 'pointer' }}
          data-work-order-hint
        >
          From the bid: {money(row.hint.total)} sub labor
        </button>
      ) : (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No bid total to copy. Type the price the leader gave.</span>
      )}
    </div>
  )
}
