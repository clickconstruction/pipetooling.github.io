/**
 * The Projects board's one read (punch list #242, PR 6): every Working job with its lines,
 * filtered by the gate, with the Costs tab's bulk cost read, the budget rows, the stage
 * checklists' count and the expected hours, assembled into cards worst first through
 * `projectPace`. The board page and the Dashboard's Projects strip both call this, so the two
 * never disagree about a project. Lifted out of `pages/ProjectsBoard.tsx` (v2.6330).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { useBidVsActualBurnInputs } from './useBidVsActualBurnInputs'
import { useJobBudgetRows } from './useJobBudgetRows'
import { useStageChecklistStates } from './useStageChecklistStates'
import { useExpectedHours, type ExpectedHoursApi } from './useExpectedHours'
import { DEFAULT_LINE_BUDGET_SETTINGS } from '../lib/jobs/lineBudgets'
import { readTargetMarginPct } from '../lib/jobs/jobBurnForVerdict'
import { checklistCountOf, isWorkingProject, projectPace, sortByPace, type ProjectPace, type ProjectRow } from '../lib/jobs/projectsBoard'
import type { SuperintendentLine } from '../lib/jobs/superintendentLine'
import type { JobChargeEvent, JobValueEvent } from '../lib/jobChargesTimeline'

// The five budget columns of #234's PR 1 ride the fixture read (PR 5), so a line the owner tuned moves its stage's share.
const SELECT = 'id, hcp_number, click_number, job_name, job_address, status, pct_complete, revenue, fixtures:jobs_ledger_fixtures(id, name, stage_kind, line_kind, line_unit_price, count, progress_pct, sequence_order, budget_labor_pct, budget_materials_pct, budget_source, budget_tuned_at, budget_rate_usd)'

async function loadWorkingProjects(): Promise<ProjectRow[]> {
  const rows = await withSupabaseRetry(
    () => supabase.from('jobs_ledger').select(SELECT).eq('status', 'working').order('hcp_number', { ascending: false }).limit(300),
    'load project list',
  )
  return ((rows ?? []) as unknown as ProjectRow[]).filter(isWorkingProject)
}

export type ProjectsBoardCard = {
  row: ProjectRow
  pace: ProjectPace
  line: SuperintendentLine
  /** The job's cost events are still loading. */
  loading: boolean
  /** The job's cost read failed. */
  failed: boolean
  events: readonly JobChargeEvent[]
  valueEvents: readonly JobValueEvent[]
}

export type ProjectsBoardState = {
  /** The projects, or null before the first read lands. */
  rows: ProjectRow[] | null
  /** One card per project, worst first. */
  cards: ProjectsBoardCard[]
  targets: ExpectedHoursApi
  /** The project list is being read. */
  loading: boolean
  /** The project list's failed read, in its class and words. */
  failure: OfflineRecoveryLastError | null
  reload: () => void
}

export function useProjectsBoard(enabled = true): ProjectsBoardState {
  const [rows, setRows] = useState<ProjectRow[] | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!enabled) return
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
  }, [tick, enabled])

  const ids = useMemo(() => (rows ?? []).map((r) => r.id), [rows])
  const burn = useBidVsActualBurnInputs(enabled && ids.length > 0, ids)
  const budgets = useJobBudgetRows(ids, enabled && ids.length > 0)
  const checklists = useStageChecklistStates(ids, enabled && ids.length > 0)
  const targets = useExpectedHours(ids, enabled && ids.length > 0)

  const cards = useMemo(() => {
    const settings = DEFAULT_LINE_BUDGET_SETTINGS
    const margin = readTargetMarginPct()
    return sortByPace(
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
  }, [rows, burn.inputsByJob, budgets, targets.byJob, checklists.questions, checklists.answersByFixture])

  return { rows, cards, targets, loading, failure, reload }
}
