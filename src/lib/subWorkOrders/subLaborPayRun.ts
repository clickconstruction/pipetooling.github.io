/**
 * Sub Labor read as a pay run (2026-09-05 refresh). Two kernels:
 *
 *  - `sheetPayWhen` — the rule one sheet's money is under, from what the sheet
 *    already stores: stage, payable-after date, hold reason, the job's bills,
 *    the rail's no-agreement gap, crew-vs-sub. Ready · Queued · Waiting on
 *    customer · After inspection · On hold · Not payable · Payroll.
 *  - `buildSubLaborPayRun` — the tiles (owed / ready now / queued for the
 *    pay-run day / not payable and why) and one row per sub with the owed
 *    figure, a segmented bar of where the money sits, the ready sheets the
 *    Pay button opens, and the sentence under the bar.
 *
 * Pure: no React, no Supabase. Money is whatever balance the caller derived.
 */
import type { SubSheetStage } from '../subSheetStage'
import { daysBetweenYmd } from './sheetRail'

export type SheetPayWhenKind = 'ready' | 'queued' | 'wait' | 'hold' | 'walk' | 'work' | 'gap' | 'crew' | 'unpriced' | 'paid'

export type SheetPayWhen = {
  kind: SheetPayWhenKind
  /** The chip. */
  label: string
  /** The fact behind it, muted under the chip. */
  detail: string
  tone: 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'gray'
  /** Order in a sub's group: what can be paid first. */
  rank: number
}

export type SheetPayWhenInput = {
  stage: SubSheetStage
  payableAfter: string | null | undefined
  payHoldReason: string | null | undefined
  /** The Pipeline job's bills: null when the sheet's job is not in the Pipeline. */
  bills: { out: number; paid: number } | null
  /** Rail gap — work under way with nothing signed. */
  gap: boolean
  crew: boolean
  balance: number
  unpriced: boolean
  todayYmd: string
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function sheetPayWhen(i: SheetPayWhenInput): SheetPayWhen {
  if (i.unpriced) return { kind: 'unpriced', label: 'Unpriced', detail: 'price the sheet first', tone: 'gray', rank: 8 }
  if (i.balance <= 0) return { kind: 'paid', label: 'Paid', detail: i.balance < 0 ? `over by ${money(-i.balance)}` : 'balance is $0', tone: 'green', rank: 9 }
  if (i.crew) return { kind: 'crew', label: 'Payroll', detail: 'crew sheet · no work order needed', tone: 'violet', rank: 7 }
  const hold = (i.payHoldReason ?? '').trim()
  if (hold) return { kind: 'hold', label: 'On hold', detail: hold, tone: 'red', rank: 3 }
  if (i.gap) return { kind: 'gap', label: 'Not payable', detail: `nothing signed · ${money(i.balance)} on a handshake`, tone: 'red', rank: 6 }
  if (i.stage === 'working') return { kind: 'work', label: 'After inspection', detail: 'sub has not said "done"', tone: 'gray', rank: 5 }
  if (i.stage === 'walkthrough') return { kind: 'walk', label: 'After inspection', detail: 'inspection pending', tone: 'gray', rank: 4 }
  // customer_pay
  const payable = (i.payableAfter ?? '').trim().slice(0, 10)
  const customerPaid = i.bills != null && i.bills.out > 0 && i.bills.paid >= i.bills.out
  if (customerPaid) return { kind: 'ready', label: 'Ready', detail: `customer paid${i.bills!.out > 1 ? ` · ${i.bills!.paid} of ${i.bills!.out} bills` : ''}`, tone: 'green', rank: 0 }
  if (payable && payable <= i.todayYmd) return { kind: 'ready', label: 'Ready', detail: `payable after ${payable} · date reached`, tone: 'green', rank: 0 }
  if (payable) return { kind: 'queued', label: `Queued · ${payable.slice(5).replace('-', '/')}`, detail: `payable after ${payable}${i.bills && i.bills.out > 0 ? ' · customer still owes' : ''}`, tone: 'blue', rank: 1 }
  const billWord = i.bills == null ? 'no job bill to read' : i.bills.out === 0 ? 'nothing billed yet' : `bill ${i.bills.paid + 1} of ${i.bills.out} open`
  return { kind: 'wait', label: 'Waiting on customer', detail: billWord, tone: 'amber', rank: 2 }
}

/** The chips over the ledger. */
export const PAY_RUN_FILTERS = ['due', 'ready', 'queued', 'wait', 'gap', 'crew', 'paid'] as const
export type PayRunFilter = (typeof PAY_RUN_FILTERS)[number]
export const PAY_RUN_FILTER_LABEL: Record<PayRunFilter, string> = {
  due: 'All due',
  ready: 'Ready now',
  queued: 'Queued',
  wait: 'Waiting on customer',
  gap: 'No agreement',
  crew: 'Crew pay',
  paid: 'Paid',
}
export const PAY_RUN_FILTER_HINT: Record<PayRunFilter, string> = {
  due: 'Every sheet with money open',
  ready: 'Passed inspection, draw triggered, with the bill paid or the payable-after date reached',
  queued: 'A payable-after date in the future — promised for the pay run',
  wait: 'Draw triggered, nothing promised yet',
  gap: 'Work under way with nothing signed',
  crew: 'A teammate on the sheet — pays through payroll',
  paid: 'Balance is $0 — the history',
}

export function payRunFilterMatches(filter: PayRunFilter, pw: SheetPayWhen): boolean {
  switch (filter) {
    case 'due':
      return pw.kind !== 'paid' && pw.kind !== 'unpriced'
    case 'ready':
    case 'queued':
    case 'wait':
    case 'gap':
    case 'crew':
      return pw.kind === filter
    case 'paid':
      return pw.kind === 'paid'
  }
}

export type PayRunSheet = {
  id: string
  subKey: string
  subName: string
  /** The roster person behind a lone contractor — the portal globe's key; null for crew, unknown or several. */
  personId: string | null
  teammates: string[]
  crew: boolean
  balance: number
  payWhen: SheetPayWhen
}

export type PayRunSegment = 'ready' | 'queued' | 'wait' | 'work' | 'hold' | 'gap'
export const PAY_RUN_SEGMENTS: readonly PayRunSegment[] = ['ready', 'queued', 'wait', 'work', 'hold', 'gap']
export const PAY_RUN_SEGMENT_LABEL: Record<PayRunSegment, string> = {
  ready: 'Ready',
  queued: 'Queued for the pay run',
  wait: 'Waiting on customer',
  work: 'Still in work / inspection',
  hold: 'On hold',
  gap: 'No agreement',
}

export type PayRunSub = {
  key: string
  name: string
  /** Set when every sheet under this row names the same lone roster person. */
  personId: string | null
  teammates: string[]
  crew: boolean
  /** Sheets with money open (paid ones are history, not a count). */
  sheetCount: number
  /** Money open on sub sheets; 0 on crew groups (payroll). */
  owed: number
  segments: Record<PayRunSegment, number>
  /** Ready sheets, biggest first — the Pay button opens the first. */
  readySheetIds: string[]
  readyAmount: number
  /** The sentence under the bar. */
  whyNot: string
  action: { kind: 'pay'; amount: number; sheets: number } | { kind: 'draft' } | { kind: 'note'; text: string }
}

export type SubLaborPayRun = {
  tiles: {
    owed: number
    owedSubs: number
    owedSheets: number
    ready: number
    readySheets: number
    queued: number
    queuedSheets: number
    /** "Fri Sep 11" when the pay-run day is set, else null. */
    queuedDayLabel: string | null
    blocked: number
    blockedReasons: string[]
  }
  subs: PayRunSub[]
  counts: Record<PayRunFilter, number>
}

const segmentOf = (k: SheetPayWhenKind): PayRunSegment | null =>
  k === 'ready' ? 'ready' : k === 'queued' ? 'queued' : k === 'wait' ? 'wait' : k === 'work' || k === 'walk' ? 'work' : k === 'hold' ? 'hold' : k === 'gap' ? 'gap' : null

export function buildSubLaborPayRun(sheets: readonly PayRunSheet[], opts: { payRunDay: string | null | undefined; todayYmd: string }): SubLaborPayRun {
  const bySub = new Map<string, PayRunSub & { ready: Array<{ id: string; balance: number }> }>()
  const counts = Object.fromEntries(PAY_RUN_FILTERS.map((f) => [f, 0])) as Record<PayRunFilter, number>
  const tiles = { owed: 0, owedSubs: 0, owedSheets: 0, ready: 0, readySheets: 0, queued: 0, queuedSheets: 0, queuedDayLabel: nextPayRunDayLabel(opts.payRunDay, opts.todayYmd), blocked: 0, blockedReasons: [] as string[] }
  const blockedBy: Record<PayRunSegment, number> = { ready: 0, queued: 0, wait: 0, work: 0, hold: 0, gap: 0 }

  for (const s of sheets) {
    for (const f of PAY_RUN_FILTERS) if (payRunFilterMatches(f, s.payWhen)) counts[f] += 1
    const open = s.balance > 0 ? s.balance : 0
    const seg = segmentOf(s.payWhen.kind)
    let sub = bySub.get(s.subKey)
    if (!sub) {
      sub = { key: s.subKey, name: s.subName, personId: s.personId, teammates: [], crew: s.crew, sheetCount: 0, owed: 0, segments: { ready: 0, queued: 0, wait: 0, work: 0, hold: 0, gap: 0 }, readySheetIds: [], readyAmount: 0, whyNot: '', action: { kind: 'note', text: '' }, ready: [] }
      bySub.set(s.subKey, sub)
    }
    sub.crew = sub.crew && s.crew
    if (sub.personId !== s.personId) sub.personId = null
    for (const t of s.teammates) if (!sub.teammates.includes(t)) sub.teammates.push(t)
    if (s.payWhen.kind === 'paid' || s.payWhen.kind === 'unpriced') continue
    sub.sheetCount += 1
    if (s.crew) continue // payroll — counted as a sheet, never as owed
    sub.owed += open
    if (seg) sub.segments[seg] += open
    if (s.payWhen.kind === 'ready') sub.ready.push({ id: s.id, balance: open })
    tiles.owed += open
    tiles.owedSheets += 1
    if (s.payWhen.kind === 'ready') {
      tiles.ready += open
      tiles.readySheets += 1
    } else if (s.payWhen.kind === 'queued') {
      tiles.queued += open
      tiles.queuedSheets += 1
    } else if (seg) {
      tiles.blocked += open
      blockedBy[seg] += open
    }
  }

  const subs: PayRunSub[] = []
  for (const sub of bySub.values()) {
    sub.ready.sort((a, b) => b.balance - a.balance)
    sub.readySheetIds = sub.ready.map((r) => r.id)
    sub.readyAmount = sub.ready.reduce((n, r) => n + r.balance, 0)
    if (sub.owed > 0) tiles.owedSubs += 1
    const bits: string[] = []
    if (sub.segments.ready > 0) bits.push(`${money(sub.segments.ready)} ready`)
    if (sub.segments.queued > 0) bits.push(`${money(sub.segments.queued)} queued${tiles.queuedDayLabel ? ` for ${tiles.queuedDayLabel}` : ''}`)
    if (sub.segments.wait > 0) bits.push(`${money(sub.segments.wait)} waiting on customer`)
    if (sub.segments.hold > 0) bits.push(`${money(sub.segments.hold)} on hold`)
    if (sub.segments.work > 0) bits.push(`${money(sub.segments.work)} still in work`)
    if (sub.segments.gap > 0) bits.push(`${money(sub.segments.gap)} with no agreement`)
    const only = (seg: PayRunSegment) => sub.owed > 0 && sub.segments[seg] === sub.owed
    sub.whyNot = sub.crew
      ? 'Crew sheets pay through payroll, not the pay run'
      : sub.owed === 0
        ? 'Paid up'
        : only('ready')
          ? `Ready · ${bits[0]!.replace(' ready', '')}`
          : only('queued')
            ? `Queued${tiles.queuedDayLabel ? ` for ${tiles.queuedDayLabel}` : ''}`
            : only('gap')
              ? 'No agreement · nothing signed'
              : bits.join(' · ')
    sub.action = sub.crew
      ? { kind: 'note', text: 'Payroll' }
      : sub.readyAmount > 0
        ? { kind: 'pay', amount: sub.readyAmount, sheets: sub.readySheetIds.length }
        : sub.segments.gap > 0 && sub.segments.gap >= sub.owed
          ? { kind: 'draft' }
          : sub.owed === 0
            ? { kind: 'note', text: 'Paid up' }
            : { kind: 'note', text: sub.segments.queued > 0 && sub.segments.queued + sub.segments.ready >= sub.owed ? `Pays ${tiles.queuedDayLabel ?? 'on the pay-run day'}` : 'Nothing payable yet' }
    const { ready: _r, ...row } = sub
    void _r
    subs.push(row)
  }
  subs.sort((a, b) => Number(a.crew) - Number(b.crew) || b.owed - a.owed || a.name.localeCompare(b.name))

  if (blockedBy.gap > 0) tiles.blockedReasons.push(`${money(blockedBy.gap)} with no agreement`)
  if (blockedBy.hold > 0) tiles.blockedReasons.push(`${money(blockedBy.hold)} on hold`)
  if (blockedBy.wait > 0) tiles.blockedReasons.push(`${money(blockedBy.wait)} waiting on customer`)
  if (blockedBy.work > 0) tiles.blockedReasons.push(`${money(blockedBy.work)} still in work`)
  return { tiles, subs, counts }
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The next pay-run date on or after today, as a YMD; null when the day is not set or unknown. */
export function nextPayRunYmd(payRunDay: string | null | undefined, todayYmd: string): string | null {
  const idx = DAYS.indexOf((payRunDay ?? '').trim().toLowerCase())
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(todayYmd)
  if (idx < 0 || !m) return null
  const base = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  const delta = (idx - base.getUTCDay() + 7) % 7
  base.setUTCDate(base.getUTCDate() + delta)
  return base.toISOString().slice(0, 10)
}

/** "Fri Sep 11" for the next pay run; null when unknown. */
export function nextPayRunDayLabel(payRunDay: string | null | undefined, todayYmd: string): string | null {
  const ymd = nextPayRunYmd(payRunDay, todayYmd)
  if (!ymd) return null
  const [y, mo, d] = ymd.split('-').map(Number)
  const dow = new Date(Date.UTC(y!, mo! - 1, d!)).getUTCDay()
  return `${DAY_SHORT[dow]} ${MONTH_SHORT[mo! - 1]} ${d}`
}

/** Days until a YMD from today (negative when past). */
export function daysUntilYmd(ymd: string | null | undefined, todayYmd: string): number {
  return ymd ? daysBetweenYmd(todayYmd, ymd) : 0
}
