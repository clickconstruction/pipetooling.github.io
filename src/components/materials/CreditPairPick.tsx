/**
 * The credit form's Credits invoice… pick (v2.5035, the owner's call of 2026-10-09): on a credit,
 * the same house's invoice it takes money off. It lists this house's invoices, newest first, never
 * a credit and never the credit itself (`creditableInvoices`); the tab saves the choice as
 * `credits_invoice_id` and both rows then show the pair.
 */
import type { CSSProperties } from 'react'
import { creditableInvoices, type PairableSupplyRow } from '../../lib/materials/supplyHouseInvoiceForm'

const label: CSSProperties = { display: 'block', marginBottom: '0.25rem', fontWeight: 500 }
const input: CSSProperties = { width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }

export function CreditPairPick({
  rows,
  creditId,
  value,
  onChange,
}: {
  /** Every row of this house, paid ones too. */
  rows: ReadonlyArray<PairableSupplyRow & { invoice_date: string }>
  /** The credit being edited, or null for a new one. */
  creditId: string | null
  /** The paired invoice's id, or '' when not paired. */
  value: string
  onChange: (invoiceId: string) => void
}) {
  const options = creditableInvoices(rows, creditId)
  return (
    <div style={{ marginBottom: '0.75rem' }} data-testid="credit-credits-invoice">
      <label htmlFor="credit-credits-invoice" style={label}>
        Credits invoice…
      </label>
      <select id="credit-credits-invoice" value={value} onChange={(e) => onChange(e.target.value)} style={input}>
        <option value="">Not paired yet</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {options.length === 0 ? 'This house has no invoice on file to pair it to yet.' : 'The invoice from this house that the credit takes money off. Both rows show the pair.'}
      </div>
    </div>
  )
}
