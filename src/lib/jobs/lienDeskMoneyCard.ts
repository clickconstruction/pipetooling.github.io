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
import type { LienDeskNeedsYou, LienDeskPile } from './lienDesk'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'

export type LienDeskMoneyCardPile = { key: LienDeskPile; label: string; count: number }

/** The deadline chip (v2.3822): the earliest window as one colored chip, the sentence behind it as the hover. */
export type LienDeskMoneyCardDeadline = {
  /** "closed Sep 15" · "6 notices by Oct 15 · in 20 days" · "today" — the count leads, the GCs are `who` (v2.4054) */
  label: string
  /** The GCs on that day — "Southern Pine", "Michael Holmby +6" — drawn as a chip of their own (v2.4054). */
  who: string | null
  tone: 'red' | 'amber' | 'gray'
  /** The old first sentence plus the mail-by warning, for the hover. */
  hover: string
  /** The pile the earliest notice sits in — the chip opens the desk there. */
  pile: LienDeskPile
}

export type LienDeskMoneyCard = {
  /** "3 lien notices due · $28,987 — the earliest by Oct 3" */
  claim: string
  /** The piles behind the count, and whose window closes first. */
  why: string
  /** Notices due — the badge. */
  count: number
  tone: 'red' | 'amber' | 'gray'
  /** The two-line card's first line (v2.3822, punch list #44): the count and the money, nothing else. */
  title: string
  /** The piles as chips, in the desk's order, only the non-empty ones; each opens the desk on that pile. */
  piles: LienDeskMoneyCardPile[]
  /** The earliest window as a chip, or null with no date. */
  deadline: LienDeskMoneyCardDeadline | null
}

/** The count on the Lien desk's door (the Pipeline's Lien desk button, v2.3405): jobs to draft + the leader's jobs + approved notices waiting for the run; null before the desk has loaded. */
export function lienDeskCount(summary: LienDeskNeedsYou | null | undefined): number | null {
  if (!summary) return null
  return summary.office.jobs + summary.leader.jobs + summary.office.ready
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
  const day = earliest ? formatYmdMonthDay(earliest) : null
  const next = office.next
  // A closed window is a lien lost only once the affidavit's day has passed too (v2.7273, punch list #335, row 4): while that
  // day is ahead the card says *send the late notice by <day>*, in the clock's words, amber and red inside a week as the clock
  // is; past it, the gone words. The day is the office's group's (`next.affidavitBy`) when its window is the earliest, else the
  // leader's (`leader.affidavitBy`, job 891 on 2026-11-14: awaiting approval 30 days past its window, the affidavit's day Dec 15).
  const affidavitBy = !closed ? null : next.deadline === earliest && next.notices > 0 ? next.affidavitBy : leader.earliestDeadline === earliest ? leader.affidavitBy : null
  const lateDays = affidavitBy ? daysBetweenYmd(todayYmd, affidavitBy) : null
  const lateBy = lateDays != null && lateDays >= 0 ? affidavitBy : null
  const lateDay = lateBy ? formatYmdMonthDay(lateBy) : null
  const lateWhen = lateDays == null ? '' : lateDays === 0 ? 'today' : lateDays === 1 ? 'tomorrow' : `in ${lateDays} days`
  const goneForGood = closed && affidavitBy != null && lateBy == null
  const tone: LienDeskMoneyCard['tone'] = lateBy ? (lateDays != null && lateDays <= 7 ? 'red' : 'amber') : soon != null && soon <= 7 ? 'red' : soon != null && soon <= 14 ? 'amber' : 'gray'
  const claim = `${count} lien ${count === 1 ? 'notice' : 'notices'} due · ${formatUsdNoCents(dollars)}${day ? ` — the earliest ${closed ? 'closed' : 'by'} ${day}` : ''}${lateDay ? ` · send the late notice by ${lateDay}` : ''}`
  const closedTail = lateDay ? ` — the window closed; send the late notice by ${lateDay} and the affidavit can still follow` : goneForGood ? ' — the window closed and the affidavit’s day has passed too; the lien right on that work is gone' : closed ? ' — the window closed; a late notice can still carry the affidavit while its own window is open' : ''

  const parts: string[] = []
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
  const why = `${parts.join(' · ')}${tone === 'red' && day && !closed ? ` — mail by ${day} or the lien right on that work is gone` : lateDay || goneForGood ? closedTail : ''}`

  // The two-line card (v2.3822): the count and the money on line one; the piles and the deadline as chips.
  const title = `${count} lien ${count === 1 ? 'notice' : 'notices'} due · ${formatUsdNoCents(dollars)}`
  const piles: LienDeskMoneyCardPile[] = []
  if (office.needsOwner > 0) piles.push({ key: 'needs_owner', label: `${office.needsOwner} need${office.needsOwner === 1 ? 's' : ''} an owner`, count: office.needsOwner })
  if (toDraft > 0) piles.push({ key: 'to_draft', label: `${toDraft} to draft`, count: toDraft })
  if (leader.jobs > 0) piles.push({ key: 'awaiting', label: `${leader.jobs} awaiting approval`, count: leader.jobs })
  if (office.ready > 0) piles.push({ key: 'ready', label: `${office.ready} approved for the run`, count: office.ready })
  let deadline: LienDeskMoneyCardDeadline | null = null
  if (earliest && day) {
    const leaderFirst = leader.earliestDeadline === earliest && office.earliestDeadline !== earliest
    const names = next.deadline === earliest && next.notices > 0 ? next.gcNames : []
    const who = names.length === 0 ? '' : names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`
    const many = next.deadline === earliest && next.notices > 1 ? `${next.notices} notices` : ''
    // v2.4054: the chip leads with the count and the day, and the GCs are a chip of their
    // own — so the count is never the part a narrow card cuts off ("15 noti…").
    const when = lateDay ? `late notice by ${lateDay} · ${lateWhen}` : closed ? `closed ${day}` : soon === 0 ? 'today' : soon === 1 ? 'tomorrow' : `by ${day} · in ${soon} days`
    const label = many ? `${many} ${when}` : when
    const hover = `${parts[0] ?? ''}${closed ? closedTail : day ? ` — mail by ${day} or the lien right on that work is gone` : ''}`
    deadline = { label, who: who || null, tone, hover, pile: leaderFirst ? 'awaiting' : 'to_draft' }
  }
  return { claim, why, count, tone, title, piles, deadline }
}
