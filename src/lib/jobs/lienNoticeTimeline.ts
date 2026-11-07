import { COURTESY_AFFIDAVIT_MARGIN_DAYS, COURTESY_FROM_DAY, addDaysYmd, courtesyReminderWindow } from './lienCourtesyNotice'
import { LETTER_TWO_BY_DAY, LETTER_TWO_FROM_DAY } from './lienLetterTwo'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'

export { addDaysYmd }

/**
 * One sent notice's timeline, top to bottom (punch list #274, PR 2; Grace's board of 2026-11-06):
 * one row per thing that happened or may happen, in date order, each with its date, what it is
 * in a first-week employee's words, which kind of thing it is (a legal requirement, a courtesy
 * notice, the attorney's letter, our rule, a payment), its status, and what happens next. Only
 * events get a dot — the notice mailed, a payment, today, the law's day; a span of days we chose
 * is a window. Day 0 is named by its date and where the date came from. Pure: every row is read
 * from facts the desk already holds; nothing here reads or writes.
 */

export type LienTimelineKind = 'law' | 'courtesy' | 'letter' | 'ours' | 'payment' | 'today'
export type LienTimelineStatus = 'done' | 'open' | 'late' | 'soon' | 'deadline' | 'paying' | 'paid' | 'now' | 'cleared' | 'missed' | 'skipped'

export type LienTimelineRow = {
  key: string
  kind: LienTimelineKind
  /** 'YYYY-MM-DD'; `to` only on a window. */
  from: string
  to?: string
  /** Days since day 0. */
  dayFrom: number
  dayTo?: number
  title: string
  /** The second line: why, or where the date came from. '' when the title says it all. */
  detail: string
  /** The kind chip in plain words; '' on the today row. */
  chip: string
  status: LienTimelineStatus
  /** The pill's words, *late · act now*. */
  statusWords: string
  /** Under the pill: what happens next, with the days. */
  next: string
}

export type LienNoticeTimelineFacts = {
  todayYmd: string
  /** Day 0: the day the mailing was recorded, or the day USPS accepted or delivered it, and which. */
  day0: { ymd: string; why: string }
  /** The affidavit's day, § 53.052; null when none can be named yet. */
  lienDay: string | null
  /** The one courtesy's day, when it went. */
  courtesySentYmd: string | null
  /** The legal hold on the courtesy, when there is one: a homestead, no approved work month, a closed window. */
  courtesyHeld?: string | null
  /** The attorney's letter: where it stands and the day it went. */
  letter: { state: 'none' | 'waiting' | 'due' | 'overdue' | 'in_flight' | 'sent' | 'closed'; sentYmd: string | null; inFlightWords?: string }
  /** Payments on the job since day 0, oldest first. */
  payments: ReadonlyArray<{ ymd: string; amount: number }>
  /** What the sent bills still owe today. */
  openBalance: number
  /** The claim the notice named, for the mailed row; null leaves it out. */
  claim?: number | null
  affidavitFiled: boolean
  /** The words for today's row: what is true now, from the courtesy's and the letter's own words. */
  todayWords: string
  /** Paying it down (PR 3 of #274): the day the reminders' pause ends, 'YYYY-MM-DD'; null or absent when they are not paying. */
  pauseUntil?: string | null
  /** The day they promised the rest by, when one is on record; null or absent when none. */
  promisedYmd?: string | null
  /** The amount they promised for the rest; null or absent when they gave none. */
  promisedAmount?: number | null
}

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function lienNoticeTimeline(f: LienNoticeTimelineFacts): LienTimelineRow[] {
  const fmt = formatYmdMonthDay
  const day0 = f.day0.ymd
  const today = f.todayYmd
  const d = (n: number) => addDaysYmd(day0, n)
  const dayOf = (ymd: string) => daysBetweenYmd(day0, ymd) ?? 0
  const between = (a: string, b: string) => daysBetweenYmd(a, b) ?? 0
  const todayDay = dayOf(today)
  const rows: LienTimelineRow[] = []
  const paidInFull = f.openBalance <= 0.005 && f.payments.length > 0
  // Paying it down (PR 3 of #274): while the pause runs, the letter's window waits and the payment row names the day the desk asks again.
  const paying = !paidInFull && Boolean(f.pauseUntil && today < f.pauseUntil)

  rows.push({
    key: 'mailed', kind: 'law', from: day0, dayFrom: 0,
    title: `The lien notice was mailed to the owner and the GC${f.claim ? ` for ${usd(f.claim)}` : ''}.`,
    detail: `Day 0 counts ${f.day0.why}.`,
    chip: 'legal requirement', status: 'done', statusWords: '✓ done', next: `${plural(todayDay, 'day')} ago · the clock started`,
  })

  const weekStart = f.lienDay ? addDaysYmd(f.lienDay, -COURTESY_AFFIDAVIT_MARGIN_DAYS) : null
  // The one courtesy: a window from day 7, or from reminders week of the lien's month when that is later (punch list #235, PR 4), to the affidavit's week.
  const reminderWeek = courtesyReminderWindow(f.lienDay)
  const cFrom = reminderWeek && reminderWeek.from > d(COURTESY_FROM_DAY) ? reminderWeek.from : d(COURTESY_FROM_DAY)
  const cTo = weekStart && weekStart > cFrom ? weekStart : cFrom
  if (f.courtesySentYmd) {
    rows.push({ key: 'courtesy', kind: 'courtesy', from: f.courtesySentYmd, dayFrom: dayOf(f.courtesySentYmd), title: 'The one courtesy reminder went, by email and text.', detail: 'A plain reminder that the notice stands. We send it once; after a week of silence the attorney’s letter leads.', chip: 'courtesy notice', status: 'done', statusWords: '✓ done', next: `${plural(between(f.courtesySentYmd, today), 'day')} ago · no second one` })
  } else if (!paidInFull) {
    const base = { key: 'courtesy', kind: 'courtesy' as const, from: cFrom, to: cTo, dayFrom: dayOf(cFrom), dayTo: dayOf(cTo), title: 'One courtesy reminder may go: a plain email and text saying the notice stands.', detail: `Not required. The owner chose day ${COURTESY_FROM_DAY}. After it, silence means the attorney’s letter, not a second reminder.`, chip: 'courtesy notice' }
    if (f.courtesyHeld) rows.push({ ...base, status: 'skipped', statusWords: 'held', next: `${f.courtesyHeld} · the attorney’s letter still goes` })
    else if (today < cFrom) rows.push({ ...base, status: 'soon', statusWords: `opens in ${plural(between(today, cFrom), 'day')}`, next: `from ${fmt(cFrom)} the row offers Send a courtesy notice` })
    else if (today <= cTo) rows.push({ ...base, status: 'open', statusWords: 'open · optional', next: `${plural(between(today, cTo), 'day')} left to send it · after ${fmt(cTo)} the desk asks for the affidavit` })
    else rows.push({ ...base, status: 'skipped', statusWords: 'not sent', next: 'the window passed · the attorney’s letter leads' })
  }

  // The attorney's letter: counsel's window, day 10 to day 14, late after.
  const lFrom = d(LETTER_TWO_FROM_DAY)
  const lTo = d(LETTER_TWO_BY_DAY)
  const letterBase = { key: 'letter', kind: 'letter' as const, from: lFrom, to: lTo, dayFrom: LETTER_TWO_FROM_DAY, dayTo: LETTER_TWO_BY_DAY, chip: 'attorney’s letter' }
  if (f.letter.state === 'sent' && f.letter.sentYmd) {
    rows.push({ ...letterBase, from: f.letter.sentYmd, to: undefined, dayFrom: dayOf(f.letter.sentYmd), dayTo: undefined, title: 'The attorney’s letter went, by certified mail.', detail: 'Counsel’s stronger letter. Nothing more goes to this owner before the affidavit.', status: 'done', statusWords: '✓ done', next: `${plural(between(f.letter.sentYmd, today), 'day')} ago · the affidavit is next` })
  } else if (!paidInFull) {
    const title = 'The attorney’s letter should go in this window: the stronger letter our attorney wrote.'
    const detail = `Counsel’s rule, ${LETTER_TWO_FROM_DAY} to ${LETTER_TWO_BY_DAY} days after the notice. After ${fmt(lTo)} it still goes, but every day later weakens it.`
    if (f.letter.state === 'in_flight') rows.push({ ...letterBase, title, detail, status: 'open', statusWords: 'in hand', next: f.letter.inFlightWords ?? 'drafted on the notice, waiting to go out' })
    else if (paying) rows.push({ ...letterBase, title, detail, status: 'open', statusWords: 'waits', next: 'the attorney’s letter waits while they pay · the office may still send it when the payment was token' })
    else if (today < lFrom) rows.push({ ...letterBase, title, detail, status: 'soon', statusWords: `due in ${plural(between(today, lFrom), 'day')}`, next: `from ${fmt(lFrom)} the row offers Send the attorney’s letter` })
    else if (today <= lTo) rows.push({ ...letterBase, title, detail, status: 'open', statusWords: 'due now', next: `${plural(between(today, lTo), 'day')} left in the window` })
    else rows.push({ ...letterBase, title, detail, status: 'late', statusWords: 'late · act now', next: `${plural(between(lTo, today), 'day')} past the window · it still goes, weaker each day` })
  }

  // Payments since the notice: an event each, the last one carrying the remainder.
  f.payments.forEach((p, i) => {
    const last = i === f.payments.length - 1
    const full = last && paidInFull
    rows.push({
      key: `pay:${p.ymd}:${i}`, kind: 'payment', from: p.ymd, dayFrom: dayOf(p.ymd),
      title: `${usd(p.amount)} paid${full ? ' · paid in full.' : last ? ` · ${usd(f.openBalance)} still owed.` : '.'}`,
      detail: full ? 'The claim is zero on every paper. The affidavit leaves the Affidavits list by itself.' : 'A payment on the job, applied to the oldest bill first. Every paper now claims the remainder.',
      chip: 'payment', status: full ? 'paid' : 'paying', statusWords: full ? '✓ paid' : 'paying',
      next: `${plural(between(p.ymd, today), 'day')} ago${full ? ' · the ladder closed' : last && paying ? ` · reminders paused until ${fmt(f.pauseUntil!)}` : last ? ' · the remainder is the claim' : ''}`,
    })
  })

  // What they promised for the rest (PR 3 of #274): their word is a row with its day; the desk asks again on it, and the lien's day does not move for it.
  if (f.promisedYmd && !paidInFull) {
    const n = between(today, f.promisedYmd)
    rows.push({
      key: 'promise', kind: 'ours', from: f.promisedYmd, dayFrom: dayOf(f.promisedYmd),
      title: `They promised the rest${f.promisedAmount ? `, ${usd(f.promisedAmount)},` : ''} by this day.`,
      detail: 'Their word, recorded on the notice. A promise moves no legal day; only the money does.',
      chip: 'their promise',
      status: n >= 0 ? 'soon' : 'late', statusWords: n >= 0 ? `promised · in ${plural(n, 'day')}` : 'promise passed',
      next: n >= 0 ? `on ${fmt(f.promisedYmd)} the desk asks again` : `${plural(-n, 'day')} past their word · the reminders run again`,
    })
  }

  rows.push({ key: 'today', kind: 'today', from: today, dayFrom: todayDay, title: f.todayWords, detail: '', chip: '', status: 'now', statusWords: 'now', next: '' })

  if (f.lienDay && weekStart) {
    if (!paidInFull && !f.affidavitFiled) {
      const base = { key: 'week', kind: 'ours' as const, from: weekStart, to: f.lienDay, dayFrom: dayOf(weekStart), dayTo: dayOf(f.lienDay), title: 'The affidavit’s week: draft it, the leader signs it before a notary, file it at the county.', detail: `Our rule. The paper takes about a week, so from ${fmt(weekStart)} this notice’s row offers Draft affidavit instead of a reminder. A courtesy may still be sent by hand from the footer.`, chip: 'our rule' }
      if (today < weekStart) rows.push({ ...base, status: 'soon', statusWords: `starts in ${plural(between(today, weekStart), 'day')}`, next: `on ${fmt(weekStart)} the button here becomes Draft affidavit` })
      else if (today <= f.lienDay) rows.push({ ...base, status: 'now', statusWords: 'this week', next: 'draft it, the leader signs before a notary, file it at the county' })
    }
    const left = between(today, f.lienDay)
    const lienBase = { key: 'lien', kind: 'law' as const, from: f.lienDay, dayFrom: dayOf(f.lienDay), chip: 'legal requirement' }
    if (paidInFull) rows.push({ ...lienBase, title: 'No longer a deadline for this job.', detail: 'The law’s day still exists; there is nothing left to file on it.', chip: 'no longer applies', status: 'cleared', statusWords: 'deadline', next: 'cleared by the payment' })
    else if (f.affidavitFiled) rows.push({ ...lienBase, title: 'The affidavit is on file at the county.', detail: 'Served on the owner within five days, as § 53.055 asks.', status: 'done', statusWords: '✓ filed', next: left >= 0 ? `${plural(left, 'day')} before the law’s day` : 'on time' })
    else if (left < 0) rows.push({ ...lienBase, title: 'The lien had to be on file at the county by this day.', detail: '§ 53.052. The day has passed with nothing filed.', status: 'missed', statusWords: 'passed', next: `${plural(-left, 'day')} ago · the lien right for this month is lost` })
    else rows.push({ ...lienBase, title: `The lien${f.openBalance > 0.005 && f.payments.length ? ` for the ${usd(f.openBalance)} still owed` : ''} must be on file at the county by this day, or the right to it is lost.`, detail: '§ 53.052, the 15th of the third month after the work month, rolled past the weekend. This job’s own day.', status: 'deadline', statusWords: `deadline · in ${plural(left, 'day')}`, next: 'miss it and the lien is lost for good' })
  }

  // Date order; today after whatever shares its day.
  const rank = (r: LienTimelineRow) => (r.kind === 'today' ? 1 : 0)
  return rows.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : rank(a) - rank(b)))
}

/** *Why these N are here*: the step's notices grouped by their own reason, biggest group first. */
export function lienTimelineWhyChips(whys: ReadonlyArray<string>): Array<{ why: string; n: number }> {
  const by = new Map<string, number>()
  for (const w of whys) {
    const key = w.trim()
    if (!key) continue
    by.set(key, (by.get(key) ?? 0) + 1)
  }
  return [...by.entries()].map(([why, n]) => ({ why, n })).sort((a, b) => b.n - a.n || a.why.localeCompare(b.why))
}

/** The today row's words: what is true now, from the courtesy's and the letter's own states. */
export function lienTimelineTodayWords(input: { courtesyState: string; courtesyReason?: string; letterState: string; paidInFull: boolean; waitingForAnswer?: boolean }): string {
  if (input.paidInFull) return 'Closed. Nothing is owed and nothing is left to send.'
  if (input.letterState === 'sent') return 'You are here. The attorney’s letter went; the affidavit is next.'
  if (input.letterState === 'in_flight') return 'You are here. The attorney’s letter is drafted and waiting to go out.'
  if (input.courtesyState === 'paying') return 'You are here. They are paying it down. The attorney’s letter waits while they pay.'
  if (input.courtesyState === 'affidavit_week') return 'You are here. It is the affidavit’s week: draft it, the leader signs it before a notary, file it.'
  if (input.courtesyState === 'held') return `You are here. The courtesy is held: ${input.courtesyReason || 'the lien cannot go on yet'}.`
  if (input.courtesyState === 'sent' && input.waitingForAnswer) return 'You are here. The courtesy went; the desk waits a week for an answer.'
  if (input.letterState === 'due' || input.letterState === 'overdue') return 'You are here. Nothing has been paid or answered, and the attorney’s letter has not gone.'
  if (input.courtesyState === 'due') return 'You are here. Nothing has come since the packet. A courtesy reminder may go.'
  if (input.courtesyState === 'waiting') return 'You are here. The notice is in the mail; the desk waits for day 7.'
  return 'You are here.'
}
