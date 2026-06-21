import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatErrorMessage } from '../../utils/errorHandling'
import { HostedStripeBillPanel, type InvoiceWithJobForBillView } from '../jobs/HostedStripeBillPanel'
import { PhysicalInvoicePreview } from '../jobs/PhysicalInvoicePreview'
import { buildPhysicalInvoicePdfBlob } from '../../lib/physicalInvoicePdf'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from '../../lib/physicalInvoiceDocumentForBilledInvoice'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export default function DocumentsJobBilledInvoiceModal({
  open,
  invoice,
  onClose,
  overlayZIndex = 70,
}: {
  open: boolean
  invoice: JobsLedgerInvoice | null
  onClose: () => void
  overlayZIndex?: number
}) {
  const { role } = useAuth()
  const [job, setJob] = useState<JobWithDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pdfOpening, setPdfOpening] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !invoice?.job_id) {
      setJob(null)
      setLoadError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    void (async () => {
      try {
        const j = await fetchJobWithDetailsById(invoice.job_id)
        if (cancelled) return
        if (!j) {
          setJob(null)
          setLoadError('Job not found or not visible.')
          return
        }
        setJob(j)
      } catch (e) {
        if (!cancelled) setLoadError(formatErrorMessage(e, 'Could not load job'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, invoice?.job_id])

  const invFull: JobsLedgerInvoice | null =
    job && invoice ? (job.invoices.find((i) => i.id === invoice.id) ?? invoice) : null

  const invWithJob: InvoiceWithJobForBillView | null =
    job && invFull ? { ...invFull, job } : null

  const physicalDoc =
    job && invFull ? buildPhysicalInvoiceDocumentForBilledInvoice(job, invFull) : null

  const openPdfInNewTab = useCallback(async () => {
    if (!physicalDoc || !job) return
    const win = window.open('', '_blank')
    if (!win) {
      window.alert('Pop-up blocked. Allow pop-ups for this site to preview the PDF.')
      return
    }
    setPdfOpening(true)
    setPdfError(null)
    let objectUrl: string | null = null
    try {
      const blob = await buildPhysicalInvoicePdfBlob(physicalDoc)
      objectUrl = URL.createObjectURL(blob)
      win.location.href = objectUrl
      window.setTimeout(() => {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      }, 60_000)
    } catch (e) {
      win.close()
      setPdfError(e instanceof Error ? e.message : 'Could not build PDF preview')
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    } finally {
      setPdfOpening(false)
    }
  }, [physicalDoc, job, invoice])

  if (!open || !invoice) return null

  const subtitle = job ? `${effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'} · ${job.job_name ?? '—'}` : '—'
  const stripeId = (invoice.stripe_invoice_id ?? '').trim()
  const isStripeHosted = Boolean(stripeId && (invoice.hosted_invoice_url ?? '').trim())

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
        padding: '0.75rem',
        boxSizing: 'border-box',
      }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: 8,
          width: 'min(920px, 96vw)',
          maxHeight: '90vh',
          overflow: 'auto',
          boxSizing: 'border-box',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="documents-billed-invoice-title"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <h2 id="documents-billed-invoice-title" style={{ margin: 0, fontSize: '1.25rem', lineHeight: 1.3 }}>
            View bill
          </h2>
          {isStripeHosted && stripeId && role === 'dev' ? (
            <button
              type="button"
              title="Open this invoice in Stripe Dashboard"
              onClick={() =>
                window.open(
                  `https://dashboard.stripe.com/invoices/${encodeURIComponent(stripeId)}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
              style={{
                flexShrink: 0,
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: 4,
                border: '1px solid #d1d5db',
                background: 'white',
                cursor: 'pointer',
                color: '#374151',
                fontWeight: 500,
              }}
            >
              Open in Stripe
            </button>
          ) : null}
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>{subtitle}</p>

        {loading ? <p style={{ margin: '0 0 1rem', color: '#6b7280' }}>Loading job…</p> : null}
        {loadError ? (
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#b45309' }}>{loadError}</p>
        ) : null}

        {!loading && !loadError && invWithJob ? (
          <>
            <HostedStripeBillPanel invoice={invWithJob} />
            <hr style={{ margin: '1.25rem 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 600 }}>Invoice PDF (PipeTooling layout)</h3>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
              Reconstructed from job data; may differ from the original Stripe or emailed PDF.
            </p>
            {physicalDoc ? (
              <>
                <div style={{ marginBottom: '0.75rem' }}>
                  <PhysicalInvoicePreview document={physicalDoc} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => void openPdfInNewTab()}
                    disabled={pdfOpening}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '1px solid #2563eb',
                      background: 'white',
                      borderRadius: 4,
                      cursor: pdfOpening ? 'wait' : 'pointer',
                      color: '#1d4ed8',
                      fontWeight: 500,
                      fontSize: '0.875rem',
                    }}
                  >
                    {pdfOpening ? 'Opening…' : 'Open PDF in new tab'}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                PDF preview is not available for this invoice amount.
              </p>
            )}
            {pdfError ? (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#b45309' }}>{pdfError}</p>
            ) : null}
          </>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              background: 'white',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
