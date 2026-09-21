import { formatYmdMonthDay } from './billedExpectedPay'
import type { WorkMonth } from './forecastWorkMonths'
import type { LienMonthHistoryEntry } from './lienMonthHistory'

/**
 * The affidavit's month card (v2.3681): which work months the lien will cover.
 * A sub's lien covers the months a § 53.056 notice went out for; a month whose
 * window closed with no notice, or was skipped, is worked but unsecured — its
 * share of the balance is an ordinary receivable. The affidavit never re-dates
 * work: an unsecured month is shown, named, and left off the lien.
 */
export type AffidavitMonthStatus = 'lien' | 'open' | 'unsecured'

export type AffidavitMonthRow = {
  key: string
  status: AffidavitMonthStatus
  /** "41.4 approved hours · notice sent Sep 24" */
  words: string
}

const hoursWords = (h: number) => `${h.toLocaleString(undefined, { maximumFractionDigits: 1 })} approved ${h === 1 ? 'hour' : 'hours'}`

export function affidavitMonthRows(work: ReadonlyArray<WorkMonth>, history: ReadonlyArray<LienMonthHistoryEntry>): AffidavitMonthRow[] {
  const byMonth = new Map(history.map((h) => [h.month, h]))
  return work.map((m) => {
    const h = byMonth.get(m.key)
    const hours = hoursWords(m.hours)
    if (h?.outcome === 'sent' || m.notice?.state === 'sent') {
      return { key: m.key, status: 'lien', words: `${hours} · notice sent${h?.at ? ` ${formatYmdMonthDay(h.at.slice(0, 10))}` : ''}` }
    }
    if (h?.outcome === 'skipped') {
      return { key: m.key, status: 'unsecured', words: `${hours} · skipped${h.at ? ` ${formatYmdMonthDay(h.at.slice(0, 10))}` : ''}${h.byName ? ` by ${h.byName}` : ''} — given up on purpose; the lien does not cover it` }
    }
    if (h?.outcome === 'missed' || m.notice?.state === 'closed') {
      const closed = h?.deadline || m.notice?.due || ''
      return { key: m.key, status: 'unsecured', words: `${hours} · window closed${closed ? ` ${formatYmdMonthDay(closed)}` : ''} with no notice — the lien does not cover it` }
    }
    if (!m.notice) return { key: m.key, status: 'lien', words: `${hours} · no monthly notice required` }
    return { key: m.key, status: 'open', words: `${hours} · notice still open — mail by ${formatYmdMonthDay(m.notice.due)}` }
  })
}

/** The card's closing sentence: what the affidavit names, and where the rest of the money goes. */
export function affidavitMonthsSentence(rows: ReadonlyArray<AffidavitMonthRow>, labelOf: (key: string) => string): string {
  const lien = rows.filter((r) => r.status === 'lien').map((r) => labelOf(r.key))
  const open = rows.filter((r) => r.status === 'open').map((r) => labelOf(r.key))
  const unsecured = rows.filter((r) => r.status === 'unsecured').map((r) => labelOf(r.key))
  const list = (xs: string[]) => (xs.length <= 1 ? xs[0] ?? '' : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  const parts: string[] = []
  parts.push(lien.length ? `The affidavit names ${list(lien)}${open.length ? `, and ${list(open)} once ${open.length === 1 ? 'its' : 'their'} notice has gone out` : ''}.` : open.length ? `Nothing is on the lien yet — ${list(open)} joins it once the notice has gone out.` : 'No month has a notice on record — the affidavit cannot claim this work.')
  if (unsecured.length) parts.push(`${list(unsecured)}'s share of the balance stays an ordinary receivable — chase it in Collections; it does not ride on the lien.`)
  return parts.join(' ')
}
