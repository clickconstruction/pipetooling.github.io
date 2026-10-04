import { Fragment, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { formatAiaDate } from '../../lib/aiaG702G703Template'
import { formatAiaMoney } from '../../lib/aiaG702G703Preview'
import { type SavedPayApplication, carryMismatch } from '../../lib/aiaPayApplications'
import { loadPayApplications } from '../../lib/aiaPayApplicationsIo'
import { jobDocumentFolderLinks } from '../../lib/jobs/jobDocumentsTab'
import AiaG702G703Modal from './AiaG702G703Modal'

/**
 * The job window's Documents tab (v2.4491): the job's pay applications, each with the link to the
 * file that was sent, and the job's folders. A row opens the AIA G702-G703 window on that
 * application; the window sits above the job window and the list reloads when it closes.
 */

/** One step above the job window's overlay (1010) and its form's nested overlays. */
const AIA_FROM_JOB_WINDOW_Z_INDEX = 1030

const th: CSSProperties = { textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.875rem', verticalAlign: 'middle' }
const num: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-strong)' }
const quietButton: CSSProperties = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem', borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)' }

export function JobWindowDocumentsTab({ job, onAiaOpenChange }: { job: JobWithDetails; onAiaOpenChange?: (open: boolean) => void }) {
  const [apps, setApps] = useState<SavedPayApplication[] | null>(null)
  // null = closed; 'new' = a new application; a number = that saved application.
  const [aia, setAia] = useState<number | 'new' | null>(null)

  const reload = useCallback(() => {
    let cancelled = false
    void loadPayApplications(job.id)
      .catch(() => [] as SavedPayApplication[])
      .then((list) => {
        if (!cancelled) setApps(list)
      })
    return () => {
      cancelled = true
    }
  }, [job.id])

  useEffect(() => reload(), [reload])

  const openAia = (which: number | 'new') => {
    setAia(which)
    onAiaOpenChange?.(true)
  }
  const closeAia = () => {
    setAia(null)
    onAiaOpenChange?.(false)
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
        ) : apps.length === 0 ? (
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
                    <th style={th}>File</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app) => {
                    const mismatch = carryMismatch(app.fields, app.applicationNumber, apps)
                    return (
                    <Fragment key={app.id}>
                    <tr data-testid="job-documents-pay-app">
                      <td style={{ ...td, fontWeight: 700 }}>{app.applicationNumber}</td>
                      <td style={td}>{formatAiaDate(app.periodTo) || '—'}</td>
                      <td style={{ ...td, ...num }}>{formatAiaMoney(app.currentPaymentDue)}</td>
                      <td style={td}>
                        {app.link ? (
                          <a href={app.link} target="_blank" rel="noopener noreferrer">
                            Open the file
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>No link</span>
                        )}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button type="button" onClick={() => openAia(app.applicationNumber)} style={quietButton} aria-label={`Open application ${app.applicationNumber}`}>
                          Open
                        </button>
                      </td>
                    </tr>
                    {mismatch ? (
                      <tr data-testid="job-documents-pay-app-flag">
                        <td colSpan={5} style={{ ...td, paddingTop: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
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
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Retainage held as of application {apps[apps.length - 1]!.applicationNumber}: {formatAiaMoney(held)}
            </p>
          </>
        )}
      </section>

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
        zIndex={AIA_FROM_JOB_WINDOW_Z_INDEX}
      />
    </div>
  )
}

export default JobWindowDocumentsTab
