/**
 * Messages, cut 9 (wave 1, helper 7): Bill day's asks, each its own text from the company number. The ask for a draw
 * not in, the ask for an unconditional waiver still owed, the reminder on a draw sent back, the text the superintendent
 * gets on the first checking day, and the send-back note written from the walk. Lifted from the Messages prototype
 * v1.178 (`askForDraw`, `askAllNotIn`, `remindDraw`, `superText`, `sendBackDraw`'s note) on branch spike/gc-mode,
 * to-dos/gc-mode/messages/prototype.html. A trade's texts are in its language from the portal's words table
 * (`portalI18n.ts`, the `bd` keys); the superintendent's text is ours, in English.
 */
import type { TradeWaiverCheck } from '../ownerBilling'
import { pDate, pt, pWeekday, type PortalLang } from '../portalI18n'
import { money, weekdayDate } from '../words'
import type { DrawLineAtWeSee } from './lines'
import { notInRows, type BillDayDates, type TradeDraw } from './trades'

/**
 * Who a text goes to: their first name, their portal's link to the draws (`…#draws`), and the language to write in.
 * Pass `tradeMailLang(company.lang)`, which holds Spanish until `PORTAL_SPANISH_ON`.
 */
export interface AskTo {
  firstName: string
  link: string
  lang: PortalLang
}

/** A contact's first name, for the greeting. Empty: none on file. */
export function firstNameOf(contact: string): string {
  return contact.trim().split(/\s+/)[0] ?? ''
}

/** A key that may open a text, after the greeting: "Greg, pay application 4…", or "Pay application 4…" with no name. */
function opening(to: AskTo, words: string): string {
  return to.firstName ? `${to.firstName}, ${words}` : words.charAt(0).toUpperCase() + words.slice(1)
}

/** "draw 2", "draws 1, 2 and 3", "the final draw", in the trade's language (`owedDrawWords`, word for word in English). */
export function owedDrawWordsIn(lang: PortalLang, owed: TradeWaiverCheck['owedUnconditional']): string {
  const progress = owed.filter((o) => !o.final).map((o) => String(o.draw))
  const parts: string[] = []
  const last = progress[progress.length - 1]
  if (progress.length === 1 && last) parts.push(pt(lang, 'bdDrawOne', { n: last }))
  else if (last) parts.push(pt(lang, 'bdDrawsMany', { list: progress.slice(0, -1).join(', '), last }))
  if (owed.some((o) => o.final)) parts.push(pt(lang, 'bdDrawFinal'))
  return parts.join(pt(lang, 'and'))
}

/** A typed note as a sentence: trimmed, with its full stop. Empty stays empty. */
function asSentence(note: string): string {
  const t = note.trim()
  return t === '' || /[.?!]$/.test(t) ? t : `${t}.`
}

/**
 * The ask for a draw not in: the pay application it goes on, the day it closes, the draw that is due, and any
 * unconditional waiver still owed. The link comes last, so nothing follows it.
 */
export function askDrawText(row: TradeDraw, dates: BillDayDates, jobName: string, to: AskTo): string {
  const { lang } = to
  const owed = row.owedUnconditional.length > 0
  return [
    opening(to, pt(lang, 'bdAskDraw', { app: dates.number, job: jobName, date: pWeekday(lang, dates.cutoff) })),
    pt(lang, 'bdDrawDue', { n: row.number }),
    owed ? pt(lang, 'bdWaiverToo', { draws: owedDrawWordsIn(lang, row.owedUnconditional) }) : '',
    pt(lang, owed ? 'bdSendThem' : 'bdSendIt', { link: to.link }),
  ]
    .filter(Boolean)
    .join(' ')
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
  const { lang } = to
  const one = owed.length === 1 ? owed[0] : undefined
  return [
    opening(to, pt(lang, 'bdAskWaiver', { draws: owedDrawWordsIn(lang, owed) })),
    one?.paidOn ? pt(lang, 'bdPaidThatDraw', { date: pDate(lang, one.paidOn) }) : '',
    pt(lang, 'bdUploadIt', { link: to.link }),
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * The reminder on a draw we sent back: the day it went, our note, and where to send it again. Null: nothing is sent
 * back. The note is the office's, in the words it was typed in.
 */
export function remindDrawText(row: TradeDraw, to: AskTo): string | null {
  if (row.state !== 'back' || !row.back) return null
  const { lang } = to
  return [
    opening(to, pt(lang, 'bdWentBack', { n: row.number, date: pWeekday(lang, row.back.on) })),
    asSentence(row.back.note),
    pt(lang, 'bdResendIt', { link: to.link }),
  ]
    .filter(Boolean)
    .join(' ')
}

/** The text the superintendent gets on the first checking day, or when the office presses Ask to walk it. Never a dollar. */
export function superintendentText(name: string, draws: number, jobName: string, dates: BillDayDates): string {
  return `${name}, ${draws} ${draws === 1 ? 'draw' : 'draws'} to check on ${jobName} by ${weekdayDate(dates.checkBy)}. The lines are on the daily log, in walking order.`
}

/**
 * The note a draw goes back with, written from the walk: each line we see under the claim, what she noted, and a photo
 * when she took one. Every sentence stands alone. Empty: nothing under the claim. Her note stays in her words.
 */
export function sendBackNote(lines: DrawLineAtWeSee[], lang: PortalLang): string {
  const parts: string[] = []
  for (const l of lines) {
    const why = [asSentence(l.note), l.photo ? pt(lang, 'bdBackPhoto') : ''].filter(Boolean)
    if (l.doubt && l.weSee !== null) {
      parts.push([pt(lang, 'bdBackLine', { item: l.item, label: l.label, claimed: l.claimed, weSee: l.weSee }), ...why].join(' '))
    } else if (l.stored > 0 && l.onSite === false) {
      parts.push([pt(lang, 'bdBackStored', { item: l.item, label: l.label, amount: money(l.stored) }), ...why].join(' '))
    }
  }
  return parts.length ? `${parts.join(' ')} ${pt(lang, 'bdBackAgain')}` : ''
}
