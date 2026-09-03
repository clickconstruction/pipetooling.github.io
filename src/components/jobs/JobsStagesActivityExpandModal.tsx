import { useEffect } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRole } from '../../hooks/useAuth'
import type { JobThreadActivityItem } from '../JobThreadNotesPanel'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { JobActivityView } from './JobActivityView'
import { renderStagesThreadFullscreenJobHeader } from './jobsStagesRowShared'
import { useSessionNotesOpener } from './sessionNotesOpenerContext'
import type { StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'

/**
 * Floating Job activity modal — the shell only. Everything inside it is
 * {@link JobActivityView}, the same body the expanded row's panel renders
 * (v2.1673), so the two can no longer drift apart.
 *
 * Opened by the activity box's corner expand button and the row's "N Reports"
 * chip. Closed by ✕, Escape, or the backdrop; Escape while typing first blurs
 * the composer (draft kept) so a stray key never eats an unfinished note.
 * Below 700px the card drops its inset and rounding and goes edge to edge —
 * the whole screen is the card on a phone.
 */

type Props = {
  job: JobWithDetails
  /** Raw thread activity (all kinds); null while the lazy load is in flight. */
  activity: JobThreadActivityItem[] | null
  upcoming: StagesUpcomingAppointment | null
  onClose: () => void
  /** Same thread-note pipeline as the box; absent → read-only (no composer). */
  submitNoteWithBody?: (jobId: string, body: string, source: 'draft' | 'stamp') => Promise<boolean>
  viewerRole?: UserRole | null
  /** Pipeline % complete (jobs_ledger.pct_complete); null when never set. */
  pctComplete?: number | null
  canEditPct?: boolean
  pctSaving?: boolean
  /** Commits a new percent + note (the tab's commitStagesPctWithNote). */
  onCommitPct?: (value: number, note: string) => void | Promise<void>
  /** People assigned to the job (jobs_ledger_team_members). */
  teamMembers?: Array<{ user_id: string; name: string | null }>
  /** Opens the add/remove-people modal (editors only; it stacks above at z 1002). */
  peopleAction?: { onClick: () => void }
}

export function JobsStagesActivityExpandModal({
  job,
  activity,
  upcoming,
  onClose,
  submitNoteWithBody,
  viewerRole,
  pctComplete,
  canEditPct,
  pctSaving,
  onCommitPct,
  teamMembers,
  peopleAction,
}: Props) {
  const narrow = useMatchMedia('(max-width: 700px)')
  const jobName = (job.job_name ?? '').trim() || 'this job'

  // A fixed full-viewport overlay — lock the page behind it (ref-counted, same
  // hook the thread panel's fullscreen mode uses) or phones keep scrolling the
  // Pipeline underneath the card.
  useBodyScrollLock(true)
  // Per-job door into Session notes (null for roles that can't open it).
  const sessionNotesOpener = useSessionNotesOpener()

  // Escape anywhere in the modal closes it; the composer's own Escape handler
  // stops propagation before this listener sees it (blur-first behavior).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Job activity for ${jobName}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: narrow ? 0 : '1.5rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: narrow ? 0 : 14,
          width: '100%',
          height: '100%',
          maxWidth: narrow ? 'none' : 980,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: narrow ? 'none' : '0 24px 70px rgba(0,0,0,0.45)',
          overflow: 'hidden',
          // Edge-to-edge on phones (v2.1747): keep the header out from under the
          // status bar and the composer above the home indicator (panel idiom).
          paddingTop: narrow ? 'env(safe-area-inset-top, 0px)' : 0,
          paddingBottom: narrow ? 'env(safe-area-inset-bottom, 0px)' : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0.8rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>{renderStagesThreadFullscreenJobHeader(job)}</div>
          {sessionNotesOpener ? (
            <button
              type="button"
              onClick={() => sessionNotesOpener(job)}
              title="Every clock session on this job, one line each — Session notes"
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'var(--bg-blue-tint)',
                color: 'var(--text-link)',
                border: '1px solid var(--border-blue)',
                borderRadius: 999,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Sessions
            </button>
          ) : null}
          {narrow ? null : (
            <span style={{ color: 'var(--text-faint)', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>esc to close</span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close job activity"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.05rem',
              cursor: 'pointer',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <JobActivityView
          job={job}
          activity={activity}
          upcoming={upcoming}
          viewerRole={viewerRole}
          narrow={narrow}
          reportsOpenByDefault
          {...(submitNoteWithBody ? { submitNoteWithBody } : {})}
          pctComplete={pctComplete ?? null}
          canEditPct={canEditPct ?? false}
          pctSaving={pctSaving ?? false}
          {...(onCommitPct ? { onCommitPct } : {})}
          {...(teamMembers ? { teamMembers } : {})}
          {...(peopleAction ? { peopleAction } : {})}
        />
      </div>
    </div>
  )
}
