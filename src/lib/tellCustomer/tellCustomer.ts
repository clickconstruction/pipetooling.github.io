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
export type TellMoment = 'booked' | 'rescheduled' | 'estimate'

/** The flow step each moment's line lives on, for the office's quick replies. A moved visit reads the Booked step too. */
export const MOMENT_STEP: Readonly<Record<TellMoment, string>> = { booked: 'booked', rescheduled: 'booked', estimate: 'estimate' }

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
}

/** What to say on the call the receipt offers, until the office writes a script on the step (Settings → Flows, v2.5596). */
export const DEFAULT_SCRIPTS: Readonly<Record<TellMoment, { text: string; textEs: string }>> = {
  booked: SEED_CALL_SCRIPTS.booked,
  rescheduled: {
    text: 'Hi {first}, this is {me} with Click Plumbing. We moved your visit to {day}, {window}, and I wanted to make sure that works for you.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Cambiamos su visita al {day}, {window}, y quería confirmar que le funciona.',
  },
  estimate: SEED_CALL_SCRIPTS.estimate,
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

export function tellActs(moment: TellMoment, first: string | null, hold: TellHold | null): TellActs {
  const who = first ?? 'the customer'
  const their = first ? `${first}’s` : 'Their'
  const receipt = { icon: '🧾', words: 'Then shows you what went, and offers the call.', hold: false }
  if (moment === 'estimate') {
    const email = { icon: '✉️', words: `Emails ${who} the estimate with the link to approve it.`, hold: false }
    if (hold) return { rows: [email, { icon: '⚠', words: holdWords(hold, first), hold: true }, receipt], primary: `Send email to ${who}`, skip: 'Skip', emailOnly: null }
    const text = { icon: '💬', words: `Texts ${who} the same link from the company number. ${their} answer comes to the office.`, hold: false }
    return { rows: [email, text, receipt], primary: `Send both to ${who}`, skip: 'Skip', emailOnly: 'Email only' }
  }
  if (hold) return { rows: [{ icon: '⚠', words: holdWords(hold, first), hold: true }], primary: 'Close', skip: 'Skip', emailOnly: null }
  const what = moment === 'rescheduled' ? 'the new day and window' : 'the day and the window'
  return {
    rows: [{ icon: '💬', words: `Texts ${who} ${what} from the company number. ${their} answer comes to the office.`, hold: false }, receipt],
    primary: `Send text to ${who}`,
    skip: 'Skip',
    emailOnly: null,
  }
}

// ---------- the receipt ----------

/** An instant as the clock says it in the app's time zone: "2:41 PM". */
export function clockHm(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/** The receipt's line under the text: *Text · from the company number · 2:41 PM · in Dana’s thread*. */
export function sentLine(first: string | null, atMs: number): string {
  return `Text · from the company number · ${clockHm(atMs)} · in ${first ? `${first}’s` : 'their'} thread`
}

/** The receipt's line for the estimate's email: *Email · dana@example.com · 3:05 PM*. */
export function emailSentLine(email: string, atMs: number): string {
  return `Email · ${email} · ${clockHm(atMs)}`
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
    return office ? 'The office’s Booked line, filled from the block. Change any word.' : 'The app’s own words, since the office has no Booked line yet. Change any word.'
  },
  linkHint: 'The link fills in when it sends. Keep the word link in braces where you want it.',
  noEmail: 'No email goes for a booking.',
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
  skipped: 'Nothing sent.',
  morningTitle: 'Ready for the morning',
  morningLine: (day: string) => `Goes at 9 AM on ${day} from the company number.`,
  morningWhere: 'Until then it waits on the Dashboard under Today’s sends. You can change it or take it back there.',
} as const
