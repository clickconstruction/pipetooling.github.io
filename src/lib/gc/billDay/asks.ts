/**
 * Messages, cut 9 (wave 1, helper 7): Bill day's asks, each its own text from the company number. The ask for a draw
 * not in, the ask for an unconditional waiver still owed, the reminder on a draw sent back, the text the superintendent
 * gets on the first checking day, and the send-back note written from the walk. Lifted from the Messages prototype
 * v1.178 (`askForDraw`, `askAllNotIn`, `remindDraw`, `superText`, `sendBackDraw`'s note) on branch spike/gc-mode,
 * to-dos/gc-mode/messages/prototype.html. English for now; the Spanish comes from the portal's words table (helper 8).
 */
import { owedDrawWords } from '../ownerBilling'
import { money, shortDate, weekdayDate } from '../words'
import type { DrawLineAtWeSee } from './lines'
import { notInRows, type BillDayDates, type TradeDraw } from './trades'

/** Who a text goes to: their first name, and their portal's link to the draws (`…#draws`). */
export interface AskTo {
  firstName: string
  link: string
}

/** A contact's first name, for the greeting. Empty: none on file. */
export function firstNameOf(contact: string): string {
  return contact.trim().split(/\s+/)[0] ?? ''
}

const hello = (to: AskTo) => (to.firstName ? `${to.firstName}, ` : '')
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The ask for a draw not in: the pay application it goes on, the day it closes, the draw that is due, and any
 * unconditional waiver still owed. The link comes last, so nothing follows it.
 */
export function askDrawText(row: TradeDraw, dates: BillDayDates, jobName: string, to: AskTo): string {
  const owed = row.owedUnconditional.length
    ? ` The unconditional waiver for ${owedDrawWords(row.owedUnconditional)} is still owed too. Send them here: ${to.link}`
    : ` Send it here: ${to.link}`
  return `${capital(`${hello(to)}pay application ${dates.number} on ${jobName} closes ${weekdayDate(dates.cutoff)}.`)} Your draw ${row.number} is due by then.${owed}`
}

/** The ask for each trade not in, each its own text, as one press sends them. A trade with no one to text is left out. */
export function askNotInTexts(
  rows: TradeDraw[],
  dates: BillDayDates,
  jobName: string,
  toOf: (row: TradeDraw) => AskTo | null,
): { packageId: string; partnerId: string | null; text: string }[] {
  return notInRows(rows).flatMap((row) => {
    const to = toOf(row)
    return to ? [{ packageId: row.packageId, partnerId: row.partnerId, text: askDrawText(row, dates, jobName, to) }] : []
  })
}

/** The ask for an unconditional waiver still owed. Null: they owe none. */
export function askWaiverText(row: TradeDraw, to: AskTo): string | null {
  const owed = row.owedUnconditional
  if (owed.length === 0) return null
  const one = owed.length === 1 ? owed[0] : undefined
  const paid = one?.paidOn ? ` We paid that draw ${shortDate(one.paidOn)}.` : ''
  return `${capital(`${hello(to)}the unconditional waiver for ${owedDrawWords(owed)} is still owed.`)}${paid} Upload it here: ${to.link}`
}

/** The reminder on a draw we sent back: the day it went, our note, and where to send it again. Null: nothing is sent back. */
export function remindDrawText(row: TradeDraw, to: AskTo): string | null {
  if (row.state !== 'back' || !row.back) return null
  const note = row.back.note.trim()
  const said = note ? ` ${/[.?!]$/.test(note) ? note : `${note}.`}` : ''
  return `${capital(`${hello(to)}draw ${row.number} went back ${weekdayDate(row.back.on)}.`)}${said} Resend it here: ${to.link}`
}

/** The text the superintendent gets on the first checking day, or when the office presses Ask to walk it. Never a dollar. */
export function superintendentText(name: string, draws: number, jobName: string, dates: BillDayDates): string {
  return `${name}, ${draws} ${draws === 1 ? 'draw' : 'draws'} to check on ${jobName} by ${weekdayDate(dates.checkBy)}. The lines are on the daily log, in walking order.`
}

/**
 * The note a draw goes back with, written from the walk: each line we see under the claim, what she noted, and a photo
 * when she took one. Every sentence stands alone. Empty: nothing under the claim.
 */
export function sendBackNote(lines: DrawLineAtWeSee[]): string {
  const parts: string[] = []
  for (const l of lines) {
    const why = [l.note ? (/[.?!]$/.test(l.note) ? l.note : `${l.note}.`) : '', l.photo ? 'We have a photo of it.' : ''].filter(Boolean).join(' ')
    if (l.doubt && l.weSee !== null) {
      parts.push([`Line ${l.item}, ${l.label}, reads ${l.claimed}%. We see ${l.weSee}%.`, why].filter(Boolean).join(' '))
    } else if (l.stored > 0 && l.onSite === false) {
      parts.push([`Line ${l.item}, ${l.label}, claims ${money(l.stored)} of stored material. We did not see it on site.`, why].filter(Boolean).join(' '))
    }
  }
  return parts.length ? `${parts.join(' ')} Send it again.` : ''
}
