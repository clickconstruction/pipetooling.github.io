/**
 * GC mode, the real build, the schedule's PR 7b: the Schedule window (call 1 of the plan,
 * to-dos/gc-mode/mockups/schedule-pr7.md on branch spike/gc-mode). A dev's **Schedule** on a project's
 * card opens it at `schedule=<projectId>`, the way the plans, the questions and the change orders open
 * theirs. It frames the schedule's body (`GcSchedule`), which reads the job's schedule over the board
 * the page already holds. A dev's only until the schedule's PR 10 opens it to the team (G-133); a dev moves a bar
 * in it since PR 8a, each move with why it moved. Since PR 9d, `canPull` adds Pull earlier and Days back (a dev's while
 * Building is built, since they read its submittals and RFIs).
 */
import { useEffect } from 'react'
import type { ScheduleReads } from '../../lib/gc/scheduleIo'
import type { GcProject, GcState } from '../../lib/gc/types'
import { GcSchedule } from './GcSchedule'

export function GcScheduleWindow({
  state,
  project,
  by,
  canMove = false,
  canPull = false,
  reads,
  onClose,
}: {
  state: GcState
  project: GcProject
  by: string
  canMove?: boolean
  canPull?: boolean
  /** What this reader may read over the schedule (PR 16), memoized by the page. */
  reads?: ScheduleReads
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(0.75rem + var(--app-top-chrome, 0px)) 0.75rem 0.75rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${project.name}: the schedule`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(1240px, 100%)', maxHeight: 'min(94vh, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-strong)' }}
      >
        <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{project.name} · the schedule</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              What each trade does when, and what waits on what. {canMove ? 'Drag a bar to move it. Every move is saved with why it moved.' : 'Nothing moves here.'}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.3rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem 0.4rem' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '0.8rem 1rem', overflowY: 'auto' }}>
          <GcSchedule state={state} projectId={project.id} by={by} canMove={canMove} canPull={canPull} {...(reads ? { reads } : {})} />
        </div>
      </div>
    </div>
  )
}
