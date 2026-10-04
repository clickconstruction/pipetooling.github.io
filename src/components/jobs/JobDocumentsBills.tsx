import { useMemo, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { jobDocumentBillRows } from '../../lib/jobs/jobDocumentsTab'
import { formatAiaMoney } from '../../lib/aiaG702G703Preview'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { openBilledInvoicePdfInNewTab } from '../../lib/openBilledInvoicePdf'
import { useToastContext } from '../../contexts/ToastContext'
import BilledBillViewModal from './BilledBillViewModal'
import { billingTypeLabel } from './HostedStripeBillPanel'
import { documentsHeading, documentsQuietButton, documentsTd, documentsTh, documentsNum, documentsLinkButton } from './jobDocumentsStyles'

/** One step above the job window's overlay (1010) and its form's nested overlays. */
const BILL_VIEW_FROM_DOCUMENTS_Z_INDEX = 1030

/**
 * The Documents tab's bills (v2.4495): the job's bills that went out, from the job already loaded.
 * A row opens View bill above the job window; PDF rebuilds the invoice in a new tab.
 */
export function JobDocumentsBills({ job, onOverlayOpenChange }: { job: JobWithDetails; onOverlayOpenChange?: (open: boolean) => void }) {
  const { showToast } = useToastContext()
  const [viewId, setViewId] = useState<string | null>(null)
  const rows = useMemo(() => jobDocumentBillRows(job.invoices ?? [], calendarYmdInAppTzFromIso), [job.invoices])
  const viewing = viewId ? (job.invoices ?? []).find((inv) => inv.id === viewId) ?? null : null

  const open = (id: string | null) => {
    setViewId(id)
    onOverlayOpenChange?.(id != null)
  }

  return (
    <section aria-labelledby="job-documents-bills" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h3 id="job-documents-bills" style={documentsHeading}>
        Bills
      </h3>
      {rows.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No bill has gone out on this job.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={documentsTh}>Bill</th>
                <th style={{ ...documentsTh, textAlign: 'right' }}>Amount</th>
                <th style={documentsTh}>Where it stands</th>
                <th style={documentsTh} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const inv = (job.invoices ?? []).find((i) => i.id === row.id)!
                return (
                  <tr key={row.id} data-testid="job-documents-bill">
                    <td style={documentsTd}>
                      <button type="button" onClick={() => open(row.id)} style={documentsLinkButton}>
                        {row.title}
                      </button>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem', fontSize: '0.8125rem' }}>{billingTypeLabel(inv)}</span>
                    </td>
                    <td style={{ ...documentsTd, ...documentsNum }}>{formatAiaMoney(row.amount)}</td>
                    <td style={documentsTd}>
                      {row.words}
                      {row.hostedUrl ? (
                        <>
                          {' · '}
                          <a href={row.hostedUrl} target="_blank" rel="noopener noreferrer">
                            Customer&apos;s page
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td style={{ ...documentsTd, textAlign: 'right' }}>
                      <button
                        type="button"
                        aria-label={`Open the PDF of ${row.title}`}
                        style={documentsQuietButton}
                        // The tab has to open inside the click, before anything is awaited.
                        onClick={() =>
                          void openBilledInvoicePdfInNewTab(
                            { id: row.id, job_id: job.id },
                            {
                              onBlocked: () => showToast('The browser blocked the new tab. Allow pop-ups for this site and press PDF again.', 'warning'),
                              onError: (message) => showToast(message, 'error'),
                            },
                          )
                        }
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <BilledBillViewModal invoice={viewing ? { ...viewing, job } : null} onClose={() => open(null)} overlayZIndex={BILL_VIEW_FROM_DOCUMENTS_Z_INDEX} />
    </section>
  )
}

export default JobDocumentsBills
