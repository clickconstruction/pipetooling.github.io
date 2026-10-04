import { useCallback, useEffect, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { formatContractStamp, jobContractChipColors, jobContractChips, jobContractSignatureAuditLine, type JobContractRow } from '../../lib/jobs/jobContractLifecycle'
import { loadJobContractRows } from '../../lib/jobs/jobLienPaperIo'
import { normalizeDocumentUrl } from '../../lib/jobs/lienFilingDocumentLink'
import { openHtmlPreviewWindow } from '../../lib/jobsDocuments/printWindow'
import { useToastContext } from '../../contexts/ToastContext'
import JobContractModal from './JobContractModal'
import { buildJobContractRecordHtml } from './JobContractRecordModal'
import { documentsChip, documentsHeading, documentsLinkButton, documentsQuietButton, documentsTd } from './jobDocumentsStyles'

/**
 * The Documents tab's contract (v2.4496): the job's contracts that were sent, signed or voided,
 * as the Documents page lists them. A signed one opens the Contract window on its record; one
 * only sent opens the page that went out. The heading's button opens the Contract window.
 */
export function JobDocumentsContract({ job, onOverlayOpenChange }: { job: JobWithDetails; onOverlayOpenChange?: (open: boolean) => void }) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<JobContractRow[] | null>(null)
  // null = closed; '' = the window with no record picked; otherwise that record.
  const [windowOn, setWindowOn] = useState<string | null>(null)

  const reload = useCallback(() => {
    let cancelled = false
    void loadJobContractRows(job.id).then((list) => {
      if (!cancelled) setRows(list)
    })
    return () => {
      cancelled = true
    }
  }, [job.id])

  useEffect(() => reload(), [reload])
  // The Contract window announces a change from wherever it is open (the Edit tab has one too).
  useEffect(() => {
    const onChanged = () => void reload()
    window.addEventListener('job-contract-changed', onChanged)
    return () => window.removeEventListener('job-contract-changed', onChanged)
  }, [reload])

  const openWindow = (recordId: string | null) => {
    setWindowOn(recordId)
    onOverlayOpenChange?.(recordId != null)
  }

  const openRow = (con: JobContractRow) => {
    if (con.signed_at) openWindow(con.id)
    else if (!openHtmlPreviewWindow(buildJobContractRecordHtml(con, job, null))) showToast('The browser blocked the new window. Allow pop-ups to view the contract.', 'error')
  }

  return (
    <section aria-labelledby="job-documents-contract" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h3 id="job-documents-contract" style={{ ...documentsHeading, flex: 1 }}>
          Contract
        </h3>
        <button type="button" style={documentsQuietButton} onClick={() => openWindow('')}>
          Contract window
        </button>
      </div>
      {rows == null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No contract has been sent or signed on this job.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {rows.map((con) => {
              const signedCopy = normalizeDocumentUrl(con.signed_document_url)
              return (
                <tr key={con.id} data-testid="job-documents-contract-row">
                  <td style={documentsTd}>
                    <button type="button" onClick={() => openRow(con)} style={documentsLinkButton}>
                      {con.template_name ?? 'Contract'}
                    </button>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>rev {con.revision}</span>
                    {jobContractChips(con).map((c) => (
                      <span key={c.label} style={{ ...documentsChip, ...jobContractChipColors(c.tone) }}>
                        {c.label}
                      </span>
                    ))}
                    {con.signed_at ? (
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>{jobContractSignatureAuditLine(con)}</span>
                    ) : con.last_sent_at ? (
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>Sent {formatContractStamp(con.last_sent_at)}</span>
                    ) : null}
                    {signedCopy ? (
                      <a href={signedCopy} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
                        Signed copy
                      </a>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <JobContractModal open={windowOn != null} onClose={() => openWindow(null)} job={job} initialRecordId={windowOn || null} onChanged={() => void reload()} />
    </section>
  )
}

export default JobDocumentsContract
