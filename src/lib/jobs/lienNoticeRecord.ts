import { lienAffidavitMethodWords, lienAffidavitNoticesWords, type LienAffidavitNoticeRow, type LienAffidavitOwnerSend } from './lienAffidavitNotices'
import { lienAffidavitNoticeCheck, lienNoticeCheckLines } from './lienAffidavitNoticeCheck'
import { lienCommercialClock } from './lienDeadlines'
import { describeNoticeMonths } from './lienNoticeDraft'
import { parseLienSends, sendNeedsTracking, sendTrackingComing } from './lienSendTracking'
import type { LienNoticeFields } from '../jobsDocuments/lienFilingDocuments'

/**
 * The notice record behind a lien affidavit (punch list #322). Pure: what the job's record holds, laid out for a
 * person who has to be sure of the paper before it is signed and filed.
 *
 * The short form swears two things off the § 53.056 notices on the job: the months payment is requested for
 * (sentence 5) and the day and method each notice went to the owner (sentence 6). A paper with two days in sentence 6
 * and an **Ask first** on its help sheet left the reader with a warning and no way to see what went, when, to whom, by
 * what mail number, for which months, and whether each was on time. This reads the same rows the paper is filled from
 * (`job_lien_filings`, kind `notice_53_056`, not voided) and says all of that, with nothing guessed: a copy the record
 * lacks is a row that says so, and a number nobody typed is named as missing.
 *
 * Three things come out. The notices, one row for each copy mailed, each with the words it was recorded with, so a
 * copy of it can print behind the page (the owner, 2026-11-12: *I want to see copies of what was sent*). The months
 * the paper swears, each with its last day to mail and whether the owner's copy and the original contractor's went on
 * time (`lienAffidavitNoticeCheck`, so this record and the help sheet's check cannot disagree): the page prints the
 * check's lines and no table of the months, which the owner asked not to see. And the paper's two sentences read
 * against the record.
 */

/** A recorded filing, as much of it as this reads. The desk and the Lien window both hold the whole row. */
export type LienNoticeRecordFiling = LienAffidavitNoticeRow & {
  id?: string | null
  created_at?: string | null
  amount?: number | string | null
  /** The paper's own total, when one notice stood for several jobs and this job's share is less. */
  printed_claim?: number | string | null
  /** Recorded after the fact: the paper went out by hand and the office typed in what it knew. */
  by_hand?: boolean | null
  document_url?: string | null
  document_note?: string | null
  /** The notice's own fields as they were when it was recorded (`LienNoticeFields`): what a copy of it is drawn from. */
  fields?: unknown
}

export type LienNoticeRecordRecipient = 'owner' | 'original_contractor'

/** Where a copy's mail number stands: on the record, coming from the mail provider, owed by the office, or not a thing this method has. */
export type LienNoticeRecordNumber = 'held' | 'coming' | 'owed' | 'none'

/** One copy of one notice. `onRecord` false is a copy the record does not hold: the row says so and states nothing else. */
export type LienNoticeRecordCopy = {
  recipient: LienNoticeRecordRecipient
  onRecord: boolean
  /** 'YYYY-MM-DD'; '' when the record has no day. */
  sentOn: string
  method: string
  /** As recorded: a certified mail number, a courier's, who signed for it, or an email's id and address. */
  tracking: string
  number: LienNoticeRecordNumber
  /** A photo of the mail receipt is on the job. */
  receipt: boolean
}

export type LienNoticeRecordNotice = {
  /** 1 for the first notice mailed, counting up. The month table names a notice by this. */
  n: number
  /** The day the office entered it in the app, 'YYYY-MM-DD'; '' when the row has none. */
  recordedOn: string
  byHand: boolean
  /** Every month the notice named, oldest first. */
  months: string[]
  /** This job's amount on the notice; null when the row has none. */
  claim: number | null
  /** The paper's total, when it was more than this job's amount. */
  printedClaim: number | null
  savedCopy: boolean
  savedNote: string
  copies: LienNoticeRecordCopy[]
  /** The notice's words as the row keeps them (`LienNoticeFields`), for a printed copy; null when the row keeps none. */
  snapshot: LienNoticeFields | null
}

/** One recipient's notice for one month: when it went, which notice, and how it stands against the month's last day. */
export type LienNoticeRecordSide = { state: 'on_time' | 'late' | 'missing'; sentOn: string; notice: number | null; daysLate: number }

export type LienNoticeRecordMonth = { month: string; dueOn: string; owner: LienNoticeRecordSide; contractor: LienNoticeRecordSide }

/** A line of the paper read against the record: `ok` they agree, `ask` they do not, `note` a fact beside them. */
export type LienNoticeRecordLine = { state: 'ok' | 'ask' | 'note'; lead: string; words: string }

export type LienNoticeRecord = {
  notices: LienNoticeRecordNotice[]
  months: LienNoticeRecordMonth[]
  /** The notice check's own lines (`lienNoticeCheckLines`): what the help sheet says under **Ask first**. None when every month is on time to both. */
  flags: string[]
  lines: LienNoticeRecordLine[]
  /** What the record does not hold, each a thing the office can add in the app. */
  gaps: string[]
  /** Voided notices handed in. They are counted here and nowhere else. */
  voided: number
  /** The commercial clock applies: the last day is the 15th of the third month, not the second. */
  commercial: boolean
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

const money = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const dayNumber = (ymd: string): number => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / 86_400_000

/** Whole days from `fromYmd` to `toYmd`; 0 when either is not a day. */
export function lienNoticeRecordDaysBetween(fromYmd: string, toYmd: string): number {
  return YMD.test(fromYmd) && YMD.test(toYmd) ? Math.round(dayNumber(toYmd) - dayNumber(fromYmd)) : 0
}

const RECIPIENTS: ReadonlyArray<LienNoticeRecordRecipient> = ['owner', 'original_contractor']

const isRecipient = (r: string): r is LienNoticeRecordRecipient => r === 'owner' || r === 'original_contractor'

function copiesOf(sends: unknown): LienNoticeRecordCopy[] {
  const out: LienNoticeRecordCopy[] = []
  for (const s of parseLienSends(sends)) {
    if (!isRecipient(s.recipient)) continue
    const tracking = (s.tracking ?? '').trim()
    out.push({
      recipient: s.recipient,
      onRecord: true,
      sentOn: YMD.test(s.sent_on ?? '') ? (s.sent_on as string) : '',
      method: s.method,
      tracking,
      number: tracking ? 'held' : sendTrackingComing(s) ? 'coming' : sendNeedsTracking(s) ? 'owed' : 'none',
      receipt: Boolean((s.receipt_url ?? '').trim()),
    })
  }
  // The owner's copy first, then the original contractor's; a copy the record lacks is a row of its own.
  const rows: LienNoticeRecordCopy[] = []
  for (const recipient of RECIPIENTS) {
    const held = out.filter((c) => c.recipient === recipient).sort((a, b) => (a.sentOn < b.sentOn ? -1 : a.sentOn > b.sentOn ? 1 : 0))
    if (held.length > 0) rows.push(...held)
    else rows.push({ recipient, onRecord: false, sentOn: '', method: '', tracking: '', number: 'none', receipt: false })
  }
  return rows
}

const text = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

/**
 * A row's stored fields as a notice a copy can be drawn from: every line the form prints, blank where the row has
 * none. Null when the row keeps no word of the notice (an empty object, or something that is not the form), so a copy
 * is never a page of blanks passed off as what was mailed.
 */
export function lienNoticeSnapshot(fields: unknown): LienNoticeFields | null {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return null
  const f = fields as Record<string, unknown>
  if (!text(f.claimantName).trim() && !text(f.claimAmount).trim() && !text(f.projectDescription).trim()) return null
  return {
    noticeDate: text(f.noticeDate),
    projectDescription: text(f.projectDescription),
    claimantName: text(f.claimantName),
    laborMaterialsType: text(f.laborMaterialsType),
    originalContractorName: text(f.originalContractorName),
    contractedWithIfDifferent: text(f.contractedWithIfDifferent),
    claimAmount: text(f.claimAmount),
    contactPerson: text(f.contactPerson),
    claimantAddress: text(f.claimantAddress),
    ...(text(f.claimSplit).trim() ? { claimSplit: text(f.claimSplit) } : {}),
    ...(f.homesteadStatement === true ? { homesteadStatement: true } : {}),
    ...(text(f.retainageIncluded).trim() ? { retainageIncluded: text(f.retainageIncluded) } : {}),
  }
}

const firstDay = (copies: ReadonlyArray<LienNoticeRecordCopy>): string =>
  copies
    .filter((c) => c.onRecord && c.sentOn)
    .map((c) => c.sentOn)
    .sort()[0] ?? ''

/** The live § 53.056 notices as the record holds them, the first mailed first. A notice with no day on any copy sorts by the day it was entered. */
export function lienNoticeRecordNotices(filings: ReadonlyArray<LienNoticeRecordFiling> | null | undefined): LienNoticeRecordNotice[] {
  const live = (filings ?? []).filter((f) => f.kind === 'notice_53_056' && !f.voided_at)
  const drawn = live.map((f, i) => {
    const copies = copiesOf(f.sends)
    const recordedOn = (f.created_at ?? '').slice(0, 10)
    const claim = money(f.amount)
    const printed = money(f.printed_claim)
    return {
      i,
      key: firstDay(copies) || (YMD.test(recordedOn) ? recordedOn : '9999-99-99'),
      notice: {
        n: 0,
        recordedOn: YMD.test(recordedOn) ? recordedOn : '',
        byHand: f.by_hand === true,
        months: [...new Set((f.months_covered ?? []).filter((m) => MONTH.test(m)))].sort(),
        claim,
        printedClaim: printed !== null && (claim === null || Math.abs(printed - claim) >= 0.005) ? printed : null,
        savedCopy: Boolean((f.document_url ?? '').trim()),
        savedNote: (f.document_note ?? '').trim(),
        copies,
        snapshot: lienNoticeSnapshot(f.fields),
      } satisfies LienNoticeRecordNotice,
    }
  })
  return drawn
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.notice.recordedOn < b.notice.recordedOn ? -1 : a.notice.recordedOn > b.notice.recordedOn ? 1 : a.i - b.i))
    .map((d, i) => ({ ...d.notice, n: i + 1 }))
}

function sideOf(notices: ReadonlyArray<LienNoticeRecordNotice>, month: string, recipient: LienNoticeRecordRecipient, sentOn: string | null, dueOn: string): LienNoticeRecordSide {
  if (sentOn === null) return { state: 'missing', sentOn: '', notice: null, daysLate: 0 }
  const from = notices.find((n) => n.months.includes(month) && n.copies.some((c) => c.onRecord && c.recipient === recipient && c.sentOn === sentOn))
  const daysLate = dueOn ? Math.max(0, lienNoticeRecordDaysBetween(dueOn, sentOn)) : 0
  return { state: daysLate > 0 ? 'late' : 'on_time', sentOn, notice: from?.n ?? null, daysLate }
}

/** The owner's copies as sentence 6 counts them, read off the record's own rows: each day and method once, oldest first. */
export function lienNoticeRecordOwnerSends(notices: ReadonlyArray<LienNoticeRecordNotice>): LienAffidavitOwnerSend[] {
  const seen = new Set<string>()
  const out: LienAffidavitOwnerSend[] = []
  for (const n of notices) {
    for (const c of n.copies) {
      if (!c.onRecord || c.recipient !== 'owner' || !c.sentOn) continue
      const key = `${c.method}|${c.sentOn}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ method: c.method, sentOn: c.sentOn })
    }
  }
  return out.sort((a, b) => (a.sentOn !== b.sentOn ? (a.sentOn < b.sentOn ? -1 : 1) : a.method.localeCompare(b.method)))
}

/** Every month from one day's month through another's, as keys; none when either end is not a day or they are out of order. */
export function lienNoticeRecordSpanMonths(workStartYmd: string | null | undefined, workEndYmd: string | null | undefined): string[] {
  const from = (workStartYmd ?? '').trim()
  const to = (workEndYmd ?? '').trim()
  if (!YMD.test(from) || !YMD.test(to) || from.slice(0, 7) > to.slice(0, 7)) return []
  const out: string[] = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7))
  const end = to.slice(0, 7)
  // A job that runs for years is not a thing; the cap keeps a typo from filling the page.
  for (let i = 0; i < 120; i += 1) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(key)
    if (key === end) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

const who = (r: LienNoticeRecordRecipient): string => (r === 'owner' ? 'the owner' : 'the original contractor')

/** What the record does not hold, notice by notice, in the order a reader meets them on the page. */
export function lienNoticeRecordGaps(notices: ReadonlyArray<LienNoticeRecordNotice>): string[] {
  const gaps: string[] = []
  for (const n of notices) {
    const name = `Notice ${n.n}`
    if (n.months.length === 0) gaps.push(`${name} names no month of work.`)
    for (const c of n.copies) {
      if (!c.onRecord) gaps.push(`${name} has no copy to ${who(c.recipient)} on record.`)
      else {
        if (!c.sentOn) gaps.push(`${name} has no day mailed for the copy to ${who(c.recipient)}.`)
        if (c.number === 'owed') gaps.push(`${name} has no mail number for the copy to ${who(c.recipient)}.`)
        if (c.number === 'coming') gaps.push(`${name} waits on the mail provider for the number of the copy to ${who(c.recipient)}.`)
      }
    }
    const numbers = n.copies.filter((c) => c.onRecord && c.number === 'held' && (c.method === 'certified_mail' || c.method === 'traceable_courier'))
    if (numbers.length > 1 && new Set(numbers.map((c) => c.tracking.replace(/\s+/g, ''))).size === 1) gaps.push(`${name} has the same mail number on both copies. Each envelope has its own.`)
    if (!n.savedCopy && !n.savedNote) gaps.push(`${name} has no saved copy of the paper.`)
    if (!n.snapshot) gaps.push(`${name} has no record of its words, so no copy of it prints.`)
  }
  return gaps
}

/**
 * The record behind one paper. `swornMonths` are the months the paper swears (`lienAffidavitSwornMonths`), and the two
 * `paper…Words` are sentences 5 and 6 as the paper prints them. Null on a job contracted with the owner: an original
 * contractor owes no monthly notice, and the paper has neither sentence.
 */
export function lienNoticeRecord(input: {
  isSub: boolean
  propertyKind: string | null | undefined
  swornMonths: ReadonlyArray<string>
  filings: ReadonlyArray<LienNoticeRecordFiling> | null | undefined
  paperMonthsWords: string
  paperNoticesWords: string
  /** The job's work dates as the paper's fields hold them, 'YYYY-MM-DD'. */
  workStart?: string | null
  workEnd?: string | null
}): LienNoticeRecord | null {
  if (!input.isSub) return null
  const filings = input.filings ?? []
  const notices = lienNoticeRecordNotices(filings)
  const check = lienAffidavitNoticeCheck({ isSub: true, propertyKind: input.propertyKind, months: input.swornMonths, filings })
  const months = check.months.map((m): LienNoticeRecordMonth => ({
    month: m.month,
    dueOn: m.dueOn,
    owner: sideOf(notices, m.month, 'owner', m.ownerSentOn, m.dueOn),
    contractor: sideOf(notices, m.month, 'original_contractor', m.contractorSentOn, m.dueOn),
  }))

  const sworn = check.months.map((m) => m.month)
  const noticed = [...new Set(notices.flatMap((n) => n.months))].sort()
  const lines: LienNoticeRecordLine[] = []

  // Sentence 5: the months, the paper's words against the months the notices name for this job.
  const paperMonths = input.paperMonthsWords.trim()
  const recordMonths = describeNoticeMonths(sworn)
  const unbacked = sworn.filter((m) => !noticed.includes(m))
  if (!paperMonths) lines.push({ state: 'ask', lead: 'Sentence 5.', words: 'The paper names no month. No notice on record names a month of this job’s work.' })
  else if (paperMonths === recordMonths && unbacked.length === 0) lines.push({ state: 'ok', lead: 'Sentence 5.', words: `The paper names ${paperMonths}. A notice on record names each of those months.` })
  else lines.push({ state: 'ask', lead: 'Sentence 5.', words: `The paper names ${paperMonths}. The notices on record name ${recordMonths || 'no month'} for this job.` })

  // Sentence 6: the days and the method, the paper's words against the owner's copies on the record.
  const paperNotices = input.paperNoticesWords.trim()
  const recordNotices = lienAffidavitNoticesWords(lienNoticeRecordOwnerSends(notices))
  if (!paperNotices) lines.push({ state: 'ask', lead: 'Sentence 6.', words: 'The paper has a blank where the day goes. No copy to the owner is on record with a day.' })
  else if (paperNotices === recordNotices) lines.push({ state: 'ok', lead: 'Sentence 6.', words: `The paper says ${paperNotices}. The owner’s copies on record say the same.` })
  else lines.push({ state: 'ask', lead: 'Sentence 6.', words: `The paper says ${paperNotices}. The record shows ${recordNotices || 'no copy to the owner'}.` })

  // Beside them: a month a notice names that the paper leaves off, and a month of the job's work no notice names.
  const span = lienNoticeRecordSpanMonths(input.workStart, input.workEnd)
  const outside = noticed.filter((m) => !sworn.includes(m))
  if (outside.length > 0) lines.push({ state: 'note', lead: 'Left off the paper.', words: `The notices also name ${describeNoticeMonths(outside)}. The paper leaves ${outside.length === 1 ? 'it' : 'them'} off, as outside this job’s work dates.` })
  const unnamed = span.filter((m) => !noticed.includes(m))
  if (unnamed.length > 0) lines.push({ state: 'note', lead: 'No notice.', words: `This job’s work dates take in ${describeNoticeMonths(unnamed)}. No notice on record names ${unnamed.length === 1 ? 'it' : 'them'}.` })

  return {
    notices,
    months,
    flags: lienNoticeCheckLines(check),
    lines,
    gaps: lienNoticeRecordGaps(notices),
    voided: filings.filter((f) => f.kind === 'notice_53_056' && Boolean(f.voided_at)).length,
    commercial: lienCommercialClock(input.propertyKind),
  }
}

/** True when the record raises a question for the attorney: a month late or missing, or a sentence the record does not back. */
export function lienNoticeRecordAsks(record: LienNoticeRecord): boolean {
  return record.flags.length > 0 || record.lines.some((l) => l.state === 'ask')
}

const METHOD_CELL: Record<string, string> = { certified_mail: 'Certified mail', traceable_courier: 'Courier with receipt', hand: 'By hand', email: 'Email' }

/** The method in a table cell: a few words with a capital. An unknown one prints as recorded. */
export function lienNoticeRecordMethodWords(method: string): string {
  const words = METHOD_CELL[method] ?? lienAffidavitMethodWords(method)
  return words.charAt(0).toUpperCase() + words.slice(1)
}
