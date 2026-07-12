import { useCallback, useState } from 'react'
import { JobThreadNotesPanel } from '../JobThreadNotesPanel'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobsListCache } from '../../contexts/JobsListCacheContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { useJobThreadNotesForModal } from '../../hooks/useJobThreadNotesForModal'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { QuickfillJobClockSummary } from '../../lib/quickfillCompleteNoBill'
import type { JobWithDetails } from '../../types/jobWithDetails'

function formatShortDate(iso: string | null | undefined): string {
  const t = (iso ?? '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return '—'
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function clockSummaryLine(summary: QuickfillJobClockSummary | undefined): string {
  if (!summary || summary.sessionCount === 0) return 'No clock sessions'
  const hours =
    summary.totalHours > 0 ? ` · ${formatDecimalWorkHoursToHhMm(summary.totalHours)}` : ''
  const open = summary.hasOpenSession ? ' · on the clock now' : ''
  const sessions = `${summary.sessionCount} clock session${summary.sessionCount === 1 ? '' : 's'}`
  return `Started ${formatShortDate(summary.firstClockInAt)} · ${sessions}${hours}${open}`
}

/** Jobs resolved 100% complete (report % / Edit Job % complete) with no Total Bill set.
 * Inline list: work dates + clock rollup per job, expandable Job-Detail-style activity feed,
 * and an Edit job button to fill in the Total Bill. */
export function QuickfillCompleteNoBillSection({
  completeNoBillJobs,
  clockSummaryByJobId,
  jobsListBusy,
}: {
  completeNoBillJobs: JobWithDetails[]
  clockSummaryByJobId: Map<string, QuickfillJobClockSummary>
  jobsListBusy: boolean
}) {
  const { runFetchJobs } = useJobsListCache()
  const jobFormModal = useJobFormModal()
  const { showToast } = useToastContext()
  const { user: authUser, role: authRole, profileName } = useAuth()
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  // One thread-notes subscription at a time: the expanded row behaves exactly like Job Detail.
  const threadNotes = useJobThreadNotesForModal(expandedJobId, expandedJobId != null, {
    authUserId: authUser?.id,
    showToast,
    authorDisplayName: authUser?.id ? profileName : undefined,
  })

  const openEditJob = useCallback(
    (jobId: string) => {
      if (jobsListBusy) {
        showToast('Please wait until jobs finish loading.', 'info')
        return
      }
      jobFormModal?.openEditJob(jobId, { onSaved: () => void runFetchJobs(null) })
    },
    [jobsListBusy, jobFormModal, showToast, runFetchJobs],
  )

  return (
    <>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#374151' }}>
        Jobs marked <strong>100% complete</strong> (latest field report %, or the Edit Job{' '}
        <strong>% complete</strong> field when no report has one) with no <strong>Total Bill</strong>{' '}
        set. Open a job to fill in the Total Bill so it can be billed.
      </p>
      {completeNoBillJobs.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          No complete jobs are missing a Total Bill.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {completeNoBillJobs.map((j) => {
            const num = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
            const name = (j.job_name ?? '').trim()
            const addr = (j.job_address ?? '').trim()
            const summary = clockSummaryByJobId.get(j.id)
            const expanded = expandedJobId === j.id
            const workDatesTitle =
              summary && summary.workDates.length > 0
                ? `Work dates: ${summary.workDates.join(', ')}`
                : undefined
            return (
              <div
                key={j.id}
                style={{
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  borderRadius: 8,
                  padding: '0.6rem 0.75rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#7f1d1d' }}>
                      {num}
                      {name ? ` · ${name}` : ''}
                    </div>
                    {addr ? (
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{addr}</div>
                    ) : null}
                    <div
                      title={workDatesTitle}
                      style={{ fontSize: '0.8125rem', color: '#374151', marginTop: '0.15rem' }}
                    >
                      {clockSummaryLine(summary)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => openEditJob(j.id)}
                      title="Open Edit Job to set the Total Bill"
                      style={{
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: '1px solid #fecaca',
                        background: 'white',
                        color: '#b91c1c',
                      }}
                    >
                      Edit job
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedJobId(expanded ? null : j.id)}
                      aria-expanded={expanded}
                      title="Show the job's activity history"
                      style={{
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        color: '#374151',
                      }}
                    >
                      Activity {expanded ? '▴' : '▾'}
                    </button>
                  </div>
                </div>
                {expanded ? (
                  <div
                    style={{
                      marginTop: '0.6rem',
                      borderTop: '1px solid #fecaca',
                      paddingTop: '0.6rem',
                      background: 'white',
                      borderRadius: 6,
                      padding: '0.6rem',
                    }}
                  >
                    <JobThreadNotesPanel
                      activity={threadNotes.activity}
                      loading={threadNotes.loading}
                      canPost={threadNotes.canPost}
                      draft={threadNotes.draft}
                      onDraftChange={threadNotes.setDraft}
                      onSubmit={() => void threadNotes.submitNote()}
                      submitting={threadNotes.submitting}
                      showSectionTitle={false}
                      showEmptyPlaceholder={false}
                      showComposerLabel={false}
                      viewerRole={authRole as UserRole | null}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
