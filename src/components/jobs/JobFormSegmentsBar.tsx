/**
 * The ② Bills and payments heading (with its ⓘ how-it-moves explainer) and the By bill / By date
 * switch. The striped line strip, its rows and the "create invoice from selected segments" button
 * that lived here gave way to the money card (`JobFormMoneyCard`, v2.4307).
 */
import { useState, type CSSProperties } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'

/** How the ② block lists its money (v2.4294): each bill with the payments under it, or everything on one date line. */
export type BillsAndPaymentsView = 'bill' | 'date'

/**
 * The By bill / By date switch (v2.4294). It changes only the bill list, so since v2.4298 it sits on
 * that list's own Bills header row (`JobFormInvoiceList`) rather than on the ② heading.
 */
export function BillsViewSwitch({ view, onViewChange }: { view: BillsAndPaymentsView; onViewChange: (view: BillsAndPaymentsView) => void }) {
  const switchBtn = (key: BillsAndPaymentsView): CSSProperties => ({
    padding: '0.2rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: view === key ? 600 : 500,
    // The header row is small caps; the switch reads as ordinary words.
    textTransform: 'none',
    letterSpacing: 'normal',
    border: 'none',
    background: view === key ? '#2563eb' : 'var(--surface)',
    color: view === key ? '#ffffff' : 'var(--text-700)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  })
  return (
    <div
      role="group"
      aria-label="How to list the money"
      data-testid="bills-view-switch"
      style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}
    >
      <button type="button" onClick={() => onViewChange('bill')} aria-pressed={view !== 'date'} title="Each bill, with the payments that paid it under it" style={switchBtn('bill')}>
        By bill
      </button>
      <button type="button" onClick={() => onViewChange('date')} aria-pressed={view === 'date'} title="Bills going out and money coming in on one date line, oldest first" style={switchBtn('date')}>
        By date
      </button>
    </div>
  )
}

/**
 * "② Invoices" heading with the ⓘ how-it-moves explainer beside it (v2.1146) —
 * the trigger used to live inside the segment strip's header row; the modal
 * renders this instead so the explainer sits next to the section title.
 */
export function InvoicesSectionHeading({
  sampleDollars,
  jobLabel,
}: {
  sampleDollars: number | null
  jobLabel?: string | null
}) {
  const [explainerOpen, setExplainerOpen] = useState(false)
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 400, textDecoration: 'underline', fontSize: '0.9375rem', color: 'var(--text-700)' }}>
          ② Bills and payments
        </span>
        <button
          type="button"
          onClick={() => setExplainerOpen((v) => !v)}
          aria-expanded={explainerOpen}
          style={{
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-link)',
            fontSize: '0.6875rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          ⓘ How invoices and jobs move
        </button>
      </div>
      {explainerOpen && (
        <div
          style={{
            borderLeft: '2px solid var(--border-strong)',
            padding: '0.35rem 0 0.35rem 0.75rem',
            marginTop: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}
        >
          <div>
            1. Create an invoice here — it breaks off as its own <strong style={{ color: 'var(--text-700)' }}>green card</strong> on the
            Pipeline board and moves by itself:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ ...EXPLAINER_CHIP_BASE, background: '#16a34a', border: '1px solid rgba(255,255,255,0.5)' }}>
              ${formatCurrency(sampleDollars ?? 1450)}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>→ Ready to Bill → Billed → Paid</span>
          </div>
          <div>
            2. The job itself stays a <strong style={{ color: 'var(--text-700)' }}>blue card</strong> in Working. When its last payment
            lands, it floats through on its own:
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ ...EXPLAINER_CHIP_BASE, background: '#2563eb', border: 'none' }}>{jobLabel || 'This job'}</span>
            <span style={{ whiteSpace: 'nowrap' }}>→ Paid</span>
          </div>
        </div>
      )}
    </div>
  )
}

/** Sample chips in the explainer wear the exact Stages colors users will see there. */
const EXPLAINER_CHIP_BASE = {
  display: 'inline-block',
  padding: '0.1rem 0.45rem',
  borderRadius: 4,
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: '#ffffff',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
} as const
