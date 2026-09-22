/**
 * Day book kernel (to-dos/day-book, PR 1+2).
 *
 * What each office person got done on each day, read from records the app already
 * stamps with the actor — never typed. `get_day_book_payload` returns raw rows in one
 * shape; this file turns them into the lines People → Day book draws:
 *
 *   Billed 3 · J102 J258 J273 · $14,200
 *   Applied 4 deposits · 3 jobs
 *   Sent 2 contracts · J650 J878
 *   Approved 12 clock sessions · 5 people · 61.5h
 *
 * Rules the design settled (the to-do carries the why):
 * - A quiet day (clock time, no lines) is a fact about the app's reach, not a score. It
 *   is flagged on the row and counted nowhere.
 * - The clock-out note (`clock_sessions.notes`) is shown when present, never asked for.
 * - Money arrives already stripped when the viewer may not see it (`amount_usd` null);
 *   the kernel only sums what it is given and never invents a figure.
 * - Rows with no actor never reach a person; the payload counts them per day and the
 *   day header says "and N more by the system".
 *
 * Pure: no React, no dates from the wall clock except the `nowMs` the caller passes.
 */
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { formatCrewDayHours } from '../crewDay'

export type DayBookKind =
  | 'billed'
  | 'deposit'
  | 'payment'
  | 'status'
  | 'contract_sent'
  | 'contract_filed'
  | 'approval'
  | 'hours_reviewed'
  | 'dispatch_answered'
  | 'deleted'
  /** A schedule block added, moved, reassigned or removed (the ledger, v2.3726). */
  | 'schedule'

/** The kind chips on the toolbar. */
export type DayBookChip = 'everything' | 'billing' | 'deposits' | 'contracts' | 'approvals' | 'schedule'

export const DAY_BOOK_CHIPS: ReadonlyArray<{ id: DayBookChip; label: string; kinds: ReadonlyArray<DayBookKind> }> = [
  { id: 'everything', label: 'Everything', kinds: [] },
  { id: 'billing', label: 'Billing', kinds: ['billed', 'status'] },
  { id: 'deposits', label: 'Deposits', kinds: ['deposit', 'payment'] },
  { id: 'contracts', label: 'Contracts', kinds: ['contract_sent', 'contract_filed'] },
  { id: 'approvals', label: 'Approvals', kinds: ['approval', 'hours_reviewed', 'dispatch_answered'] },
  { id: 'schedule', label: 'Schedule', kinds: ['schedule'] },
]

export type DayBookUserRow = { id: string; name: string | null; role: string | null }
export type DayBookJobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }
export type DayBookRefPersonRow = { id: string; name: string | null }
export type DayBookSessionRow = {
  user_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string | null
  on_bid: boolean
  note: string | null
}
export type DayBookEventRow = {
  actor_user_id: string
  at: string
  /** Company-calendar date (YYYY-MM-DD), assigned server-side. */
  day: string
  kind: DayBookKind | string
  ref_type: 'job' | 'person' | 'person_name' | 'dispatch_request' | 'table' | null
  ref_id: string | null
  amount_usd: number | string | null
  detail: Record<string, unknown> | null
}
export type DayBookSystemRow = { day: string; kind: string; n: number }
/**
 * What was still waiting at the end of a day (v2.3714): `kind` is a chip id
 * (`approvals` today; more as history for them exists), `n` the count at that day's end.
 * Reconstructed server-side from timestamps — exact, no snapshot.
 */
export type DayBookQueueRow = { day: string; kind: string; n: number }

export type DayBookPayload = {
  from: string
  to: string
  viewer: { can_see_money: boolean; can_pick_person: boolean; user_id: string }
  users: DayBookUserRow[]
  jobs: DayBookJobRow[]
  ref_people: DayBookRefPersonRow[]
  sessions: DayBookSessionRow[]
  events: DayBookEventRow[]
  system_counts: DayBookSystemRow[]
  /** Absent from a payload older than v2.3714. */
  queue?: DayBookQueueRow[]
}

export type DayBookRef = { label: string; href: string | null }

export type DayBookLine = {
  kind: DayBookKind
  /** The sentence without refs or amount: "Billed 3", "Approved 12 clock sessions". */
  verb: string
  count: number
  /** What the line points at, in first-seen order (jobs, people). */
  refs: DayBookRef[]
  /** A trailing qualifier: "5 people · 61.5h", "Sep 1–7", "recoverable". */
  qualifier: string | null
  /** Sum of the amounts the payload carried; null when the viewer may not see money. */
  amountUsd: number | null
  /** Drawn muted (the deleted-records line). */
  quiet: boolean
}

export type DayBookSpan = { inAt: string; outAt: string | null; onBid: boolean }

export type DayBookPersonDay = {
  userId: string
  name: string
  role: string | null
  hoursMs: number
  /** A session still open (only meaningful for today). */
  open: boolean
  spans: DayBookSpan[]
  lines: DayBookLine[]
  /** Clock time and nothing on the record — before any chip filter. */
  quiet: boolean
  /** Non-empty clock-out notes, in session order. */
  notes: string[]
}

export type DayBookDay = {
  day: string
  /** "Wed, Sep 16" */
  label: string
  people: DayBookPersonDay[]
  hoursMs: number
  lineCount: number
  /** Outcomes written with no actor (system / backfill) — "and N more by the system". */
  systemCount: number
}

export type DayBookSummary = {
  hoursMs: number
  people: number
  billed: { n: number; usd: number | null }
  deposits: { n: number; usd: number | null }
  payments: number
  contracts: { sent: number; filed: number }
  approvals: number
  statusMoves: number
  /** Distinct schedule blocks touched (v2.3726). */
  scheduleBlocks: number
}

export type DayBookView = {
  from: string
  to: string
  canSeeMoney: boolean
  canPickPerson: boolean
  /** Everyone the viewer may pick (the select), by name. */
  people: Array<{ id: string; name: string }>
  /** Newest day first. Days with no session and no line are left out. */
  days: DayBookDay[]
  summary: DayBookSummary
}

export type DayBookBuildOptions = {
  chip?: DayBookChip
  /** Restrict to one person (a user id). */
  person?: string | null
  nowMs: number
}

const STATUS_WORD: Record<string, string> = {
  billed: 'Billed',
  paid: 'Paid',
  working: 'Working',
  scheduled: 'Scheduled',
  complete: 'Complete',
  completed: 'Complete',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  collections: 'Collections',
}

function statusWord(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return 'a new status'
  const known = STATUS_WORD[s.toLowerCase()]
  if (known) return known
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** "Wed, Sep 16" for a YYYY-MM-DD, without touching the wall clock or the host zone. */
export function dayBookDayLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** The Mon–Sun week holding `ymd`, as YYYY-MM-DD strings. */
export function dayBookWeekOf(ymd: string): { from: string; to: string } {
  const d = new Date(`${ymd}T12:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7 // Monday = 0
  const from = new Date(d)
  from.setUTCDate(d.getUTCDate() - dow)
  const to = new Date(from)
  to.setUTCDate(from.getUTCDate() + 6)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/** Shift a YYYY-MM-DD by whole days. */
export function dayBookShiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "Week of Sep 8 – 14" / "Sep 8 – Oct 4" for the toolbar. */
export function dayBookRangeLabel(from: string, to: string): string {
  const f = new Date(`${from}T12:00:00Z`)
  const t = new Date(`${to}T12:00:00Z`)
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return `${from} – ${to}`
  if (from === to) return dayBookDayLabel(from)
  const sameMonth = f.getUTCMonth() === t.getUTCMonth() && f.getUTCFullYear() === t.getUTCFullYear()
  const fm = f.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const tm = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const isWeek = (t.getTime() - f.getTime()) / 86400000 === 6 && (f.getUTCDay() + 6) % 7 === 0
  const span = sameMonth ? `${fm} – ${t.getUTCDate()}` : `${fm} – ${tm}`
  return isWeek ? `Week of ${span}` : span
}

/** The queue rows the payload carries, keyed `day → chip → n`. */
export function dayBookQueueIndex(payload: Pick<DayBookPayload, 'queue'>): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const q of payload.queue ?? []) {
    const n = toNumber(q.n)
    if (n === null) continue
    const day = out.get(q.day) ?? new Map<string, number>()
    day.set(q.kind, n)
    out.set(q.day, day)
  }
  return out
}

/**
 * Did this kind of work have anything waiting at the end of that day? `true` / `false`
 * when the payload carries that day's queue for that chip, `null` when it does not
 * (a chip history cannot answer for yet, a day the payload did not cover). The Month
 * grid turns an empty run amber only on `true`.
 */
export function dayBookQueueHeldWork(payload: Pick<DayBookPayload, 'queue'>): (chip: DayBookChip, day: string) => boolean | null {
  const index = dayBookQueueIndex(payload)
  return (chip, day) => {
    const n = index.get(day)?.get(chip)
    return n === undefined ? null : n > 0
  }
}

/**
 * The "left" a history line ends with — *48 still waiting* on a past day's Approved
 * line — from the reconstructed queue. Today's figures come from the live hooks.
 */
export function dayBookHistoryLeft(payload: Pick<DayBookPayload, 'queue'>, line: Pick<DayBookLine, 'kind'>, day: string): string | null {
  const n = dayBookQueueIndex(payload).get(day)?.get('approvals')
  if (line.kind === 'approval' && typeof n === 'number') return n > 0 ? `${n} still waiting` : 'none left waiting'
  return null
}

export function formatDayBookUsd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function jobLabel(job: DayBookJobRow | undefined, fallbackId: string): string {
  if (!job) return `job ${fallbackId.slice(0, 8)}`
  const num = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  return num ? `J${num}` : (job.job_name?.trim() || `job ${fallbackId.slice(0, 8)}`)
}

function jobHref(job: DayBookJobRow | undefined): string | null {
  if (!job) return null
  const num = effectiveJobLedgerNumber(job.hcp_number, job.click_number)
  return num ? `/jobs?job=${encodeURIComponent(num)}` : null
}

function sessionMs(s: DayBookSessionRow, nowMs: number): number {
  const inMs = Date.parse(s.clocked_in_at)
  const outMs = s.clocked_out_at ? Date.parse(s.clocked_out_at) : nowMs
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 0
  return Math.max(0, outMs - inMs)
}

/** One person's lines for one day, from that person's events on that day. */
function buildLines(
  events: DayBookEventRow[],
  jobsById: Map<string, DayBookJobRow>,
  canSeeMoney: boolean,
): DayBookLine[] {
  const out: DayBookLine[] = []

  const refsForJobs = (rows: DayBookEventRow[]): DayBookRef[] => {
    const seen = new Set<string>()
    const refs: DayBookRef[] = []
    for (const r of rows) {
      if (r.ref_type !== 'job' || !r.ref_id || seen.has(r.ref_id)) continue
      seen.add(r.ref_id)
      const job = jobsById.get(r.ref_id)
      refs.push({ label: jobLabel(job, r.ref_id), href: jobHref(job) })
    }
    return refs
  }
  const sumUsd = (rows: DayBookEventRow[]): number | null => {
    if (!canSeeMoney) return null
    let total = 0
    let any = false
    for (const r of rows) {
      const n = toNumber(r.amount_usd)
      if (n === null) continue
      total += n
      any = true
    }
    return any ? total : null
  }
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

  // Billed: one invoice counts once even when it was both marked billed and sent.
  const billed = events.filter((e) => e.kind === 'billed')
  if (billed.length > 0) {
    const byInvoice = new Map<string, DayBookEventRow>()
    for (const e of billed) {
      const inv = typeof e.detail?.invoice_id === 'string' ? e.detail.invoice_id : `${e.ref_id}:${e.at}`
      const prev = byInvoice.get(inv)
      // Prefer the row that carries an amount.
      if (!prev || (toNumber(prev.amount_usd) === null && toNumber(e.amount_usd) !== null)) byInvoice.set(inv, e)
    }
    const rows = [...byInvoice.values()]
    out.push({
      kind: 'billed',
      verb: `Billed ${rows.length}`,
      count: rows.length,
      refs: refsForJobs(rows),
      qualifier: null,
      amountUsd: sumUsd(rows),
      quiet: false,
    })
  }

  const deposits = events.filter((e) => e.kind === 'deposit')
  if (deposits.length > 0) {
    const refs = refsForJobs(deposits)
    out.push({
      kind: 'deposit',
      verb: `Applied ${deposits.length} ${plural(deposits.length, 'deposit', 'deposits')}`,
      count: deposits.length,
      refs,
      qualifier: refs.length > 1 ? `${refs.length} jobs` : null,
      amountUsd: sumUsd(deposits),
      quiet: false,
    })
  }

  const payments = events.filter((e) => e.kind === 'payment')
  if (payments.length > 0) {
    out.push({
      kind: 'payment',
      verb: `Recorded ${payments.length} ${plural(payments.length, 'payment', 'payments')}`,
      count: payments.length,
      refs: refsForJobs(payments),
      qualifier: null,
      amountUsd: sumUsd(payments),
      quiet: false,
    })
  }

  // Status moves: one line per destination, in first-seen order.
  const statusRows = events.filter((e) => e.kind === 'status')
  if (statusRows.length > 0) {
    const byTo = new Map<string, DayBookEventRow[]>()
    for (const e of statusRows) {
      const to = statusWord(e.detail?.to)
      const list = byTo.get(to) ?? []
      list.push(e)
      byTo.set(to, list)
    }
    for (const [to, rows] of byTo) {
      const refs = refsForJobs(rows)
      out.push({
        kind: 'status',
        verb: `Moved ${refs.length} ${plural(refs.length, 'job', 'jobs')} to ${to}`,
        count: refs.length,
        refs,
        qualifier: null,
        amountUsd: null,
        quiet: false,
      })
    }
  }

  const sent = events.filter((e) => e.kind === 'contract_sent')
  if (sent.length > 0) {
    out.push({
      kind: 'contract_sent',
      verb: `Sent ${sent.length} ${plural(sent.length, 'contract', 'contracts')}`,
      count: sent.length,
      refs: refsForJobs(sent),
      qualifier: null,
      amountUsd: null,
      quiet: false,
    })
  }
  const filed = events.filter((e) => e.kind === 'contract_filed')
  if (filed.length > 0) {
    out.push({
      kind: 'contract_filed',
      verb: `Filed ${filed.length} signed ${plural(filed.length, 'contract', 'contracts')}`,
      count: filed.length,
      refs: refsForJobs(filed),
      qualifier: null,
      amountUsd: null,
      quiet: false,
    })
  }

  const approvals = events.filter((e) => e.kind === 'approval')
  if (approvals.length > 0) {
    const people = new Set<string>()
    let hours = 0
    for (const e of approvals) {
      if (e.ref_id) people.add(e.ref_id)
      hours += toNumber(e.detail?.hours) ?? 0
    }
    out.push({
      kind: 'approval',
      verb: `Approved ${approvals.length} clock ${plural(approvals.length, 'session', 'sessions')}`,
      count: approvals.length,
      refs: [],
      qualifier: `${people.size} ${plural(people.size, 'person', 'people')} · ${hours.toFixed(1)}h`,
      amountUsd: null,
      quiet: false,
    })
  }

  const reviewed = events.filter((e) => e.kind === 'hours_reviewed')
  if (reviewed.length > 0) {
    const names = new Set<string>()
    let start: string | null = null
    let end: string | null = null
    for (const e of reviewed) {
      if (e.ref_id) names.add(e.ref_id)
      const s = typeof e.detail?.start_date === 'string' ? e.detail.start_date : null
      const en = typeof e.detail?.end_date === 'string' ? e.detail.end_date : null
      if (s && (!start || s < start)) start = s
      if (en && (!end || en > end)) end = en
    }
    const range = start && end ? `${dayBookDayLabel(start).replace(/^\w+, /, '')}–${dayBookDayLabel(end).replace(/^\w+, /, '')}` : null
    out.push({
      kind: 'hours_reviewed',
      verb: 'Reviewed hours',
      count: reviewed.length,
      refs: [...names].map((n) => ({ label: n, href: null })),
      qualifier: [`${names.size} ${plural(names.size, 'person', 'people')}`, range].filter(Boolean).join(' · '),
      amountUsd: null,
      quiet: false,
    })
  }

  const dispatch = events.filter((e) => e.kind === 'dispatch_answered')
  if (dispatch.length > 0) {
    out.push({
      kind: 'dispatch_answered',
      verb: `Answered ${dispatch.length} dispatch ${plural(dispatch.length, 'request', 'requests')}`,
      count: dispatch.length,
      refs: [],
      qualifier: null,
      amountUsd: null,
      quiet: false,
    })
  }

  // Schedule: one line for the day — people whose blocks changed, blocks touched, the
  // days those blocks fall on ("Thu–Fri"). A move and a reassign of one block is one block.
  const sched = events.filter((e) => e.kind === 'schedule')
  if (sched.length > 0) {
    const people = new Set<string>()
    const blocks = new Set<string>()
    const dates: string[] = []
    let removed = 0
    for (const e of sched) {
      const who = typeof e.detail?.assignee_user_id === 'string' ? e.detail.assignee_user_id : null
      if (who) people.add(who)
      const block = typeof e.detail?.block_id === 'string' ? e.detail.block_id : `${e.ref_id}:${e.at}`
      blocks.add(block)
      const wd = typeof e.detail?.work_date === 'string' ? e.detail.work_date : null
      if (wd) dates.push(wd)
      if (e.detail?.change === 'removed') removed += 1
    }
    dates.sort()
    const weekday = (ymd: string) => dayBookDayLabel(ymd).split(',')[0] ?? ymd
    const span = dates.length === 0 ? null : dates[0] === dates[dates.length - 1] ? weekday(dates[0]!) : `${weekday(dates[0]!)}–${weekday(dates[dates.length - 1]!)}`
    out.push({
      kind: 'schedule',
      verb: 'Updated the schedule',
      count: blocks.size,
      refs: refsForJobs(sched),
      qualifier: [
        `${people.size} ${plural(people.size, 'person', 'people')}`,
        `${blocks.size} ${plural(blocks.size, 'block', 'blocks')}${removed > 0 ? ` (${removed} removed)` : ''}`,
        span,
      ]
        .filter(Boolean)
        .join(' · '),
      amountUsd: null,
      quiet: false,
    })
  }

  // Deletions arrive pre-aggregated per table (detail.n / detail.restored_n).
  const deleted = events.filter((e) => e.kind === 'deleted')
  if (deleted.length > 0) {
    let n = 0
    let restored = 0
    for (const e of deleted) {
      n += toNumber(e.detail?.n) ?? 1
      restored += toNumber(e.detail?.restored_n) ?? 0
    }
    out.push({
      kind: 'deleted',
      verb: `Deleted ${n} ${plural(n, 'record', 'records')}`,
      count: n,
      refs: [],
      qualifier: restored > 0 ? `${restored} restored · recoverable` : 'recoverable',
      amountUsd: null,
      quiet: true,
    })
  }

  return out
}

/** The sentence a line reads as: "Billed 3 · J102 J258 J273 · $14,200". */
export function dayBookLineSentence(line: DayBookLine): string {
  const parts: string[] = [line.verb]
  if (line.refs.length > 0) parts.push(line.refs.map((r) => r.label).join(' '))
  if (line.qualifier) parts.push(line.qualifier)
  if (line.amountUsd !== null) parts.push(formatDayBookUsd(line.amountUsd))
  return parts.join(' · ')
}

export function buildDayBookView(payload: DayBookPayload, opts: DayBookBuildOptions): DayBookView {
  const chip = opts.chip ?? 'everything'
  const chipKinds = new Set(DAY_BOOK_CHIPS.find((c) => c.id === chip)?.kinds ?? [])
  const filterKinds = chip !== 'everything'
  const canSeeMoney = payload.viewer?.can_see_money === true
  const canPickPerson = payload.viewer?.can_pick_person === true

  const usersById = new Map<string, DayBookUserRow>()
  for (const u of payload.users ?? []) usersById.set(u.id, u)
  const jobsById = new Map<string, DayBookJobRow>()
  for (const j of payload.jobs ?? []) jobsById.set(j.id, j)

  const wantPerson = opts.person ?? null
  const keep = (userId: string) => (!wantPerson || userId === wantPerson) && usersById.has(userId)

  // Group sessions and events by day, then by person.
  const byDay = new Map<string, { sessions: Map<string, DayBookSessionRow[]>; events: Map<string, DayBookEventRow[]> }>()
  const dayBucket = (day: string) => {
    let b = byDay.get(day)
    if (!b) {
      b = { sessions: new Map(), events: new Map() }
      byDay.set(day, b)
    }
    return b
  }
  for (const s of payload.sessions ?? []) {
    if (!keep(s.user_id)) continue
    const b = dayBucket(s.work_date)
    const list = b.sessions.get(s.user_id) ?? []
    list.push(s)
    b.sessions.set(s.user_id, list)
  }
  for (const e of payload.events ?? []) {
    if (!keep(e.actor_user_id)) continue
    const b = dayBucket(e.day)
    const list = b.events.get(e.actor_user_id) ?? []
    list.push(e)
    b.events.set(e.actor_user_id, list)
  }
  const systemByDay = new Map<string, number>()
  for (const s of payload.system_counts ?? []) systemByDay.set(s.day, (systemByDay.get(s.day) ?? 0) + (toNumber(s.n) ?? 0))

  const summary: DayBookSummary = {
    hoursMs: 0,
    people: 0,
    billed: { n: 0, usd: canSeeMoney ? 0 : null },
    deposits: { n: 0, usd: canSeeMoney ? 0 : null },
    payments: 0,
    contracts: { sent: 0, filed: 0 },
    approvals: 0,
    statusMoves: 0,
    scheduleBlocks: 0,
  }
  const peopleSeen = new Set<string>()

  const days: DayBookDay[] = []
  const dayKeys = [...byDay.keys()].sort().reverse()
  for (const day of dayKeys) {
    const b = byDay.get(day)!
    const userIds = new Set<string>([...b.sessions.keys(), ...b.events.keys()])
    const people: DayBookPersonDay[] = []
    let dayHours = 0
    let lineCount = 0
    for (const userId of userIds) {
      const u = usersById.get(userId)!
      const sessions = (b.sessions.get(userId) ?? []).slice().sort((a, c) => a.clocked_in_at.localeCompare(c.clocked_in_at))
      const events = b.events.get(userId) ?? []
      const allLines = buildLines(events, jobsById, canSeeMoney)
      const lines = filterKinds ? allLines.filter((l) => chipKinds.has(l.kind)) : allLines
      const hoursMs = sessions.reduce((acc, s) => acc + sessionMs(s, opts.nowMs), 0)
      const quiet = sessions.length > 0 && allLines.length === 0
      // Under a chip, a person with nothing matching and not quiet is left out.
      if (filterKinds && lines.length === 0 && !quiet) continue

      for (const l of allLines) {
        if (l.kind === 'billed') {
          summary.billed.n += l.count
          if (summary.billed.usd !== null && l.amountUsd !== null) summary.billed.usd += l.amountUsd
        } else if (l.kind === 'deposit') {
          summary.deposits.n += l.count
          if (summary.deposits.usd !== null && l.amountUsd !== null) summary.deposits.usd += l.amountUsd
        } else if (l.kind === 'payment') summary.payments += l.count
        else if (l.kind === 'contract_sent') summary.contracts.sent += l.count
        else if (l.kind === 'contract_filed') summary.contracts.filed += l.count
        else if (l.kind === 'approval') summary.approvals += l.count
        else if (l.kind === 'status') summary.statusMoves += l.count
        else if (l.kind === 'schedule') summary.scheduleBlocks += l.count
      }
      summary.hoursMs += hoursMs
      peopleSeen.add(userId)
      dayHours += hoursMs
      lineCount += lines.length

      people.push({
        userId,
        name: u.name?.trim() || 'Someone',
        role: u.role,
        hoursMs,
        open: sessions.some((s) => !s.clocked_out_at),
        spans: sessions.map((s) => ({ inAt: s.clocked_in_at, outAt: s.clocked_out_at, onBid: s.on_bid })),
        lines,
        quiet,
        notes: sessions.map((s) => (s.note ?? '').trim()).filter((n) => n.length > 0),
      })
    }
    if (people.length === 0 && !(systemByDay.get(day) ?? 0)) continue
    people.sort((a, c) => (c.lines.length - a.lines.length) || (c.hoursMs - a.hoursMs) || a.name.localeCompare(c.name))
    days.push({
      day,
      label: dayBookDayLabel(day),
      people,
      hoursMs: dayHours,
      lineCount,
      systemCount: systemByDay.get(day) ?? 0,
    })
  }
  summary.people = peopleSeen.size

  const peopleList = [...usersById.values()]
    .map((u) => ({ id: u.id, name: u.name?.trim() || 'Someone' }))
    .sort((a, c) => a.name.localeCompare(c.name))

  return {
    from: payload.from,
    to: payload.to,
    canSeeMoney,
    canPickPerson,
    people: peopleList,
    days,
    summary,
  }
}

export { formatCrewDayHours as formatDayBookHours }
