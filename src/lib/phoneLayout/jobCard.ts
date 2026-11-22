/**
 * The Job Mode card under the new phone layout (`newPhoneLayout.ts`): the same pieces, laid out for a thumb.
 *
 * The card is the most used screen in the app. Before the switch its first screen named the job three times,
 * drew Paint a map twice, and put the customer's number a screen down as ten unbroken digits on a 23 px link.
 * With the switch on the card opens on Call, Directions and Text, then full-width rows for the job's doors, and
 * the four squares above the card fold into it.
 *
 * This kernel holds the rules that decide what is drawn, so the card, the details under it and the row of squares
 * above it agree: when the card is laid out the new way, when the squares may fold, and the words of the lines.
 * It touches no state of the day: which job, which press and which sheet are the card's own, as they were.
 * Pure.
 */
import { phoneContact } from '../phoneContact'

/**
 * Whether the card is laid out the new way. The switch is on at a phone's width (`on`), the card is the full
 * one, the day is on screen with a job on it, and the job's papers do not close it.
 *
 * - The short Job Mode page keeps its own layout: its lower half is already behind one row.
 * - A job closed by its papers shows its number and the papers to sign, never its details, so there is nothing
 *   to lay out, and the squares above the card stay as they are.
 */
export function phoneJobCardOn(input: { on: boolean; short: boolean; dayOnScreen: boolean; hasJob: boolean; closedByPapers: boolean }): boolean {
  return input.on && !input.short && input.dayOnScreen && input.hasJob && !input.closedByPapers
}

/**
 * Whether the row of squares above the card is folded into it. Only while the switch is on, and only for the
 * job the card says it holds (`foldedJobId`): the card then draws every press those squares had. Any other day
 * keeps its squares: no job (This week and Tomorrow stay as they are), a job the card does not lay out, or a
 * square's job that is not the card's (clocked onto a bid with a stop still ahead).
 */
export function jobSquaresFolded(input: { on: boolean; squaresJobId: string | null; foldedJobId: string | null }): boolean {
  return input.on && input.squaresJobId != null && input.squaresJobId === input.foldedJobId
}

/**
 * Whether the squares draw nothing while the day is still being read. With the switch on and a job already
 * folded into the card, the two empty squares would only flash and leave.
 */
export function jobSquaresHiddenWhileReading(input: { on: boolean; foldedJobId: string | null }): boolean {
  return input.on && input.foldedJobId != null
}

/** Today's stops as one line when the day holds one: the time, and where it stands in the day. */
export function oneStopToday(stopCount: number): boolean {
  return stopCount === 1
}

/** *8:00 AM · 1 of 1 today*: the one stop's line. The job's name is in the card's title, so the line leaves it out. */
export function oneStopLineWords(timeLabel: string): string {
  const time = (timeLabel ?? '').trim()
  return time ? `${time} · 1 of 1 today` : '1 of 1 today'
}

/** The number as a phone number, by the app's own formatter: *(512) 555-0142*. What was typed when it is not one. */
export function phoneAsWritten(raw: string | null | undefined): string {
  const typed = (raw ?? '').trim()
  if (!typed) return ''
  return phoneContact(typed)?.display ?? typed
}

/** The names of the card's first row, the same words a first-timer would say. */
export const JOB_CARD_FIRST_ROW_WORDS = { call: 'Call', directions: 'Directions', text: 'Text' } as const

/** The card's rows, in the order they are drawn. */
export const JOB_CARD_ROW_WORDS = {
  materials: 'Materials on site',
  photos: 'Photos',
  updates: 'Job updates',
  details: 'Job details',
  calendar: 'Job calendar',
} as const

/** A count beside a row's name: the number, nothing for none or for a count not read yet. */
export function rowCountWords(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null
  return String(Math.floor(count))
}

/** Text no smaller than this on the card. */
export const JOB_CARD_MIN_TEXT_PX = 12
/** No press on the card shorter than this. */
export const JOB_CARD_MIN_PRESS_PX = 40
/** The first row's presses and the full-width rows stand this tall. */
export const JOB_CARD_ROW_PX = 44
