import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lienDeskHref } from '../lien/lienDeskRoute'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import { workMonthShort } from './forecastWorkMonths'
import { correctedClaim, type LienClaimCorrection } from './lienClaimCorrection'
import type { LienDeskEntry } from './lienDesk'
import { parseLienDeskDraftFields } from './lienNoticeDraft'

/**
 * The leader's card on the Dashboard for the lien notices that wait on his signature (v2.7435, Taunya's ask of
 * 2026-11-16: *"I need to improve how it looks for a leader on their dashboard when they need to approve liens"*, the
 * second drawing she approved). It replaces the one row *Approve N lien notices the office drafted*.
 *
 * The card says the deadline in its title, the money and the wait in one line, then up to three notices, the most
 * pressing first, each with its own press. Everything it prints is the Lien desk's own data: the awaiting pile's
 * entries, their month rows, and the claim as the notice pane reads it (`correctedClaim` over the entry's open
 * balance). Pure.
 *
 * Three calls made here, each held by a test:
 *  - **Which notices.** Every notice on the Awaiting approval pile that is not part of a run the office prepared for
 *    one GC (`lienDeskEntryInRun`): those ride the `lien-notice-batch` card. The pile is the company's, not the
 *    leader's own jobs, as the row it replaces counted.
 *  - **A window that already closed.** A notice whose only windows have closed is never called *today*: nothing on
 *    it can still be made today. It counts under *wait on your signature*, its row says which month closed and when,
 *    and it turns the card red, since a late notice is the more pressing one.
 *  - **A notice the desk holds no window for.** A job the month reader returns no row for has no day to print. Its
 *    row names the notice's months and no day.
 */

/** Days ahead a window turns the card red and the title names its day: the desk's own week. */
export const LIEN_LEADER_SOON_DAYS = 7
/** Notices drawn as rows; the rest are one line. */
export const LIEN_LEADER_ROWS = 3

export const LIEN_LEADER_KICKER = 'Lien notices · your signature'

/** A notice on the awaiting pile that is part of a run the office prepared for one GC: the batch card's, not this card's. */
export function lienDeskEntryInRun(e: Pick<LienDeskEntry, 'item' | 'gcCustomerId'>): boolean {
  if (!e.item || !e.gcCustomerId) return false
  return Boolean(parseLienDeskDraftFields(e.item.fields)?.batchReason)
}

export type LienLeaderChip = { key: string; tone: 'red' | 'gray' | 'amber'; text: string }

export type LienLeaderRow = {
  jobId: string
  /** "891 · Take 5- Liberty Hill". */
  label: string
  number: string
  claim: number
  /** "$2,976". */
  claimWords: string
  gcName: string
  chips: LienLeaderChip[]
  /** The notice's months, "Jul + Aug + Sep": drawn when no chip names a month. */
  monthsWords: string
  /** A chip on the row already names its month. */
  monthNamed: boolean
  href: string
  /** "Open 891 to sign ▸" on the first row, "Open 804 ›" on the others. */
  pressLabel: string
  /** What a press on the row says to a screen reader. */
  pressTitle: string
  primary: boolean
}

/** A piece of the line under the title; `strong` is drawn in the stronger ink. */
export type LienLeaderSeg = { text: string; strong?: boolean }

export type LienLeaderSignCard = {
  /** Every notice the card counts, drawn or not. */
  count: number
  tone: 'red' | 'blue'
  kicker: string
  title: string
  /** The line under the title on a computer. */
  line: LienLeaderSeg[]
  /** The same words on a phone: the wait takes a line of its own. */
  phoneLines: LienLeaderSeg[][]
  /** The line as plain words, for the walk view and a fold's summary. */
  detail: string
  /** The sum of the claims, "$6,529". */
  figure: string
  rows: LienLeaderRow[]
  more: { count: number; label: string; href: string } | null
}

export type LienLeaderSignInput = {
  todayYmd: string
  /** The desk's Awaiting approval pile. */
  awaiting: ReadonlyArray<LienDeskEntry>
  jobNumber: (jobId: string) => string
  jobName: (jobId: string) => string
  gcName: (gcCustomerId: string) => string
  /** The claim set by hand for a job, when one is. */
  claimCorrection?: (jobId: string) => LienClaimCorrection | null | undefined
}

const plural = (n: number) => (n === 1 ? 'lien notice' : 'lien notices')

function monthLong(key: string): string {
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
}

/** "Thursday, Nov 19". */
function weekdayAndDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const weekday = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
  return `${weekday}, ${formatYmdMonthDay(ymd)}`
}

const dayCount = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** One waiting notice, read off its entry. */
type Read = {
  entry: LienDeskEntry
  /** The soonest window still open among the notice's months. */
  open: { key: string; deadline: string; daysLeft: number } | null
  /** The notice's months whose window closed with no notice. */
  closed: Array<{ key: string; deadline: string }>
  claim: number
  askedYmd: string | null
  rank: number
}

function read(e: LienDeskEntry, input: LienLeaderSignInput): Read {
  const named = e.item && e.item.months.length > 0 ? e.item.months : e.dueMonths
  const rows = e.months.filter((m) => named.includes(m.key) && !m.noticed)
  const openRows = rows.filter((m) => m.daysLeft >= 0).sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0))
  const first = openRows[0]
  const open = first ? { key: first.key, deadline: first.deadline, daysLeft: first.daysLeft } : null
  const closed = rows.filter((m) => m.daysLeft < 0).map((m) => ({ key: m.key, deadline: m.deadline }))
  const claim = correctedClaim(e.openBalance, input.claimCorrection?.(e.jobId)).claim
  const askedYmd = e.item?.submitted_at ? calendarYmdInAppTzFromIso(e.item.submitted_at) : null
  // The most pressing first: a window inside the week, then one that already closed, then a later window, then no window.
  const rank = open && open.daysLeft <= LIEN_LEADER_SOON_DAYS ? 0 : closed.length > 0 ? 1 : open ? 2 : 3
  return { entry: e, open, closed, claim, askedYmd, rank }
}

function chipsFor(r: Read): LienLeaderChip[] {
  const chips: LienLeaderChip[] = []
  if (r.open) {
    const d = r.open.daysLeft
    if (d === 0) chips.push({ key: `open-${r.open.key}`, tone: 'red', text: `${monthLong(r.open.key)} closes today` })
    else if (d === 1) chips.push({ key: `open-${r.open.key}`, tone: 'red', text: `${monthLong(r.open.key)} closes tomorrow` })
    else chips.push({ key: `open-${r.open.key}`, tone: d <= LIEN_LEADER_SOON_DAYS ? 'red' : 'gray', text: dayCount(d) })
  }
  for (const c of r.closed) chips.push({ key: `closed-${c.key}`, tone: 'red', text: `${monthLong(c.key)} closed ${formatYmdMonthDay(c.deadline)}, not sent` })
  if (Math.round(r.claim) <= 0) chips.push({ key: 'no-claim', tone: 'amber', text: 'nothing claimed, ask the office' })
  return chips
}

/** The card, or null when no notice waits on the leader outside a prepared run. */
export function buildLienLeaderSignCard(input: LienLeaderSignInput): LienLeaderSignCard | null {
  const reads = input.awaiting
    .filter((e) => e.pile === 'awaiting' && !lienDeskEntryInRun(e))
    .map((e) => read(e, input))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      const ad = a.open?.deadline ?? '9999'
      const bd = b.open?.deadline ?? '9999'
      if (ad !== bd) return ad < bd ? -1 : 1
      return b.claim - a.claim
    })
  const count = reads.length
  if (count === 0) return null

  // The title, by the soonest window still open.
  const withOpen = reads.filter((r) => r.open)
  const soonest = withOpen.map((r) => r.open!.deadline).sort()[0] ?? null
  const soonestDays = soonest ? (daysBetweenYmd(input.todayYmd, soonest) ?? null) : null
  const atSoonest = soonest ? withOpen.filter((r) => r.open!.deadline === soonest) : []
  const named = soonestDays != null && soonestDays <= LIEN_LEADER_SOON_DAYS ? atSoonest : []
  let title: string
  if (named.length > 0 && soonestDays === 0) title = `Sign ${named.length} ${plural(named.length)} today`
  else if (named.length > 0 && soonest) title = `Sign ${named.length} ${plural(named.length)} by ${soonestDays === 1 ? 'tomorrow' : weekdayAndDay(soonest)}`
  else title = `${count} ${plural(count)} ${count === 1 ? 'waits' : 'wait'} on your signature`

  // The rest, in the line under the title.
  const rest = reads.filter((r) => !named.includes(r))
  const lead: string[] = []
  if (named.length > 0) {
    const restOpen = rest.filter((r) => r.open)
    const latest = restOpen.map((r) => r.open!.deadline).sort().pop()
    if (restOpen.length > 0 && latest) lead.push(`${restOpen.length} more by ${formatYmdMonthDay(latest)}`)
    const restClosed = rest.filter((r) => !r.open && r.closed.length > 0).length
    if (restClosed > 0) lead.push(`${restClosed} more with a window already closed`)
    const restNone = rest.filter((r) => !r.open && r.closed.length === 0).length
    if (restNone > 0) lead.push(`${restNone} more with no open window`)
  } else if (soonest) {
    lead.push(`The soonest window closes ${formatYmdMonthDay(soonest)}`)
  }

  // Whole dollars, summed as the rows print them, so the figure is the one a person gets by adding the rows.
  const sum = reads.reduce((s, r) => s + Math.round(r.claim), 0)
  const figure = formatUsdNoCents(sum)
  const money: LienLeaderSeg[] = [{ text: figure, strong: true }, { text: ` on ${count === 1 ? '1 job' : `${count} jobs`}` }]

  // The wait: one day for all of them reads with its date, different days read by the oldest.
  const asked = reads.map((r) => r.askedYmd).filter((d): d is string => Boolean(d)).sort()
  const oldest = asked[0] ?? null
  const waitedDays = oldest ? Math.max(0, daysBetweenYmd(oldest, input.todayYmd) ?? 0) : null
  const oneDay = asked.length === count && new Set(asked).size === 1
  let waitComputer: LienLeaderSeg[] = []
  let waitPhone: LienLeaderSeg[] = []
  if (oldest != null && waitedDays != null) {
    if (oneDay && waitedDays === 0) {
      waitComputer = [{ text: `${count === 1 ? 'it was' : 'they were'} sent to you today` }]
      waitPhone = [{ text: 'Sent to you today' }]
    } else if (oneDay) {
      waitComputer = [{ text: `${count === 1 ? 'it has' : 'they have'} waited on you since ` }, { text: formatYmdMonthDay(oldest), strong: true }, { text: `, ${dayCount(waitedDays)}` }]
      waitPhone = [{ text: 'Waiting on you since ' }, { text: formatYmdMonthDay(oldest), strong: true }, { text: `, ${dayCount(waitedDays)}` }]
    } else {
      waitComputer = [{ text: `the oldest has waited on you ${dayCount(waitedDays)}` }]
      waitPhone = [{ text: `The oldest has waited on you ${dayCount(waitedDays)}` }]
    }
  }

  const sep: LienLeaderSeg = { text: ' · ' }
  const join = (parts: LienLeaderSeg[][]): LienLeaderSeg[] => parts.filter((p) => p.length > 0).flatMap((p, i) => (i === 0 ? p : [sep, ...p]))
  const leadSegs: LienLeaderSeg[][] = lead.map((text) => [{ text }])
  const line = join([...leadSegs, money, waitComputer])
  const phoneLines = [join([...leadSegs, money]), waitPhone].filter((l) => l.length > 0)

  const rows: LienLeaderRow[] = reads.slice(0, LIEN_LEADER_ROWS).map((r, i) => {
    const e = r.entry
    const number = input.jobNumber(e.jobId)
    const name = input.jobName(e.jobId).trim()
    const chips = chipsFor(r)
    const months = e.item && e.item.months.length > 0 ? e.item.months : e.dueMonths
    return {
      jobId: e.jobId,
      label: name ? `${number} · ${name}` : number,
      number,
      claim: r.claim,
      claimWords: formatUsdNoCents(r.claim),
      gcName: e.gcCustomerId ? input.gcName(e.gcCustomerId).trim() : '',
      chips,
      monthsWords: months.map(workMonthShort).join(' + '),
      monthNamed: chips.some((c) => c.key.startsWith('closed-') || (c.key.startsWith('open-') && c.tone === 'red' && r.open != null && r.open.daysLeft <= 1)),
      href: lienDeskHref({ kind: 'notice', job: e.jobId, pile: 'awaiting' }),
      pressLabel: i === 0 ? `Open ${number} to sign ▸` : `Open ${number} ›`,
      pressTitle: `Open the notice for ${name ? `${number} ${name}` : number} on the Lien desk`,
      primary: i === 0,
    }
  })

  const moreCount = count - rows.length
  const tone: 'red' | 'blue' = reads.some((r) => r.rank <= 1) ? 'red' : 'blue'
  return {
    count,
    tone,
    kicker: LIEN_LEADER_KICKER,
    title,
    line,
    phoneLines,
    detail: line.map((s) => s.text).join(''),
    figure,
    rows,
    more: moreCount > 0 ? { count: moreCount, label: `${moreCount} more ${moreCount === 1 ? 'waits' : 'wait'} on you ›`, href: lienDeskHref({ kind: 'notice', pile: 'awaiting' }) } : null,
  }
}
