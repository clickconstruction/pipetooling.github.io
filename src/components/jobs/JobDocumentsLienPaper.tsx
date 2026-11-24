import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { type JobLienPaper, type JobLienPaperRow, type LienPaperTab, jobLienPaperRows } from '../../lib/jobs/jobLienPaperRows'
import { loadJobLienPaper } from '../../lib/jobs/jobLienPaperIo'
import { lienReleaseChipColors, lienReleaseChips } from '../../lib/jobs/lienReleaseLifecycle'
import { isLienWaiverFormType, lienReleaseSnapshotToWaiverFields } from '../../lib/jobs/lienReleaseTracking'
import { lienReleaseRowSignatureWithInk } from '../../lib/jobs/lienReleaseInk'
import { buildLienWaiverPrintHtml } from '../../lib/jobsDocuments/lienWaiverRelease'
import { openHtmlWindowWhenReady } from '../../lib/jobsDocuments/printWindow'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { formatAiaMoney } from '../../lib/aiaG702G703Preview'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { useAuth } from '../../hooks/useAuth'
import { useTakenDown } from '../../hooks/useTakenDown'
import { useJobLienDeskEntry } from '../../hooks/useJobLienDeskEntry'
import { lienWindowDeskDoorHref } from '../../lib/lien/lienWindowDeskDoor'
import { useToastContext } from '../../contexts/ToastContext'
import LienInstrumentsModal from './LienInstrumentsModal'
import { documentsChip, documentsHeading, documentsLinkButton, documentsNum, documentsQuietButton, documentsTd } from './jobDocumentsStyles'
import { EmptyState } from '../EmptyState'

/** A plain date passes through; a timestamp becomes its Central day. */
const dayOf = (v: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : calendarYmdInAppTzFromIso(v))

/**
 * The Documents tab's lien paper (v2.4496): the notices and filings recorded on the job, its
 * demand letters and its releases of lien. A release opens the page as signed; a letter or a
 * filing opens the Lien window on the tab that holds it, where it can be viewed and tracked.
 *
 * The window is handed the job's place on the Lien desk (punch list #335): this section holds no desk, so the
 * window's header read *Draft the notice* at every step, over a notice already drafted, sent for approval or
 * printed. The desk is read for this job while the window is open (`useJobLienDeskEntry`), and the header's
 * button for a step worked on the desk leaves the job window for the desk's page, on the job (`onLeave`).
 */
export function JobDocumentsLienPaper({ job, onOverlayOpenChange, onLeave }: { job: JobWithDetails; onOverlayOpenChange?: (open: boolean) => void; /** Called before the window's door leaves for the Lien desk's page: the job window closes itself. */ onLeave?: () => void }) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const { user, profileName } = useAuth()
  const [paper, setPaper] = useState<JobLienPaper | null>(null)
  const [lienTab, setLienTab] = useState<LienPaperTab | null>(null)
  const deskEntry = useJobLienDeskEntry(job, lienTab != null)
  // Recording in the Lien window reads again and keeps nothing to stop that read: one that lands after the section is
  // taken down sets nothing (v2.7771).
  const takenDown = useTakenDown()

  const reload = useCallback(() => {
    let cancelled = false
    void loadJobLienPaper(job.id).then((p) => {
      if (!cancelled && !takenDown()) setPaper(p)
    })
    return () => {
      cancelled = true
    }
  }, [job.id, takenDown])

  useEffect(() => reload(), [reload])

  const rows = useMemo(() => (paper ? jobLienPaperRows(paper, dayOf) : null), [paper])

  const openLienWindow = (tab: LienPaperTab | null) => {
    setLienTab(tab)
    onOverlayOpenChange?.(tab != null)
  }

  const openRow = (row: JobLienPaperRow) => {
    if (row.kind !== 'release') {
      openLienWindow(row.tab)
      return
    }
    const rel = row.release
    const form = isLienWaiverFormType(rel.form_type) ? rel.form_type : 'conditional_progress'
    const jobNumber = effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
    // The page as signed, with the ink stored at signing.
    void openHtmlWindowWhenReady(async () => buildLienWaiverPrintHtml(form, lienReleaseSnapshotToWaiverFields(rel), jobNumber, await lienReleaseRowSignatureWithInk(rel))).then((ok) => {
      if (!ok) showToast('The browser blocked the new window. Allow pop-ups to view the release.', 'error')
    })
  }

  return (
    <section aria-labelledby="job-documents-lien" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h3 id="job-documents-lien" style={{ ...documentsHeading, flex: 1 }}>
          Lien paper
        </h3>
        <button type="button" style={documentsQuietButton} onClick={() => openLienWindow('demand')}>
          Lien window
        </button>
      </div>
      {rows == null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState compact main="No lien notice, demand letter or release is on this job." next={{ label: 'Lien window', onPress: () => openLienWindow('demand') }} tail="starts one." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.id}`} data-testid="job-documents-lien-row">
                  <td style={documentsTd}>
                    <button type="button" onClick={() => openRow(row)} style={documentsLinkButton}>
                      {row.title}
                    </button>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8125rem' }}>{row.detail}</span>
                    {row.kind === 'release'
                      ? lienReleaseChips(row.release).map((c) => (
                          <span key={c.label} style={{ ...documentsChip, ...lienReleaseChipColors(c.tone) }}>
                            {c.label}
                          </span>
                        ))
                      : null}
                    {row.kind === 'filing' && row.documentUrl ? (
                      <a href={row.documentUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '0.5rem', fontSize: '0.8125rem' }}>
                        Saved copy
                      </a>
                    ) : null}
                  </td>
                  <td style={{ ...documentsTd, ...documentsNum }}>{row.amount == null ? '' : formatAiaMoney(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LienInstrumentsModal
        open={lienTab != null}
        onClose={() => openLienWindow(null)}
        job={job}
        invoice={null}
        initialTab={lienTab ?? undefined}
        signerNameFallback={(profileName ?? '').trim()}
        authEmail={user?.email?.trim() ?? ''}
        // Punch list #335: where the job's notice and affidavit stand on the Lien desk, and the leader a paper sent for approval waits on.
        deskNotice={deskEntry.deskNotice}
        deskAffidavit={deskEntry.deskAffidavit}
        deskLeader={deskEntry.deskLeader}
        // The header's door for a step worked on the desk: this window and the job window close, and the desk's page opens on the job.
        onOpenLienDesk={(jobId, deskKind) => {
          openLienWindow(null)
          onLeave?.()
          navigate(lienWindowDeskDoorHref(jobId, deskKind))
        }}
        onLastWorkSaved={() => deskEntry.refetch()}
        onRecorded={() => {
          void reload()
          deskEntry.refetch()
        }}
      />
    </section>
  )
}

export default JobDocumentsLienPaper
