/**
 * Messages, residential R5: **Message the customer** on Job Mode (`RESIDENTIAL_BUILD_PLAN.md` → R5 on branch
 * spike/gc-mode; screen 2 of `customer-messages-prototype.html` v0.8 beside it, the sheet and its preview). A tech on
 * the job picks one of the lines the office put on the phone, sees it filled, types only what the app cannot know, and
 * sends it. There is no free text: **Something else** is a note on the job, and the office sends what the customer
 * should hear. Pure. The door's who-may and its switch are `messages/jobBox.ts`; the reads and writes are
 * `jobModeMessageCustomerIo.ts`.
 *
 * - A line that needs money or the customer's page link stays off the phone. A tech sees no money, and the app cannot
 *   make the link from the field yet.
 * - The app fills their first name, the tech's name, the job, its address, and the window, day and next visit from the
 *   tech's own blocks on the job. Minutes out and what the tech found are typed in the fill row.
 */
import type { PortalLang } from './gc/portalI18n'
import { scheduleFormatTimeHm, scheduleFormatWeekdayOnly } from './jobScheduleChicago'
import { blanksIn, blankWords, fillFirst, fillLine, type BlankFills } from './quickReplies/blanks'
import { hintFor, phoneLines, shortName, SOMETHING_ELSE, wordsFor, type PhoneLine } from './quickReplies/phone'
import { quickRepliesFromRows, type QuickReplyRow } from './quickReplies/rows'

// ---------- the phone's lines, from the table ----------

/** A `quick_replies` row with the phone's columns (`20261013210000_quick_replies_phone_es.sql`). */
export interface PhoneLineRow extends QuickReplyRow {
  phone_order: number | null
  phone_name: string | null
  text_es: string | null
}

/** The rows a tech reads (`quick_replies_phone_tech`) as the phone's lines. A row of a kind the kernel does not know is left out. */
export function phoneLinesFromRows(rows: readonly PhoneLineRow[]): PhoneLine[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return quickRepliesFromRows(rows, []).map((q) => {
    const r = byId.get(q.id)
    return { ...q, phoneOrder: r?.phone_order ?? null, phoneName: r?.phone_name ?? null, textEs: r?.text_es ?? null }
  })
}

/** Blanks a tech's phone never offers: money a tech does not see, and a page link the field cannot make yet. */
export const OFF_PHONE_BLANKS: readonly string[] = ['amount', 'link']

/** True when the line can go from the phone: neither its English nor its Spanish needs money or the page link. */
export function onPhone(line: Pick<PhoneLine, 'text' | 'textEs'>): boolean {
  const used = [...blanksIn(line.text), ...blanksIn(line.textEs ?? '')]
  return !used.some((b) => OFF_PHONE_BLANKS.includes(b))
}

// ---------- the fills ----------

/** One of the tech's blocks on the job, as `job_schedule_blocks` keeps it. */
export interface JobModeBlock {
  /** `work_date`, YYYY-MM-DD. */
  workDate: string
  /** "09:30:00". */
  timeStart: string
  timeEnd: string
}

/** What the app knows on the press. */
export interface JobModeFillInput {
  /** The customer's name as their record has it: "Dana Whitfield". */
  customerName: string | null
  /** The signed-in tech's name: "Luis Ortega". */
  me: string | null
  jobName: string | null
  jobAddress: string | null
  /** The tech's blocks on this job from today on, any order. */
  blocks: readonly JobModeBlock[]
  /** Today, YYYY-MM-DD in Chicago. */
  today: string
}

const firstWord = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null

/** A block's window as a text says it: "9:30 AM to 11:00 AM". */
export function windowWords(block: Pick<JobModeBlock, 'timeStart' | 'timeEnd'>): string {
  return `${scheduleFormatTimeHm(block.timeStart)} to ${scheduleFormatTimeHm(block.timeEnd)}`
}

/**
 * The blanks the app fills from Job Mode. `window` and `day` are today's block on the job, the first when there are
 * two. `back day` and `back time` are the first block after today. A blank with nothing to read stays out, so the fill
 * row asks for it.
 */
export function jobModeFills(input: JobModeFillInput): BlankFills {
  const sorted = [...input.blocks].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.timeStart.localeCompare(b.timeStart))
  const todays = sorted.find((b) => b.workDate === input.today) ?? null
  const next = sorted.find((b) => b.workDate > input.today) ?? null
  const fills: Record<string, string> = {}
  const put = (key: string, value: string | null | undefined) => {
    if (value?.trim()) fills[key] = value.trim()
  }
  put('first', firstWord(input.customerName))
  put('me', firstWord(input.me))
  put('job', input.jobName)
  put('address', input.jobAddress)
  if (todays) {
    put('window', windowWords(todays))
    put('day', 'today')
  }
  if (next) {
    put('back day', scheduleFormatWeekdayOnly(next.workDate))
    put('back time', scheduleFormatTimeHm(next.timeStart))
  }
  return fills
}

// ---------- the sheet ----------

/** One button on the sheet. */
export interface SheetRow {
  line: PhoneLine
  /** The button's name: "On my way". */
  name: string
  /** The hint under it: "minutes out, from the drive". */
  hint: string
}

/**
 * The sheet's buttons: the phone's lines that can go from the phone, the job's step first, six at most, each by its
 * short name with a hint from its blanks. **Something else** is the sheet's own last press, never a row here.
 */
export function sheetRows(lines: readonly PhoneLine[], stepId: string | null, fills: BlankFills): SheetRow[] {
  return phoneLines(lines.filter(onPhone), stepId).map((line) => ({ line, name: shortName(line, fills), hint: hintFor(line.text, fills) }))
}

/** One blank the tech types in the fill row. */
export interface FillAsk {
  key: string
  /** The box's words: "minutes out, from the drive". */
  words: string
}

/** What a line reads before it sends. */
export interface Preview {
  /** The words with every blank filled that can be. */
  text: string
  /** The blanks the tech types, in order. */
  asks: FillAsk[]
  /** Why Send waits, or null when it can go. */
  stop: string | null
}

/**
 * The preview: the line in the customer's language, the app's fills and what the tech typed. A blank left empty is
 * asked in the fill row, and Send waits until it is filled.
 */
export function previewOf(line: Pick<PhoneLine, 'text' | 'textEs'>, fills: BlankFills, typed: Readonly<Record<string, string>>, lang: PortalLang = 'en'): Preview {
  const words = wordsFor(line, lang)
  const appLeft = fillLine(words, fills).left
  const { text, left } = fillLine(words, { ...fills, ...typed })
  return { text, asks: appLeft.map((key) => ({ key, words: blankWords(key) })), stop: fillFirst(left) }
}

// ---------- their answer ----------

/** A line in their thread as the sheet reads it. */
export interface ThreadTail {
  direction: string
  at: string
  body: string
}

const saidNewestFirst = (lines: readonly ThreadTail[]) =>
  lines.filter((m) => m.direction === 'in' || m.direction === 'out').sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

/** True when they answered and nobody has written back: their line is newer than ours. Notes and events do not count. */
export function replyWaiting(lines: readonly ThreadTail[]): boolean {
  return saidNewestFirst(lines)[0]?.direction === 'in'
}

/** Their answer waiting on the sheet: the newest line, when it is theirs. Null when ours is newest or there is none. */
export function waitingAnswer(lines: readonly ThreadTail[]): ThreadTail | null {
  const newest = saidNewestFirst(lines)[0]
  return newest?.direction === 'in' ? newest : null
}

// ---------- Something else ----------

/** The note **Something else** leaves on the job for the office: "Please tell Dana: the part comes Thursday." Null when empty. */
export function noteForOffice(text: string, customerName: string | null): string | null {
  const said = text.trim()
  if (!said) return null
  return `Please tell ${firstWord(customerName) ?? 'the customer'}: ${said}`
}

// ---------- the words ----------

export const SHEET_WORDS = {
  door: 'Message the customer',
  doorWaiting: 'Message the customer. They answered.',
  title: (first: string | null) => (first ? `Message ${first}` : 'Message the customer'),
  pick: 'Pick a line. You see it before it sends.',
  none: 'The office has not put any lines on the phone yet. Use Something else to leave them a note.',
  noCustomer: 'This job has no customer yet. Ask the office to add one.',
  answered: (first: string | null) => `${first ?? 'They'} wrote back:`,
  answerComes: 'Their answer comes back to you here. The office sees it too.',
  preview: (first: string | null) => (first ? `This is what ${first} gets.` : 'This is what they get.'),
  send: (first: string | null) => (first ? `Send to ${first}` : 'Send'),
  back: 'Pick another line',
  sent: (first: string | null) => (first ? `Sent to ${first}.` : 'Sent.'),
  noteSent: 'The office has your note.',
  somethingElse: SOMETHING_ELSE,
} as const
