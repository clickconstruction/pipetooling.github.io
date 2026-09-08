/**
 * Jobs → Subs → Work tiles as queues (v2.2963). Each of the four tiles opens a
 * modal the office clears from inside: the rows the tile counts, ordered by
 * what needs a move first, plus the small facts each row's form pre-fills.
 * Pure — the board rows and stage groups come from the kernels that already
 * feed the tab.
 */
import type { WorkOrderBoardRow } from '../subWorkOrders/workOrderBoardRows'
import { daysBetweenYmd } from '../subWorkOrders/sheetRail'
import type { SubsJobGroup, SubsStageRow } from './subsTabRows'
import { endAfterWeekdays, nextWeekdayOnOrAfter, stageWindowPhase, stageWindowWeekdays, type StageWindowSpan } from './stageWindow'
import { subDispatchSpan, type SubDispatchOrder } from './subDispatch'
import { askState, type StageAskWindow } from '../../../supabase/functions/_shared/stageAsk'

export type SubsTileKey = 'handshake' | 'stages' | 'offers' | 'signed'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const dayOf = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}
const ymdOf = (d: Date): string => d.toISOString().slice(0, 10)

/** `today` + n calendar days, as YYYY-MM-DD. */
export function addCalendarDays(ymd: string, days: number): string {
  const d = dayOf(ymd)
  d.setUTCDate(d.getUTCDate() + days)
  return ymdOf(d)
}

// ── 1 · On a handshake ────────────────────────────────────────────────────────

export type HandshakeQueueRow = {
  row: WorkOrderBoardRow
  /** The sheet's own date — when the handshake started. */
  workingSince: string | null
  daysWorking: number
  /** The sheet's job number has no Pipeline row: the order needs a job before it can go. */
  needsJob: boolean
}

/** Sheets with money open and nothing signed, most money first (unpriced last). */
export function buildHandshakeQueue(board: WorkOrderBoardRow[], todayYmd: string): { rows: HandshakeQueueRow[]; openUsd: number } {
  const rows = board
    .filter((r) => r.group === 'no_agreement')
    .map((row) => ({ row, workingSince: row.sheetDate, daysWorking: row.sheetDate ? Math.max(0, daysBetweenYmd(row.sheetDate, todayYmd)) : 0, needsJob: !row.jobId }))
    .sort((a, b) => Number(a.row.unpriced) - Number(b.row.unpriced) || b.row.open - a.row.open || a.row.key.localeCompare(b.row.key))
  return { rows, openUsd: rows.reduce((s, r) => s + r.row.open, 0) }
}

export type QuickOfferDefaults = { start: string; end: string; workDays: number; expires: string; amount: string }

/**
 * What the inline form opens with: the window runs from the day they started
 * (never a weekend) to `workDays` weekdays past today, the offer is good for a
 * week, the price is the sheet total.
 */
export function quickOfferDefaults(input: { sheetDate: string | null; todayYmd: string; agreed: number; unpriced: boolean; workDays?: number; goodForDays?: number }): QuickOfferDefaults {
  const workDays = Math.max(1, Math.floor(input.workDays ?? 10))
  const goodFor = Math.max(1, Math.floor(input.goodForDays ?? 7))
  const startBase = input.sheetDate && YMD.test(input.sheetDate) && input.sheetDate < input.todayYmd ? input.sheetDate : input.todayYmd
  const start = nextWeekdayOnOrAfter(startBase)
  const end = endAfterWeekdays(nextWeekdayOnOrAfter(input.todayYmd), workDays)
  return { start, end: end < start ? start : end, workDays, expires: addCalendarDays(input.todayYmd, goodFor), amount: input.unpriced || input.agreed <= 0 ? '' : String(Math.round(input.agreed * 100) / 100) }
}

/** The one-line reason a quick send cannot go yet, or null. */
export function quickOfferProblem(input: { amount: string; start: string; end: string; expires: string; todayYmd: string; hasJob: boolean }): string | null {
  if (!input.hasJob) return 'Pick the job first'
  const n = Number(input.amount)
  if (input.amount.trim() === '' || !Number.isFinite(n) || n <= 0) return 'Set the price — a sent work order needs one'
  if (!YMD.test(input.start) || !YMD.test(input.end)) return 'Pick both window days'
  if (input.end < input.start) return 'The window ends before it starts'
  if (input.end < input.todayYmd) return 'The window is already behind us'
  if (!YMD.test(input.expires) || input.expires < input.todayYmd) return 'The offer would expire before it arrives'
  return null
}

// ── 2 · Stages waiting ────────────────────────────────────────────────────────

export type StagesQueuePhase = 'passed' | 'open' | 'ahead' | 'unset'
export const STAGES_QUEUE_PHASE_LABEL: Record<StagesQueuePhase, string> = {
  passed: 'Window passed · move the dates or send anyway',
  open: 'Open now',
  ahead: 'Ahead',
  unset: 'No dates yet',
}
const PHASE_ORDER: StagesQueuePhase[] = ['passed', 'open', 'ahead', 'unset']

export type StagesQueueRow = {
  row: SubsStageRow
  group: SubsJobGroup
  phase: StagesQueuePhase
  /** The GC has asked for other dates and nobody answered. */
  askOpen: boolean
  /** For a passed window: the same number of weekdays, starting the next weekday. */
  suggestedSpan: StageWindowSpan | null
}

/** Stage rows (a window with no order) grouped passed → open → ahead → no dates. */
export function buildStagesQueue(groups: SubsJobGroup[], todayYmd: string): { rows: StagesQueueRow[]; totalUsd: number } {
  const rows: StagesQueueRow[] = []
  for (const g of groups) {
    for (const r of g.rows) {
      if (r.kind !== 'stage') continue
      const wp = r.span ? stageWindowPhase(r.span, todayYmd) : null
      const phase: StagesQueuePhase = wp === 'past' ? 'passed' : wp ?? 'unset'
      const suggestedSpan = phase === 'passed' && r.span ? (() => {
        const start = nextWeekdayOnOrAfter(todayYmd)
        return { start, end: endAfterWeekdays(start, Math.max(1, stageWindowWeekdays(r.span))) }
      })() : null
      rows.push({ row: r, group: g, phase, askOpen: askState(r.window as unknown as StageAskWindow) === 'open', suggestedSpan })
    }
  }
  rows.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || (a.row.span?.start ?? '9999').localeCompare(b.row.span?.start ?? '9999') || a.group.jobNumber.localeCompare(b.group.jobNumber, undefined, { numeric: true }) || a.row.stage.sequence - b.row.stage.sequence)
  return { rows, totalUsd: rows.reduce((s, r) => s + r.row.stage.amount, 0) }
}

// ── 3 · Offers out ────────────────────────────────────────────────────────────

export type OffersQueueRow = {
  row: WorkOrderBoardRow
  expired: boolean
  sentOn: string | null
  daysOut: number
  goodThrough: string | null
  /** Calendar days until the offer lapses; null when it never does. Negative once expired. */
  daysLeft: number | null
}

/** Sent offers, expired first, then the ones out longest. */
export function buildOffersQueue(board: WorkOrderBoardRow[], todayYmd: string): { rows: OffersQueueRow[]; totalUsd: number; expiredCount: number } {
  const rows: OffersQueueRow[] = []
  for (const row of board) {
    if (row.coverage.kind !== 'sent') continue
    const c = row.coverage
    rows.push({ row, expired: c.expired, sentOn: c.sentAt, daysOut: c.sentAt ? Math.max(0, daysBetweenYmd(c.sentAt, todayYmd)) : 0, goodThrough: c.expiresOn, daysLeft: c.expiresOn ? daysBetweenYmd(todayYmd, c.expiresOn) : null })
  }
  rows.sort((a, b) => Number(b.expired) - Number(a.expired) || b.daysOut - a.daysOut || a.row.key.localeCompare(b.row.key))
  return { rows, totalUsd: rows.reduce((s, r) => s + (r.row.coverage.kind === 'sent' ? r.row.coverage.amount : 0), 0), expiredCount: rows.filter((r) => r.expired).length }
}

// ── 4 · Signed this month ─────────────────────────────────────────────────────

/** The office's one move on a signed row, from where the sheet sits on its rail. */
export type SignedNextKind = 'wait_sub' | 'inspection' | 'bill' | 'pay' | 'done'
export const SIGNED_NEXT_LABEL: Record<SignedNextKind, string> = {
  wait_sub: 'Waiting on the sub',
  inspection: 'Call it in for inspection',
  bill: 'Bill and collect',
  pay: 'Pay the sub',
  done: 'Nothing — done',
}

export function signedNextKind(row: WorkOrderBoardRow): SignedNextKind {
  switch (row.rail.current) {
    case 'inspection':
      return 'inspection'
    case 'customer_pays':
      return 'bill'
    case 'paid':
      return row.open > 0 ? 'pay' : 'done'
    default:
      return 'wait_sub'
  }
}

export type SignedQueueRow = {
  row: WorkOrderBoardRow
  signedOn: string | null
  recordId: string | null
  next: SignedNextKind
  /** The next move is the office's (not the sub's, not nothing). */
  officeOwns: boolean
}

/** `YYYY-MM` for a date; the tile counts by calendar month. */
export const monthOf = (ymd: string): string => ymd.slice(0, 7)

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export function monthName(month: string): string {
  const m = Number(month.slice(5, 7))
  return MONTH_NAMES[m - 1] ?? month
}

/** Signed orders whose signed-on falls in `month`; the office's rows first, newest signature first. */
export function buildSignedQueue(board: WorkOrderBoardRow[], month: string): { rows: SignedQueueRow[]; totalUsd: number; payableUsd: number; officeCount: number } {
  const rows: SignedQueueRow[] = []
  for (const row of board) {
    if (row.coverage.kind !== 'signed') continue
    const signedOn = row.coverage.signedOn
    if (!signedOn || !signedOn.startsWith(month)) continue
    const next = signedNextKind(row)
    rows.push({ row, signedOn, recordId: row.coverage.recordId ?? row.recordId, next, officeOwns: next === 'inspection' || next === 'bill' || next === 'pay' })
  }
  rows.sort((a, b) => Number(b.officeOwns) - Number(a.officeOwns) || (b.signedOn ?? '').localeCompare(a.signedOn ?? '') || a.row.key.localeCompare(b.row.key))
  return {
    rows,
    totalUsd: rows.reduce((s, r) => s + (r.row.coverage.kind === 'signed' ? r.row.coverage.amount : 0), 0),
    payableUsd: rows.filter((r) => r.next === 'pay').reduce((s, r) => s + r.row.open, 0),
    officeCount: rows.filter((r) => r.officeOwns).length,
  }
}

/** How many signed orders fall in each earlier month — the footer's "‹ August · 5". */
export function signedCountForMonth(board: WorkOrderBoardRow[], month: string): number {
  return board.filter((r) => r.coverage.kind === 'signed' && (r.coverage.signedOn ?? '').startsWith(month)).length
}

// ── Sub availability (the picker in Stages waiting and Offer someone else) ──

export type SubAvailability = {
  /** Other live orders whose dates touch the span — "#273 · Trim & final". */
  busy: string[]
  /** Days inside the span the sub marked off. */
  off: string[]
}

const spansOverlap = (a: StageWindowSpan, b: StageWindowSpan): boolean => a.start <= b.end && b.start <= a.end

/** Is this sub free across the span? Reads the same live orders and off days the dispatch lanes read. */
export function subAvailabilityForSpan(personId: string, span: StageWindowSpan, orders: readonly SubDispatchOrder[], offDaysByPerson: ReadonlyMap<string, readonly string[]>, excludeOrderId: string | null = null): SubAvailability {
  const busy: string[] = []
  for (const o of orders) {
    if (o.personId !== personId || o.id === excludeOrderId) continue
    const s = subDispatchSpan(o)
    if (!s || !spansOverlap(s, span)) continue
    busy.push(o.stageName ? `${o.jobLabel} · ${o.stageName}` : o.jobLabel)
  }
  const off = (offDaysByPerson.get(personId) ?? []).filter((d) => d >= span.start && d <= span.end).sort()
  return { busy: [...new Set(busy)], off }
}

export function availabilityTone(a: SubAvailability): 'free' | 'busy' | 'off' {
  if (a.off.length > 0) return 'off'
  if (a.busy.length > 0) return 'busy'
  return 'free'
}

/** "free those days" · "on #273 · Trim & final" · "off Sep 10" */
export function availabilityLabel(a: SubAvailability, fmtDay: (ymd: string) => string): string {
  if (a.off.length > 0) return `off ${a.off.map(fmtDay).join(', ')}`
  if (a.busy.length > 0) return a.busy.length === 1 ? `on ${a.busy[0]}` : `on ${a.busy.length} other jobs`
  return 'free those days'
}
