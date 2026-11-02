import { useMemo, type CSSProperties } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { pageGate } from '../lib/roleGate'
import OfflineRetryPanel from '../components/OfflineRetryPanel'
import { EmptyState } from '../components/EmptyState'
import { emptyWords, emptyWordsWithPress } from '../lib/emptyWords'
import { useProjectsBoard } from '../hooks/useProjectsBoard'
import { changeWords } from '../lib/jobs/expectedHours'
import { canSeeProjectsBoard, canSetExpectedHours, projectLabel } from '../lib/jobs/projectsBoard'
import { ProjectCard } from '../components/projectsBoard/ProjectCard'

/**
 * The Projects board (punch list #242, PR 3), `/projects-board`: every working project as one
 * card for the leader, the superintendents and the office — the pace strip as the labor budget
 * filled by the job's real days and divided by its stages, the expected hours as a slider in the
 * budget's range with its reason, the Recent changes strip with Undo, and the card large on a
 * press. The door is the Projects press beside Forecast on the Pipeline. The read and the cards
 * are `useProjectsBoard` (PR 6), the same the Dashboard's Projects strip draws.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }

export default function ProjectsBoard() {
  const { loading: authLoading, user, role } = useAuth()
  // `?job=<id>` from the Costs tab's Where we are card: that project opens large on arrival (PR 5).
  const [params] = useSearchParams()
  const focusJob = params.get('job')
  const board = useProjectsBoard()
  const { rows, cards, targets, loading, failure, reload } = board

  const gate = pageGate({ loading: authLoading, user, role }, canSeeProjectsBoard)
  const canEdit = canSetExpectedHours(role)
  const rowsById = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows])
  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />

  const nameOf = (jobId: string) => {
    const r = rowsById.get(jobId)
    return r ? projectLabel(r) : 'a project'
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem', display: 'grid', gap: '1rem' }} data-testid="projects-board">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Projects · where each one stands</h1>
          <p style={{ ...muted, margin: '0.2rem 0 0' }}>Every working project, worst first. The strip is the labor budget, filled by the real days. {canEdit ? 'Slide the expected hours to set the target, and say why.' : 'The expected hours under a strip are the target the office set, with its reason.'}</p>
        </div>
        <span style={muted}>{rows ? `${rows.length} project${rows.length === 1 ? '' : 's'}` : loading ? 'reading…' : ''}</span>
      </div>
      {targets.history.length ? (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} data-testid="targets-history">
          <span style={{ fontWeight: 600 }}>Recent changes</span>
          {targets.history.slice(0, 4).map((h) => (
            <span key={`${h.kind}-${h.id}-${h.at}`} style={muted}>
              {nameOf(h.jobId)} · {changeWords(h)}
            </span>
          ))}
          {canEdit && targets.undo ? <button type="button" style={{ ...link, marginLeft: 'auto' }} onClick={() => void targets.undoLatest()}>Undo the last change</button> : null}
        </div>
      ) : null}
      {targets.error ? <p role="alert" style={{ color: 'var(--text-red-700)', margin: 0, fontSize: '0.85rem' }}>{targets.error}</p> : null}
      {failure ? <OfflineRetryPanel failure={failure} onRetry={reload} surface="projects-board" idempotent busy={loading} /> : null}
      {focusJob && rows && !rows.some((r) => r.id === focusJob) ? <p data-testid="focus-missing" style={{ ...muted, margin: 0 }}>The job you came from is not on the board. A job lands here when it is Working with a stage In order, or priced at $25,000 and up.</p> : null}
      {rows && rows.length === 0 ? <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'working projects', page: { label: 'Open the Pipeline', tail: 'and set a job Working with its stages.' } }), { to: '/jobs?tab=stages' })} /> : null}
      {cards.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '0.75rem' }} data-testid="project-cards">
          {cards.map((c) => (
            <ProjectCard
              key={c.row.id}
              row={c.row}
              pace={c.pace}
              target={targets.byJob.get(c.row.id) ?? null}
              events={c.events}
              valueEvents={c.valueEvents}
              loading={c.loading}
              failed={c.failed}
              canEdit={canEdit}
              initiallyOpen={c.row.id === focusJob}
              onSetTarget={(hours, from, why) => targets.setTarget(c.row.id, hours, from, why)}
              onClearTarget={() => targets.clearTarget(c.row.id)}
            />
          ))}
        </div>
      ) : null}
      <p style={{ ...muted, margin: 0 }}>A project is a working job with a stage In order, or priced at $25,000 and up.</p>
    </div>
  )
}
