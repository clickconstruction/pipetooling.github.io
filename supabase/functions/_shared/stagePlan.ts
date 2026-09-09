/**
 * Stage Plan (to-dos/stage-plan, PR 1): the line item is the stage.
 *
 * Order and kind live on `jobs_ledger_fixtures` (`stage_kind`, `shared_with_gc`).
 * This kernel reads a job's line items with their windows, the sub orders on
 * those windows, the orders' sheets, and the job's invoices and payments, and
 * says for every row: its number (Order rows only), where the work stands,
 * where its draw stands, and the one line the Bill tab prints under it. The
 * four rules it enforces:
 *
 *   1. The line item is the record — nothing here is stored anywhere else.
 *   2. Order rows wait; Any rows don't. A numbered stage starts when the one
 *      above it passes inspection; an Any stage has its own dates.
 *   3. The GC sees our crew, never a sub — `gcView` has no field a name could
 *      ride in, one live stage, one ask on the next one.
 *   4. Draws follow stages. An Order stage becomes a draw when it passes
 *      inspection and nothing bills out of order; an Any stage bills when its
 *      work is done; a plain line item rides on the final draw. A stage is
 *      DONE when the customer pays its bill.
 *
 * Pure and dependency-free: lives in supabase/functions/_shared so the
 * customer-portal and submit-portal-request functions run the same rules the
 * Bill tab, the Edit read-out and the customer drawer do (src/lib/jobs/stagePlan.ts
 * re-exports it). Tested from src/lib/jobs/stagePlan.test.ts.
 */
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

// Dependency-free date words (this module is shared with the Deno edge
// functions; it mirrors formatWorkDateYmdMonthDayShort / calendarYmdInAppTzFromIso
// in src/utils/dateUtils.ts).
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
function formatWorkDateYmdMonthDayShort(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd.trim()
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12) return ymd.trim()
  return `${MONTH_SHORT[mo - 1]} ${d}`
}
function calendarYmdInAppTzFromIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const y = g('year'), m = g('month'), day = g('day')
  return y && m && day ? `${y}-${m}-${day}` : ''
}

export type StageKind = 'order' | 'any'

export type StagePlanFixture = {
  id: string
  name: string
  count: number
  line_unit_price: number | null
  sequence_order: number
  invoice_id: string | null
  /** `order` numbered · `any` its own dates · null = a plain line item. */
  stage_kind: StageKind | null
  shared_with_gc: boolean
  /** Crew-reported percent from a stage-weighted field report (v2.3192); a sub sheet's progress wins when an order exists. */
  progress_pct?: number | null
}
export type StagePlanWindow = {
  id: string
  fixture_id: string
  window_start: string | null
  window_end: string | null
  asked_start?: string | null
  asked_end?: string | null
  asked_note?: string | null
  asked_at?: string | null
  answered_at?: string | null
  answer?: string | null
  answer_note?: string | null
}
/**
 * A sub order (`step_commitments`) on a window. Deliberately carries no
 * `display_name` / `person_id`: the plan has no field a name could ride in.
 */
export type StagePlanOrder = {
  id: string
  stage_window_id: string | null
  status: string
  picked_start: string | null
  picked_end: string | null
  labor_job_id: string | null
  change_requested_at?: string | null
}
export type StagePlanSheet = {
  id: string
  stage: string | null
  progress_pct: number | null
  /** ISO instants — read as company calendar days. */
  progress_at?: string | null
  stage_changed_at?: string | null
}
export type StagePlanInvoice = {
  id: string
  status: string
  billed_at?: string | null
  sent_to_customer_at?: string | null
}
export type StagePlanPayment = { invoice_id: string | null; paid_on: string | null }

export type StagePlanInput = {
  fixtures: StagePlanFixture[]
  windows: StagePlanWindow[]
  orders: StagePlanOrder[]
  sheets: StagePlanSheet[]
  invoices: StagePlanInvoice[]
  payments: StagePlanPayment[]
  /** `YYYY-MM-DD`, company calendar — decides "scheduled" vs "on site". */
  todayYmd: string
}

export type StageSpan = { start: string; end: string }
export type StageWork = 'none' | 'window' | 'offered' | 'scheduled' | 'working' | 'inspection' | 'passed'
export type StageDraw = 'paid' | 'billed' | 'ready' | 'waits' | 'later' | 'open' | 'none'
export type StageBadge = 'done' | 'live' | 'later' | 'any' | 'any-done' | 'none'
export type StageTone = 'plain' | 'muted' | 'green' | 'blue' | 'amber'
export type StageLinePart = { text: string; tone: StageTone }
export type StageAsk = { start: string; end: string; note: string | null; answer: 'open' | 'accepted' | 'proposed'; answerNote: string | null }

export type StagePlanRow = {
  fixtureId: string
  name: string
  amount: number
  kind: StageKind | null
  /** 1-based among Order rows; null for Any and plain rows. */
  number: number | null
  badge: StageBadge
  work: StageWork
  window: StageSpan | null
  pick: StageSpan | null
  pct: number | null
  /** Company day the sheet passed inspection. */
  passedOn: string | null
  /** Company day an Any row's work was done (inspection called or 100%). */
  doneOn: string | null
  draw: StageDraw
  /** Draw N = the stage's number; null when the row draws no number. */
  drawNumber: number | null
  /** The day the draw was paid or billed. */
  drawOn: string | null
  invoiceId: string | null
  sharedWithGc: boolean
  ask: StageAsk | null
  rescheduling: boolean
  /** The second line under the row on the Bill tab, in parts the UI can tone. */
  stateParts: StageLinePart[]
  stateLine: string
}

export type StagePlan = {
  /** Plan order: Order rows by sequence, then Any rows by sequence, then plain rows. */
  rows: StagePlanRow[]
  byFixtureId: ReadonlyMap<string, StagePlanRow>
  orderCount: number
  anyCount: number
  plainCount: number
  sharedCount: number
}

export const fixtureAmount = (f: Pick<StagePlanFixture, 'count' | 'line_unit_price'>): number =>
  Math.round((Number(f.count) || 0) * (Number(f.line_unit_price) || 0) * 100) / 100

/** "Sep 4" · "Sep 9 – 10" · "Sep 22 – Oct 2". */
export function stageSpanShort(span: StageSpan): string {
  if (span.start === span.end) return formatWorkDateYmdMonthDayShort(span.start)
  const a = formatWorkDateYmdMonthDayShort(span.start)
  const b = formatWorkDateYmdMonthDayShort(span.end)
  const sameMonth = span.start.slice(0, 7) === span.end.slice(0, 7)
  return sameMonth ? `${a} – ${b.replace(/^\S+\s/, '')}` : `${a} – ${b}`
}

/** A GC reads percent in words. */
export function pctWords(pct: number | null): string {
  const p = Math.max(0, Math.min(100, Number(pct) || 0))
  if (p <= 15) return 'just started'
  if (p <= 40) return 'about a third'
  if (p <= 65) return 'about halfway'
  return 'nearly done'
}

const ymdOf = (iso: string | null | undefined): string | null => {
  const s = (iso ?? '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return calendarYmdInAppTzFromIso(s) || null
}
const spanOf = (start: string | null | undefined, end: string | null | undefined): StageSpan | null =>
  start ? { start, end: end || start } : null
const day = (ymd: string) => formatWorkDateYmdMonthDayShort(ymd)

const LIVE_ORDER_STATUSES = new Set(['offered', 'accepted', 'approved', 'settled'])

/** The order fulfilling a window: a signed order beats an open offer. */
function orderByWindow(orders: StagePlanOrder[]): Map<string, StagePlanOrder> {
  const out = new Map<string, StagePlanOrder>()
  for (const o of orders) {
    if (!o.stage_window_id || !LIVE_ORDER_STATUSES.has(o.status)) continue
    const prev = out.get(o.stage_window_id)
    if (!prev || (prev.status === 'offered' && o.status !== 'offered')) out.set(o.stage_window_id, o)
  }
  return out
}

function workOf(window: StagePlanWindow | null, order: StagePlanOrder | null, sheet: StagePlanSheet | null, todayYmd: string): StageWork {
  const hasWindow = !!(window?.window_start && window.window_end)
  if (!order) return hasWindow ? 'window' : 'none'
  if (order.status === 'offered') return hasWindow ? 'offered' : 'none'
  const st = (sheet?.stage ?? 'working').trim()
  if (st === 'customer_pay') return 'passed'
  if (st === 'walkthrough') return 'inspection'
  if (sheet && sheet.progress_pct != null && sheet.progress_pct > 0) return 'working'
  if (order.picked_start && todayYmd >= order.picked_start) return 'working'
  if (order.picked_start) return 'scheduled'
  return hasWindow ? 'offered' : 'none'
}

const started = (w: StageWork) => w === 'scheduled' || w === 'working' || w === 'inspection' || w === 'passed'

type Resolved = {
  f: StagePlanFixture
  amount: number
  window: StagePlanWindow | null
  order: StagePlanOrder | null
  sheet: StagePlanSheet | null
  work: StageWork
  invoice: StagePlanInvoice | null
}

export function buildStagePlan(input: StagePlanInput): StagePlan {
  const winByFixture = new Map<string, StagePlanWindow>()
  for (const w of input.windows) if (!winByFixture.has(w.fixture_id)) winByFixture.set(w.fixture_id, w)
  const ordByWin = orderByWindow(input.orders)
  const sheetById = new Map(input.sheets.map((s) => [s.id, s]))
  const invoiceById = new Map(input.invoices.map((i) => [i.id, i]))
  const paidOnByInvoice = new Map<string, string>()
  for (const p of input.payments) {
    if (!p.invoice_id || !p.paid_on) continue
    const prev = paidOnByInvoice.get(p.invoice_id)
    if (!prev || p.paid_on > prev) paidOnByInvoice.set(p.invoice_id, p.paid_on)
  }

  const bySeq = (a: StagePlanFixture, b: StagePlanFixture) => a.sequence_order - b.sequence_order || a.name.localeCompare(b.name)
  const sorted = [...input.fixtures].sort(bySeq)
  const resolve = (f: StagePlanFixture): Resolved => {
    const window = winByFixture.get(f.id) ?? null
    const order = window ? ordByWin.get(window.id) ?? null : null
    const sheet = order?.labor_job_id ? sheetById.get(order.labor_job_id) ?? null : null
    return { f, amount: fixtureAmount(f), window, order, sheet, work: workOf(window, order, sheet, input.todayYmd), invoice: f.invoice_id ? invoiceById.get(f.invoice_id) ?? null : null }
  }
  const orderRows = sorted.filter((f) => f.stage_kind === 'order').map(resolve)
  const anyRows = sorted.filter((f) => f.stage_kind === 'any').map(resolve)
  const plainRows = sorted.filter((f) => f.stage_kind !== 'order' && f.stage_kind !== 'any').map(resolve)
  const hasOrder = orderRows.length > 0

  const common = (r: Resolved) => {
    const w = r.window
    const ask: StageAsk | null =
      w?.asked_at && w.asked_start && w.asked_end
        ? { start: w.asked_start, end: w.asked_end, note: (w.asked_note ?? '').trim() || null, answer: !w.answered_at ? 'open' : w.answer === 'accepted' ? 'accepted' : 'proposed', answerNote: (w.answer_note ?? '').trim() || null }
        : null
    const passedOn = r.work === 'passed' ? ymdOf(r.sheet?.stage_changed_at) : null
    const anyDone = r.work === 'passed' || r.work === 'inspection' || (r.sheet?.progress_pct ?? r.f.progress_pct ?? 0) >= 100
    const doneOn = anyDone ? ymdOf(r.sheet?.stage_changed_at) ?? ymdOf(r.sheet?.progress_at) : null
    let draw: StageDraw
    let drawOn: string | null = null
    if (r.invoice) {
      if (r.invoice.status === 'paid') {
        draw = 'paid'
        drawOn = paidOnByInvoice.get(r.invoice.id) ?? null
      } else if (r.invoice.status === 'billed') {
        draw = 'billed'
        drawOn = ymdOf(r.invoice.billed_at) ?? ymdOf(r.invoice.sent_to_customer_at)
      } else draw = 'ready'
    } else if (r.amount <= 0) draw = 'none'
    else draw = 'later'
    return {
      fixtureId: r.f.id,
      name: r.f.name.trim() || 'Line item',
      amount: r.amount,
      work: r.work,
      window: w?.window_start && w.window_end ? { start: w.window_start, end: w.window_end } : null,
      pick: r.order && r.order.status !== 'offered' ? spanOf(r.order.picked_start, r.order.picked_end) : null,
      pct: r.sheet?.progress_pct ?? r.f.progress_pct ?? null,
      passedOn,
      doneOn,
      anyDone,
      draw: draw as StageDraw,
      drawOn,
      invoiceId: r.f.invoice_id,
      sharedWithGc: !!r.f.shared_with_gc,
      ask,
      rescheduling: !!r.order?.change_requested_at,
    }
  }

  const rows: StagePlanRow[] = []
  // Order rows: numbered, each waits on the one above it.
  let predecessorsClear = true
  let liveTaken = false
  let firstUnbilledNumber: number | null = null
  orderRows.forEach((r, i) => {
    const c = common(r)
    const n = i + 1
    let draw = c.draw
    if (!r.invoice && r.amount > 0) draw = r.work === 'passed' ? (predecessorsClear ? 'ready' : 'waits') : 'later'
    const invoiced = !!r.invoice
    const done = draw === 'paid' || (draw === 'none' && r.work === 'passed')
    const badge: StageBadge = done ? 'done' : liveTaken ? 'later' : 'live'
    if (!done) liveTaken = true
    const waitsOn = firstUnbilledNumber
    if (!invoiced && r.amount > 0) {
      predecessorsClear = false
      if (firstUnbilledNumber == null) firstUnbilledNumber = n
    }
    const parts: StageLinePart[] = [{ text: `Stage ${n}`, tone: 'plain' }]
    switch (r.work) {
      case 'passed':
        parts.push({ text: c.passedOn ? `passed ${day(c.passedOn)}` : 'passed inspection', tone: 'green' })
        break
      case 'inspection':
        parts.push({ text: 'done · inspection next', tone: 'blue' })
        break
      case 'working':
        parts.push({ text: c.pick ? `on site ${stageSpanShort(c.pick)}` : 'on site', tone: 'blue' })
        if (c.pct != null) parts.push({ text: `${Math.round(c.pct)}%`, tone: 'blue' })
        break
      case 'scheduled':
        parts.push({ text: c.pick ? `scheduled ${stageSpanShort(c.pick)}` : 'scheduled', tone: 'blue' })
        break
      case 'offered':
        parts.push({ text: c.window ? `offered · ${stageSpanShort(c.window)}` : 'offered', tone: 'muted' })
        break
      case 'window':
        parts.push({ text: c.window ? `window ${stageSpanShort(c.window)}` : 'window', tone: 'plain' })
        break
      default:
        parts.push({ text: n === 1 ? 'not scheduled' : `after ${n - 1}`, tone: 'muted' })
    }
    switch (draw) {
      case 'paid':
        parts.push({ text: `draw ${n} paid${c.drawOn ? ` ${day(c.drawOn)}` : ''}`, tone: 'muted' })
        break
      case 'billed':
        parts.push({ text: `draw ${n} billed${c.drawOn ? ` ${day(c.drawOn)}` : ''}`, tone: 'muted' })
        break
      case 'ready':
        parts.push({ text: `draw ${n} ready to bill`, tone: 'amber' })
        break
      case 'waits':
        parts.push({ text: `draw ${n} waits on stage ${waitsOn ?? n - 1}`, tone: 'amber' })
        break
      case 'later':
        parts.push({ text: `draw ${n} after it passes`, tone: 'muted' })
        break
      default:
        parts.push({ text: 'no draw', tone: 'muted' })
    }
    const { anyDone: _d, ...rest } = c
    void _d
    rows.push({ ...rest, kind: 'order', number: n, badge, draw, drawNumber: draw === 'none' ? null : n, stateParts: parts, stateLine: parts.map((p) => p.text).join(' · ') })
  })
  // Any rows: their own dates, bill when done.
  for (const r of anyRows) {
    const c = common(r)
    let draw = c.draw
    if (!r.invoice && r.amount > 0) draw = c.anyDone ? 'ready' : 'later'
    const badge: StageBadge = c.anyDone || draw === 'paid' ? 'any-done' : 'any'
    const parts: StageLinePart[] = []
    if (c.anyDone) parts.push({ text: c.doneOn ? `◆ done ${day(c.doneOn)}` : '◆ done', tone: 'green' })
    else if (r.work === 'working') parts.push({ text: c.pick ? `◆ on site ${stageSpanShort(c.pick)}` : '◆ on site', tone: 'blue' })
    else if (r.work === 'scheduled') parts.push({ text: c.pick ? `◆ scheduled ${stageSpanShort(c.pick)}` : '◆ scheduled', tone: 'blue' })
    else if (r.work === 'offered') parts.push({ text: c.window ? `◆ offered · ${stageSpanShort(c.window)}` : '◆ offered', tone: 'muted' })
    else if (r.work === 'window') parts.push({ text: c.window ? `◆ window ${stageSpanShort(c.window)}` : '◆ window', tone: 'plain' })
    else parts.push({ text: '◆ not scheduled', tone: 'muted' })
    switch (draw) {
      case 'paid':
        parts.push({ text: `paid${c.drawOn ? ` ${day(c.drawOn)}` : ''}`, tone: 'muted' })
        break
      case 'billed':
        parts.push({ text: `billed${c.drawOn ? ` ${day(c.drawOn)}` : ''}`, tone: 'muted' })
        break
      case 'ready':
        parts.push({ text: 'ready to bill', tone: 'amber' })
        break
      case 'later':
        parts.push({ text: 'bills when done', tone: 'muted' })
        break
      default:
        parts.push({ text: 'no draw', tone: 'muted' })
    }
    const { anyDone: _d, ...rest } = c
    void _d
    rows.push({ ...rest, kind: 'any', number: null, badge, draw, drawNumber: null, stateParts: parts, stateLine: parts.map((p) => p.text).join(' · ') })
  }
  // Plain rows: not a stage; ride the final draw.
  for (const r of plainRows) {
    const c = common(r)
    let draw = c.draw
    if (!r.invoice && r.amount > 0) draw = hasOrder ? 'later' : 'open'
    const parts: StageLinePart[] = [{ text: 'not a stage', tone: 'muted' }]
    switch (draw) {
      case 'paid':
        parts.push({ text: `paid${c.drawOn ? ` ${day(c.drawOn)}` : ''}`, tone: 'muted' })
        break
      case 'billed':
        parts.push({ text: `billed${c.drawOn ? ` ${day(c.drawOn)}` : ''}`, tone: 'muted' })
        break
      case 'ready':
        parts.push({ text: 'ready to bill', tone: 'amber' })
        break
      case 'later':
        parts.push({ text: 'bills with the final draw', tone: 'muted' })
        break
      case 'open':
        parts.push({ text: 'bills on its own', tone: 'muted' })
        break
      default:
        parts.push({ text: 'no draw', tone: 'muted' })
    }
    const { anyDone: _d, ...rest } = c
    void _d
    rows.push({ ...rest, kind: null, number: null, badge: 'none', draw, drawNumber: null, stateParts: parts, stateLine: parts.map((p) => p.text).join(' · ') })
  }

  return {
    rows,
    byFixtureId: new Map(rows.map((r) => [r.fixtureId, r])),
    orderCount: orderRows.length,
    anyCount: anyRows.length,
    plainCount: plainRows.length,
    sharedCount: rows.filter((r) => r.sharedWithGc).length,
  }
}

const orderRowsOf = (plan: StagePlan) => plan.rows.filter((r) => r.kind === 'order')

/** Words for where an Order stage stands, office side. */
function stageWords(r: StagePlanRow): string {
  switch (r.work) {
    case 'passed':
      return `passed inspection · ${r.invoiceId ? (r.draw === 'paid' ? 'paid' : 'billed') : r.draw === 'waits' ? 'waits on the stage before it' : 'ready to bill'}`
    case 'inspection':
      return 'waiting on inspection'
    case 'working':
      return 'on site now'
    case 'scheduled':
      return r.pick ? `scheduled ${stageSpanShort(r.pick)}` : 'scheduled'
    case 'offered':
    case 'window':
      return r.window ? `planned ${stageSpanShort(r.window)}` : 'planned'
    default:
      return 'not scheduled'
  }
}

/** "Stage 2 of 4 · Top-out · on site now" — Order rows only; null when the job has none. */
export function headline(plan: StagePlan): string | null {
  const orders = orderRowsOf(plan)
  if (orders.length === 0) return null
  const live = orders.find((r) => r.badge === 'live')
  if (!live) return `All ${orders.length} stage${orders.length === 1 ? '' : 's'} done`
  return `Stage ${live.number} of ${orders.length} · ${live.name} · ${stageWords(live)}`
}

export type StageBillable = { fixtureId: string; amount: number; why: string }

/**
 * What may be billed right now, in plan order: an Order stage that passed
 * inspection with every stage above it invoiced; an Any stage whose work is
 * done. Never a row already on an invoice, never out of order.
 */
export function billable(plan: StagePlan): StageBillable[] {
  return plan.rows
    .filter((r) => r.draw === 'ready' && !r.invoiceId && r.amount > 0)
    .map((r) => ({ fixtureId: r.fixtureId, amount: r.amount, why: r.kind === 'order' ? `Stage ${r.number} passed inspection` : `${r.name} is done` }))
}

export type GcStepState = 'done' | 'now' | 'next' | 'later'
export type GcStep = {
  /** The line item — the portal maps it to the window an ask lands on. */
  fixtureId: string
  name: string
  number: number
  state: GcStepState
  line: string
  /** Only on the live row while the crew is on site. */
  pct: number | null
  /** The one row the GC may ask other dates on. */
  askable: boolean
  ask: StageAsk | null
}
export type GcAlso = { name: string; state: 'done' | 'now' | 'later'; line: string }
export type GcView = { headline: string | null; steps: GcStep[]; also: GcAlso[] }

/**
 * The GC's sequence: shared Order rows numbered 1..M, one `now`, one `next`
 * (the only askable row), the rest `later`; shared Any rows under "Also on
 * this job". No name can appear — the plan never carried one.
 */
export function gcView(plan: StagePlan): GcView {
  const shared = orderRowsOf(plan).filter((r) => r.sharedWithGc)
  const steps: GcStep[] = []
  let nowSeen = false
  let nextSeen = false
  shared.forEach((r, i) => {
    const number = i + 1
    const done = r.badge === 'done'
    let state: GcStepState
    if (done) state = 'done'
    else if (!nowSeen && !nextSeen && started(r.work)) {
      state = 'now'
      nowSeen = true
    } else if (!nextSeen) {
      state = 'next'
      nextSeen = true
    } else state = 'later'
    const prevName = i > 0 ? shared[i - 1]!.name : null
    let line: string
    switch (state) {
      case 'done':
        line = r.passedOn ? `Passed inspection ${day(r.passedOn)}` : 'Done'
        break
      case 'now':
        line =
          r.work === 'passed'
            ? r.passedOn
              ? `Passed inspection ${day(r.passedOn)}`
              : 'Passed inspection'
            : r.work === 'inspection'
              ? 'Work done · inspection next'
              : r.work === 'working'
                ? `${r.pick ? `On site ${stageSpanShort(r.pick)}` : 'On site'} · ${pctWords(r.pct)}`
                : r.pick
                  ? `Scheduled ${stageSpanShort(r.pick)}`
                  : 'Scheduled'
        break
      case 'next':
        line = r.rescheduling
          ? "We're picking new days inside the window"
          : r.ask?.answer === 'open'
            ? `You asked for ${stageSpanShort(r.ask)} · we'll confirm`
            : r.window
              ? `Planned ${stageSpanShort(r.window)}`
              : prevName
                ? `After ${prevName.toLowerCase()}`
                : 'Not scheduled yet'
        break
      default:
        line = prevName ? `After ${prevName.toLowerCase()}` : 'Later'
    }
    steps.push({ fixtureId: r.fixtureId, name: r.name, number, state, line, pct: state === 'now' && r.work === 'working' ? r.pct : null, askable: state === 'next', ask: state === 'next' ? r.ask : null })
  })
  const also: GcAlso[] = plan.rows
    .filter((r) => r.kind === 'any' && r.sharedWithGc)
    .map((r) => {
      if (r.badge === 'any-done') return { name: r.name, state: 'done' as const, line: r.doneOn ? `Done ${day(r.doneOn)}` : 'Done' }
      if (r.work === 'working') return { name: r.name, state: 'now' as const, line: `${r.pick ? `On site ${stageSpanShort(r.pick)}` : 'On site'} · ${pctWords(r.pct)}` }
      if (r.work === 'scheduled') return { name: r.name, state: 'now' as const, line: r.pick ? `Scheduled ${stageSpanShort(r.pick)}` : 'Scheduled' }
      return { name: r.name, state: 'later' as const, line: r.window ? `Planned ${stageSpanShort(r.window)}` : 'Not scheduled yet' }
    })
  const m = steps.length
  const lead = steps.find((s) => s.state === 'now') ?? steps.find((s) => s.state === 'next')
  const leadRow = lead ? shared[lead.number - 1] : undefined
  const leadWords = !lead || !leadRow
    ? ''
    : leadRow.work === 'passed'
      ? 'passed inspection'
      : leadRow.work === 'inspection'
        ? 'waiting on inspection'
        : leadRow.work === 'working'
          ? 'on site now'
          : lead.line.charAt(0).toLowerCase() + lead.line.slice(1)
  const gcHeadline = m === 0 ? null : !lead ? `All ${m} stage${m === 1 ? '' : 's'} done` : `Stage ${lead.number} of ${m} · ${lead.name} · ${leadWords}`
  return { headline: gcHeadline, steps, also }
}
