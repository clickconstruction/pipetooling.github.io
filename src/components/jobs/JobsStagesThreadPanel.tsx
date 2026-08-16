import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { UserRole } from '../../hooks/useAuth'
import type { JobThreadActivityItem } from '../JobThreadNotesPanel'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { JobActivityView } from './JobActivityView'
import type { StagesUpcomingAppointment } from '../../lib/stagesUpcomingSchedule'

/**
 * The Pipeline row's expanded Job activity panel (v2.1673) — inline in the row,
 * or full screen when the header's expand button is on.
 *
 * It used to be `JobThreadNotesPanel`, which rendered its own unnumbered
 * two-lines-per-item feed; now both shells render {@link JobActivityView}, the
 * same body the floating modal shows. Owner call: "the full panel should have
 * numbers too and be like the Floating modal." `JobThreadNotesPanel` still
 * serves Job Detail, Job Mode and Quickfill unchanged.
 *
 * The fullscreen portal is required: inline, the Stages table's position:sticky
 * wrapper traps a fixed overlay in a low stacking context and the app chrome
 * paints over it. z 1001 sits above the top bar (50) and the mobile bottom nav
 * (1000), below the modals it can spawn (people / schedule at 1002).
 */

const INLINE_SHELL: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 'min(460px, 62vh)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  overflow: 'hidden',
  paddingTop: '0.25rem',
}

const FULLSCREEN_SHELL: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1001,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--surface)',
  paddingTop: 'env(safe-area-inset-top)',
  paddingBottom: 'env(safe-area-inset-bottom)',
  overflow: 'hidden',
}

export type JobsStagesThreadPanelProps = {
  job: JobWithDetails
  /** Raw thread activity (all kinds). */
  activity: JobThreadActivityItem[]
  /** True while this job's thread is loading — the feed shows its own placeholder. */
  loading: boolean
  upcoming: StagesUpcomingAppointment | null
  viewerRole?: UserRole | null
  /** Absent (or signed out) → read-only, no composer. */
  submitNoteWithBody?: (jobId: string, body: string, source: 'draft' | 'stamp') => Promise<boolean>
  fullscreen: boolean
  onToggleFullscreen: () => void
  /** Job number / service type / name / address; shown only while fullscreen. */
  fullscreenHeader: ReactNode
  pctComplete?: number | null
  canEditPct?: boolean
  pctSaving?: boolean
  onCommitPct?: (value: number, note: string) => void | Promise<void>
  teamMembers?: Array<{ user_id: string; name: string | null }>
  peopleAction?: { onClick: () => void; disabled?: boolean }
}

export function JobsStagesThreadPanel({
  job,
  activity,
  loading,
  upcoming,
  viewerRole,
  submitNoteWithBody,
  fullscreen,
  onToggleFullscreen,
  fullscreenHeader,
  pctComplete,
  canEditPct,
  pctSaving,
  onCommitPct,
  teamMembers,
  peopleAction,
}: JobsStagesThreadPanelProps) {
  // Inline the panel spans the whole row (colSpan = every column), so both
  // shells are as wide as the viewport and share one breakpoint.
  const narrow = useMatchMedia('(max-width: 700px)')

  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onToggleFullscreen()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [fullscreen, onToggleFullscreen])

  /**
   * Lock the page behind the overlay (matters on phones — the reason fullscreen
   * exists). The shared hook is reference-counted, which this surface needs: a
   * billed job mounts the panel TWICE (its job row and its invoice row), so two
   * locks are live at once. The old panel hand-rolled save/restore instead, and
   * the second instance restored the first's 'hidden' — leaving the page
   * unscrollable until reload. Caught live on the Pipeline (v2.1673).
   */
  useBodyScrollLock(fullscreen)

  const content = (
    <div style={fullscreen ? FULLSCREEN_SHELL : INLINE_SHELL}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: fullscreen ? '0.7rem 0.9rem' : '0 0.9rem',
          ...(fullscreen ? { borderBottom: '1px solid var(--border)' } : null),
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {fullscreen ? (
            fullscreenHeader
          ) : (
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Job activity / notes</span>
          )}
        </div>
        {fullscreen ? (
          <span style={{ color: 'var(--text-faint)', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>esc to close</span>
        ) : null}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={fullscreen ? 'Exit full screen' : 'Expand to full screen'}
          aria-label={fullscreen ? 'Exit full screen' : 'Expand activity to full screen'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            flexShrink: 0,
            padding: 0,
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            background: 'var(--surface)',
            color: 'var(--text-link)',
            cursor: 'pointer',
          }}
        >
          {fullscreen ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />}
        </button>
      </div>

      <JobActivityView
        job={job}
        activity={loading ? null : activity}
        upcoming={upcoming}
        viewerRole={viewerRole}
        narrow={narrow}
        reportsOpenByDefault={fullscreen}
        {...(submitNoteWithBody ? { submitNoteWithBody } : {})}
        pctComplete={pctComplete ?? null}
        canEditPct={canEditPct ?? false}
        pctSaving={pctSaving ?? false}
        {...(onCommitPct ? { onCommitPct } : {})}
        {...(teamMembers ? { teamMembers } : {})}
        {...(peopleAction ? { peopleAction } : {})}
      />
    </div>
  )

  return fullscreen ? createPortal(content, document.body) : content
}
