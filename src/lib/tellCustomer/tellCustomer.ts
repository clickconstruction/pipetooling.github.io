/**
 * Tell the customer (v2.5593, punch list #115; the plan `to-dos/tell-the-customer/README.md`). The principle: nothing
 * reaches a customer without a person pressing it, or seeing it the moment after. When the office books a job's first
 * visit, the sheet opens before anything goes: the office's Booked line filled from the block, the text ticked, the
 * words theirs to change, Send or Skip. After the send, the receipt: what went, when, and the call to make, with its
 * script. Pure: the fills from the block, the line for the moment (the office's on the step, else the app's own), the
 * words, why no text can go, the rows and the presses, the receipt's words and its script. The reads and the send are
 * `tellCustomerIo.ts`; the sheet is `components/customers/TellCustomerSheet.tsx`.
 */
import type { PortalLang } from '../gc/portalI18n'
import { windowWords } from '../jobModeText'
import { scheduleFormatWeekdayLong } from '../jobScheduleChicago'
import { blankNames, fillLine, type BlankFills } from '../quickReplies/blanks'
import { stepLine, type QuickReply } from '../quickReplies/kernel'
import { lineWords } from '../quickReplies/spanish'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/** The moments that open the sheet. PR 3 adds the estimate. */
export type TellMoment = 'booked' | 'rescheduled'

/** The flow step each moment's line lives on, for the office's quick replies. A moved visit reads the Booked step too. */
export const MOMENT_STEP: Readonly<Record<TellMoment, string>> = { booked: 'booked', rescheduled: 'booked' }

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
}

/** What to say on the call the receipt offers, until the office writes a script on the step (the Flows editor, PR 5). */
export const DEFAULT_SCRIPTS: Readonly<Record<TellMoment, { text: string; textEs: string }>> = {
  booked: {
    text: 'Hi {first}, this is {me} with Click Plumbing. You should have a text from us with the window for {day}, {window}. Does that still work for you? {tech} will text you when on the way.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Le llegó un mensaje nuestro con la ventana del {day}, {window}. ¿Le sigue funcionando? {tech} le avisará cuando vaya en camino.',
  },
  rescheduled: {
    text: 'Hi {first}, this is {me} with Click Plumbing. We moved your visit to {day}, {window}, and I wanted to make sure that works for you.',
    textEs: 'Hola {first}, le habla {me} de Click Plumbing. Cambiamos su visita al {day}, {window}, y quería confirmar que le funciona.',
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

export interface TellFillInput {
  customerName: string | null
  /** The signed-in person's name. */
  me: string | null
  jobName: string | null
  jobAddress: string | null
  block: TellBlock
}

export const firstWord = (name: string | null | undefined) => name?.trim().split(/\s+/)[0] || null

/** The blanks the sheet fills: their first name, ours, the job, its address, the visit's day and window, and the tech. */
export function tellFills(input: TellFillInput): BlankFills {
  const fills: Record<string, string> = {}
  const put = (key: string, value: string | null | undefined) => {
    if (value?.trim()) fills[key] = value.trim()
  }
  put('first', firstWord(input.customerName))
  put('me', firstWord(input.me))
  put('job', input.jobName)
  put('address', input.jobAddress)
  put('day', scheduleFormatWeekdayLong(input.block.workDate))
  put('window', windowWords(input.block))
  put('tech', firstWord(input.block.techName))
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

/** The line a moment sends: the office's team line for customers on the moment's step, else the app's own words. */
export function lineFor(moment: TellMoment, lines: readonly QuickReply[], me: string): TellLine {
  const own = stepLine(lines, 'customer', MOMENT_STEP[moment], me)
  if (own && moment === 'booked') return { text: own.text, textEs: own.textEs ?? null, office: true, id: own.id }
  const d = DEFAULT_LINES[moment]
  return { text: d.text, textEs: d.textEs, office: false, id: null }
}

/** The words as they would go, in the customer's language, and the blanks nobody filled. */
export function tellWords(line: Pick<TellLine, 'text' | 'textEs'>, fills: BlankFills, lang: PortalLang): { text: string; left: string[] } {
  return fillLine(lineWords(line, lang), fills)
}

/** The blanks still in a body the person edited: "{x}" words. */
export function blanksLeftIn(body: string): string[] {
  return [...new Set(Array.from(body.matchAll(/\{([a-z ]+)\}/g)).flatMap((m) => (m[1] ? [m[1]] : [])))]
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
}

export function tellActs(moment: TellMoment, first: string | null, hold: TellHold | null): TellActs {
  const who = first ?? 'the customer'
  const their = first ? `${first}’s` : 'Their'
  if (hold) return { rows: [{ icon: '⚠', words: holdWords(hold, first), hold: true }], primary: 'Close', skip: 'Skip' }
  const what = moment === 'rescheduled' ? 'the new day and window' : 'the day and the window'
  return {
    rows: [
      { icon: '💬', words: `Texts ${who} ${what} from the company number. ${their} answer comes to the office.`, hold: false },
      { icon: '🧾', words: 'Then shows you what went, and offers the call.', hold: false },
    ],
    primary: `Send text to ${who}`,
    skip: 'Skip',
  }
}

// ---------- the receipt ----------

/** An instant as the clock says it in the app's time zone: "2:41 PM". */
export function clockHm(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/** The receipt's line under the words: *Text · from the company number · 2:41 PM · in Dana’s thread*. */
export function sentLine(first: string | null, atMs: number): string {
  return `Text · from the company number · ${clockHm(atMs)} · in ${first ? `${first}’s` : 'their'} thread`
}

/** The call's script, filled for this customer, in the office's language. The step's own script replaces the default in PR 5. */
export function receiptScript(moment: TellMoment, fills: BlankFills, lang: PortalLang = 'en'): string {
  const s = DEFAULT_SCRIPTS[moment]
  return fillLine(lang === 'es' ? s.textEs : s.text, fills).text
}

// ---------- the words ----------

export const TELL_WORDS = {
  title: (first: string | null) => `Tell ${first ?? 'the customer'}`,
  whatGoes: 'What goes',
  whatHappens: 'What happens',
  textTo: (number: string) => `Text to ${number}`,
  reads: (lang: PortalLang) => (lang === 'es' ? 'reads Spanish' : 'reads English'),
  editHint: (office: boolean, moment: TellMoment) =>
    office ? 'The office’s Booked line, filled from the block. Change any word.' : moment === 'rescheduled' ? 'The app’s own words for a moved visit. Change any word.' : 'The app’s own words, since the office has no Booked line yet. Change any word.',
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
  skipped: 'Nothing sent.',
} as const
