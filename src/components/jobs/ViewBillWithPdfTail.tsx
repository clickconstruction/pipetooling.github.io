import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { openBilledInvoicePdfInNewTab } from '../../lib/openBilledInvoicePdf'

/**
 * View Bill with the one-click PDF tail (v2.2329, owner-approved mockup):
 * a split control — the modal to work with the bill, the paper to hand over.
 * Icon-only tail; opens the same invoice View Bill targets, freshly
 * generated, in a new tab.
 */
export default function ViewBillWithPdfTail({
  onViewBill,
  invoice,
}: {
  onViewBill: () => void
  invoice: { id: string; job_id: string }
}) {
  const { showToast } = useToastContext()
  const [opening, setOpening] = useState(false)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'stretch' }}>
      <button
        type="button"
        onClick={onViewBill}
        style={{
          padding: '0.35rem 0.75rem',
          fontSize: '0.8125rem',
          background: 'var(--surface)',
          color: 'var(--text-link)',
          border: '1px solid #2563eb',
          borderRadius: '4px 0 0 4px',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        View Bill
      </button>
      <button
        type="button"
        disabled={opening}
        aria-label="Open invoice PDF in a new tab"
        title="Open invoice PDF in a new tab"
        onClick={() => {
          if (opening) return
          setOpening(true)
          void openBilledInvoicePdfInNewTab(invoice, {
            onBlocked: () => showToast('Pop-up blocked. Allow pop-ups for this site to open the PDF.', 'warning'),
            onError: (m) => showToast(m, 'error'),
          }).finally(() => setOpening(false))
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0.35rem 0.5rem',
          background: 'var(--surface)',
          color: 'var(--text-link)',
          border: '1px solid #2563eb',
          borderLeft: 'none',
          borderRadius: '0 4px 4px 0',
          cursor: opening ? 'wait' : 'pointer',
        }}
      >
        {opening ? (
          <span style={{ fontSize: '0.75rem' }}>…</span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={14} height={14} fill="currentColor" aria-hidden>
            <path d="M160 64C124.7 64 96 92.7 96 128L96 512C96 547.3 124.7 576 160 576L480 576C515.3 576 544 547.3 544 512L544 234.5C544 217.5 537.3 201.2 525.3 189.2L418.7 82.7C406.7 70.7 390.5 64 373.5 64L160 64zM389.5 240C378.7 240 368 229.3 368 218.5L368 112L496 240L389.5 240zM216 328L424 328C437.3 328 448 338.7 448 352C448 365.3 437.3 376 424 376L216 376C202.7 376 192 365.3 192 352C192 338.7 202.7 328 216 328zM216 424L424 424C437.3 424 448 434.7 448 448C448 461.3 437.3 472 424 472L216 472C202.7 472 192 461.3 192 448C192 434.7 202.7 424 216 424z" />
          </svg>
        )}
      </button>
    </span>
  )
}
