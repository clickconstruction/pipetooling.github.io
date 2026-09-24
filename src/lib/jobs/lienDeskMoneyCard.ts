/**
 * The Pipeline's lien card (punch list #34, v2.3799): Today's Money
 * Opportunities carries the Lien desk's notices due — the office's drafting
 * piles plus the master's awaiting pile — as one card built from the desk's
 * own summary (`useLienDeskData` → `summary`), so the count, the dollars and
 * the date are the desk's and never a second opinion. Null when nothing is
 * due: the card stays off the strip. The tone follows the Dashboard's lien
 * card (`dashboardNeedsYou`): red inside a week of the earliest window,
 * amber inside two.
 */
import type { LienDeskNeedsYou } from './lienDesk'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'

export type LienDeskMoneyCard = {
  /** "3 lien notices due · $28,987 — the earliest by Oct 3" */
  claim: string
  /** The piles behind the count, and whose window closes first. */
  why: string
  /** Notices due — the badge. */
  count: number
  tone: 'red' | 'amber' | 'gray'
}

export function buildLienDeskMoneyCard(summary: LienDeskNeedsYou | null | undefined, todayYmd: string): LienDeskMoneyCard | null {
  if (!summary) return null
  const { office, leader } = summary
  const count = office.jobs + leader.jobs
  if (count <= 0) return null
  const dollars = office.dollars + leader.dollars
  const earliest = [office.earliestDeadline, leader.earliestDeadline].filter((d): d is string => Boolean(d)).sort()[0] ?? null
  const soon = earliest ? daysBetweenYmd(todayYmd, earliest) : null
  // A window already closed (the desk still lists the notice — it goes out as
  // information) reads as closed, never as "today".
  const closed = soon != null && soon < 0
  const when = soon == null ? '' : closed ? `closed ${-soon === 1 ? 'yesterday' : `${-soon} days ago`}` : soon === 0 ? 'today' : soon === 1 ? 'tomorrow' : `in ${soon} days`
  const tone: LienDeskMoneyCard['tone'] = soon != null && soon <= 7 ? 'red' : soon != null && soon <= 14 ? 'amber' : 'gray'
  const day = earliest ? formatYmdMonthDay(earliest) : null
  const claim = `${count} lien ${count === 1 ? 'notice' : 'notices'} due · ${formatUsdNoCents(dollars)}${day ? ` — the earliest ${closed ? 'closed' : 'by'} ${day}` : ''}`

  const parts: string[] = []
  const next = office.next
  if (earliest && next.deadline === earliest && next.notices > 0) {
    const names = next.gcNames.length ? next.gcNames : next.gcIds.map(() => 'a GC')
    const gcWords = names.length === 0 ? '' : names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
    parts.push(`${when ? `${when[0]!.toUpperCase()}${when.slice(1)}` : day}: ${next.notices === 1 ? 'the notice' : `${next.notices} notices`}${gcWords ? ` under ${gcWords}` : ''}`)
  } else if (earliest) {
    parts.push(`${when ? `${when[0]!.toUpperCase()}${when.slice(1)}` : day}: the first window closes`)
  }
  const toDraft = office.jobs - office.needsOwner
  if (toDraft > 0) parts.push(`${toDraft} to draft`)
  if (office.needsOwner > 0) parts.push(`${office.needsOwner} waiting on the owner of record`)
  if (leader.jobs > 0) parts.push(`${leader.jobs} awaiting approval`)
  if (office.ready > 0) parts.push(`${office.ready} approved for the run`)
  const why = `${parts.join(' · ')}${tone === 'red' && day && !closed ? ` — mail by ${day} or the lien right on that work is gone` : ''}`
  return { claim, why, count, tone }
}
