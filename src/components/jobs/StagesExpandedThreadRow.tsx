/**
 * The expanded notes-thread row under a Pipeline job row (Stages tab decomposition PR 9,
 * v2.3541). The same `<tr>` was pasted three times — the job table, and both row kinds of
 * the unified table — differing only in the job variable and the column count. The caller
 * keeps the `expandedJobThreadId === job.id` gate; the tables build the shared inputs once.
 */
import { JobsStagesThreadPanel } from './JobsStagesThreadPanel'
import type { JobsStagesTableProps } from './JobsStagesTable'
import { renderStagesExpandedRowPanel, renderStagesThreadFullscreenJobHeader } from './jobsStagesRowShared'
import type { JobWithDetails } from '../../types/jobWithDetails'

export type StagesExpandedThreadRowShared = Pick<
  JobsStagesTableProps,
  | 'jobThreadActivityByJobId'
  | 'jobThreadNotesLoadingId'
  | 'stagesUpcomingByJobId'
  | 'authRole'
  | 'authUser'
  | 'submitJobThreadNoteWithBody'
  | 'jobThreadFullscreen'
  | 'setJobThreadFullscreen'
  | 'canEditJobPctComplete'
  | 'pctCompleteSavingId'
  | 'commitStagesPctWithNote'
  | 'canManageJobPeople'
  | 'setManageJobPeople'
>

export function StagesExpandedThreadRow({
  job,
  colSpan,
  jobThreadActivityByJobId,
  jobThreadNotesLoadingId,
  stagesUpcomingByJobId,
  authRole,
  authUser,
  submitJobThreadNoteWithBody,
  jobThreadFullscreen,
  setJobThreadFullscreen,
  canEditJobPctComplete,
  pctCompleteSavingId,
  commitStagesPctWithNote,
  canManageJobPeople,
  setManageJobPeople,
}: StagesExpandedThreadRowShared & { job: JobWithDetails; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        style={{
          padding: '0.5rem 0.75rem',
          background: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {renderStagesExpandedRowPanel(
          <JobsStagesThreadPanel
            job={job}
            activity={jobThreadActivityByJobId[job.id] ?? []}
            loading={jobThreadNotesLoadingId === job.id}
            upcoming={stagesUpcomingByJobId[job.id] ?? null}
            viewerRole={authRole}
            {...(authUser ? { submitNoteWithBody: submitJobThreadNoteWithBody } : {})}
            fullscreen={jobThreadFullscreen}
            onToggleFullscreen={() => setJobThreadFullscreen(!jobThreadFullscreen)}
            fullscreenHeader={renderStagesThreadFullscreenJobHeader(job)}
            pctComplete={job.pct_complete ?? null}
            canEditPct={canEditJobPctComplete}
            pctSaving={pctCompleteSavingId === job.id}
            onCommitPct={(value, note) => commitStagesPctWithNote(job.id, value, note)}
            teamMembers={job.team_members?.map((t) => ({ user_id: t.user_id, name: t.users?.name ?? null })) ?? []}
            {...(canManageJobPeople
              ? {
                  peopleAction: {
                    onClick: () =>
                      setManageJobPeople({
                        jobId: job.id,
                        jobLabel: `${(job.hcp_number ?? '').trim() || '—'} · ${(job.job_name ?? '').trim() || 'Job'}`,
                        currentTeamUserIds: job.team_members?.map((t) => t.user_id) ?? [],
                      }),
                  },
                }
              : {})}
          />,
        )}
      </td>
    </tr>
  )
}
