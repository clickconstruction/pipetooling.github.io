import { useJobAccountShares } from '../../hooks/useJobAccountShares'
import { jobAccountSplitFromLines, type JobSupplyInvoiceLine } from '../../lib/fetchJobMaterialsCostSnapshot'
import { billTabJobAccountNote } from '../../lib/supplyHouseJobAccountsLedger'

type Props = {
  jobId: string
  /** Office-role gate (same set as the header storefront icon). */
  enabled: boolean
  supplyInvoiceLines: JobSupplyInvoiceLine[]
  /** Jumps to the Costs tab for the invoice detail; omitted = no link. */
  onOpenCosts?: (() => void) | null
}

/**
 * Bill-tab job-account note (v2.3257): sits between the money bar and the
 * Invoices heading — the moment you're about to bill a customer whose
 * materials ride on a supply house's job account. Renders nothing when no
 * packet is on record (mockup-approved). Teal is literal — no teal tokens.
 */
export function JobFormBillJobAccountNote({ jobId, enabled, supplyInvoiceLines, onOpenCosts }: Props) {
  const { shares } = useJobAccountShares(jobId, enabled)
  const split = jobAccountSplitFromLines(supplyInvoiceLines)
  const note = billTabJobAccountNote(shares ?? [], split.unpaidOnJobAccount, (iso) => new Date(iso).toLocaleDateString())
  if (!note) return null
  return (
    <div
      role="note"
      aria-label="Job account on file"
      style={{
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'flex-start',
        padding: '0.6rem 0.75rem',
        border: '1px solid #99f6e4',
        background: '#f0fdfa',
        borderRadius: 6,
        fontSize: '0.8125rem',
        color: 'var(--text-base)',
      }}
    >
      <svg viewBox="0 0 16 16" width={15} height={15} style={{ color: '#0f766e', flex: 'none', marginTop: 2 }} aria-hidden>
        <path d="M8 1.2 13.5 3v4.3c0 3.4-2.3 6.1-5.5 7.5C4.8 13.4 2.5 10.7 2.5 7.3V3L8 1.2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m5.6 7.8 1.7 1.7 3.1-3.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: '#0f766e' }}>{note.headline}</strong> — {note.sentLine}.
        <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 2 }}>
          {note.whatItMeans}
          {note.flaggedLine ? (
            <>
              {' '}
              <span style={{ color: '#0f766e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{note.flaggedLine}</span>
            </>
          ) : null}
        </span>
      </span>
      {onOpenCosts ? (
        <button
          type="button"
          onClick={onOpenCosts}
          style={{ background: 'none', border: 'none', padding: 0, color: '#0f766e', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap', alignSelf: 'center' }}
        >
          Costs →
        </button>
      ) : null}
    </div>
  )
}
