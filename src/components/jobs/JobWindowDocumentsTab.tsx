import { Fragment, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { formatAiaDate } from '../../lib/aiaG702G703Template'
import { formatAiaMoney } from '../../lib/aiaG702G703Preview'
import { type SavedPayApplication, carryMismatch } from '../../lib/aiaPayApplications'
import { PayApplicationNumberTaken, loadDeletedPayApplications, loadPayApplications, restorePayApplication } from '../../lib/aiaPayApplicationsIo'
import { changedAfterWentOut, changedAfterWords, isPayApplicationCopy, payApplicationDay, payApplicationDayTime, payApplicationDeletedWords, payApplicationFileName, payApplicationHistory, payApplicationRestoreTakenWords, payApplicationSavedWords } from '../../lib/aiaPayApplicationHistory'
import { jobDocumentFolderLinks } from '../../lib/jobs/jobDocumentsTab'
import { canMakeJobDriveFolders, driveFoldersMadeWords, jobDriveLinksPatch, type JobDriveFolders, type JobDriveLinksPatch } from '../../lib/jobs/jobDriveFolders'
import { makeJobDriveFolders } from '../../lib/jobs/jobDriveFoldersIo'
import { formatErrorMessage } from '../../utils/errorHandling'
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
import { EmptyState } from '../EmptyState'
import type { JobWindowTabKey } from '../../lib/jobs/jobHistoryTab'

/**
 * The job window's Documents tab (v2.4491): the job's pay applications, each with the workbooks
 * that went out from it and who saved it (v2.4710), then its bills, contract, test reports and
 * lien paper (v2.4495, v2.4496), then everything else sent from the job, each with the copy as
 * it went (v2.4554, the office only), then the job's folders. A row opens the AIA G702-G703
 * window on that application; the window sits above the job window and the lists reload when
 * it closes. Since v2.6054 the folders section offers **Make the job’s Drive folders** to the office when the job
 * has no job folder, and since v2.6055 when it has one but no pictures or plans link: the app makes what is missing
 * under Jobs and the window patches its copy of the job with the links.
 */

/** One step above the job window's overlay (1010) and its form's nested overlays. */
const AIA_FROM_JOB_WINDOW_Z_INDEX = 1030

const th: CSSProperties = { textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
const quietButton: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }

export function JobWindowDocumentsTab({
  job,
  onOverlayOpenChange,
  onRequestTab,
  onFoldersMade,
}: {
  job: JobWithDetails
  onOverlayOpenChange?: (open: boolean) => void
  /** The window's own tab switch: an empty bills or folders list names the tab that fills it (punch list #184). */
  onRequestTab?: (tab: JobWindowTabKey) => void
  /** The links the Drive-folders press wrote (v2.6054): the window patches the job it holds. */
  onFoldersMade?: (patch: JobDriveLinksPatch) => void
}) {
  const { role } = useAuth()
  const { showToast } = useToastContext()
  const [apps, setApps] = useState<SavedPayApplication[] | null>(null)
  // Everything sent from the job, read once: the pay application workbooks go under their applications, the rest to Sent from this job.
  const [sent, setSent] = useState<SentCopy[] | null>(null)
  // The applications taken off the job (v2.4715), listed after the live ones.
  const [deleted, setDeleted] = useState<SavedPayApplication[]>([])
  // null = closed; 'new' = a new application; a number = that saved application.
  const [aia, setAia] = useState<number | 'new' | null>(null)
  // The deleted application being put back (#92), while the write is in flight.
  const [restoringId, setRestoringId] = useState<string | null>(null)

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

  /** Put a deleted application back on the job (#92); the table reads again. */
  const restore = async (app: SavedPayApplication) => {
    if (restoringId) return
    setRestoringId(app.id)
    try {
      await restorePayApplication(app)
      reload()
      showToast(`Application ${app.applicationNumber} is back on the job.`, 'success')
    } catch (e) {
      if (e instanceof PayApplicationNumberTaken) showToast(payApplicationRestoreTakenWords(e.applicationNumber), 'error')
      else {
        console.error(e)
        showToast('The application could not be put back.', 'error')
      }
    } finally {
      setRestoringId(null)
    }
  }

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
  // The job's Drive folders, made by the app (v2.6054): offered to the office when any of the job's three links is
  // missing (v2.6055), since the press fills in what is missing inside a folder the job already has.
  const [makingFolders, setMakingFolders] = useState(false)
  const [madeFolders, setMadeFolders] = useState<JobDriveFolders | null>(null)
  const hasJobFolder = folders.some((f) => f.label === 'Job folder')
  const offerFolders = canMakeJobDriveFolders(role) && folders.length < 3
  const makeFolders = async () => {
    if (makingFolders) return
    setMakingFolders(true)
    try {
      const r = await makeJobDriveFolders(job.id)
      setMadeFolders(r)
      onFoldersMade?.(jobDriveLinksPatch(r))
      showToast(driveFoldersMadeWords(r).line, 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'The folders were not made.'), 'error')
    } finally {
      setMakingFolders(false)
    }
  }
  const madeWords = madeFolders ? driveFoldersMadeWords(madeFolders) : null
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
          <EmptyState compact main="No pay applications are saved on this job." next={{ label: 'New application', onPress: () => openAia('new') }} tail="makes one, or adds one you already sent." />
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
                          <td style={{ ...td, textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => void restore(app)}
                              disabled={restoringId != null}
                              style={{ ...quietButton, whiteSpace: 'nowrap', cursor: restoringId != null ? 'wait' : 'pointer' }}
                              aria-label={`Put application ${app.applicationNumber} back`}
                            >
                              {restoringId === app.id ? 'Putting back…' : 'Put it back'}
                            </button>
                          </td>
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

      <JobDocumentsBills job={job} onOverlayOpenChange={onOverlayOpenChange} onOpenBill={onRequestTab ? () => onRequestTab('bill') : undefined} />

      <JobDocumentsContract job={job} onOverlayOpenChange={onOverlayOpenChange} />

      <JobDocumentsTestReports job={job} />

      <JobDocumentsLienPaper job={job} onOverlayOpenChange={onOverlayOpenChange} />

      {canReadSentCopies(role) ? <JobDocumentsSent job={job} rows={otherSent} /> : null}

      <section aria-labelledby="job-documents-folders" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <h3 id="job-documents-folders" style={heading}>
          Job folders
        </h3>
        {folders.length === 0 ? (
          <EmptyState
            compact
            {...(offerFolders
              ? {
                  main: 'No folder links are on this job.',
                  next: { label: makingFolders ? 'Making the folders…' : 'Make the job’s Drive folders', onPress: () => void makeFolders() },
                  tail: onRequestTab ? 'makes them under Jobs, shared with the office,' : 'makes them under Jobs, shared with the office.',
                  ...(onRequestTab ? { orNext: { label: 'Edit', onPress: () => onRequestTab('edit') } } : {}),
                }
              : onRequestTab
                ? { main: 'No folder links are on this job.', next: { label: 'Edit', onPress: () => onRequestTab('edit') }, tail: 'is the tab that adds them.' }
                : { main: 'No folder links are on this job. Add them on the Edit tab.' })}
          />
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
        {folders.length > 0 && offerFolders ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" style={quietButton} disabled={makingFolders} onClick={() => void makeFolders()}>
              {makingFolders ? 'Making the folders…' : 'Make the job’s Drive folders'}
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{hasJobFolder ? 'fills in what is missing inside the job’s folder, and the links.' : 'makes the job’s folder under Jobs with Customer Pictures, Plans and Team only inside.'}</span>
          </div>
        ) : null}
        {madeWords ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {madeWords.line}
            {madeWords.hold ? <span style={{ display: 'block', color: 'var(--text-amber-800)', fontWeight: 600 }}>{madeWords.hold}</span> : null}
          </p>
        ) : null}
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
