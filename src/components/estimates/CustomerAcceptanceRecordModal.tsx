import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CustomerAcceptanceRecordBody, type EstimateRecordRow } from './CustomerAcceptanceRecordBody'

type CustomerAcceptanceRecordModalProps = {
  open: boolean
  onClose: () => void
  estimateId: string | null
}

/**
 * Estimates' accepted-record modal. Since v2.2709 the loading + document live
 * in `CustomerAcceptanceRecordBody` (shared with the Jobs signed-agreement
 * view); this file is the Estimates-side shell — header, Open estimate, Close.
 */
export default function CustomerAcceptanceRecordModal({ open, onClose, estimateId }: CustomerAcceptanceRecordModalProps) {
  const [row, setRow] = useState<EstimateRecordRow | null>(null)

  useEffect(() => {
    if (!open) return
    setRow(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', boxSizing: 'border-box' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-acceptance-record-title"
        style={{ width: '100%', maxWidth: 720, maxHeight: 'min(92vh, 900px)', overflow: 'auto', background: 'var(--surface)', borderRadius: 8, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 id="customer-acceptance-record-title" style={{ margin: 0, fontSize: '1.1rem' }}>
              Accepted estimate
            </h2>
            {/* Flex-wrap with nowrap segments (matches PersonContractSignedRecordModal):
                narrow screens break between the phrases, never mid-timestamp. */}
            {row && row.status === 'customer_accepted' ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', columnGap: '0.65rem' }}>
                {row.acceptor_printed_name?.trim() ? (
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <strong>Signed as:</strong> {row.acceptor_printed_name.trim()}
                  </span>
                ) : null}
                {row.acceptor_consented_at ? (
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <strong>Accepted:</strong> {new Date(row.acceptor_consented_at).toLocaleString()}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {row && row.status === 'customer_accepted' ? (
              <Link to={`/estimates/${row.estimate_number}`} style={{ fontSize: '0.9rem' }} onClick={onClose}>
                Open estimate
              </Link>
            ) : null}
            <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.85rem' }}>
              Close
            </button>
          </div>
        </div>
        <div style={{ padding: '1rem 1.25rem 1.5rem' }}>
          <CustomerAcceptanceRecordBody open={open} estimateId={estimateId} onLoaded={setRow} />
        </div>
      </div>
    </div>
  )
}
