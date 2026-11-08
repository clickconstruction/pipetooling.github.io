/**
 * The Projects board's one read (punch list #242): what `list_project_board` answers, parsed,
 * and turned into the shapes the strip and the day card draw. The wages stay in the database;
 * the read carries hours per person per day and the money as a whole percent of the job's money
 * budget, the same for every role on the board, so the leader, the office and the superintendent
 * read one number. `readsWages` says only whether this viewer's own read of a day carries dollars
 * (a dev, the pay-approved master, the controller). Pure.
 */
import type { JobChargeEvent, JobValueEvent } from '../jobChargesTimeline'
import type { ProjectFixture, ProjectRow } from './projectsBoard'

export type ProjectLaborRow = { ymd: string; who: string; hours: number }
export type ProjectValueRow = { ymd: string; pct: number; kind: 'report' | 'manual' }

export type ProjectBoardJob = ProjectRow & {
  /** The Costs baseline's kind and hours; null with no baseline. */
  budgetKind: string | null
  budgetHours: number | null
  /** The planned finish frozen at award (punch list #234 PR 2), `YYYY-MM-DD`; null with none, or a function older than it. Optional, so a fixture built before it still fits. */
  plannedFinish?: string | null
  labor: ProjectLaborRow[]
  values: ProjectValueRow[]
  /** The blended spend as a whole percent of the money budget; null with no money budget. */
  spentPct: number | null
}

export type ProjectBoardRead = { readsWages: boolean; jobs: ProjectBoardJob[] }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseJob(raw: unknown): ProjectBoardJob | null {
  const j = obj(raw)
  const id = str(j.id)
  if (!id) return null
  return {
    id,
    hcp_number: str(j.hcp_number),
    click_number: str(j.click_number),
    job_name: str(j.job_name),
    job_address: str(j.job_address),
    status: str(j.status),
    pct_complete: num(j.pct_complete),
    revenue: num(j.revenue),
    // What the job's kind reads. A function older than these answers no `kind` at all, so the gate knows they never came.
    kind: j.kind === undefined ? undefined : str(j.kind),
    bid_id: str(j.bid_id),
    project_id: str(j.project_id),
    first_work_date: str(j.first_work_date),
    billing_only: j.billing_only === true,
    fixtures: arr(j.fixtures) as ProjectFixture[],
    budgetKind: str(j.budget_kind),
    budgetHours: num(j.budget_hours),
    plannedFinish: str(j.planned_finish),
    labor: arr(j.labor).flatMap((r) => {
      const l = obj(r)
      const ymd = str(l.ymd)
      const hours = num(l.hours)
      return ymd && hours != null && hours > 0 ? [{ ymd, who: str(l.who) ?? '', hours }] : []
    }),
    values: arr(j.values).flatMap((r) => {
      const v = obj(r)
      const ymd = str(v.ymd)
      const pct = num(v.pct)
      return ymd && pct != null ? [{ ymd, pct, kind: v.kind === 'manual' ? ('manual' as const) : ('report' as const) }] : []
    }),
    spentPct: num(j.spent_pct),
  }
}

export function parseProjectBoardRead(raw: unknown): ProjectBoardRead {
  const r = obj(raw)
  return { readsWages: r.reads_wages === true, jobs: arr(r.jobs).flatMap((j) => parseJob(j) ?? []) }
}

/** The job's hours on it, every person and every day. */
export function teamHoursOf(job: Pick<ProjectBoardJob, 'labor'>): number {
  return job.labor.reduce((s, l) => s + l.hours, 0)
}

/** The labor rows as the strip and the day card read them: hours, and no dollar, since none leaves the database. */
export function laborEventsOf(job: Pick<ProjectBoardJob, 'labor'>): JobChargeEvent[] {
  return job.labor.map((l) => ({ source: 'team_labor', dateKey: l.ymd, amount: 0, label: l.who, who: l.who, hours: l.hours }))
}

/** The percents as the day card reads them. */
export function valueEventsOf(job: Pick<ProjectBoardJob, 'values'>): JobValueEvent[] {
  return job.values.map((v) => ({ dateKey: v.ymd, percent: v.pct, label: '', kind: v.kind }))
}
