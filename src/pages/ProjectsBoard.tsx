import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { pageGate } from '../lib/roleGate'
import { withSupabaseRetry } from '../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import OfflineRetryPanel from '../components/OfflineRetryPanel'
import { EmptyState } from '../components/EmptyState'
import { emptyWords, emptyWordsWithPress } from '../lib/emptyWords'
import { useBidVsActualBurnInputs } from '../hooks/useBidVsActualBurnInputs'
import { useJobBudgetRows } from '../hooks/useJobBudgetRows'
import { useStageChecklistStates } from '../hooks/useStageChecklistStates'
import { useExpectedHours } from '../hooks/useExpectedHours'
import { DEFAULT_LINE_BUDGET_SETTINGS } from '../lib/jobs/lineBudgets'
import { readTargetMarginPct } from '../lib/jobs/jobBurnForVerdict'
import { changeWords } from '../lib/jobs/expectedHours'
import { canSeeProjectsBoard, canSetExpectedHours, checklistCountOf, isWorkingProject, projectLabel, projectPace, sortByPace, type ProjectRow } from '../lib/jobs/projectsBoard'
import { ProjectCard } from '../components/projectsBoard/ProjectCard'

/**
 * The Projects board (punch list #242, PR 3), `/projects-board`: every working project as one
 * card for the leader, the superintendents and the office — the pace strip as the labor budget
 * filled by the job's real days and divided by its stages, the expected hours as a slider in the
 * budget's range with its reason, the Recent changes strip with Undo, and the card large on a
 * press. The door is the Projects press beside Forecast on the Pipeline. The numbers are
 * `projectPace` (`lib/jobs/projectsBoard.ts`), the same the superintendent's phone reads.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8rem' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.8rem' }

const SELECT = 'id, hcp_number, click_number, job_name, job_address, status, pct_complete, revenue, fixtures:jobs_ledger_fixtures(id, name, stage_kind, line_kind, line_unit_price, count, progress_pct, sequence_order)'

async function loadWorkingProjects(): Promise<ProjectRow[]> {
  const rows = await withSupabaseRetry(
    () => supabase.from('jobs_ledger').select(SELECT).eq('status', 'working').order('hcp_number', { ascending: false }).limit(300),
    'load the projects',
  )
  return ((rows ?? []) as unknown as ProjectRow[]).filter(isWorkingProject)
}

export default function ProjectsBoard() {
  const { loading: authLoading, user, role } = useAuth()
  const [rows, setRows] = useState<ProjectRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let gone = false
    setLoading(true)
    loadWorkingProjects()
      .then((r) => {
        if (gone) return
        setRows(r)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (!gone) setFailure(recoveryFailureFromError(e, 'The projects could not be read.'))
      })
      .finally(() => {
        if (!gone) setLoading(false)
      })
    return () => {
      gone = true
    }
  }, [tick])

  const ids = useMemo(() => (rows ?? []).map((r) => r.id), [rows])
  const burn = useBidVsActualBurnInputs(ids.length > 0, ids)
  const budgets = useJobBudgetRows(ids, ids.length > 0)
  const checklists = useStageChecklistStates(ids, ids.length > 0)
  const targets = useExpectedHours(ids, ids.length > 0)

  const gate = pageGate({ loading: authLoading, user, role }, canSeeProjectsBoard)
  if (gate === 'wait') return null
  if (gate === 'away') return <Navigate to="/dashboard" replace />
  const canEdit = canSetExpectedHours(role)

  const settings = DEFAULT_LINE_BUDGET_SETTINGS
  const margin = readTargetMarginPct()
  const cards = sortByPace(
    (rows ?? []).map((row) => {
      const inputs = burn.inputsByJob.get(row.id)
      const ready = inputs && inputs !== 'error' ? inputs : null
      const pace = projectPace({
        row,
        budgetRow: budgets.get(row.id),
        burn: ready ? { chargeEvents: ready.chargeEvents, teamHours: ready.teamHours, revenue: ready.revenue } : null,
        target: targets.byJob.get(row.id) ?? null,
        checklist: checklistCountOf(row.fixtures ?? [], checklists.questions, checklists.answersByFixture),
        settings,
        targetMarginPct: margin,
      })
      return { row, pace, line: pace.line, loading: inputs == null, failed: inputs === 'error', events: ready?.chargeEvents ?? [], valueEvents: ready?.valueEvents ?? [] }
    }),
  )
  const nameOf = (jobId: string) => {
    const r = rows?.find((x) => x.id === jobId)
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
