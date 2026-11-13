/**
 * Bills sent (punch list #327, PR 1): one line each time a bill leaves the company, read from the records the app
 * already keeps. The master asked for a ledger he can open at any time that says which bills went out, to whom, and
 * when exactly. Nothing here is a new record: a line is a sent copy (`sent_documents`, `lib/sent/`) with the bill's
 * amount and the job's words beside it, so the list can never disagree with what was sent.
 *
 * The rules, pure. The reads are `billsSentIo.ts`, the screen `components/billing/BillsSentLedger.tsx` at `/bills-sent`.
 *
 * - Every send is its own line. A bill sent twice is two lines, the second marked *2nd send* with the day of the first.
 * - A day's total counts a bill once, on the day it first went. A resend and a statement are listed and not added.
 * - A copy that went to an address on the copy list folds into its send, as *copy to*.
 * - The line never guesses. A print says the app cannot know who was handed it.
 *
 * PR 2 adds the sends that kept no copy, each saying what it lacks: an email of a Stripe bill before the copies began
 * (`jobs_ledger_invoice_stripe_email_sends`: the time, no address), a bill entered from Housecall Pro (the invoice's
 * own stamp: the day only) and a text that carried the pay link (`messages`). It also adds the gaps: a bill that was
 * made and has no send of any kind on record (`billsSentGaps`), shown above the days so a missing send is seen.
 *
 * PR 3 adds whether a send arrived. An email's last word from the mail service (`bill_send_marks`, over
 * `email_send_log`) reads *Delivered 9:28 AM*, *Opened 9:41 AM* or *Bounced. It did not arrive.* A line whose send did
 * not arrive, on a bill still open with no later send that did, is `stillMissed`: the red tile counts those.
 *
 * PR 4 adds one bill's record (`billsSentRecord`): every send of that bill in order, newest first, each with who it
 * went to and whether it arrived, and the paper it prints as (`billsSentRecordHtml`).
 *
 * PR 5 takes the list out of the app: the lines on the screen as a spreadsheet (`billsSentCsv`) and as a page to
 * print (`billsSentListHtml`), each in the order and with the words the screen shows.
 *
 * PR 6 lets a person say how a bill went when the app did not send it: handed over, mailed, emailed from their own
 * mailbox, sent from Housecall Pro. The record is one sent copy of kind `bill_by_hand` with no copy body
 * (`byHandFiling`), so the bill leaves the gaps and reads as a line on the day it went, marked as someone's word.
 *
 * A phone draws a line in three rows (`billsSentPhoneWords`): the time and the amount, then the work, then where it
 * went. The bill's number stays on the bill's record, where the whole line leads.
 */
import { appTzWallTimeMs, companyWeekStartSundayContaining, calendarYmdInAppTzFromIso, formatDenverTimeOnly, formatWorkDateYmdMonthDayShort, formatWorkDateYmdWeekdayShortFriendly, ymdAddDays } from '../../utils/dateUtils'
import { escapeCsvField } from '../domTableToCsv'
import { formatCurrency } from '../format'
import { canReadSentCopies, sentKindWords, type SentCopy, type SentFiling } from '../sent/sentCopies'
import { sentCopyJobLabel, type SentCopyAboutJob } from '../sent/sentCopyAbout'

/** Who may open the screen: the people who read sent copies, as the table's own policy (dev, master, assistant, controller). */
export function canOpenBillsSent(role: string | null | undefined): boolean {
  return canReadSentCopies(role)
}

export const BILLS_SENT_PATH = '/bills-sent'

/** The papers the list reads: every kind that begins `bill`, a statement to a general contractor, a pay application. */
export const BILLS_SENT_KIND_PREFIX = 'bill'
export const BILLS_SENT_OTHER_KINDS: ReadonlyArray<string> = ['gc_statement', 'gc_statement_print', 'pay_application']

export function isBillsSentKind(kind: string): boolean {
  return kind.startsWith(BILLS_SENT_KIND_PREFIX) || BILLS_SENT_OTHER_KINDS.includes(kind)
}

/** A sent copy as the list reads it: the row, the jobs it names and the id that ties an email to its statement row. */
export type BillsSentCopy = SentCopy & { resendEmailId?: string | null }

/** The bill a copy was drawn from (`jobs_ledger_invoices`). */
export interface BillsSentBill {
  id: string
  jobId: string | null
  amount: number | null
  status: string
  /** When the bill was made, for its record. Absent on a read that did not ask. */
  billedAtIso?: string | null
}

/** A job's words and what the search box can find it by. */
export interface BillsSentJob extends SentCopyAboutJob {
  job_address?: string | null
  customer_name?: string | null
}

/** A statement's own row (`gc_statement_emails`), by the email's id. */
export interface BillsSentStatement {
  resendEmailId: string
  total: number | null
  jobCount: number | null
}

/** A send of a bill the page did not load as a line: enough to say which send a line is and when the first went. */
export interface BillsSentEarlier {
  billId: string
  atIso: string
}

/** One email of a Stripe bill as the send log has it (`jobs_ledger_invoice_stripe_email_sends`): the time and the copy list, never the main address. */
export interface BillsSentStripeRow {
  id: string
  billId: string
  atIso: string
  copyEmails: string[]
}

/** A bill whose only record of going out is the stamp on the bill itself: entered from Housecall Pro, or a PDF emailed before the copies began. The day, at noon. */
export interface BillsSentStamp {
  billId: string
  atIso: string
  channel: 'housecallpro' | 'physical'
}

/** A text that carried a pay link (`messages`). The bill is the one its link opens, when the link still names one. */
export interface BillsSentText {
  id: string
  atIso: string
  billId: string | null
  jobId: string | null
  number: string
  toName: string
  by: string
  /** Quo's answer: delivered, undelivered, failed, or null before it answers. */
  delivery: string | null
}

/** A bill the app made that carries no send stamp: billed or paid, a Stripe bill, never emailed from the app. */
export interface BillsSentUnsent {
  billId: string
  jobId: string | null
  amount: number | null
  status: string
  billedAtIso: string
}

/** What the mail service last said of one sent copy, and the day its bill was paid (`bill_send_marks`). */
export interface BillsSentMark {
  id: string
  /** sent, delivered, delivery_delayed, bounced, complained, opened or clicked. Null when not known. */
  lastEvent: string | null
  lastEventAtIso: string | null
  /** The email's type on the log: `gc_statement_scheduled` is a statement the app sent on a schedule. */
  emailType: string | null
  /** YYYY-MM-DD, for a copy of a paid bill. */
  paidOn: string | null
  paidHow: string | null
}

export interface BillsSentInput {
  copies: ReadonlyArray<BillsSentCopy>
  bills: ReadonlyMap<string, BillsSentBill>
  jobs: ReadonlyMap<string, BillsSentJob>
  statements: ReadonlyMap<string, BillsSentStatement>
  /** Every send on record of the bills on the page, the page's own included. */
  earlier: ReadonlyArray<BillsSentEarlier>
  stripeRows?: ReadonlyArray<BillsSentStripeRow>
  stamps?: ReadonlyArray<BillsSentStamp>
  texts?: ReadonlyArray<BillsSentText>
  unsent?: ReadonlyArray<BillsSentUnsent>
  /** By sent copy id. Absent before the read function is on the database: the lines then say nothing of arriving. */
  marks?: ReadonlyMap<string, BillsSentMark>
}

/** How it left, as the chips sort it. */
export type BillsSentRoute = 'email' | 'text' | 'printed' | 'statement' | 'housecall_pro' | 'by_hand' | 'other'

/** The name the tile, the chip and the strip give a bill that has no send of any kind on record. */
export const BILLS_SENT_GAP_LABEL = 'No send on record'

/** A chip's key: a route, every line, the sends that did not arrive, or the bills with no send on record. */
export type BillsSentChip = BillsSentRoute | 'all' | 'missed' | 'gap'

/** The chips: every route, the sends that did not arrive, then the bills with no send on record (`gap`), which are not lines. */
export const BILLS_SENT_ROUTE_CHIPS: ReadonlyArray<{ key: BillsSentChip; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Email' },
  { key: 'text', label: 'Text' },
  { key: 'printed', label: 'Printed' },
  { key: 'statement', label: 'Statement' },
  { key: 'housecall_pro', label: 'Housecall Pro' },
  { key: 'by_hand', label: 'Recorded by hand' },
  { key: 'missed', label: 'Did not arrive' },
  { key: 'gap', label: BILLS_SENT_GAP_LABEL },
]

/** The day the app began keeping a copy of each send. A send before it has a time and no address. */
export const BILLS_SENT_COPIES_BEGAN_YMD = '2026-10-05'

export interface BillsSentLine {
  /** The sent copy's id, or the id of the record a line with no copy came from (`row:…`, `stamp:…`, `text:…`). */
  id: string
  atIso: string
  /** True when the record holds the day and no time: the line reads *Day only*. */
  dayOnly: boolean
  route: BillsSentRoute
  /** The chip on the line: *Email*, *Email, sent again*, *Printed*, *Statement*, *Saved as a file*. */
  routeWords: string
  /** *Bill 1412-0002*, *Statement*, *Pay application 4*. */
  what: string
  billId: string | null
  /** The job's words and its door; '' and null on a paper that names no job. */
  jobWords: string
  jobTo: string | null
  /** Who it was for, by name. */
  payer: string
  amount: number | null
  /** True when this line adds to its day's total: the first send on record of a bill that has an amount. */
  counts: boolean
  /** True when the bill is paid today. */
  paid: boolean
  toName: string
  toAddresses: string[]
  copyTo: string[]
  /** Who pressed send. */
  by: string
  /** Which send of this bill the line is: 1 for the first. */
  nth: number
  /** The first send's time, on a line that is not the first. */
  firstAtIso: string | null
  /** What the app cannot know or wants said: under a print, under a statement. '' otherwise. */
  note: string
  /** Whether it arrived, in words: *Delivered 9:28 AM*, *Opened 9:41 AM*, *Bounced. It did not arrive.*, a text's *Delivered* or *Not delivered*. '' when not known. */
  delivery: string
  /** How the words read: it arrived, it did not, or the mail service has not said. '' with no words. */
  deliveryTone: '' | 'ok' | 'bad' | 'quiet'
  /** True when this send did not arrive, the bill is not paid, and no later send of the bill arrived. */
  stillMissed: boolean
  /** The day the bill was paid, YYYY-MM-DD, when the read knows it. */
  paidOn: string | null
  /** True for a statement the app sent on a schedule: `by` is then whose schedule it is. */
  bySchedule: boolean
  /** The copy the line opens; null on a send that kept none, whose note says so. */
  copy: BillsSentCopy | null
  /** The copies to the copy list that went with this send, to open beside it. */
  copies: BillsSentCopy[]
  /** What the search box matches, lower case. */
  haystack: string
}

/** A copy to the copy list rides with the send it followed when it went within this long of it. */
const COPY_FOLD_MS = 5 * 60_000

const BILL_SOURCE = 'jobs_ledger_invoices'

const isStatementKind = (kind: string): boolean => kind.startsWith('gc_statement')

/** The words for a paper that is a bill of a named sort. */
const KIND_WHAT: Readonly<Record<string, string>> = {
  bill_gc_pay_app: 'Pay application',
  bill_gc_certified: 'Certified bill',
  bill_gc_reminder: 'Reminder',
  bill_gc_interest: 'Interest bill',
}

/**
 * The number on the bill as the payer read it, from the email's own title: *Invoice #1412-0002 from …* gives
 * `1412-0002`. '' when the title carries none (a print, a paper that is not a Stripe bill).
 */
export function billNumberFromTitle(title: string): string {
  const m = /#\s*([A-Za-z0-9][A-Za-z0-9-]*)/.exec(title)
  return m?.[1] ?? ''
}

function whatOf(copy: BillsSentCopy): string {
  if (isStatementKind(copy.kind)) return 'Statement'
  if (copy.kind === 'pay_application') {
    const n = copy.sourceSnapshot?.applicationNumber
    return typeof n === 'number' || (typeof n === 'string' && n.trim()) ? `Pay application ${n}` : 'Pay application'
  }
  const named = KIND_WHAT[copy.kind]
  if (named) return named
  if (copy.kind === 'bill' || copy.kind === 'bill_resent' || copy.kind === 'bill_copy' || copy.kind === 'bill_pay_code') {
    const number = billNumberFromTitle(copy.title)
    return number ? `Bill ${number}` : 'Bill'
  }
  return sentKindWords(copy.kind) || 'Bill'
}

function routeOf(copy: BillsSentCopy): BillsSentRoute {
  if (isStatementKind(copy.kind)) return 'statement'
  if (copy.how === 'email') return 'email'
  if (copy.how === 'print') return 'printed'
  return 'other'
}

const OTHER_ROUTE_WORDS: Readonly<Record<string, string>> = { hand: 'Handed over', mail: 'Mailed', link: 'Link sent', download: 'Saved as a file' }

function routeWordsOf(copy: BillsSentCopy, route: BillsSentRoute, nth: number): string {
  if (route === 'statement') return copy.how === 'print' ? 'Statement, printed' : 'Statement'
  if (route === 'email') return nth > 1 ? 'Email, sent again' : 'Email'
  if (route === 'printed') return 'Printed'
  return OTHER_ROUTE_WORDS[copy.how] ?? 'Sent'
}

function noteOf(copy: BillsSentCopy, route: BillsSentRoute): string {
  if (route === 'statement') return copy.how === 'print' ? 'Lists bills already sent. Not in the day’s total. The app cannot know who it was handed to.' : 'Lists bills already sent. Not in the day’s total.'
  if (route === 'printed') return copy.kind === 'bill_pay_code' ? 'The pay sheet was printed. The app cannot know who it was handed to.' : 'Printed. The app cannot know who it was handed to.'
  if (copy.how === 'download') return 'Saved as a file. The app cannot know where it went.'
  return ''
}

const billIdOf = (copy: BillsSentCopy): string | null => (copy.sourceTable === BILL_SOURCE && copy.sourceId ? copy.sourceId : null)

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * The lines, newest first. A copy to the copy list folds into the send it rode with. Each line knows which send of
 * its bill it is from every send on record (`earlier`), so a second send whose first is off the page still says so.
 */
export function billsSentLines(input: BillsSentInput): BillsSentLine[] {
  const ms = (iso: string): number => {
    const t = Date.parse(iso)
    return Number.isFinite(t) ? t : 0
  }
  const wanted = input.copies.filter((c) => isBillsSentKind(c.kind))
  const riders = wanted.filter((c) => c.kind === 'bill_copy')
  // A record made by hand is a person's word that a bill went, on the day they named: a line of its own shape.
  const byHand = wanted.filter((c) => c.kind === BILLS_SENT_BY_HAND_KIND)
  const sends = wanted.filter((c) => c.kind !== 'bill_copy' && c.kind !== BILLS_SENT_BY_HAND_KIND).sort((a, b) => ms(b.sentAt) - ms(a.sentAt))

  // Every send on record of each bill, oldest first, the page's own included once.
  const timesByBill = new Map<string, number[]>()
  const note = (billId: string, at: number) => {
    const list = timesByBill.get(billId) ?? []
    if (!list.includes(at)) list.push(at)
    timesByBill.set(billId, list)
  }
  for (const e of input.earlier) note(e.billId, ms(e.atIso))
  for (const c of sends) {
    const billId = billIdOf(c)
    if (billId) note(billId, ms(c.sentAt))
  }

  // An email row of the send log is the same send as the copy filed with it: the copy is the line, the row is not
  // drawn twice. A row with no copy near it (a send before the copies began, or one Stripe made for us) is its own line.
  const covered = new Set<string>()
  for (const c of sends) {
    const billId = billIdOf(c)
    if (!billId || c.how !== 'email') continue
    let best: BillsSentStripeRow | null = null
    for (const r of input.stripeRows ?? []) {
      if (r.billId !== billId || covered.has(r.id)) continue
      const gap = Math.abs(ms(r.atIso) - ms(c.sentAt))
      if (gap <= COPY_FOLD_MS && (!best || gap < Math.abs(ms(best.atIso) - ms(c.sentAt)))) best = r
    }
    if (best) covered.add(best.id)
  }
  const bareRows = (input.stripeRows ?? []).filter((r) => !covered.has(r.id))
  // A stamp stands for a bill that has no other record of going out.
  const stamps = (input.stamps ?? []).filter((st) => ![...sends, ...byHand].some((c) => billIdOf(c) === st.billId))
  const texts = input.texts ?? []
  for (const c of byHand) {
    const billId = billIdOf(c)
    if (billId) note(billId, ms(byHandWentAtIso(c)))
  }
  for (const r of bareRows) note(r.billId, ms(r.atIso))
  for (const st of stamps) note(st.billId, ms(st.atIso))
  for (const t of texts) if (t.billId) note(t.billId, ms(t.atIso))
  for (const list of timesByBill.values()) list.sort((a, b) => a - b)

  // The number a bill carries, from any copy of it on the page, for a line that has no copy of its own.
  const numberByBill = new Map<string, string>()
  for (const c of wanted) {
    const billId = billIdOf(c)
    const number = billId ? billNumberFromTitle(c.title) : ''
    if (billId && number && !numberByBill.has(billId)) numberByBill.set(billId, number)
  }

  // A copy to the copy list rides with the nearest send of its bill; one with no send near it stands as its own line.
  const ridersBySend = new Map<string, BillsSentCopy[]>()
  const alone: BillsSentCopy[] = []
  for (const r of riders) {
    const billId = billIdOf(r)
    const at = ms(r.sentAt)
    let best: BillsSentCopy | null = null
    for (const s of sends) {
      if (!billId || billIdOf(s) !== billId || s.how !== 'email') continue
      const gap = Math.abs(ms(s.sentAt) - at)
      if (gap <= COPY_FOLD_MS && (!best || gap < Math.abs(ms(best.sentAt) - at))) best = s
    }
    if (best) ridersBySend.set(best.id, [...(ridersBySend.get(best.id) ?? []), r])
    else alone.push(r)
  }

  const lineOf = (copy: BillsSentCopy, rode: BillsSentCopy[]): BillsSentLine => {
    const billId = billIdOf(copy)
    const bill = billId ? input.bills.get(billId) : undefined
    const route = routeOf(copy)
    const times = billId ? (timesByBill.get(billId) ?? []) : []
    const at = ms(copy.sentAt)
    const nth = billId ? Math.max(1, times.indexOf(at) + 1) : 1
    const firstAt = nth > 1 && times.length ? times[0]! : null
    const statement = copy.resendEmailId ? input.statements.get(copy.resendEmailId) : undefined
    const amount =
      route === 'statement'
        ? (statement?.total ?? null)
        : copy.kind === 'pay_application'
          ? num(copy.sourceSnapshot?.currentPaymentDue)
          : (bill?.amount ?? null)
    const jobId = (copy.jobIds ?? [])[0] ?? bill?.jobId ?? null
    const job = jobId ? input.jobs.get(jobId) : undefined
    const jobWords = jobId ? sentCopyJobLabel(jobId, job) : route === 'statement' && statement?.jobCount ? plural(statement.jobCount, 'job') : ''
    const payer = copy.recipientName || (job?.customer_name ?? '').trim()
    const copyTo = [...new Set(rode.flatMap((r) => r.recipientEmails))].filter((a) => !copy.recipientEmails.includes(a))
    const what = whatOf(copy)
    const mark = input.marks?.get(copy.id)
    const arrival = arrivalOf(mark, copy.sentAt)
    return {
      id: copy.id,
      atIso: copy.sentAt,
      dayOnly: false,
      delivery: arrival.words,
      deliveryTone: arrival.tone,
      stillMissed: false,
      paidOn: mark?.paidOn ?? null,
      bySchedule: mark?.emailType === 'gc_statement_scheduled',
      route,
      routeWords: routeWordsOf(copy, route, nth),
      what,
      billId,
      jobWords,
      jobTo: jobId ? `/jobs?edit=${encodeURIComponent(jobId)}` : null,
      payer,
      amount,
      counts: !!billId && nth === 1 && amount != null && route !== 'statement',
      paid: bill?.status === 'paid',
      toName: copy.recipientName,
      toAddresses: copy.recipientEmails,
      copyTo,
      by: copy.sentByName,
      nth,
      firstAtIso: firstAt != null ? new Date(firstAt).toISOString() : null,
      note: noteOf(copy, route),
      copy,
      copies: rode,
      haystack: [what, jobWords, payer, copy.recipientName, ...copy.recipientEmails, ...copyTo, (job?.job_address ?? '').trim(), (job?.customer_name ?? '').trim(), copy.sentByName, copy.title]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }
  }

  /** A line for a send that kept no copy: what the record holds, and a note that says what it lacks. */
  const bareLine = (o: {
    id: string
    atIso: string
    billId: string | null
    jobId?: string | null
    route: BillsSentRoute
    routeWords: (nth: number) => string
    dayOnly?: boolean
    toName?: string
    toAddresses?: string[]
    copyTo?: string[]
    by?: string
    delivery?: string
    note: string
  }): BillsSentLine => {
    const bill = o.billId ? input.bills.get(o.billId) : undefined
    const times = o.billId ? (timesByBill.get(o.billId) ?? []) : []
    const nth = o.billId ? Math.max(1, times.indexOf(ms(o.atIso)) + 1) : 1
    const firstAt = nth > 1 && times.length ? times[0]! : null
    const jobId = o.jobId ?? bill?.jobId ?? null
    const job = jobId ? input.jobs.get(jobId) : undefined
    const jobWords = jobId ? sentCopyJobLabel(jobId, job) : ''
    const payer = (job?.customer_name ?? '').trim()
    const number = o.billId ? (numberByBill.get(o.billId) ?? '') : ''
    const what = number ? `Bill ${number}` : 'Bill'
    const amount = bill?.amount ?? null
    const toName = (o.toName ?? '').trim()
    const toAddresses = o.toAddresses ?? []
    const copyTo = o.copyTo ?? []
    const by = (o.by ?? '').trim()
    return {
      id: o.id,
      atIso: o.atIso,
      dayOnly: o.dayOnly ?? false,
      delivery: o.delivery ?? '',
      deliveryTone: o.delivery === 'Delivered' ? 'ok' : o.delivery ? 'bad' : '',
      stillMissed: false,
      paidOn: null,
      bySchedule: false,
      route: o.route,
      routeWords: o.routeWords(nth),
      what,
      billId: o.billId,
      jobWords,
      jobTo: jobId ? `/jobs?edit=${encodeURIComponent(jobId)}` : null,
      payer,
      amount,
      counts: !!o.billId && nth === 1 && amount != null,
      paid: bill?.status === 'paid',
      toName,
      toAddresses,
      copyTo,
      by,
      nth,
      firstAtIso: firstAt != null ? new Date(firstAt).toISOString() : null,
      note: o.note,
      copy: null,
      copies: [],
      haystack: [what, jobWords, payer, toName, ...toAddresses, ...copyTo, (job?.job_address ?? '').trim(), by, o.routeWords(nth)].filter(Boolean).join(' ').toLowerCase(),
    }
  }

  const rowLines = bareRows.map((r) =>
    bareLine({
      id: `row:${r.id}`,
      atIso: r.atIso,
      billId: r.billId,
      route: 'email',
      routeWords: (nth) => (nth > 1 ? 'Email, sent again' : 'Email'),
      copyTo: r.copyEmails,
      note:
        calendarYmdInAppTzFromIso(r.atIso) < BILLS_SENT_COPIES_BEGAN_YMD
          ? 'The address was not kept. The app kept no copy of a send before Oct 5, 2026.'
          : 'No copy of this send was kept, so the address is not on record.',
    }),
  )
  const stampLines = stamps.map((st) =>
    bareLine({
      id: `stamp:${st.billId}`,
      atIso: st.atIso,
      billId: st.billId,
      dayOnly: true,
      route: st.channel === 'housecallpro' ? 'housecall_pro' : 'email',
      routeWords: () => (st.channel === 'housecallpro' ? 'Housecall Pro' : 'Email'),
      note:
        st.channel === 'housecallpro'
          ? 'Sent from Housecall Pro. The app has the day only. It has no address, no sender and no copy.'
          : 'Emailed as a PDF. The app has the day only, and kept no copy.',
    }),
  )
  const textLines = texts.map((t) =>
    bareLine({
      id: `text:${t.id}`,
      atIso: t.atIso,
      billId: t.billId,
      jobId: t.jobId,
      route: 'text',
      routeWords: () => 'Text with pay link',
      toName: t.toName,
      toAddresses: t.number ? [t.number] : [],
      by: t.by,
      delivery: t.delivery === 'delivered' ? 'Delivered' : t.delivery === 'undelivered' || t.delivery === 'failed' ? 'Not delivered' : '',
      note: t.billId ? '' : 'The pay link in this text no longer names a bill.',
    }),
  )

  const byHandLines = byHand.map((c) => {
    const how = byHandHowOf(c)
    const recordedYmd = Number.isFinite(Date.parse(c.sentAt)) ? calendarYmdInAppTzFromIso(c.sentAt) : ''
    const said = typeof c.sourceSnapshot?.note === 'string' ? c.sourceSnapshot.note.trim() : ''
    return bareLine({
      id: c.id,
      atIso: byHandWentAtIso(c),
      billId: billIdOf(c),
      jobId: (c.jobIds ?? [])[0] ?? null,
      dayOnly: true,
      route: 'by_hand',
      routeWords: () => BILLS_SENT_BY_HAND_HOWS.find((h) => h.key === how)?.label ?? 'Recorded by hand',
      toName: c.recipientName,
      by: c.sentByName,
      note: [`Recorded by hand${recordedYmd ? ` on ${formatWorkDateYmdWeekdayShortFriendly(recordedYmd)}` : ''}. The app sent nothing and kept no copy.`, said].filter(Boolean).join(' '),
    })
  })
  const lines = [...sends.map((s) => lineOf(s, ridersBySend.get(s.id) ?? [])), ...alone.map((r) => lineOf(r, [])), ...rowLines, ...stampLines, ...textLines, ...byHandLines].sort((a, b) => ms(b.atIso) - ms(a.atIso))
  // A send that did not arrive still wants someone when its bill is open and nothing sent after it arrived.
  for (const line of lines) {
    if (line.deliveryTone !== 'bad' || line.paid) continue
    line.stillMissed = !lines.some((other) => other !== line && !!line.billId && other.billId === line.billId && other.deliveryTone === 'ok' && ms(other.atIso) > ms(line.atIso))
  }
  return lines
}

/**
 * What the mail service last said of an email, in the line's words. The service keeps only its last word: *opened*
 * means it was delivered and then opened. A send with no word yet says nothing, never that it did not arrive.
 */
function arrivalOf(mark: BillsSentMark | undefined, sentAtIso: string): { words: string; tone: BillsSentLine['deliveryTone'] } {
  const event = mark?.lastEvent ?? ''
  if (!event) return { words: '', tone: '' }
  const at = mark?.lastEventAtIso ?? ''
  const sameDay = at && calendarYmdInAppTzFromIso(at) === calendarYmdInAppTzFromIso(sentAtIso)
  const when = !at ? '' : sameDay ? ` ${billsSentTime(at)}` : ` ${formatWorkDateYmdWeekdayShortFriendly(calendarYmdInAppTzFromIso(at))} at ${billsSentTime(at)}`
  switch (event) {
    case 'delivered':
      return { words: `Delivered${when}`, tone: 'ok' }
    case 'opened':
    case 'clicked':
      return { words: `Opened${when}`, tone: 'ok' }
    case 'bounced':
      return { words: 'Bounced. It did not arrive.', tone: 'bad' }
    case 'complained':
      return { words: 'Delivered. The reader marked it as spam.', tone: 'quiet' }
    case 'delivery_delayed':
      return { words: 'Delayed by their mail server.', tone: 'quiet' }
    case 'sent':
      return { words: 'Sent. Their mail server has not answered yet.', tone: 'quiet' }
    default:
      return { words: '', tone: '' }
  }
}

/** Who sent it, as the line writes it: *by Priya*, or *by the app, on Marcus’s schedule* for a statement on a schedule. */
export function billsSentByWords(line: Pick<BillsSentLine, 'by' | 'bySchedule'>): string {
  if (line.bySchedule) return line.by ? `by the app, on ${line.by}’s schedule` : 'by the app, on a schedule'
  return line.by ? `by ${line.by}` : ''
}

/** A paid bill's word on its lines: *Paid Nov 9* when the day is known, *Paid since* when only the fact is. '' when not paid. */
export function billsSentPaidWords(line: Pick<BillsSentLine, 'paid' | 'paidOn'>): string {
  if (line.paidOn) return `Paid ${formatWorkDateYmdMonthDayShort(line.paidOn)}`
  return line.paid ? 'Paid since' : ''
}

/** A bill with no send on record, as the strip above the days draws it. */
export interface BillsSentGap {
  billId: string
  jobId: string | null
  jobWords: string
  jobTo: string | null
  payer: string
  amount: number | null
  paid: boolean
  /** *Billed Mon, Nov 9 at 3:26 PM.* */
  billedWords: string
  haystack: string
}

/**
 * The bills that were made and have no send of any kind on record: no email, no text, no print. The open ones are
 * the ones to look at; the paid ones are told apart, since a bill paid at the door needed no send. A bill with a
 * line on the list is never a gap, whatever its stamp says.
 */
export function billsSentGaps(input: Pick<BillsSentInput, 'unsent' | 'jobs'>, lines: ReadonlyArray<Pick<BillsSentLine, 'billId'>>): { open: BillsSentGap[]; paid: BillsSentGap[] } {
  const sent = new Set(lines.map((l) => l.billId).filter((id): id is string => !!id))
  const gaps = (input.unsent ?? [])
    .filter((u) => !sent.has(u.billId))
    .slice()
    .sort((a, b) => (a.billedAtIso < b.billedAtIso ? 1 : a.billedAtIso > b.billedAtIso ? -1 : 0))
    .map((u): BillsSentGap => {
      const job = u.jobId ? input.jobs.get(u.jobId) : undefined
      const jobWords = u.jobId ? sentCopyJobLabel(u.jobId, job) : ''
      const payer = (job?.customer_name ?? '').trim()
      const ymd = Number.isFinite(Date.parse(u.billedAtIso)) ? calendarYmdInAppTzFromIso(u.billedAtIso) : ''
      const billedWords = ymd ? `Billed ${formatWorkDateYmdWeekdayShortFriendly(ymd)} at ${billsSentTime(u.billedAtIso)}.` : 'Billed.'
      return {
        billId: u.billId,
        jobId: u.jobId,
        jobWords,
        jobTo: u.jobId ? `/jobs?edit=${encodeURIComponent(u.jobId)}` : null,
        payer,
        amount: u.amount,
        paid: u.status === 'paid',
        billedWords,
        haystack: [jobWords, payer, (job?.job_address ?? '').trim()].filter(Boolean).join(' ').toLowerCase(),
      }
    })
  return { open: gaps.filter((g) => !g.paid), paid: gaps.filter((g) => g.paid) }
}

/** The gaps the search box leaves. */
export function billsSentGapFilter(gaps: ReadonlyArray<BillsSentGap>, typed: string): BillsSentGap[] {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean)
  return gaps.filter((g) => words.every((w) => g.haystack.includes(w)))
}

/** The strip's heading: *3 bills are billed with no send on record*. */
export function billsSentGapHeading(n: number): string {
  return n === 1 ? '1 bill is billed with no send on record' : `${n} bills are billed with no send on record`
}

/** `1 bill`, `2 bills`. */
export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/** `2nd`, `3rd`, `11th`. */
export function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  const last = n % 10
  return `${n}${last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`
}

/** A dollar amount as the list writes it: `$4,860.00`. */
export function billsSentMoney(n: number): string {
  return `$${formatCurrency(n)}`
}

/** What a line that is not a bill's first send says about the first: *2nd send. First sent Tue, Nov 3.* '' on a first send. */
export function billsSentAgainWords(line: Pick<BillsSentLine, 'nth' | 'firstAtIso'>): string {
  if (line.nth <= 1) return ''
  const ymd = line.firstAtIso ? calendarYmdInAppTzFromIso(line.firstAtIso) : ''
  return ymd ? `${ordinal(line.nth)} send. First sent ${formatWorkDateYmdWeekdayShortFriendly(ymd)}.` : `${ordinal(line.nth)} send.`
}

/** Who it went to, as the line writes it: the name, then each address. '' when the copy names neither. */
export function billsSentToWords(line: Pick<BillsSentLine, 'toName' | 'toAddresses'>): { name: string; addresses: string } {
  return { name: line.toName.trim(), addresses: line.toAddresses.join(', ') }
}

/** The time alone, in the company's calendar: *9:28 AM*. '' for a time that does not parse. */
export function billsSentTime(iso: string): string {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? formatDenverTimeOnly(t) : ''
}

/** A count of bills and their sum. */
export interface BillsSentSum {
  bills: number
  total: number
}

export interface BillsSentDay {
  ymd: string
  /** *Today · Thu, Nov 12*, *Yesterday · Wed, Nov 11*, then the day alone. */
  label: string
  lines: BillsSentLine[]
  /** The bills that first went this day. */
  sum: BillsSentSum
  /** Lines that are a second or later send. */
  again: number
  statements: number
  /** Lines whose send did not arrive. */
  missed: number
}

const sumOf = (lines: ReadonlyArray<BillsSentLine>): BillsSentSum => {
  const counted = lines.filter((l) => l.counts)
  return { bills: new Set(counted.map((l) => l.billId)).size, total: counted.reduce((s, l) => s + (l.amount ?? 0), 0) }
}

/** The lines under one band per day in the company's calendar, in the order given (newest first). */
export function billsSentDays(lines: ReadonlyArray<BillsSentLine>, todayYmd: string): BillsSentDay[] {
  const yesterday = ymdAddDays(todayYmd, -1)
  const out: BillsSentDay[] = []
  for (const line of lines) {
    const ymd = Number.isFinite(Date.parse(line.atIso)) ? calendarYmdInAppTzFromIso(line.atIso) : ''
    const last = out[out.length - 1]
    if (last && last.ymd === ymd) {
      last.lines.push(line)
      continue
    }
    const day = ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : 'No date'
    out.push({ ymd, label: ymd === todayYmd ? `Today · ${day}` : ymd === yesterday ? `Yesterday · ${day}` : day, lines: [line], sum: { bills: 0, total: 0 }, again: 0, statements: 0, missed: 0 })
  }
  for (const d of out) {
    d.sum = sumOf(d.lines)
    d.again = d.lines.filter((l) => l.nth > 1).length
    d.statements = d.lines.filter((l) => l.route === 'statement').length
    d.missed = d.lines.filter((l) => l.deliveryTone === 'bad').length
  }
  return out
}

/** A day band's small words after its total: *2 sent again · 1 statement*. '' when there are neither. */
export function billsSentDayExtras(day: Pick<BillsSentDay, 'again' | 'statements'> & { missed?: number }): string {
  const parts: string[] = []
  if (day.missed && day.missed > 0) parts.push(`${day.missed} did not arrive`)
  if (day.again > 0) parts.push(`${day.again} sent again`)
  if (day.statements > 0) parts.push(plural(day.statements, 'statement'))
  return parts.join(' · ')
}

/** `2 bills · $8,270.00`; a day with sends and no first send says *0 bills*. */
export function billsSentSumWords(sum: BillsSentSum): string {
  return sum.bills > 0 ? `${plural(sum.bills, 'bill')} · ${billsSentMoney(sum.total)}` : '0 bills'
}

/** The two tiles: the bills that first went today, and since the Sunday that began this week. */
export function billsSentTiles(lines: ReadonlyArray<BillsSentLine>, todayYmd: string): { today: BillsSentSum; week: BillsSentSum } {
  const weekStart = companyWeekStartSundayContaining(todayYmd) ?? todayYmd
  const dayOf = (l: BillsSentLine) => (Number.isFinite(Date.parse(l.atIso)) ? calendarYmdInAppTzFromIso(l.atIso) : '')
  return {
    today: sumOf(lines.filter((l) => dayOf(l) === todayYmd)),
    week: sumOf(lines.filter((l) => dayOf(l) >= weekStart && dayOf(l) <= todayYmd)),
  }
}

/** The lines a route chip and the search box leave. Every typed word must be found. */
export function billsSentFilter(lines: ReadonlyArray<BillsSentLine>, route: BillsSentChip, typed: string): BillsSentLine[] {
  if (route === 'gap') return []
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean)
  return lines.filter((l) => (route === 'all' || (route === 'missed' ? l.stillMissed : l.route === route)) && words.every((w) => l.haystack.includes(w)))
}

/** The words a copy's window is headed with. */
export function billsSentCopyLabel(line: Pick<BillsSentLine, 'what' | 'jobWords' | 'routeWords'>): string {
  return ['Copy as it went out', line.what, line.jobWords, line.routeWords].filter(Boolean).join(' · ')
}


/** One send on a bill's record. */
export interface BillsSentRecordEvent {
  id: string
  /** *Thu, Nov 12 · 11:02 AM*, or the day alone when the record holds no time. */
  when: string
  /** *Emailed again by Marcus*. */
  head: string
  /** *To Accounts Payable, ap@larkfield.example. Delivered 11:02 AM.* */
  detail: string
  line: BillsSentLine
}

/** Every send of one bill, as its record draws it. */
export interface BillsSentRecord {
  billId: string
  /** *Bill 1398-0003*. */
  what: string
  jobWords: string
  jobTo: string | null
  payer: string
  amount: number | null
  /** *Not paid*, *Paid Nov 9*, *Paid*. */
  stateWords: string
  /** Newest first. Empty for a bill with no send on record. */
  events: BillsSentRecordEvent[]
  /** *Bill made Tue, Nov 3 at 4:38 PM.* '' when the read does not know. */
  madeWords: string
}

const dayAndTime = (iso: string, dayOnly: boolean): string => {
  const ymd = Number.isFinite(Date.parse(iso)) ? calendarYmdInAppTzFromIso(iso) : ''
  if (!ymd) return ''
  const day = formatWorkDateYmdWeekdayShortFriendly(ymd)
  return dayOnly ? day : `${day} · ${billsSentTime(iso)}`
}

function recordHead(line: BillsSentLine): string {
  const by = billsSentByWords(line)
  const verb =
    line.route === 'email'
      ? line.nth > 1
        ? 'Emailed again'
        : 'Emailed'
      : line.route === 'text'
        ? 'Texted the pay link'
        : line.route === 'printed'
          ? 'Printed'
          : line.route === 'housecall_pro'
            ? 'Sent from Housecall Pro'
            : line.routeWords
  return by ? `${verb} ${by}` : verb
}

function recordDetail(line: BillsSentLine): string {
  const parts: string[] = []
  const to = [line.toName, line.toAddresses.join(', ')].filter(Boolean).join(', ')
  if (to) parts.push(`To ${to}.`)
  if (line.copyTo.length > 0) parts.push(`Copy to ${line.copyTo.join(', ')}.`)
  if (line.delivery) parts.push(/[.!?]$/.test(line.delivery) ? line.delivery : `${line.delivery}.`)
  if (line.note) parts.push(line.note)
  return parts.join(' ')
}

/**
 * One bill's record from the lines on the page: every send of it, newest first. A bill with no line (a gap) still
 * has a record, with no events. Null when the page knows nothing of the bill.
 */
export function billsSentRecord(billId: string, lines: ReadonlyArray<BillsSentLine>, input: Pick<BillsSentInput, 'bills' | 'jobs'>): BillsSentRecord | null {
  const own = lines.filter((l) => l.billId === billId)
  const bill = input.bills.get(billId)
  if (own.length === 0 && !bill) return null
  const first = own[0]
  const jobId = bill?.jobId ?? null
  const job = jobId ? input.jobs.get(jobId) : undefined
  const paidLine = own.find((l) => l.paidOn)
  const paid = bill?.status === 'paid' || own.some((l) => l.paid)
  const madeYmd = bill?.billedAtIso && Number.isFinite(Date.parse(bill.billedAtIso)) ? calendarYmdInAppTzFromIso(bill.billedAtIso) : ''
  return {
    billId,
    what: own.find((l) => l.what !== 'Bill')?.what ?? first?.what ?? 'Bill',
    jobWords: first?.jobWords || (jobId ? sentCopyJobLabel(jobId, job) : ''),
    jobTo: first?.jobTo ?? (jobId ? `/jobs?edit=${encodeURIComponent(jobId)}` : null),
    payer: first?.payer || (job?.customer_name ?? '').trim(),
    amount: bill?.amount ?? first?.amount ?? null,
    stateWords: paid ? (paidLine ? billsSentPaidWords(paidLine) : 'Paid') : 'Not paid',
    events: own.map((line) => ({ id: line.id, when: dayAndTime(line.atIso, line.dayOnly), head: recordHead(line), detail: recordDetail(line), line })),
    madeWords: madeYmd ? `Bill made ${formatWorkDateYmdWeekdayShortFriendly(madeYmd)} at ${billsSentTime(bill!.billedAtIso!)}.` : '',
  }
}

/** The record's address: the list's own, with the bill in it. */
export function billsSentRecordPath(billId: string): string {
  return `${BILLS_SENT_PATH}?bill=${encodeURIComponent(billId)}`
}

const esc = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The record as a page to print: the bill, then each send with who it went to and whether it arrived, then what
 * *Delivered* means. Our own reading of the record for a file or for counsel, so it is not itself a send.
 */
export function billsSentRecordHtml(record: BillsSentRecord, printedAtIso: string): string {
  const title = [record.what, record.jobWords].filter(Boolean).join(' · ')
  const rows = record.events
    .map((e) => `<tr><td class="when">${esc(e.when)}</td><td><b>${esc(e.head)}</b><br>${esc(e.detail)}</td></tr>`)
    .join('')
  const none = '<p>No send of this bill is on record. The app sent no email, text or print for it.</p>'
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} · record of sends</title><style>
body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:32px}
h1{font-size:18px;margin:0 0 2px}p{margin:4px 0}.sub{color:#444}
table{border-collapse:collapse;width:100%;margin-top:14px}td{border-top:1px solid #bbb;padding:7px 8px 7px 0;vertical-align:top}
td.when{white-space:nowrap;width:1%;padding-right:16px;font-weight:600}.foot{margin-top:16px;color:#444;font-size:12px}
</style></head><body>
<h1>${esc(title)}</h1>
<p class="sub">${esc([record.payer, record.amount != null ? billsSentMoney(record.amount) : '', record.stateWords].filter(Boolean).join(' · '))}</p>
<p class="sub">Record of sends, newest first. All times are Central.</p>
${record.events.length ? `<table>${rows}</table>` : none}
${record.madeWords ? `<p class="foot">${esc(record.madeWords)}</p>` : ''}
<p class="foot">Delivered means their mail server took the email. It does not mean someone read it. Each time is the app's own record of the send.</p>
<p class="foot">Printed ${esc(dayAndTime(printedAtIso, false))}.</p>
</body></html>`
}


/** A cell a spreadsheet will not run: text that opens like a formula is led with an apostrophe. */
const csvCell = (v: string): string => escapeCsvField(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v)

export const BILLS_SENT_CSV_HEAD: ReadonlyArray<string> = ['Date', 'Time', 'Bill', 'Job', 'For', 'Amount', 'In the day total', 'To', 'Address or number', 'Copy to', 'How it went', 'Sent by', 'Send of this bill', 'Arrived', 'Paid', 'Note']

/**
 * The lines as a spreadsheet, in the order given, then the bills with no send on record. Dates are the company's
 * calendar days, times are Central. The amount is a plain number so a column of them adds.
 */
export function billsSentCsv(lines: ReadonlyArray<BillsSentLine>, gaps: ReadonlyArray<BillsSentGap> = []): string {
  const rows: string[][] = [BILLS_SENT_CSV_HEAD.slice()]
  for (const l of lines) {
    const ymd = Number.isFinite(Date.parse(l.atIso)) ? calendarYmdInAppTzFromIso(l.atIso) : ''
    rows.push([
      ymd,
      l.dayOnly ? '' : billsSentTime(l.atIso),
      l.what,
      l.jobWords,
      l.payer,
      l.amount != null ? l.amount.toFixed(2) : '',
      l.counts ? 'yes' : 'no',
      l.toName,
      l.toAddresses.join('; '),
      l.copyTo.join('; '),
      l.routeWords,
      billsSentByWords(l).replace(/^by /, ''),
      String(l.nth),
      l.delivery,
      billsSentPaidWords(l),
      l.note,
    ])
  }
  for (const g of gaps) {
    rows.push(['', '', 'Bill', g.jobWords, g.payer, g.amount != null ? g.amount.toFixed(2) : '', 'no', '', '', '', BILLS_SENT_GAP_LABEL, '', '', '', g.paid ? 'Paid' : '', g.billedWords])
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** `bills-sent-2026-11-12.csv`. */
export function billsSentCsvFileName(todayYmd: string): string {
  return `bills-sent-${todayYmd}.csv`
}

/**
 * The list as a page to print: what is shown, under its days, with each day's count and total, then the open bills
 * with no send on record. `shownWords` says what the page holds when the list was narrowed (*Email · "larkfield"*).
 */
export function billsSentListHtml(days: ReadonlyArray<BillsSentDay>, gaps: ReadonlyArray<BillsSentGap>, opts: { printedAtIso: string; shownWords: string }): string {
  const lineRow = (l: BillsSentLine): string => {
    const to = [l.toName, l.toAddresses.join(', ')].filter(Boolean).join(', ')
    const facts = [l.routeWords, billsSentByWords(l), billsSentAgainWords(l), l.delivery, billsSentPaidWords(l)].filter(Boolean).join(' · ')
    return `<tr><td class="when">${esc(l.dayOnly ? 'Day only' : billsSentTime(l.atIso))}</td><td><b>${esc(l.what)}</b>${l.jobWords ? ` · ${esc(l.jobWords)}` : ''}${l.payer ? ` · ${esc(l.payer)}` : ''}<br>${to ? `To ${esc(to)}${l.copyTo.length ? `, copy to ${esc(l.copyTo.join(', '))}` : ''}<br>` : ''}${esc(facts)}${l.note ? `<br>${esc(l.note)}` : ''}</td><td class="amt">${l.amount != null ? esc(billsSentMoney(l.amount)) : ''}</td></tr>`
  }
  const dayBlock = (d: BillsSentDay): string => {
    const extras = billsSentDayExtras(d)
    return `<tr class="day"><td colspan="3"><b>${esc(d.label)}</b> <span>${esc(billsSentSumWords(d.sum))}${extras ? ` · ${esc(extras)}` : ''}</span></td></tr>${d.lines.map(lineRow).join('')}`
  }
  const gapBlock = gaps.length
    ? `<h2>${esc(billsSentGapHeading(gaps.length))}</h2><table>${gaps.map((g) => `<tr><td><b>Bill</b>${g.jobWords ? ` · ${esc(g.jobWords)}` : ''}${g.payer ? ` · ${esc(g.payer)}` : ''}<br>${esc(g.billedWords)} Not paid.</td><td class="amt">${g.amount != null ? esc(billsSentMoney(g.amount)) : ''}</td></tr>`).join('')}</table>`
    : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bills sent</title><style>
body{font:12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;margin:28px}
h1{font-size:18px;margin:0 0 2px}h2{font-size:13px;margin:16px 0 4px}p{margin:3px 0;color:#444}
table{border-collapse:collapse;width:100%}td{border-top:1px solid #ccc;padding:5px 8px 5px 0;vertical-align:top}
td.when{white-space:nowrap;width:1%;padding-right:14px;font-weight:600}td.amt{text-align:right;white-space:nowrap;font-weight:600;padding-right:0}
tr.day td{border-top:2px solid #111;padding-top:9px}tr.day span{color:#444;margin-left:8px}
tr{break-inside:avoid}
</style></head><body>
<h1>Bills sent</h1>
<p>${esc(opts.shownWords)} Newest first. All times are Central. A day’s total counts each bill once, on the day it first went.</p>
${gapBlock}
${days.length ? `<table>${days.map(dayBlock).join('')}</table>` : ''}
<p style="margin-top:14px">Delivered means their mail server took the email. It does not mean someone read it. Printed ${esc(dayAndTime(opts.printedAtIso, false))}.</p>
</body></html>`
}


/** The kind a sent copy carries when a person recorded, by hand, how a bill went. */
export const BILLS_SENT_BY_HAND_KIND = 'bill_by_hand'

/** How a bill went when the app did not send it. */
export type BillsSentByHandHow = 'handed' | 'mailed' | 'own_mailbox' | 'housecall_pro'

export const BILLS_SENT_BY_HAND_HOWS: ReadonlyArray<{ key: BillsSentByHandHow; label: string }> = [
  { key: 'handed', label: 'Handed over' },
  { key: 'mailed', label: 'Mailed' },
  { key: 'own_mailbox', label: 'Emailed from a person’s own mailbox' },
  { key: 'housecall_pro', label: 'Sent from Housecall Pro' },
]

function byHandHowOf(copy: BillsSentCopy): BillsSentByHandHow | null {
  const how = copy.sourceSnapshot?.how
  return BILLS_SENT_BY_HAND_HOWS.some((h) => h.key === how) ? (how as BillsSentByHandHow) : null
}

/** The moment a by-hand record's line sits at: noon, Central, on the day the person named; the day it was recorded when it names none. */
function byHandWentAtIso(copy: BillsSentCopy): string {
  const ymd = typeof copy.sourceSnapshot?.went_on === 'string' ? copy.sourceSnapshot.went_on : ''
  const at = ymd ? appTzWallTimeMs(ymd, 12, 0) : NaN
  return Number.isFinite(at) ? new Date(at).toISOString() : copy.sentAt
}

/** What the person fills in. */
export interface BillsSentByHandDraft {
  how: BillsSentByHandHow | ''
  /** Who it went to: a name, and an address or number when they have one. */
  toWhom: string
  /** The day it went, YYYY-MM-DD. */
  wentOnYmd: string
  note: string
}

/** What the form still needs, as one sentence; '' when the record can be saved. */
export function byHandProblem(draft: BillsSentByHandDraft, todayYmd: string): string {
  if (!draft.how) return 'Pick how the bill went.'
  if (!draft.toWhom.trim()) return 'Say who the bill went to.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.wentOnYmd)) return 'Pick the day the bill went.'
  if (draft.wentOnYmd > todayYmd) return 'The day cannot be after today.'
  return ''
}

/**
 * The sent copy a by-hand record files: no copy body, the bill as its source, and what the person said in
 * `source_snapshot` (`how`, `went_on`, `note`). The addresses stay empty on purpose: the words are a person's, typed
 * as they knew them, and an address there would read into a customer's thread as an email the app sent.
 */
export function byHandFiling(gap: Pick<BillsSentGap, 'billId' | 'jobWords'> & { jobId: string | null }, draft: BillsSentByHandDraft): SentFiling {
  const label = BILLS_SENT_BY_HAND_HOWS.find((h) => h.key === draft.how)?.label ?? 'Recorded by hand'
  return {
    kind: BILLS_SENT_BY_HAND_KIND,
    title: ['Bill', gap.jobWords, `${label}, recorded by hand`].filter(Boolean).join(' · '),
    how: draft.how === 'handed' ? 'hand' : draft.how === 'mailed' ? 'mail' : 'email',
    recipientName: draft.toWhom.trim(),
    jobIds: [gap.jobId],
    source: { table: BILL_SOURCE, id: gap.billId },
    sourceSnapshot: { by_hand: true, how: draft.how, went_on: draft.wentOnYmd, note: draft.note.trim() },
  }
}


/**
 * A line's words for a phone, where it is three rows and the whole line is the press that opens the bill's record.
 * `main` names the work: the job and who it is for, or the paper when the line is not a bill's (a statement).
 * `to` is where it went. `again` says which send it is, short. The long bill number is left to the record.
 */
export function billsSentPhoneWords(line: Pick<BillsSentLine, 'billId' | 'what' | 'jobWords' | 'payer' | 'toName' | 'toAddresses' | 'copyTo' | 'nth'>): { main: string; to: string; again: string } {
  const payer = line.payer && !line.jobWords.includes(line.payer) ? line.payer : ''
  const main = [line.billId ? '' : line.what, line.jobWords, payer].filter(Boolean).join(' · ') || line.payer || line.what
  const where = line.toAddresses.length > 0 ? line.toAddresses.join(', ') : line.toName
  const copies = line.copyTo.length > 0 ? `, copy to ${line.copyTo.join(', ')}` : ''
  return { main, to: where ? `To ${where}${copies}` : '', again: line.nth > 1 ? `${ordinal(line.nth)} send` : '' }
}
