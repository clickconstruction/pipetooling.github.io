/**
 * The Projects board's read (punch list #242): `list_project_board`, the one server read the
 * board, the leader's Dashboard line and the superintendent's phone card all stand on, so no
 * role's own RLS can make its number differ from another's. Narrowed by the gate, then the
 * stage checklists' count and the expected hours, assembled into cards worst first through
 * `projectPace`. `dayDetail` adds a payroll viewer's own read of each job's cost events, for the
 * dollars on a day's card; it is off while the Dashboard's line is closed, and every other viewer's
 * day reads the hours the server read already carries.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { useBidVsActualBurnInputs } from './useBidVsActualBurnInputs'
import { useStageChecklistStates } from './useStageChecklistStates'
import { useExpectedHours, type ExpectedHoursApi } from './useExpectedHours'
import { useLineBudgetSettings } from './useLineBudgetSettings'
import { checklistCountOf, isWorkingProject, projectPace, sortByPace, type ProjectPace } from '../lib/jobs/projectsBoard'
import { laborEventsOf, parseProjectBoardRead, valueEventsOf, type ProjectBoardJob, type ProjectBoardRead } from '../lib/jobs/projectBoardRead'
import type { SuperintendentLine } from '../lib/jobs/superintendentLine'
import type { JobChargeEvent, JobValueEvent } from '../lib/jobChargesTimeline'

/** The server's read: every Working job, or just these ids (the phone's one job). Throws its reason. */
export async function loadProjectBoardRead(jobIds?: readonly string[]): Promise<ProjectBoardRead> {
  const raw = await withSupabaseRetry(() => supabase.rpc('list_project_board', jobIds ? { p_job_ids: [...jobIds] } : {}), 'load project list')
  return parseProjectBoardRead(raw)
}

export type ProjectsBoardCard = {
  row: ProjectBoardJob
  pace: ProjectPace
  line: SuperintendentLine
  /** This viewer's day cards carry dollars: a payroll viewer whose read of this job has landed. */
  dollars: boolean
  events: readonly JobChargeEvent[]
  valueEvents: readonly JobValueEvent[]
}

export type ProjectsBoardState = {
  /** The projects, or null before the first read lands. */
  rows: ProjectBoardJob[] | null
  /** One card per project, worst first. */
  cards: ProjectsBoardCard[]
  targets: ExpectedHoursApi
  /** The project list is being read. */
  loading: boolean
  /** The project list's failed read, in its class and words. */
  failure: OfflineRecoveryLastError | null
  reload: () => void
}

export function useProjectsBoard({ dayDetail = true }: { dayDetail?: boolean } = {}): ProjectsBoardState {
  const [read, setRead] = useState<ProjectBoardRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let gone = false
    setLoading(true)
    loadProjectBoardRead()
      .then((r) => {
        if (gone) return
        setRead(r)
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

  const rows = useMemo(() => (read ? read.jobs.filter(isWorkingProject) : null), [read])
  const ids = useMemo(() => (rows ?? []).map((r) => r.id), [rows])
  const wantsDollars = Boolean(read?.readsWages) && dayDetail
  const burn = useBidVsActualBurnInputs(wantsDollars && ids.length > 0, ids)
  const checklists = useStageChecklistStates(ids, ids.length > 0)
  const targets = useExpectedHours(ids, ids.length > 0)
  const { settings } = useLineBudgetSettings()

  const cards = useMemo(() => {
    return sortByPace(
      (rows ?? []).map((row) => {
        const inputs = burn.inputsByJob.get(row.id)
        const ready = wantsDollars && inputs && inputs !== 'error' ? inputs : null
        const pace = projectPace({
          job: row,
          target: targets.byJob.get(row.id) ?? null,
          checklist: checklistCountOf(row.fixtures ?? [], checklists.questions, checklists.answersByFixture),
          settings,
        })
        return {
          row,
          pace,
          line: pace.line,
          dollars: ready != null,
          events: ready ? ready.chargeEvents : laborEventsOf(row),
          valueEvents: ready ? ready.valueEvents : valueEventsOf(row),
        }
      }),
    )
  }, [rows, burn.inputsByJob, wantsDollars, targets.byJob, checklists.questions, checklists.answersByFixture])

  return { rows, cards, targets, loading, failure, reload }
}
