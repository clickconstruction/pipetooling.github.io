/**
 * Jobs → Subs → Work (v2.2927): the Work Orders board regrouped by job, with
 * stages beside sheets. A stage is a line item with a window; it becomes a row
 * of its own until a work order fulfils it, at which point it rides on that
 * order's sheet row (the order carries `stage_window_id`).
 *
 * Groups come from the union of jobs with a sub sheet in play and jobs with a
 * stage window — a job with neither never appears. Pure.
 */
import type { WorkOrderBoardRow } from '../subWorkOrders/workOrderBoardRows'
import { stageWindowSpan, type StageWindowLike, type StageWindowSpan } from './stageWindow'
import type { StageKind } from '../jobs/stagePlan'

export type SubsFixtureLike = { id: string; job_id: string; name: string; count: number; line_unit_price: number | null; sequence_order: number; stage_kind?: StageKind | null; shared_with_gc?: boolean }
export type SubsJobLike = { id: string; hcp_number: string; customer_name: string | null; job_address: string | null }

/** Stage Plan PR 4: `kind` and `shared` (the eye) ride along from the line item. */
export type SubsStage = { id: string; name: string; amount: number; sequence: number; kind: StageKind | null; shared: boolean }

export type SubsStageRow = {
  key: string
  kind: 'stage'
  jobId: string
  stage: SubsStage
  window: StageWindowLike
  span: StageWindowSpan | null
  board: null
}
export type SubsSheetRow = {
  key: string
  kind: 'sheet'
  jobId: string | null
  stage: SubsStage | null
  window: StageWindowLike | null
  span: StageWindowSpan | null
  board: WorkOrderBoardRow
}
export type SubsRow = SubsStageRow | SubsSheetRow

export type SubsJobGroup = {
  key: string
  jobId: string | null
  jobNumber: string
  primary: string
  secondary: string | null
  rows: SubsRow[]
  /** Rows the office owes a move: stages with no order yet, sheets with nothing signed. */
  attention: number
  /** Line items on the job not yet read as a stage — the "Add a stage…" choices. */
  freeFixtures: SubsStage[]
}

export type SubsTabCounts = {
  /** Stage rows: a window with no order behind it yet. */
  stagesOpen: number
  /** Sheet rows with no window on their order. */
  sheetsWithoutWindow: number
  offersOut: number
  signed: number
}

export type SubsTabInput = {
  board: WorkOrderBoardRow[]
  windows: StageWindowLike[]
  /** step_commitments.id → job_stage_windows.id for orders that carry a stage. */
  windowIdByCommitmentId: ReadonlyMap<string, string>
  fixtures: SubsFixtureLike[]
  jobs: SubsJobLike[]
}

export const fixtureAmount = (f: Pick<SubsFixtureLike, 'count' | 'line_unit_price'>): number => Math.round((Number(f.count) || 0) * (Number(f.line_unit_price) || 0) * 100) / 100

function stageOf(f: SubsFixtureLike): SubsStage {
  return { id: f.id, name: (f.name ?? '').trim() || 'Line item', amount: fixtureAmount(f), sequence: Number(f.sequence_order) || 0, kind: f.stage_kind === 'order' || f.stage_kind === 'any' ? f.stage_kind : null, shared: f.shared_with_gc === true }
}

const numericJob = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true })

export function buildSubsTabGroups(input: SubsTabInput): { groups: SubsJobGroup[]; counts: SubsTabCounts } {
  const jobsById = new Map(input.jobs.map((j) => [j.id, j]))
  const fixturesById = new Map(input.fixtures.map((f) => [f.id, f]))
  const fixturesByJob = new Map<string, SubsFixtureLike[]>()
  for (const f of input.fixtures) fixturesByJob.set(f.job_id, [...(fixturesByJob.get(f.job_id) ?? []), f])
  const windowsById = new Map(input.windows.map((w) => [w.id, w]))

  const groups = new Map<string, SubsJobGroup>()
  const groupFor = (jobId: string | null, fallback?: WorkOrderBoardRow): SubsJobGroup => {
    const key = jobId ?? `unlinked:${fallback?.key ?? '?'}`
    let g = groups.get(key)
    if (g) return g
    const job = jobId ? (jobsById.get(jobId) ?? null) : null
    g = {
      key,
      jobId,
      jobNumber: job?.hcp_number ?? fallback?.jobNumber ?? '',
      primary: job ? `#${job.hcp_number} · ${job.customer_name ?? 'No customer'}` : (fallback?.primary ?? 'Unlinked'),
      secondary: job ? job.job_address || null : (fallback?.secondary ?? null),
      rows: [],
      attention: 0,
      freeFixtures: [],
    }
    groups.set(key, g)
    return g
  }

  // Sheet rows: the board as it stands, each carrying the stage its order fulfils.
  const claimedWindowIds = new Set<string>()
  let offersOut = 0
  let signed = 0
  let sheetsWithoutWindow = 0
  for (const row of input.board) {
    const windowId = row.commitmentId ? (input.windowIdByCommitmentId.get(row.commitmentId) ?? null) : null
    const window = windowId ? (windowsById.get(windowId) ?? null) : null
    if (window) claimedWindowIds.add(window.id)
    const fixture = window ? (fixturesById.get(window.fixture_id) ?? null) : null
    const g = groupFor(row.jobId, row)
    g.rows.push({ key: row.key, kind: 'sheet', jobId: row.jobId, stage: fixture ? stageOf(fixture) : null, window, span: stageWindowSpan(window), board: row })
    if (row.group === 'no_agreement') g.attention += 1
    if (row.group === 'sent') offersOut += 1
    if (row.group === 'signed') signed += 1
    if (!window) sheetsWithoutWindow += 1
  }

  // Stage rows: windows no order has claimed yet.
  let stagesOpen = 0
  for (const w of input.windows) {
    if (claimedWindowIds.has(w.id)) continue
    const fixture = fixturesById.get(w.fixture_id)
    const stage: SubsStage = fixture ? stageOf(fixture) : { id: w.fixture_id, name: 'Line item', amount: 0, sequence: 0, kind: null, shared: false }
    const g = groupFor(w.job_id)
    g.rows.push({ key: `stage:${w.id}`, kind: 'stage', jobId: w.job_id, stage, window: w, span: stageWindowSpan(w), board: null })
    g.attention += 1
    stagesOpen += 1
  }

  // Order rows inside each group and list the line items still free to become stages.
  for (const g of groups.values()) {
    const used = new Set(g.rows.map((r) => r.stage?.id).filter((id): id is string => !!id))
    g.freeFixtures = (g.jobId ? (fixturesByJob.get(g.jobId) ?? []) : [])
      .filter((f) => !used.has(f.id))
      .map(stageOf)
      .sort((a, b) => a.sequence - b.sequence)
    g.rows.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'stage' ? -1 : 1
      if (a.kind === 'stage' && b.kind === 'stage') return a.stage.sequence - b.stage.sequence || a.stage.name.localeCompare(b.stage.name)
      const ra = (a as SubsSheetRow).board, rb = (b as SubsSheetRow).board
      return ra.rail.position - rb.rail.position || rb.open - ra.open || ra.key.localeCompare(rb.key)
    })
  }

  const list = [...groups.values()].sort((a, b) => {
    const ua = a.jobId == null ? 1 : 0, ub = b.jobId == null ? 1 : 0
    return ua - ub || b.attention - a.attention || numericJob(a.jobNumber, b.jobNumber) || a.key.localeCompare(b.key)
  })
  return { groups: list, counts: { stagesOpen, sheetsWithoutWindow, offersOut, signed } }
}

/** The search box across groups: job, customer, address, sub, stage name, WO number. */
export function subsGroupMatches(g: SubsJobGroup, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [g.primary, g.secondary ?? '', g.jobNumber, ...g.rows.flatMap((r) => [r.stage?.name ?? '', r.board?.subName ?? '', r.board?.recordId ?? ''])].join(' ').toLowerCase()
  return hay.includes(q)
}
