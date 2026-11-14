import type { LienDeskEntry } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import type { CourtesyStatus } from './lienCourtesyNotice'
import type { LienNextUpRow } from './lienNextUp'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { countedLabel, pluralNoun } from '../batchWords'

/**
 * The lien month (punch list #235): the office's rhythm for lien work, set by the owner on
 * 2026-11-01 and refined on 2026-11-07 — reminders in the first days of the month, notices next,
 * liens by the 15th, nothing from the 16th on. It is a policy, not an app rule: the month is cut
 * into five zones by their days, and each zone counts what the desk already knows — what is left,
 * what went, what slipped past its days — so the whole office reads the same week every morning.
 *
 * The shape fits chapter 53, where every deadline is a 15th: a notice mailed in notices week gets
 * its reminder in reminders week of the next month, and the lien follows ten days after. The days
 * live here as the rule's constants (the way `lienReminderSchedule.ts` keeps the reminder
 * schedule's days) and are drawn under § Rules; making them the owner's to change from a screen
 * is the later card named in `to-dos/owner-decisions-pending.md`.
 *
 * Pure. `buildLienMonth` reads the desk's own book — the notice entries, the affidavit entries,
 * the courtesy status per sent notice, the filed affidavits waiting on their copies — and never
 * sends, files, approves or moves anything. A window closing with work unsent is a red count in
 * Catch-up, and that is the whole nudge.
 */

export type LienMonthZoneKey = 'reminders' | 'notices' | 'liens' | 'catch_up' | 'quiet'

export type LienMonthSpan = { from: number; to: number }

/** The four working zones' days; the quiet zone runs from `quietFrom` to the month's end. */
export type LienMonthRule = {
  reminders: LienMonthSpan
  notices: LienMonthSpan
  liens: LienMonthSpan
  catch_up: LienMonthSpan
  quietFrom: number
}

/** The owner's days (2026-11-07): two days of slack before every 15th, the 14th and 15th for what slipped. */
export const LIEN_MONTH_RULE: LienMonthRule = {
  reminders: { from: 1, to: 5 },
  notices: { from: 6, to: 9 },
  liens: { from: 10, to: 13 },
  catch_up: { from: 14, to: 15 },
  quietFrom: 16,
}

export const LIEN_MONTH_ZONE_KEYS: readonly LienMonthZoneKey[] = ['reminders', 'notices', 'liens', 'catch_up', 'quiet']

export const LIEN_MONTH_ZONE_LABEL: Record<LienMonthZoneKey, string> = {
  reminders: 'Reminders',
  notices: 'Notices',
  liens: 'Liens',
  catch_up: 'Catch-up',
  quiet: 'Nothing scheduled',
}

/** The work each zone is for, in a few words under its name. */
export const LIEN_MONTH_ZONE_WORK: Record<LienMonthZoneKey, string> = {
  reminders: 'the courtesy notice before each lien due this month',
  notices: 'the § 53.056 notices due this 15th',
  liens: 'the affidavits due this 15th',
  catch_up: 'what slipped, and the affidavit copies to mail',
  quiet: 'what is queuing for next month',
}

export type LienMonthZoneState = 'ahead' | 'now' | 'behind'

export type LienMonthJobState = 'left' | 'done' | 'slipped'

export type LienMonthJob = {
  jobId: string
  title: string
  state: LienMonthJobState
  /** Where it stands in the desk's own words: *to draft*, *to approve*, *sent Nov 3*. */
  words: string
}

export type LienMonthZone = {
  key: LienMonthZoneKey
  label: string
  work: string
  span: LienMonthSpan
  /** The zone's width in days. */
  days: number
  state: LienMonthZoneState
  /** Still to do this month. */
  left: number
  /** Went this month. */
  done: number
  /** Still to do once the zone's days passed — carried into Catch-up. */
  slipped: number
  jobs: LienMonthJob[]
  /** What the `left` are waiting on, by count: *3 to draft, 7 to approve*. '' when nothing is left. */
  breakdown: string
  /** Catch-up only: filed affidavits whose copies to the owner and the GC are not yet recorded as served (§ 53.055). */
  copies: number
  /** The quiet zone only: next month's three counts. */
  queue: { reminders: number; notices: number; liens: number } | null
}

export type LienMonth = {
  /** 'YYYY-MM' */
  month: string
  /** The day of the month today, 1-based. */
  today: number
  daysInMonth: number
  /** Where today falls across the month, 0 to 100, for the mark on the bar. */
  todayPct: number
  zone: LienMonthZoneKey
  zones: LienMonthZone[]
  rule: LienMonthRule
}

export type LienMonthInput = {
  todayYmd: string
  rule?: LienMonthRule
  notices: ReadonlyArray<LienDeskEntry>
  affidavits: ReadonlyArray<LienAffidavitEntry>
  /** The courtesy notice per job with a sent notice (`courtesyByJobFrom`); its `lienDay` is the affidavit's. */
  courtesyByJob: Readonly<Record<string, CourtesyStatus>>
  /** Filed affidavits not yet served (`LienWatchResult.serveDue`); absent on a reader without the filings. */
  serveDue?: ReadonlyArray<{ jobId: string }>
  jobTitle: (jobId: string) => string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function daysInMonthOf(month: string): number {
  const m = /^(\d{4})-(\d{2})/.exec(month)
  if (!m) return 30
  return new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate()
}

export function monthKeyAdd(month: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return ''
  const n = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`
}

const monthOf = (ymd: string | null | undefined): string => (ymd && /^\d{4}-\d{2}/.test(ymd) ? ymd.slice(0, 7) : '')
const monthOfIso = (iso: string | null | undefined): string => (iso ? monthOf(calendarYmdInAppTzFromIso(iso)) : '')
const shortDay = (ymd: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}` : ymd
}

/** A zone's days, the quiet zone's running to the month's end. */
export function lienMonthZoneSpan(key: LienMonthZoneKey, rule: LienMonthRule, daysInMonth: number): LienMonthSpan {
  return key === 'quiet' ? { from: rule.quietFrom, to: daysInMonth } : rule[key]
}

/** *1 to 5*, *14 to 15*, *16 to the end*. */
export function lienMonthSpanWords(key: LienMonthZoneKey, span: LienMonthSpan): string {
  if (key === 'quiet') return `${span.from} to the end`
  return span.from === span.to ? `the ${span.from}${ordinal(span.from)}` : `${span.from} to ${span.to}`
}

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  return (['th', 'st', 'nd', 'rd'] as const)[n % 10 > 3 ? 0 : n % 10]!
}

/** The zone today falls in. */
export function lienMonthZoneAt(day: number, rule: LienMonthRule = LIEN_MONTH_RULE): LienMonthZoneKey {
  for (const key of ['reminders', 'notices', 'liens', 'catch_up'] as const) {
    const s = rule[key]
    if (day >= s.from && day <= s.to) return key
  }
  return 'quiet'
}

function zoneState(span: LienMonthSpan, today: number): LienMonthZoneState {
  if (today < span.from) return 'ahead'
  if (today > span.to) return 'behind'
  return 'now'
}

/** The rule as § Rules writes it, one line each: whose it is, then the five zones. */
export function lienMonthRuleLines(rule: LienMonthRule = LIEN_MONTH_RULE): string[] {
  return [
    `The lien month is the office’s rhythm, the owner’s choice: reminders on days ${rule.reminders.from} to ${rule.reminders.to}, notices on days ${rule.notices.from} to ${rule.notices.to}, liens on days ${rule.liens.from} to ${rule.liens.to}, catch-up on the ${rule.catch_up.from}${ordinal(rule.catch_up.from)} and ${rule.catch_up.to}${ordinal(rule.catch_up.to)}, nothing scheduled from the ${rule.quietFrom}${ordinal(rule.quietFrom)}.`,
    'Reminders week sends the one courtesy notice for every lien due this month. It is never before day 7 after the packet.',
    'Notices week sends the notices due this 15th. A notice due a later month waits for its own month and shows in the quiet zone’s queue.',
    'Liens week files the affidavits due this 15th, with two days to spare for a clerk’s refusal, a wrong legal description or a weekend 15th.',
    'Catch-up is for whatever slipped, and for the affidavit’s copies to the owner and the GC within five days of filing, § 53.055.',
    'From the 16th nothing is scheduled. The desk shows what is already queuing for next month.',
  ]
}

const NOTICE_PILE_WORDS: Partial<Record<LienDeskEntry['pile'], string>> = {
  needs_owner: 'to find the owner',
  to_draft: 'to draft',
  awaiting: 'to approve',
  ready: 'to send',
  printed: 'to mail',
}

const AFFIDAVIT_PILE_WORDS: Partial<Record<LienAffidavitEntry['pile'], string>> = {
  needs_property: 'need the property facts',
  to_draft: 'to draft',
  awaiting: 'to approve',
  ready: 'to file',
}

function breakdownWords(jobs: ReadonlyArray<LienMonthJob>, order: ReadonlyArray<string>): string {
  const by = new Map<string, number>()
  for (const j of jobs) if (j.state !== 'done') by.set(j.words, (by.get(j.words) ?? 0) + 1)
  return [...by.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([w, n]) => `${n} ${w}`)
    .join(', ')
}

function sortJobs(jobs: LienMonthJob[]): LienMonthJob[] {
  const rank: Record<LienMonthJobState, number> = { slipped: 0, left: 1, done: 2 }
  return jobs.sort((a, b) => rank[a.state] - rank[b.state] || a.title.localeCompare(b.title))
}

/**
 * The five zones for the month today is in. The reminders zone counts the sent notices whose lien
 * is due this month (the courtesy's `lienDay`) — left while none went, done once one did; held,
 * paused and closed ones are nobody's to send. The notices zone counts the entries whose earliest
 * deadline is this month — left on every pile before Sent, done when the item went this month; a
 * held notice is the leader's standing decision and counts on neither side; a missed month whose
 * deadline fell this month is a slip. The liens zone does the same over the affidavits. Catch-up
 * gathers every slip plus the filed affidavits waiting on their copies. The quiet zone counts next
 * month's three queues.
 */
export function buildLienMonth(input: LienMonthInput): LienMonth {
  const rule = input.rule ?? LIEN_MONTH_RULE
  const month = monthOf(input.todayYmd) || input.todayYmd.slice(0, 7)
  const next = monthKeyAdd(month, 1)
  const today = Math.max(1, Number(input.todayYmd.slice(8, 10)) || 1)
  const daysInMonth = daysInMonthOf(month)
  const todayPct = Math.round(((today - 0.5) / daysInMonth) * 1000) / 10
  const title = (jobId: string) => input.jobTitle(jobId) || jobId.slice(0, 8)

  // Reminders: one courtesy per lien due this month.
  const reminders: LienMonthJob[] = []
  let queueReminders = 0
  for (const [jobId, c] of Object.entries(input.courtesyByJob)) {
    if (c.state === 'none' || c.state === 'closed' || c.state === 'held' || c.state === 'paying') continue
    const lienMonth = monthOf(c.lienDay)
    if (lienMonth === next && !c.lastSentAt) {
      queueReminders += 1
      continue
    }
    if (lienMonth !== month) continue
    if (c.lastSentAt) reminders.push({ jobId, title: title(jobId), state: 'done', words: `sent ${shortDay(calendarYmdInAppTzFromIso(c.lastSentAt))}` })
    else reminders.push({ jobId, title: title(jobId), state: 'left', words: c.state === 'waiting' ? 'before day 7' : 'to send' })
  }

  // Notices: the entries due this 15th.
  const notices: LienMonthJob[] = []
  let queueNotices = 0
  for (const e of input.notices) {
    // A row drafting its next months keeps the notice that went (`sentItem`, v2.6624): that send counts as done this month beside what is left.
    if (e.sentItem?.sent_at && monthOfIso(e.sentItem.sent_at) === month) notices.push({ jobId: e.jobId, title: title(e.jobId), state: 'done', words: `sent ${shortDay(calendarYmdInAppTzFromIso(e.sentItem.sent_at))}` })
    if (e.pile === 'held') continue
    if (e.pile === 'sent') {
      if (monthOfIso(e.item?.sent_at) === month) notices.push({ jobId: e.jobId, title: title(e.jobId), state: 'done', words: `sent ${shortDay(calendarYmdInAppTzFromIso(e.item!.sent_at!))}` })
      continue
    }
    if (e.pile === 'missed') {
      const slippedHere = e.missedMonths.some((k) => monthOf(e.months.find((m) => m.key === k)?.deadline) === month)
      if (slippedHere) notices.push({ jobId: e.jobId, title: title(e.jobId), state: 'slipped', words: 'missed' })
      continue
    }
    const due = monthOf(e.earliestDeadline)
    if (due === next) {
      queueNotices += 1
      continue
    }
    if (due !== month) continue
    notices.push({ jobId: e.jobId, title: title(e.jobId), state: 'left', words: NOTICE_PILE_WORDS[e.pile] ?? 'to send' })
  }

  // Liens: the affidavits due this 15th.
  const liens: LienMonthJob[] = []
  let queueLiens = 0
  for (const a of input.affidavits) {
    if (a.pile === 'held') continue
    const due = monthOf(a.deadline)
    if (a.pile === 'filed') {
      const filedMonth = monthOfIso(a.item?.sent_at) || due
      if (filedMonth === month) liens.push({ jobId: a.jobId, title: title(a.jobId), state: 'done', words: a.item?.sent_at ? `filed ${shortDay(calendarYmdInAppTzFromIso(a.item.sent_at))}` : 'filed' })
      continue
    }
    if (a.pile === 'missed') {
      if (due === month) liens.push({ jobId: a.jobId, title: title(a.jobId), state: 'slipped', words: 'missed' })
      continue
    }
    if (due === next) {
      queueLiens += 1
      continue
    }
    if (due !== month) continue
    liens.push({ jobId: a.jobId, title: title(a.jobId), state: 'left', words: AFFIDAVIT_PILE_WORDS[a.pile] ?? 'to file' })
  }

  const working = (key: Exclude<LienMonthZoneKey, 'quiet' | 'catch_up'>, jobs: LienMonthJob[], order: ReadonlyArray<string>): LienMonthZone => {
    const span = lienMonthZoneSpan(key, rule, daysInMonth)
    const state = zoneState(span, today)
    // Past its days, what is left has slipped.
    if (state === 'behind') for (const j of jobs) if (j.state === 'left') j.state = 'slipped'
    sortJobs(jobs)
    const left = jobs.filter((j) => j.state === 'left').length
    const done = jobs.filter((j) => j.state === 'done').length
    const slipped = jobs.filter((j) => j.state === 'slipped').length
    return { key, label: LIEN_MONTH_ZONE_LABEL[key], work: LIEN_MONTH_ZONE_WORK[key], span, days: span.to - span.from + 1, state, left, done, slipped, jobs, breakdown: breakdownWords(jobs, order), copies: 0, queue: null }
  }

  const remindersZone = working('reminders', reminders, ['to send', 'before day 7'])
  const noticesZone = working('notices', notices, ['to find the owner', 'to draft', 'to approve', 'to send', 'to mail', 'missed'])
  const liensZone = working('liens', liens, ['need the property facts', 'to draft', 'to approve', 'to file', 'missed'])

  const catchSpan = lienMonthZoneSpan('catch_up', rule, daysInMonth)
  const slips = sortJobs([...remindersZone.jobs, ...noticesZone.jobs, ...liensZone.jobs].filter((j) => j.state === 'slipped').map((j) => ({ ...j })))
  const copies = input.serveDue?.length ?? 0
  const catchUp: LienMonthZone = {
    key: 'catch_up',
    label: LIEN_MONTH_ZONE_LABEL.catch_up,
    work: LIEN_MONTH_ZONE_WORK.catch_up,
    span: catchSpan,
    days: catchSpan.to - catchSpan.from + 1,
    state: zoneState(catchSpan, today),
    left: slips.length + copies,
    done: 0,
    slipped: slips.length,
    jobs: slips,
    breakdown: [slips.length ? `${slips.length} slipped` : '', copies ? `${copies} ${copies === 1 ? 'copy' : 'copies'} to mail` : ''].filter(Boolean).join(', '),
    copies,
    queue: null,
  }

  const quietSpan = lienMonthZoneSpan('quiet', rule, daysInMonth)
  const quiet: LienMonthZone = {
    key: 'quiet',
    label: LIEN_MONTH_ZONE_LABEL.quiet,
    work: LIEN_MONTH_ZONE_WORK.quiet,
    span: quietSpan,
    days: Math.max(0, quietSpan.to - quietSpan.from + 1),
    state: today >= quietSpan.from ? 'now' : 'ahead',
    left: 0,
    done: 0,
    slipped: 0,
    jobs: [],
    breakdown: '',
    copies: 0,
    queue: { reminders: queueReminders, notices: queueNotices, liens: queueLiens },
  }

  return { month, today, daysInMonth, todayPct, zone: lienMonthZoneAt(today, rule), zones: [remindersZone, noticesZone, liensZone, catchUp, quiet], rule }
}

const VERB: Record<Exclude<LienMonthZoneKey, 'quiet' | 'catch_up'>, { todo: string; done: string }> = {
  reminders: { todo: 'to send', done: 'sent' },
  notices: { todo: 'to send', done: 'sent' },
  liens: { todo: 'to file', done: 'filed' },
}

export type LienMonthZoneTone = 'ahead' | 'now' | 'done' | 'slipped' | 'quiet'

/** The zone's count line and its tone: *12 to send · 4 sent*, *all 9 sent*, *2 slipped · Ridgeway Builders*, *9 reminders · 6 notices · 2 liens*. */
export function lienMonthZoneLine(zone: LienMonthZone): { head: string; sub: string; tone: LienMonthZoneTone } {
  if (zone.key === 'quiet') {
    const q = zone.queue ?? { reminders: 0, notices: 0, liens: 0 }
    const parts = [q.reminders ? `${q.reminders} ${pluralNoun('reminder', q.reminders)}` : '', q.notices ? `${q.notices} ${pluralNoun('notice', q.notices)}` : '', q.liens ? `${q.liens} ${pluralNoun('lien', q.liens)}` : ''].filter(Boolean)
    return { head: parts.length ? parts.join(' · ') : 'nothing queuing yet', sub: 'for next month', tone: 'quiet' }
  }
  if (zone.key === 'catch_up') {
    if (zone.state === 'ahead') return { head: zone.slipped ? `${zone.slipped} slipped so far` : 'nothing slipped yet', sub: zone.copies ? `${zone.copies} ${zone.copies === 1 ? 'copy' : 'copies'} to mail` : '', tone: zone.slipped ? 'slipped' : 'ahead' }
    if (zone.left === 0) return { head: 'nothing slipped', sub: zone.state === 'behind' ? 'the month went clean' : '', tone: 'done' }
    const first = zone.jobs[0]
    return { head: zone.breakdown, sub: first ? first.title : '', tone: 'slipped' }
  }
  const v = VERB[zone.key]
  if (zone.state === 'ahead') return { head: zone.left ? `${zone.left} coming` : 'nothing coming', sub: zone.breakdown, tone: 'ahead' }
  if (zone.state === 'now') return { head: `${zone.left} ${v.todo} · ${zone.done} ${v.done}`, sub: zone.breakdown, tone: 'now' }
  if (zone.slipped === 0) return { head: zone.done ? `all ${zone.done} ${v.done}` : `nothing to ${v.todo.replace(/^to /, '')}`, sub: '', tone: 'done' }
  const first = zone.jobs.find((j) => j.state === 'slipped')
  return { head: `${zone.slipped} slipped · ${zone.done} ${v.done}`, sub: first ? first.title : '', tone: 'slipped' }
}

/** The zone's one press, which opens To do on that work; null when there is nothing to open. */
export function lienMonthZonePress(zone: LienMonthZone): string | null {
  if (zone.key === 'quiet') return null
  // Catch-up's `left` already holds its slips and the copies; a working zone's slips sit beside its `left`.
  const n = zone.key === 'catch_up' ? zone.left : zone.left + zone.slipped
  if (n <= 0) return null
  if (zone.key === 'catch_up') return countedLabel('Show', n, ['slip', 'slips'])
  if (zone.key === 'reminders') return countedLabel('Show', n, ['reminder', 'reminders'])
  if (zone.key === 'notices') return countedLabel('Show', n, ['notice', 'notices'])
  return countedLabel('Show', n, ['lien', 'liens'])
}

/** Whether a To do row is the zone's work: its job is one the zone counts and the row is that zone's kind of paper. */
export function lienMonthZoneHasRow(zone: LienMonthZone, row: Pick<LienNextUpRow, 'kind' | 'jobId' | 'action'>): boolean {
  if (zone.key === 'quiet' || !row.jobId) return false
  const open = new Set(zone.jobs.filter((j) => j.state !== 'done').map((j) => j.jobId))
  if (zone.key === 'catch_up') return open.has(row.jobId) || row.action === 'record_service'
  if (!open.has(row.jobId)) return false
  if (zone.key === 'reminders') return row.action === 'courtesy'
  if (zone.key === 'notices') return row.kind === 'notice' && row.action !== 'courtesy' && row.action !== 'letter_two' && row.action !== 'promise'
  return row.kind === 'affidavit'
}

/** The bar in one sentence, for a title or a screen reader. */
export function lienMonthWords(m: LienMonth): string {
  const zone = m.zones.find((z) => z.key === m.zone)!
  return `Day ${m.today} of the lien month · ${zone.label} (days ${lienMonthSpanWords(zone.key, zone.span)}) · ${lienMonthZoneLine(zone).head}.`
}
