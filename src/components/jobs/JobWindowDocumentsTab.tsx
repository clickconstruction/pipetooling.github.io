import { Fragment, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { formatAiaDate } from '../../lib/aiaG702G703Template'
import { formatAiaMoney } from '../../lib/aiaG702G703Preview'
import { type SavedPayApplication, carryMismatch } from '../../lib/aiaPayApplications'
import { loadDeletedPayApplications, loadPayApplications } from '../../lib/aiaPayApplicationsIo'
import { changedAfterWentOut, changedAfterWords, isPayApplicationCopy, payApplicationDay, payApplicationDayTime, payApplicationDeletedWords, payApplicationFileName, payApplicationHistory, payApplicationSavedWords } from '../../lib/aiaPayApplicationHistory'
import { jobDocumentFolderLinks } from '../../lib/jobs/jobDocumentsTab'
import { type SentCopy, canReadSentCopies } from '../../lib/sent/sentCopies'
import { loadSentCopiesForJob, openSentFile } from '../../lib/sent/sentCopiesIo'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import AiaG702G703Modal from './AiaG702G703Modal'
import { JobDocumentsBills } from './JobDocumentsBills'
import { JobDocumentsContract } from './JobDocumentsContract'
import { JobDocumentsLienPaper } from './JobDocumentsLienPaper'
import { JobDocumentsSent } from './JobDocumentsSent'
import { JobDocumentsTestReports } from './JobDocumentsTestReports'

/**
 * The job window's Documents tab (v2.4491): the job's pay applications, each with the workbooks
 * that went out from it and who saved it (v2.4710), then its bills, contract, test reports and
 * lien paper (v2.4495, v2.4496), then everything else sent from the job, each with the copy as
 * it went (v2.4554, the office only), then the job's folders. A row opens the AIA G702-G703
 * window on that application; the window sits above the job window and the lists reload when
 * it closes.
 */

/** One step above the job window's overlay (1010) and its form's nested overlays. */
const AIA_FROM_JOB_WINDOW_Z_INDEX = 1030

const th: CSSProperties = { textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
const quietButton: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }

export function JobWindowDocumentsTab({ job, onOverlayOpenChange }: { job: JobWithDetails; onOverlayOpenChange?: (open: boolean) => void }) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [apps, setApps] = useState<SavedPayApplication[] | null>(null)
  // Everything sent from the job, read once: the pay application workbooks go under their applications, the rest to Sent from this job.
  const [sent, setSent] = useState<SentCopy[] | null>(null)
  // The applications taken off the job (v2.4715), listed after the live ones.
  const [deleted, setDeleted] = useState<SavedPayApplication[]>([])
  // null = closed; 'new' = a new application; a number = that saved application.
  const [aia, setAia] = useState<number | 'new' | null>(null)

  const reload = useCallback(() => {
    let cancelled = false
    void loadPayApplications(job.id)
      .catch(() => [] as SavedPayApplication[])
      .then((list) => {
        if (!cancelled) setApps(list)
      })
    void loadSentCopiesForJob(job.id)
      .catch(() => [] as SentCopy[])
      .then((list) => {
        if (!cancelled) setSent(list)
      })
    void loadDeletedPayApplications(job.id)
      .catch(() => [] as SavedPayApplication[])
      .then((list) => {
        if (!cancelled) setDeleted(list)
      })
    return () => {
      cancelled = true
    }
  }, [job.id])

  const history = payApplicationHistory(apps ?? [], sent ?? [], deleted)
  const otherSent = sent == null ? null : sent.filter((r) => !isPayApplicationCopy(r))
  const openFile = async (copy: SentCopy) => {
    if (!copy.copyPath) return
    if (!(await openSentFile(copy.copyPath))) showToast('Could not open the workbook.', 'error')
  }
  const fileButton: CSSProperties = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', fontSize: '0.875rem', color: 'var(--text-blue-700)', textDecoration: 'underline' }

  useEffect(() => reload(), [reload])

  const openAia = (which: number | 'new') => {
    setAia(which)
    onOverlayOpenChange?.(true)
  }
  const closeAia = () => {
    setAia(null)
    onOverlayOpenChange?.(false)
    reload()
  }

  const folders = jobDocumentFolderLinks(job)
  const held = apps && apps.length > 0 ? apps[apps.length - 1]!.retainageHeld : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '0.5rem' }}>
      <section aria-labelledby="job-documents-pay-apps" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileSpreadsheet size={18} color="#16a34a" aria-hidden />
          <h3 id="job-documents-pay-apps" style={{ ...heading, flex: 1 }}>
            Pay applications
          </h3>
          <button type="button" onClick={() => openAia('new')} style={quietButton}>
            New application
          </button>
        </div>
        {apps == null ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
        ) : apps.length === 0 && deleted.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No pay applications are saved on this job. Press New application to make one, or to add one you already sent.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={th}>No.</th>
                    <th style={th}>Period to</th>
                    <th style={{ ...th, textAlign: 'right' }}>Payment due</th>
                    <th style={th}>Went out</th>
                    <th style={th}>Saved</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {history.lines.map(({ app, wentOut, deleted: gone }) => {
                    if (gone) {
                      return (
                        <tr key={app.id} data-testid="job-documents-pay-app-deleted" style={{ color: 'var(--text-muted)' }}>
                          <td style={{ ...td, fontWeight: 700 }}>
                            {app.applicationNumber}
                            {app.name ? <span style={{ fontWeight: 400 }}> · {app.name}</span> : null}
                            <span style={{ fontWeight: 400 }}> · deleted</span>
                          </td>
                          <td style={td}>{formatAiaDate(app.periodTo) || '—'}</td>
                          <td style={{ ...td, ...num }}>{formatAiaMoney(app.currentPaymentDue)}</td>
                          <td style={td}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              {wentOut.map((copy) => (
                                <span key={copy.id} style={{ whiteSpace: 'nowrap' }}>
                                  {copy.copyPath ? (
                                    <button type="button" onClick={() => void openFile(copy)} style={fileButton} title="Download the workbook as it went out">
                                      {payApplicationFileName(copy) || 'the workbook'}
                                    </button>
                                  ) : (
                                    <span>copy not kept</span>
                                  )}
                                  <span style={{ fontSize: '0.8125rem' }}> · {payApplicationDayTime(copy.sentAt)}</span>
                                </span>
                              ))}
                              {wentOut.length === 0 ? <span>—</span> : null}
                            </div>
                          </td>
                          <td style={{ ...td, fontSize: '0.8125rem' }}>{payApplicationDeletedWords(app, payApplicationDay) || 'Deleted'}</td>
                          <td style={td} />
                        </tr>
                      )
                    }
                    const mismatch = carryMismatch({ values: app.fields, lines: app.lines }, app.applicationNumber, apps)
                    const saved = payApplicationSavedWords(app, payApplicationDay).replace(/^Saved /, '')
                    const changed = changedAfterWentOut(app, wentOut)
                    return (
                    <Fragment key={app.id}>
                    <tr data-testid="job-documents-pay-app">
                      <td style={{ ...td, fontWeight: 700 }}>
                        {app.applicationNumber}
                        {app.name ? <span data-testid="job-documents-pay-app-name" style={{ fontWeight: 400, color: 'var(--text-600)' }}> · {app.name}</span> : null}
                      </td>
                      <td style={td}>{formatAiaDate(app.periodTo) || '—'}</td>
                      <td style={{ ...td, ...num }}>{formatAiaMoney(app.currentPaymentDue)}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {wentOut.map((copy) => (
                            <span key={copy.id} data-testid="job-documents-pay-app-workbook" style={{ whiteSpace: 'nowrap' }}>
                              {copy.copyPath ? (
                                <button type="button" onClick={() => void openFile(copy)} style={fileButton} title="Download the workbook as it went out">
                                  {payApplicationFileName(copy) || 'the workbook'}
                                </button>
                              ) : (
                                <span style={{ color: 'var(--text-amber-800)' }}>copy not kept</span>
                              )}
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}> · {payApplicationDayTime(copy.sentAt)}</span>
                            </span>
                          ))}
                          {app.link ? (
                            <a href={app.link} target="_blank" rel="noopener noreferrer">
                              Open the file
                            </a>
                          ) : null}
                          {wentOut.length === 0 && !app.link ? <span style={{ color: 'var(--text-muted)' }}>Not yet</span> : null}
                        </div>
                      </td>
                      <td style={{ ...td, fontSize: '0.8125rem', color: 'var(--text-600)' }}>{saved || '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button type="button" onClick={() => openAia(app.applicationNumber)} style={quietButton} aria-label={`Open application ${app.applicationNumber}`}>
                          Open
                        </button>
                      </td>
                    </tr>
                    {changed ? (
                      <tr data-testid="job-documents-pay-app-changed">
                        <td colSpan={6} style={{ ...td, paddingTop: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
                          ⚠ {changedAfterWords(changed, payApplicationDay)}. The GC has the {payApplicationDay(changed.copy.sentAt)} workbook.
                        </td>
                      </tr>
                    ) : null}
                    {mismatch ? (
                      <tr data-testid="job-documents-pay-app-flag">
                        <td colSpan={6} style={{ ...td, paddingTop: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
                          ⚠ No longer matches application {mismatch.previousNumber}.{' '}
                          {app.carryReason ? `Kept as it is: ${app.carryReason}` : 'No reason given yet.'}
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {history.unsaved.length > 0 ? (
              <p data-testid="job-documents-pay-app-unsaved" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                Downloaded with no number typed, so saved on no application:{' '}
                {history.unsaved.map((copy, i) => (
                  <Fragment key={copy.id}>
                    {i > 0 ? ', ' : ''}
                    {copy.copyPath ? (
                      <button type="button" onClick={() => void openFile(copy)} style={{ ...fileButton, fontSize: '0.8125rem' }}>
                        {payApplicationFileName(copy) || 'the workbook'}
                      </button>
                    ) : (
                      'a copy that was not kept'
                    )}{' '}
                    {payApplicationDayTime(copy.sentAt)}
                  </Fragment>
                ))}
              </p>
            ) : null}
            {apps.length > 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Retainage held as of application {apps[apps.length - 1]!.applicationNumber}: {formatAiaMoney(held)}
              </p>
            ) : null}
          </>
        )}
      </section>

      <JobDocumentsBills job={job} onOverlayOpenChange={onOverlayOpenChange} />

      <JobDocumentsContract job={job} onOverlayOpenChange={onOverlayOpenChange} />

      <JobDocumentsTestReports job={job} />

      <JobDocumentsLienPaper job={job} onOverlayOpenChange={onOverlayOpenChange} />

      {canReadSentCopies(role) ? <JobDocumentsSent job={job} rows={otherSent} /> : null}

      <section aria-labelledby="job-documents-folders" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <h3 id="job-documents-folders" style={heading}>
          Job folders
        </h3>
        {folders.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No folder links are on this job. Add them on the Edit tab.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {folders.map((f) => (
              <li key={f.label} style={{ fontSize: '0.875rem' }}>
                <a href={f.url} target="_blank" rel="noopener noreferrer">
                  {f.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AiaG702G703Modal
        open={aia != null}
        onClose={closeAia}
        job={job}
        hcpForFilename={job.hcp_number ?? ''}
        initialApplicationNumber={typeof aia === 'number' ? aia : null}
        startOn="new"
        zIndex={AIA_FROM_JOB_WINDOW_Z_INDEX}
      />
    </div>
  )
}

export default JobWindowDocumentsTab
