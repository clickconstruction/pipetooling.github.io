/** Jobs → Team: the crew board kernel (v2.2974).
 *
 * One record set, two views. A "cell" is one person on one target (job, bid,
 * office, or no job at all) on one day: the dispatch blocks planned for it and
 * the clock sessions punched on it. From the cells the kernel derives the
 * board rows (by job or by person), the day totals, the summary strip and the
 * exceptions list. Pure: the loader hands in rows, this never touches Supabase.
 *
 * Time of day is the company wall clock (`APP_CALENDAR_TZ`); the track axis on
 * every chip runs 6 am → midnight.
 */
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { salariedFlatDayHours } from './salariedEffectiveHours'

export type TeamBoardSession = {
  id: string
  userId: string
  personName: string
  workDate: string
  clockedInAt: string
  clockedOutAt: string | null
  approvedAt: string | null
  jobId: string | null
  bidId: string | null
}

export type TeamBoardBlock = {
  id: string
  userId: string
  personName: string
  workDate: string
  /** 'HH:MM' or 'HH:MM:SS' wall clock */
  timeStart: string
  timeEnd: string
  jobId: string | null
  bidId: string | null
  note: string | null
}

export type TeamBoardSubSheet = {
  id: string
  workDate: string
  /** Resolved job id when the sheet's HCP number matched a job on the board; else null. */
  jobId: string | null
  jobNumber: string | null
  contractor: string
  stage: string
  address: string
}

export type TeamTargetLabel = { label: string; sub: string; jobNumber?: string | null }

export type TeamWindow = { start: number; end: number; sessionId?: string; blockId?: string; note?: string | null }

export type TeamCellKind = 'ok' | 'unplanned' | 'miss' | 'unlinked' | 'office'

export type TeamCell = {
  targetKey: string
  workDate: string
  personName: string
  userId: string | null
  plan: TeamWindow[]
  clock: TeamWindow[]
  planHours: number
  clockHours: number
  /** Any clocked session still awaiting approval. */
  pending: boolean
  kind: TeamCellKind
  /** `ok` cells whose clock exceeds the plan past the ran-long rule. */
  over: boolean
  /** Closed sessions with no job or bid — what a Link action would update. */
  unlinkedSessionIds: string[]
  /** v2.2981: a ran-long / not-planned chip the office accepted ("Looks right") — no longer an exception. */
  acked: boolean
}

export type TeamExceptionKind = 'unlinked' | 'miss' | 'over' | 'unplanned'

export type TeamException = {
  kind: TeamExceptionKind
  workDate: string
  personName: string
  userId: string | null
  targetKey: string
  hours: number
  planHours: number
  windows: string[]
  planWindows: string[]
  pending: boolean
  /** For `unlinked`: the dispatch block that day, if any — the obvious link. */
  suggestion: { targetKey: string; window: string; blockId: string } | null
  sessionIds: string[]
}

export type TeamRow = {
  key: string
  kind: 'job' | 'bid' | 'none' | 'office' | 'person'
  label: string
  sub: string
  cellsByDay: Record<string, TeamCell[]>
  subSheetsByDay: Record<string, TeamBoardSubSheet[]>
  clocked: number
  planned: number
  /** Person rows: the pay-config target for the week (salaried 8/weekday; hourly = planned). */
  target: number | null
  hasException: boolean
}

export type TeamBoardSummary = {
  clockedField: number
  plannedField: number
  onPlanHours: number
  unlinkedHours: number
  unlinkedSessions: number
  pendingUnlinked: number
  missCount: number
  overCount: number
  unplannedCount: number
  /** v2.2981: accepted ran-long / not-planned chips this week. */
  ackedCount: number
}

export type TeamBoard = {
  days: string[]
  cells: TeamCell[]
  jobRows: TeamRow[]
  personRows: TeamRow[]
  dayTotals: Array<{ workDate: string; clocked: number; planned: number }>
  summary: TeamBoardSummary
  exceptions: TeamException[]
  labels: Record<string, TeamTargetLabel>
}

export type RanLongRule = { ratio: number; minHours: number }
export const DEFAULT_RAN_LONG_RULE: RanLongRule = { ratio: 1.5, minHours: 1.5 }

export const TEAM_TRACK_AXIS = { start: 6, end: 24 } as const
export const NONE_TARGET = 'none'

export function targetKeyFor(jobId: string | null, bidId: string | null): string {
  if (jobId) return `job:${jobId}`
  if (bidId) return `bid:${bidId}`
  return NONE_TARGET
}

/** Hours-of-day (0–24, fractional) of an instant on the company wall clock. */
export function wallClockHours(iso: string, timeZone: string = APP_CALENDAR_TZ): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h + m / 60
}

export function hhmmToHours(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) + (m ?? 0) / 60
}

/** Position on the 6 am → midnight track, clamped to 0–100. */
export function trackPct(hours: number): number {
  const { start, end } = TEAM_TRACK_AXIS
  return Math.max(0, Math.min(100, ((hours - start) / (end - start)) * 100))
}

export function formatHourLabel(h: number): string {
  let whole = Math.floor(h)
  let mins = Math.round((h - whole) * 60)
  if (mins === 60) {
    whole += 1
    mins = 0
  }
  const hr = ((whole + 11) % 12) + 1
  const suffix = whole >= 12 && whole < 24 ? 'p' : 'a'
  return `${hr}${mins ? ':' + String(mins).padStart(2, '0') : ''}${suffix}`
}

export function formatWindow(w: { start: number; end: number }): string {
  return `${formatHourLabel(w.start)}–${formatHourLabel(w.end)}`
}

/** "Thu 9/3" — column and ledger date label (en-US short weekday; no locale-sensitive keys). */
export function formatBoardDay(ymd: string): string {
  try {
    return new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '')
  } catch {
    return ymd
  }
}

export function formatHours2(h: number): string {
  return h.toFixed(2)
}

export function formatHours1(h: number): string {
  return (Math.round(h * 10) / 10).toFixed(1)
}

const sumWindows = (ws: TeamWindow[]) => ws.reduce((t, w) => t + Math.max(0, w.end - w.start), 0)

/**
 * A session's clock window on its work date. Cross-midnight work is attributed
 * to the clock-in date (the app's rule), so an out time past midnight clamps
 * to 24 and an out time earlier than in (rare clock drift) yields nothing.
 */
export function sessionWindow(s: Pick<TeamBoardSession, 'clockedInAt' | 'clockedOutAt'>): { start: number; end: number } | null {
  if (!s.clockedOutAt) return null
  const start = wallClockHours(s.clockedInAt)
  const inMs = Date.parse(s.clockedInAt)
  const outMs = Date.parse(s.clockedOutAt)
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) return null
  const end = Math.min(24, start + (outMs - inMs) / 3_600_000)
  return { start, end }
}

export type BuildTeamBoardInput = {
  days: string[]
  sessions: TeamBoardSession[]
  blocks: TeamBoardBlock[]
  subSheets?: TeamBoardSubSheet[]
  labels: Record<string, TeamTargetLabel>
  officeJobId?: string | null
  /** person name → pay flags, for person-row targets. */
  payFlags?: Record<string, { is_salary?: boolean | null }>
  /** null = the ran-long rule is off (nothing is flagged). */
  ranLong?: RanLongRule | null
  /** v2.2981: `teamAckKey(...)` of every accepted chip in the week. */
  acks?: ReadonlySet<string>
}

/** The acknowledgement key for a cell: kind|day|person user id|target. */
export function teamAckKey(kind: 'over' | 'unplanned', workDate: string, userId: string, targetKey: string): string {
  return `${kind}|${workDate}|${userId}|${targetKey}`
}

/** Which acknowledgement a cell could carry, if any. */
export function teamAckKindFor(cell: Pick<TeamCell, 'kind' | 'over'>): 'over' | 'unplanned' | null {
  if (cell.kind === 'unplanned') return 'unplanned'
  if (cell.kind === 'ok' && cell.over) return 'over'
  return null
}

export function buildTeamBoard(input: BuildTeamBoardInput): TeamBoard {
  const { days, sessions, blocks, subSheets = [], labels, officeJobId = null, payFlags = {}, ranLong = DEFAULT_RAN_LONG_RULE, acks } = input
  const officeKey = officeJobId ? `job:${officeJobId}` : null
  const daySet = new Set(days)
  const cellKey = (t: string, d: string, p: string) => `${t}|${d}|${p}`
  const byKey = new Map<string, TeamCell>()
  const cellFor = (targetKey: string, workDate: string, personName: string, userId: string | null): TeamCell => {
    const k = cellKey(targetKey, workDate, personName)
    let c = byKey.get(k)
    if (!c) {
      c = { targetKey, workDate, personName, userId, plan: [], clock: [], planHours: 0, clockHours: 0, pending: false, kind: 'ok', over: false, unlinkedSessionIds: [], acked: false }
      byKey.set(k, c)
    } else if (!c.userId && userId) c.userId = userId
    return c
  }

  for (const b of blocks) {
    if (!daySet.has(b.workDate)) continue
    const name = b.personName.trim()
    if (!name) continue
    const c = cellFor(targetKeyFor(b.jobId, b.bidId), b.workDate, name, b.userId)
    c.plan.push({ start: hhmmToHours(b.timeStart), end: hhmmToHours(b.timeEnd), blockId: b.id, note: b.note })
  }
  for (const s of sessions) {
    if (!daySet.has(s.workDate)) continue
    const name = s.personName.trim()
    if (!name) continue
    const w = sessionWindow(s)
    if (!w) continue
    const tk = targetKeyFor(s.jobId, s.bidId)
    const c = cellFor(tk, s.workDate, name, s.userId)
    c.clock.push({ ...w, sessionId: s.id })
    if (!s.approvedAt) c.pending = true
    if (tk === NONE_TARGET) c.unlinkedSessionIds.push(s.id)
  }

  const cells = [...byKey.values()]
  for (const c of cells) {
    c.plan.sort((a, b) => a.start - b.start)
    c.clock.sort((a, b) => a.start - b.start)
    c.planHours = sumWindows(c.plan)
    c.clockHours = sumWindows(c.clock)
    if (c.targetKey === NONE_TARGET) c.kind = 'unlinked'
    else if (officeKey && c.targetKey === officeKey) c.kind = 'office'
    else if (c.clockHours > 0 && c.planHours > 0) c.kind = 'ok'
    else if (c.clockHours > 0) c.kind = 'unplanned'
    else c.kind = 'miss'
    c.over = ranLong != null && c.kind === 'ok' && c.clockHours > c.planHours * ranLong.ratio && c.clockHours - c.planHours > ranLong.minHours
    const ackKind = teamAckKindFor(c)
    c.acked = !!(acks && ackKind && c.userId && acks.has(teamAckKey(ackKind, c.workDate, c.userId, c.targetKey)))
  }

  // exceptions
  const blocksByDayPerson = new Map<string, TeamBoardBlock[]>()
  for (const b of blocks) {
    const k = `${b.workDate}|${b.personName.trim()}`
    const list = blocksByDayPerson.get(k) ?? []
    list.push(b)
    blocksByDayPerson.set(k, list)
  }
  const exceptions: TeamException[] = []
  for (const c of cells) {
    const base = {
      workDate: c.workDate,
      personName: c.personName,
      userId: c.userId,
      targetKey: c.targetKey,
      hours: c.clockHours,
      planHours: c.planHours,
      windows: c.clock.map(formatWindow),
      planWindows: c.plan.map(formatWindow),
      pending: c.pending,
      sessionIds: c.clock.map((w) => w.sessionId).filter((x): x is string => !!x),
    }
    if (c.kind === 'unlinked') {
      const sug = (blocksByDayPerson.get(`${c.workDate}|${c.personName}`) ?? []).slice().sort((a, b) => a.timeStart.localeCompare(b.timeStart))[0]
      exceptions.push({
        ...base,
        kind: 'unlinked',
        suggestion: sug ? { targetKey: targetKeyFor(sug.jobId, sug.bidId), window: formatWindow({ start: hhmmToHours(sug.timeStart), end: hhmmToHours(sug.timeEnd) }), blockId: sug.id } : null,
      })
    } else if (c.kind === 'miss') exceptions.push({ ...base, kind: 'miss', hours: c.planHours, suggestion: null })
    else if (c.acked) continue
    else if (c.kind === 'unplanned') exceptions.push({ ...base, kind: 'unplanned', suggestion: null })
    else if (c.over) exceptions.push({ ...base, kind: 'over', suggestion: null })
  }
  const rank: Record<TeamExceptionKind, number> = { unlinked: 0, miss: 1, over: 2, unplanned: 3 }
  const dayIdx = (d: string) => days.indexOf(d)
  exceptions.sort((a, b) => dayIdx(b.workDate) - dayIdx(a.workDate) || rank[a.kind] - rank[b.kind] || a.personName.localeCompare(b.personName))

  // rows by target
  const isField = (t: string) => t !== NONE_TARGET && t !== officeKey
  const targets = new Set<string>()
  for (const c of cells) targets.add(c.targetKey)
  const hoursByTarget: Record<string, { clocked: number; planned: number }> = {}
  for (const c of cells) {
    const t = (hoursByTarget[c.targetKey] ??= { clocked: 0, planned: 0 })
    t.clocked += c.clockHours
    t.planned += c.planHours
  }
  const mkRow = (key: string, kind: TeamRow['kind'], label: string, sub: string): TeamRow => ({ key, kind, label, sub, cellsByDay: {}, subSheetsByDay: {}, clocked: 0, planned: 0, target: null, hasException: false })
  const jobRowsMap = new Map<string, TeamRow>()
  for (const t of targets) {
    const kind: TeamRow['kind'] = t === NONE_TARGET ? 'none' : officeKey && t === officeKey ? 'office' : t.startsWith('bid:') ? 'bid' : 'job'
    const lbl = labels[t] ?? (t === NONE_TARGET ? { label: 'No job on the session', sub: 'Approved or pending hours with no job or bid' } : { label: t, sub: '' })
    jobRowsMap.set(t, mkRow(t, kind, lbl.label, lbl.sub))
  }
  for (const c of cells) {
    const r = jobRowsMap.get(c.targetKey)!
    ;(r.cellsByDay[c.workDate] ??= []).push(c)
    r.clocked += c.clockHours
    r.planned += c.planHours
    if (!c.acked && c.kind !== 'ok' && c.kind !== 'office') r.hasException = true
    if (!c.acked && c.over) r.hasException = true
  }
  for (const s of subSheets) {
    if (!daySet.has(s.workDate)) continue
    const key = s.jobId ? `job:${s.jobId}` : `sheet:${s.jobNumber ?? s.id}`
    let r = jobRowsMap.get(key)
    if (!r) {
      r = mkRow(key, 'job', labels[key]?.label ?? (s.jobNumber ? `J${s.jobNumber}` : 'Sub sheet'), labels[key]?.sub ?? s.address)
      jobRowsMap.set(key, r)
    }
    ;(r.subSheetsByDay[s.workDate] ??= []).push(s)
  }
  for (const r of jobRowsMap.values()) for (const d of Object.keys(r.cellsByDay)) r.cellsByDay[d]!.sort((a, b) => a.personName.localeCompare(b.personName))
  const jobRows = [...jobRowsMap.values()].sort((a, b) => {
    if (a.kind === 'none') return -1
    if (b.kind === 'none') return 1
    if (a.kind === 'office') return 1
    if (b.kind === 'office') return -1
    return b.clocked - a.clocked || a.label.localeCompare(b.label)
  })

  // rows by person
  const personRowsMap = new Map<string, TeamRow>()
  for (const c of cells) {
    let r = personRowsMap.get(c.personName)
    if (!r) {
      r = mkRow(c.personName, 'person', c.personName, '')
      personRowsMap.set(c.personName, r)
    }
    ;(r.cellsByDay[c.workDate] ??= []).push(c)
    r.clocked += c.clockHours
    r.planned += c.planHours
    if (!c.acked && c.kind !== 'ok' && c.kind !== 'office') r.hasException = true
    if (!c.acked && c.over) r.hasException = true
  }
  for (const r of personRowsMap.values()) {
    for (const d of Object.keys(r.cellsByDay)) r.cellsByDay[d]!.sort((a, b) => (labels[a.targetKey]?.label ?? a.targetKey).localeCompare(labels[b.targetKey]?.label ?? b.targetKey))
    const flags = payFlags[r.key]
    if (flags?.is_salary) r.target = days.reduce((t, d) => t + salariedFlatDayHours(d), 0)
    else r.target = r.planned > 0 ? r.planned : null
  }
  const personRows = [...personRowsMap.values()].sort((a, b) => a.label.localeCompare(b.label))

  // day totals + summary (field only: not office, not unlinked)
  const dayTotals = days.map((d) => {
    let clocked = 0, planned = 0
    for (const c of cells) if (c.workDate === d && isField(c.targetKey)) { clocked += c.clockHours; planned += c.planHours }
    return { workDate: d, clocked, planned }
  })
  const summary: TeamBoardSummary = { clockedField: 0, plannedField: 0, onPlanHours: 0, unlinkedHours: 0, unlinkedSessions: 0, pendingUnlinked: 0, missCount: 0, overCount: 0, unplannedCount: 0, ackedCount: 0 }
  for (const c of cells) {
    if (c.kind === 'unlinked') {
      summary.unlinkedHours += c.clockHours
      summary.unlinkedSessions += c.clock.length
      if (c.pending) summary.pendingUnlinked += c.clock.length
      continue
    }
    if (!isField(c.targetKey)) continue
    summary.clockedField += c.clockHours
    summary.plannedField += c.planHours
    if (c.kind === 'ok') summary.onPlanHours += c.clockHours
    if (c.kind === 'miss') summary.missCount += 1
    if (c.acked) summary.ackedCount += 1
    else {
      if (c.kind === 'unplanned') summary.unplannedCount += 1
      if (c.over) summary.overCount += 1
    }
  }

  return { days, cells, jobRows, personRows, dayTotals, summary, exceptions, labels }
}

/** "Where it stands" pill for the ledger — the Subs-tab vocabulary. */
export function teamCellStanding(c: TeamCell): { tone: 'ok' | 'warn' | 'miss' | 'office'; text: string } {
  if (c.acked) return { tone: 'ok', text: 'Accepted' }
  if (c.kind === 'ok') return c.over ? { tone: 'warn', text: 'Ran long' } : { tone: 'ok', text: 'On plan' }
  if (c.kind === 'unplanned') return { tone: 'warn', text: 'Not planned' }
  if (c.kind === 'miss') return { tone: 'miss', text: 'No clock' }
  if (c.kind === 'unlinked') return { tone: 'warn', text: 'Not on a job' }
  return { tone: 'office', text: 'Office' }
}

/** Ledger rows: newest day first, exceptions before on-plan, then by person. */
export function teamLedgerRows(board: TeamBoard): TeamCell[] {
  const dayIdx = (d: string) => board.days.indexOf(d)
  const rank = (c: TeamCell) => (c.acked ? 4 : c.kind === 'unlinked' ? 0 : c.kind === 'miss' ? 1 : c.over ? 2 : c.kind === 'unplanned' ? 3 : c.kind === 'ok' ? 4 : 5)
  return board.cells.slice().sort((a, b) => dayIdx(b.workDate) - dayIdx(a.workDate) || rank(a) - rank(b) || a.personName.localeCompare(b.personName))
}

// ---------------------------------------------------------------------------
// v2.2978: helpers behind the board's actions.
// ---------------------------------------------------------------------------

/** `job:<id>` / `bid:<id>` → the pick shape the session-link helper takes; `none` → null. */
export function pickFromTargetKey(key: string): { type: 'job' | 'bid'; id: string } | null {
  if (key.startsWith('job:')) return { type: 'job', id: key.slice(4) }
  if (key.startsWith('bid:')) return { type: 'bid', id: key.slice(4) }
  return null
}

export function hoursToHhmmss(h: number): string {
  const clamped = Math.max(0, Math.min(24, h))
  const whole = Math.floor(clamped)
  const mins = Math.round((clamped - whole) * 60)
  const hh = mins === 60 ? whole + 1 : whole
  const mm = mins === 60 ? 0 : mins
  return `${String(Math.min(hh, 24)).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
}

/**
 * "Move to plan": the dispatch block a clocked-not-planned cell implies — the
 * span from the first clock-in to the last clock-out on that job that day.
 * Null when there is nothing clocked.
 */
export function plannedWindowFromClock(cell: Pick<TeamCell, 'clock'>): { time_start: string; time_end: string } | null {
  if (cell.clock.length === 0) return null
  const start = Math.min(...cell.clock.map((w) => w.start))
  const end = Math.max(...cell.clock.map((w) => w.end))
  if (end <= start) return null
  return { time_start: hoursToHhmmss(start), time_end: hoursToHhmmss(end) }
}
