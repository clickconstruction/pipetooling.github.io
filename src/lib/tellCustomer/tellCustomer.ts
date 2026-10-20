/**
 * Tell the customer (v2.5593, punch list #115; the plan `to-dos/tell-the-customer/README.md`). The principle: nothing
 * reaches a customer without a person pressing it, or seeing it the moment after. When the office books a job's first
 * visit, or sends an estimate (v2.5594), the sheet opens before anything goes: the office's line on the step filled
 * for this customer, the channels that apply ticked, the words theirs to change, Send or Skip. After the send, the
 * receipt: what went, when, and the call to make, with its script. Pure: the fills from the block or the estimate, the
 * line for the moment (the office's on the step, else the app's own), the words, why no text can go, the rows and the
 * presses, the receipt's words and its script. The reads and the sends are `tellCustomerIo.ts`; the sheet is
 * `components/customers/TellCustomerSheet.tsx`.
 */
import { SEED_CALL_SCRIPTS } from '../flows/callScripts'
import type { PortalLang } from '../gc/portalI18n'
import { windowWords } from '../jobModeText'
import { scheduleFormatWeekdayLong } from '../jobScheduleChicago'
import { blankNames, fillLine, type BlankFills } from '../quickReplies/blanks'
import { stepLine, type QuickReply } from '../quickReplies/kernel'
import { lineWords } from '../quickReplies/spanish'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/** The moments that open the sheet. */
export type TellMoment = 'booked' | 'rescheduled' | 'estimate' | 'working' | 'done' | 'billed'

/**
 * The board's moves the sheet asks about (v2.5627, punch list #123): a job moved forward to Working, Ready to Bill or
 * Billed on the Pipeline, the residential steps Working, Done and Billed. Paid stays out: its step already carries the
 * pay-by reminder, and the payment has its own email.
 */
export type MoveMoment = 'working' | 'done' | 'billed'
export const MOVE_MOMENTS: readonly MoveMoment[] = ['working', 'done', 'billed']
export const isMoveMoment = (moment: TellMoment): moment is MoveMoment => (MOVE_MOMENTS as readonly string[]).includes(moment)

/** Each moment's step name, for the sheet's hints. */
export const MOMENT_NAMES: Readonly<Record<TellMoment, string>> = { booked: 'Booked', rescheduled: 'Booked', estimate: 'Estimate', working: 'Working', done: 'Done', billed: 'Billed' }

/** The flow step each moment's line lives on, for the office's quick replies. A moved visit reads the Booked step too. */
export const MOMENT_STEP: Readonly<Record<TellMoment, string>> = { booked: 'booked', rescheduled: 'booked', estimate: 'estimate', working: 'working', done: 'done', billed: 'billed' }

/** The app's own words for a moment, used until the office writes a line on the step. */
export const DEFAULT_LINES: Readonly<Record<TellMoment, { text: string; textEs: string }>> = {
  booked: {
    text: '{first}, this is {me} with Click Plumbing. We have you booked for {day}, {window}. {tech} will text you when on the way.',
    textEs: '{first}, le habla {me} de Click Plumbing. Tenemos su visita para el {day}, {window}. {tech} le enviará un mensaje cuando vaya en camino.',
  },
  rescheduled: {
    text: '{first}, this is {me} with Click Plumbing. Your visit moved to {day}, {window}. {tech} will text you when on the way.',
    textEs: '{first}, le habla {me} de Click Plumbing. Su visita cambió al {day}, {window}. {tech} le enviará un mensaje cuando vaya en camino.',
  },
  estimate: {
    text: '{first}, this is {me} with Click Plumbing. Your estimate for {job} is ready, {amount}. Open it to approve the option you want: {link}',
    textEs: '{first}, le habla {me} de Click Plumbing. Su presupuesto de {job} está listo, {amount}. Ábralo para aprobar la opción que prefiera: {link}',
  },
  working: {
    text: '{first}, this is {me} with Click Plumbing. We started the work on {job} today. Text me here with any question.',
    textEs: '{first}, le habla {me} de Click Plumbing. Hoy empezamos el trabajo de {job}. Escríbame aquí si tiene alguna pregunta.',
  },
  done: {
    text: '{first}, this is {me} with Click Plumbing. The work on {job} is done. Your bill follows by email. Text me here with any question.',
    textEs: '{first}, le habla {me} de Click Plumbing. El trabajo de {job} está terminado. Su factura llega por correo electrónico. Escríbame aquí si tiene alguna pregunta.',
  },
  billed: {
    text: '{first}, this is {me} with Click Plumbing. Your bill for {job} went to your email today. Text me here with any question.',
    textEs: '{first}, le habla {me} de Click Plumbing. Hoy le enviamos la factura de {job} a su correo electrónico. Escríbame aquí si tiene alguna pregunta.',
  },
}

/** What to say on the call the receipt offers, until the office writes a script on the step (Settings → Flows, v2.5596). */
export const DEFAULT_SCRIPTS: Readonly<Record<TellMoment, { text: string; textEs: string }>> = {
  booked: SEED_CALL_SCRIPTS.booked,
  rescheduled: {
    text: 'Hi {first}, this is {me} with Click Plumbing. We moved your visit to {day}, {window}, and I wanted to make sure that works for you.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Cambiamos su visita al {day}, {window}, y quería confirmar que le funciona.',
  },
  estimate: SEED_CALL_SCRIPTS.estimate,
  working: {
    text: 'Hi {first}, this is {me} with Click Plumbing. We started on {job} today, and I wanted to see if you have any questions.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Hoy empezamos con {job}, y quería saber si tiene alguna pregunta.',
  },
  done: {
    text: 'Hi {first}, this is {me} with Click Plumbing. The work on {job} is done. I wanted to make sure everything looks right to you.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. El trabajo de {job} está terminado. Quería asegurarme de que todo quedó bien.',
  },
  billed: {
    text: 'Hi {first}, this is {me} with Click Plumbing. Your bill for {job} went out by email today. I wanted to make sure it reached you.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Hoy le enviamos la factura de {job} por correo electrónico. Quería asegurarme de que le llegó.',
  },
}

// ---------- the fills ----------

/** The block the sheet reads: the visit's day, its window, and who is coming. */
export interface TellBlock {
  /** YYYY-MM-DD */
  workDate: string
  /** "10:00:00" */
  timeStart: string
  timeEnd: string
  /** The assignee's name: "Luis Ortega". */
  techName: string | null
}

/** The estimate the sheet reads (v2.5594): its total as words and its title. */
export interface TellEstimateFacts {
  /** "$1,850.00" */
  amount: string
  title: string
}

export interface TellFillInput {
  customerName: string | null
  /** The signed-in person's name. */
  me: string | null
  jobName: string | null
  jobAddress: string | null
  block?: TellBlock | null
  estimate?: TellEstimateFacts | null
  /** The job's newest billed bill's pay page, for `{bill}` (v2.5628). */
  billLink?: string | null
}

export const firstWord = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null

/**
 * The blanks the sheet fills: their first name, ours, the job, its address, and from a block the visit's day, window
 * and tech; from an estimate its amount and, when the job has no name, its title. `{link}` is never filled here: the
 * estimate's link exists only once the email went, and the send fills it then.
 */
export function tellFills(input: TellFillInput): BlankFills {
  const fills: Record<string, string> = {}
  const put = (key: string, value: string | null | undefined) => {
    if (value?.trim()) fills[key] = value.trim()
  }
  put('first', firstWord(input.customerName))
  put('me', firstWord(input.me))
  put('job', input.jobName ?? input.estimate?.title ?? null)
  put('address', input.jobAddress)
  if (input.block) {
    put('day', scheduleFormatWeekdayLong(input.block.workDate))
    put('window', windowWords(input.block))
    put('tech', firstWord(input.block.techName))
  }
  if (input.estimate) put('amount', input.estimate.amount)
  put('bill', input.billLink)
  return fills
}

// ---------- the line ----------

export interface TellLine {
  text: string
  textEs: string | null
  /** True when the office wrote it on the step; false for the app's own words. */
  office: boolean
  /** The office line's id, for the record; null for the app's own. */
  id: string | null
}

/** The line a moment sends: the office's team line for customers on the moment's step, else the app's own words. A moved visit always takes its own. */
export function lineFor(moment: TellMoment, lines: readonly QuickReply[], me: string): TellLine {
  const own = moment === 'rescheduled' ? null : stepLine(lines, 'customer', MOMENT_STEP[moment], me)
  if (own) return { text: own.text, textEs: own.textEs ?? null, office: true, id: own.id }
  const d = DEFAULT_LINES[moment]
  return { text: d.text, textEs: d.textEs, office: false, id: null }
}

/** The words as they would go, in the customer's language, and the blanks nobody filled. */
export function tellWords(line: Pick<TellLine, 'text' | 'textEs'>, fills: BlankFills, lang: PortalLang): { text: string; left: string[] } {
  return fillLine(lineWords(line, lang), fills)
}

/** The blanks still in a body the person edited: "{x}" words. On an estimate, `{link}` is the send's to fill, so it never holds the press. */
export function blanksLeftIn(body: string, moment: TellMoment = 'booked'): string[] {
  const left = [...new Set(Array.from(body.matchAll(/\{([a-z ]+)\}/g)).flatMap((m) => (m[1] ? [m[1]] : [])))]
  return moment === 'estimate' ? left.filter((k) => k !== 'link') : left
}

// ---------- why no text ----------

export type TellHold = 'not-office' | 'no-customer' | 'no-number' | 'stop' | 'texts-off'

export function tellHold(input: { office: boolean; hasCustomer: boolean; number: string | null; stopped: boolean; textsOn: boolean }): TellHold | null {
  if (!input.office) return 'not-office'
  if (!input.hasCustomer) return 'no-customer'
  if (!input.textsOn) return 'texts-off'
  if (!input.number) return 'no-number'
  if (input.stopped) return 'stop'
  return null
}

export function holdWords(hold: TellHold, first: string | null): string {
  const who = first ?? 'the customer'
  switch (hold) {
    case 'not-office':
      return 'No text: only the office team texts a customer from here.'
    case 'no-customer':
      return 'No text: this job has no customer yet. Add one on the job first.'
    case 'texts-off':
      return 'No text: texts are off. The owner or a dev turns them on in Settings → Phone and texts.'
    case 'no-number':
      return `No text: ${who} has no phone number on file. Add one on the customer.`
    case 'stop':
      return `No text: ${who} sent STOP to the company number. Call instead.`
  }
}

// ---------- the rows and the presses ----------

export interface ActRow {
  icon: string
  words: string
  hold: boolean
}

export interface TellActs {
  rows: ActRow[]
  /** The primary press, which says exactly what it will do; Close when nothing can go. */
  primary: string
  /** The quiet press beside it. */
  skip: string
  /** On an estimate whose text can go: the press that sends the email alone. Null otherwise. */
  emailOnly: string | null
}

/** How the customer asked to hear from us (`contacts.prefers`, v2.5597); null when nobody said. */
export type TellPrefers = 'text' | 'email' | 'either' | null

/** The customer's say beside a channel it does not match: a note, never a hold. The office still decides. */
export function prefersNote(moment: TellMoment, first: string | null, prefers: TellPrefers): string | null {
  const who = first ?? 'They'
  if (prefers === 'email') return `${who} asked to hear from us by email. ${moment === 'estimate' ? 'Email only may be the kinder press.' : 'A call may be kinder than this text.'}`
  if (prefers === 'text' && moment === 'estimate') return `${who} asked to hear from us by text. The email still carries the link.`
  return null
}

/** What a board's move texts, in the act's row (v2.5627). */
const MOVE_WHAT: Readonly<Partial<Record<TellMoment, string>>> = { working: 'that the work has started', done: 'that the work is done', billed: 'that the bill went to their email' }

export function tellActs(moment: TellMoment, first: string | null, hold: TellHold | null, prefers: TellPrefers = null): TellActs {
  const who = first ?? 'the customer'
  const their = first ? `${first}’s` : 'Their'
  const receipt = { icon: '🧾', words: 'Then shows you what went, and offers the call.', hold: false }
  const note = prefersNote(moment, first, prefers)
  const say = note ? [{ icon: 'ℹ️', words: note, hold: false }] : []
  if (moment === 'estimate') {
    const email = { icon: '✉️', words: `Emails ${who} the estimate with the link to approve it.`, hold: false }
    if (hold) return { rows: [email, { icon: '⚠', words: holdWords(hold, first), hold: true }, receipt], primary: `Send email to ${who}`, skip: 'Skip', emailOnly: null }
    const text = { icon: '💬', words: `Texts ${who} the same link from the company number. ${their} answer comes to the office.`, hold: false }
    return { rows: [email, text, ...say, receipt], primary: `Send both to ${who}`, skip: 'Skip', emailOnly: 'Email only' }
  }
  if (hold) return { rows: [{ icon: '⚠', words: holdWords(hold, first), hold: true }], primary: 'Close', skip: 'Skip', emailOnly: null }
  const what = MOVE_WHAT[moment] ?? (moment === 'rescheduled' ? 'the new day and window' : 'the day and the window')
  return {
    rows: [{ icon: '💬', words: `Texts ${who} ${what} from the company number. ${their} answer comes to the office.`, hold: false }, ...say, receipt],
    primary: `Send text to ${who}`,
    skip: 'Skip',
    emailOnly: null,
  }
}

/**
 * The office's edited words back to a line with blanks (Make this the office's line, v2.5597): each fill's value, the
 * longest first, becomes its blank again, so *Dana* reads `{first}` and *Friday, October 23, 2026* reads `{day}`. A
 * value that is empty, or one word of one letter, is left alone.
 */
export function unfillLine(text: string, fills: BlankFills): string {
  const pairs = Object.entries(fills)
    .filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].trim().length > 1)
    .sort((a, b) => b[1].length - a[1].length)
  let out = text
  for (const [key, value] of pairs) out = out.split(value).join(`{${key}}`)
  return out
}

// ---------- the send's answer (v2.5681, punch list #133) ----------

/**
 * What the page's email send answers the sheet (v2.5681): the link, or why not — never a bare null. `already-went`
 * carries the first send's time when the server knows it; `slow` is a send that gave no answer in 20 seconds and may
 * still land; `refused` is every other no, with the reason as the server or the page said it.
 */
export type TellSendEmailAnswer =
  | { ok: true; acceptUrl: string | null; emailed: boolean; warning?: string | null }
  | { ok: false; kind: TellProblemKind; why: string; sentAtMs?: number | null }

export type TellProblemKind = 'already-went' | 'refused' | 'slow'

/** The band the sheet draws when a send cannot finish: the reason and the move, in place of a toast (v2.5681). */
export interface TellProblem {
  kind: TellProblemKind
  title: string
  detail: string
}

/** The band's words for a send that answered no. The sheet keeps the typed words and the presses under it. */
export function tellProblem(answer: Extract<TellSendEmailAnswer, { ok: false }>, first: string | null): TellProblem {
  const who = first ?? 'the customer'
  if (answer.kind === 'already-went') {
    const when = answer.sentAtMs ? ` It went ${clockDay(answer.sentAtMs)} at ${clockHm(answer.sentAtMs)}.` : ''
    return {
      kind: 'already-went',
      title: `This estimate already went to ${who}.${when}`,
      detail: 'Send the link again makes a fresh link and emails it. The old link stops working. The text carries the fresh link.',
    }
  }
  if (answer.kind === 'slow') {
    return {
      kind: 'slow',
      title: 'No answer after 20 seconds.',
      detail: `The email may still have gone. Open ${first ? `${first}’s` : 'their'} thread before you press again.`,
    }
  }
  return { kind: 'refused', title: TELL_WORDS.emailNotGo, detail: answer.why }
}

// ---------- the receipt ----------

/** An instant as the clock says it in the app's time zone: "2:41 PM". */
export function clockHm(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/** A day as the band says it in the app's time zone: "Mon, Oct 20". */
export function clockDay(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
}

/** The receipt's line under the text: *Text · from the company number · 2:41 PM · in Dana’s thread*. */
export function sentLine(first: string | null, atMs: number): string {
  return `Text · from the company number · ${clockHm(atMs)} · in ${first ? `${first}’s` : 'their'} thread`
}

/** The receipt's line for the estimate's email: *Email · dana@example.com · 3:05 PM*. */
export function emailSentLine(email: string, atMs: number): string {
  return `Email · ${email} · ${clockHm(atMs)}`
}

/** The receipt's honest line when the link was made but the email did not go (v2.5681): the page copied the link. */
export function emailNotSentLine(email: string): string {
  return `The email to ${email} did not go. The link was made and copied. Paste it into an email yourself.`
}

/** The call's script, filled for this customer, in the office's language: the step's own (`flow_steps.call_script`, v2.5596) when the office wrote one, else the app's. */
export function receiptScript(moment: TellMoment, fills: BlankFills, lang: PortalLang = 'en', script: { text: string; textEs: string } | null = null): string {
  const s = script ?? DEFAULT_SCRIPTS[moment]
  const words = lang === 'es' ? s.textEs || s.text : s.text || s.textEs
  return fillLine(words, fills).text
}

// ---------- the words ----------

export const TELL_WORDS = {
  title: (first: string | null) => `Tell ${first ?? 'the customer'}`,
  whatGoes: 'What goes',
  whatHappens: 'What happens',
  textTo: (number: string) => `Text to ${number}`,
  emailTo: (email: string) => `Email to ${email}`,
  emailWhat: 'The estimate with its link to approve, as the page previews it.',
  reads: (lang: PortalLang) => (lang === 'es' ? 'reads Spanish' : 'reads English'),
  editHint: (office: boolean, moment: TellMoment) => {
    if (moment === 'estimate') return office ? 'The office’s Estimate line, filled for this estimate. Change any word.' : 'The app’s own words, since the office has no Estimate line yet. Change any word.'
    if (moment === 'rescheduled') return 'The app’s own words for a moved visit. Change any word.'
    if (isMoveMoment(moment)) return office ? `The office’s ${MOMENT_NAMES[moment]} line, filled for this job. Change any word.` : `The app’s own words, since the office has no ${MOMENT_NAMES[moment]} line yet. Change any word.`
    return office ? 'The office’s Booked line, filled from the block. Change any word.' : 'The app’s own words, since the office has no Booked line yet. Change any word.'
  },
  linkHint: 'The link fills in when it sends. Keep the word link in braces where you want it.',
  noEmail: (moment: TellMoment) => (isMoveMoment(moment) ? 'No email goes with this text.' : 'No email goes for a booking.'),
  blanksLeft: (left: readonly string[]) => `Fill ${blankNames(left)} before it sends.`,
  reading: 'Reading the job…',
  sending: 'Sending…',
  receiptTitle: (first: string | null) => `Sent to ${first ?? 'the customer'}`,
  callAsk: (first: string | null) => `Call ${first ?? 'them'} to talk it through?`,
  whatToSay: 'What to say',
  callLands: (first: string | null) => `The call lands in ${first ? `${first}’s` : 'their'} thread when it ends.`,
  call: (number: string) => `Call ${number}`,
  done: 'Done',
  sentToast: (first: string | null) => `Sent to ${first ?? 'the customer'}.`,
  bothSentToast: (first: string | null) => `Emailed and texted ${first ?? 'the customer'}.`,
  emailOnlyToast: 'The email went. No link came back, so no text went.',
  textFailed: 'The email went. The text did not. Send it from the thread.',
  emailNotGo: 'The email did not go.',
  textNotGo: 'The text did not go.',
  sendAgain: 'Send the link again',
  tryAgain: 'Try again',
  stillSending: 'Still sending. One moment.',
  skipped: 'Nothing sent.',
  officeLine: 'Make this the office’s line',
  officeLineHint: 'The words with the blanks back, as the step’s line for everyone. Change any blank before you save.',
  officeLineSave: 'Save as the office’s line',
  officeLineSaved: 'Saved as the office’s line. It fills for the next customer.',
  morningTitle: 'Ready for the morning',
  morningLine: (day: string) => `Goes at 9 AM on ${day} from the company number.`,
  morningWhere: 'Until then it waits on the Dashboard under Today’s sends. You can change it or take it back there.',
} as const
