/**
 * Profit after overhead (v2.6840, punch list #303): the Daily profit rate card left the page
 * with the doors, and its panel came back as the breakdown of the eight week chart behind
 * Money, opened by one press. `warn` and `left` are for that: the warning stands first, so a
 * reading that is low because hours wait is never taken for a loss.
 *
 * As it was, the Daily profit rate panel (link PR 9): what the card's number is made of,
 * in four parts — the trend by pay week (earned against costs, the net as a
 * bar, a week hatched while its hours wait), where a day's money goes (the
 * 14-day average as a waterfall), where each input is read from and what can
 * make it wrong, and break-even. Pure: the page passes the loader's maps.
 *
 * Since v2.6965 the breakdown reads recorded time, as the headline does: the
 * page adds what the hours still waiting on approval earn and cost
 * (`waitingDays.ts`) and passes `waiting`. The big number then agrees with the
 * headline and carries ≈, and one line under it says what approved hours alone
 * read. Without `waiting` (the recorded hours could not be read) the panel is
 * the approved reading with its warning first, as before.
 */
import { payWeekContaining } from '../payWeekAnchor'

export type ProfitWeek = { start: string; label: string; earnedUsd: number; costsUsd: number; netUsd: number; waiting: boolean }

export type ProfitWaterfallBar = { label: string; usd: number; kind: 'step' | 'total' }

export type ProfitSourceRow = { input: string; from: string; risk: string; tone: 'amber' | 'green'; door: { to: string; label: string } }

export type ProfitPanel = {
  weeks: ProfitWeek[]
  eightWeeks: string
  waterfall: ProfitWaterfallBar[]
  sources: ProfitSourceRow[]
  breakEven: string
  note: string
  noteTone: 'amber' | 'green' | 'grey'
  /** Which hours the figures count: every recorded hour, as the headline does, or approved hours only. */
  reading: 'recorded' | 'approved'
  /** What a day keeps after every cost, on the average of `days` days. `approx` when waiting hours move the figure. */
  left: { usd: number; days: number; approx: boolean }
  /**
   * While hours wait on approval. On recorded time: how many are counted, and what approved hours alone read. On
   * approved time it stands first: the reading is low, and about what it reads with them. Null when none wait.
   */
  warn: string | null
}

export type ProfitPanelInput = {
  windowStart: string
  todayYmd: string
  earnedByDay: Map<string, number>
  directByDay: Map<string, number>
  overheadByDay: Map<string, number>
  speed: { days: number; earnedPerDay: number; directPerDay: number; overheadPerDay: number; climbPerDay: number }
  contributionMargin: number | null
  totals: { earnedUsd: number; fieldLaborUsd: number; materialsUsd: number; subLaborUsd: number; overheadUsd: number }
  /** Pay-week starts whose hours still wait on approval. */
  waitingWeeks: ReadonlySet<string>
  pendingClosedHours: number
  unlinkedCard: number | null
  unattributedNoncard: number | null
  /** Earned less wages per approved field hour over the window, for what the waiting hours would add on the approved reading. */
  fieldMadePerHour: number | null
  /**
   * Set when the day maps, the speed and the totals already count the hours that still wait on approval
   * (`buildRecordedReading`): the waiting field hours in the window, and what a day keeps on approved hours alone.
   */
  waiting?: { hours: number; approvedLeftUsd: number } | null
  weekLabel: (start: string) => string
}

export const PROFIT_DOORS = {
  approvals: { to: '/people?tab=hours&approvals=1', label: 'Approve' },
  banking: { to: '/banking', label: 'Sort' },
  sheets: { to: '/people?tab=subs', label: 'Open sheets' },
  overhead: { to: '/people?tab=overhead', label: 'Open overhead' },
} as const

const money = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`

export function buildProfitPanel(input: ProfitPanelInput): ProfitPanel {
  const byWeek = new Map<string, ProfitWeek>()
  const add = (m: Map<string, number>, key: 'earnedUsd' | 'costsUsd') => {
    for (const [ymd, usd] of m) {
      if (ymd < input.windowStart || ymd > input.todayYmd) continue
      const start = payWeekContaining(ymd).start
      const w = byWeek.get(start) ?? { start, label: input.weekLabel(start), earnedUsd: 0, costsUsd: 0, netUsd: 0, waiting: input.waitingWeeks.has(start) }
      w[key] += usd
      byWeek.set(start, w)
    }
  }
  add(input.earnedByDay, 'earnedUsd')
  add(input.directByDay, 'costsUsd')
  add(input.overheadByDay, 'costsUsd')
  // Every pay week in the window appears, even an empty one.
  for (let d = payWeekContaining(input.windowStart).start; d <= input.todayYmd; d = new Date(Date.parse(`${d}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10)) {
    if (!byWeek.has(d)) byWeek.set(d, { start: d, label: input.weekLabel(d), earnedUsd: 0, costsUsd: 0, netUsd: 0, waiting: input.waitingWeeks.has(d) })
  }
  const weeks = [...byWeek.values()].sort((a, b) => (a.start < b.start ? -1 : 1)).map((w) => ({ ...w, netUsd: w.earnedUsd - w.costsUsd }))
  const earned = weeks.reduce((s, w) => s + w.earnedUsd, 0)
  const costs = weeks.reduce((s, w) => s + w.costsUsd, 0)
  const made = weeks.filter((w) => w.netUsd > 0).length
  const lost = weeks.filter((w) => w.netUsd < 0)
  const lostWaiting = lost.filter((w) => w.waiting).length
  const eightWeeks = `${weeks.length} weeks: earned ${shortK(earned)}, costs ${shortK(costs)}, net ${earned - costs >= 0 ? '+' : ''}${shortK(earned - costs)}. ${made} ${made === 1 ? 'week' : 'weeks'} made money${lost.length ? `; ${lost.length === lostWaiting ? (lost.length === 1 ? 'the one that did not is the one with hours waiting' : `the ${lost.length} that did not are the ${lost.length} with hours waiting`) : `${lost.length} did not`}` : ''}.`

  const s = input.speed
  const waterfall: ProfitWaterfallBar[] = [
    { label: 'earned', usd: s.earnedPerDay, kind: 'step' },
    { label: 'jobs', usd: -s.directPerDay, kind: 'step' },
    { label: 'overhead', usd: -s.overheadPerDay, kind: 'step' },
    { label: 'profit a day', usd: s.climbPerDay, kind: 'total' },
  ]

  const t = input.totals
  const direct = t.fieldLaborUsd + t.materialsUsd + t.subLaborUsd
  const share = (n: number): string => (direct > 0 ? `${Math.round((n / direct) * 100)}% of job costs` : '')
  const recorded = input.waiting != null
  // On recorded time the hours that matter are the waiting field hours the figures count; on approved time, every hour that waits.
  const pending = input.waiting != null ? input.waiting.hours : input.pendingClosedHours
  const sources: ProfitSourceRow[] = [
    {
      input: 'earned',
      from: `${recorded ? 'recorded' : 'approved'} field hours × the job’s contract ÷ its expected hours`,
      risk: pending > 0 ? (recorded ? `${hrs(pending)} not yet approved: counted, and can change` : `${hrs(pending)} not yet approved: reads low`) : 'read in full',
      tone: pending > 0 ? 'amber' : 'green',
      door: PROFIT_DOORS.approvals,
    },
    {
      input: 'field labor',
      from: `payroll on the approved hours${recorded ? ', and each person’s wage on the hours waiting' : ''} (${shortK(t.fieldLaborUsd)} in the window, ${share(t.fieldLaborUsd)})`,
      risk: pending > 0 ? (recorded ? 'the same hours: counted, and can change' : 'the same hours: reads low') : 'read in full',
      tone: pending > 0 ? 'amber' : 'green',
      door: PROFIT_DOORS.approvals,
    },
    {
      input: 'materials',
      from: `card and bank purchases sorted to a job, plus supply-house invoices by job (${shortK(t.materialsUsd)}, ${share(t.materialsUsd)})`,
      risk: (input.unlinkedCard ?? 0) > 0 || (input.unattributedNoncard ?? 0) > 0 ? `${input.unlinkedCard ?? 0} card purchases unsorted, ${(input.unattributedNoncard ?? 0).toLocaleString('en-US')} bank rows unsorted: reads low, or on the wrong job` : 'every purchase is sorted',
      tone: (input.unlinkedCard ?? 0) > 0 || (input.unattributedNoncard ?? 0) > 0 ? 'amber' : 'green',
      door: PROFIT_DOORS.banking,
    },
    { input: 'subs', from: `sub labor sheets by the job’s date (${shortK(t.subLaborUsd)}, ${share(t.subLaborUsd)})`, risk: 'a sheet filed late lands in the wrong week', tone: 'amber', door: PROFIT_DOORS.sheets },
    { input: 'overhead', from: `the 90-day overhead pool ÷ 90, the same figure the Overhead tab shows (${money(s.overheadPerDay)} a day)`, risk: (input.unattributedNoncard ?? 0) > 0 ? 'whatever is not sorted to a job sits here and reads high' : 'read from the sorted rows', tone: (input.unattributedNoncard ?? 0) > 0 ? 'amber' : 'green', door: PROFIT_DOORS.banking },
  ]

  const margin = input.contributionMargin
  const windowDays = Math.max(1, Math.round((Date.parse(`${input.todayYmd}T00:00:00Z`) - Date.parse(`${input.windowStart}T00:00:00Z`)) / 86_400_000) + 1)
  const paceEarned = t.earnedUsd / windowDays
  const needed = margin != null && margin > 0 ? s.overheadPerDay / margin : null
  const breakEven = needed != null ? `Break-even: overhead is ${money(s.overheadPerDay)} a day. At ${Math.round(margin! * 100)}% margin the field must earn ${money(needed)} a day to cover it. At its ${weeks.length}-week pace it earns ${money(paceEarned)} a day. ${paceEarned >= needed ? 'The window’s pace covers the office.' : 'The pace does not cover the office yet.'}` : 'Break-even cannot be read until something is earned in the window.'

  // A negative day with hours waiting is only partly the approvals: materials bought ahead of the work also land before the earning does, so the note names their share instead of blaming approvals alone.
  const materialsShare = direct > 0 ? Math.round((t.materialsUsd / direct) * 100) : null
  let note: string
  let noteTone: ProfitPanel['noteTone']
  const boughtAhead = materialsShare != null && materialsShare > 0 ? ` Part can be materials bought ahead of the work — ${materialsShare}% of the window’s job costs is materials.` : ''
  if (recorded) {
    // Every recorded hour is in: a loss here is not a pile of approvals.
    if (s.climbPerDay >= 0) {
      note = `The day makes money at ${money(s.climbPerDay)} on the ${s.days}-day average${pending > 0 ? `, counting ${hrs(pending)} still waiting on approval` : ''}.`
      noteTone = 'green'
    } else {
      note = `The day loses ${money(Math.abs(s.climbPerDay))} on the ${s.days}-day average with every recorded hour counted${pending > 0 ? `, ${hrs(pending)} of them still waiting on approval` : ''}.${boughtAhead}`
      noteTone = 'amber'
    }
  } else if (pending > 0 && s.climbPerDay < 0) {
    const addPerDay = input.fieldMadePerHour != null ? (pending * input.fieldMadePerHour) / s.days : null
    note = `The ${money(s.climbPerDay)} a day is a reading, not a result, and part of this is hours waiting: ${hrs(pending)} are not yet approved, so the last ${s.days} days earn on paper only what was approved.${addPerDay != null ? ` Approve them and the rate reads about ${money(s.climbPerDay + addPerDay)} a day.` : ''}${boughtAhead}`
    noteTone = 'amber'
  } else if (s.climbPerDay >= 0) {
    note = `The day makes money at ${money(s.climbPerDay)} on the ${s.days}-day average${pending > 0 ? `, with ${hrs(pending)} still waiting on approval` : ''}.`
    noteTone = 'green'
  } else {
    note = `The day loses ${money(Math.abs(s.climbPerDay))} on the ${s.days}-day average with every hour read. That is a result, not a reading.`
    noteTone = 'amber'
  }
  // In plain words, for the top of the breakdown.
  const waitHours = Math.round(pending)
  if (input.waiting != null) {
    // The waiting hours move the day's figure only when some fall inside the average's days.
    const moved = waitHours > 0 && Math.abs(s.climbPerDay - input.waiting.approvedLeftUsd) >= 1
    const warn = waitHours > 0 ? `Counts ${waitHours.toLocaleString('en-US')} ${waitHours === 1 ? 'hour that still waits' : 'hours that still wait'} on approval.${moved ? ` On approved hours alone it reads ${money(input.waiting.approvedLeftUsd)} a day.` : ''}` : null
    return { weeks, eightWeeks, waterfall, sources, breakEven, note, noteTone, reading: 'recorded', left: { usd: s.climbPerDay, days: s.days, approx: moved }, warn }
  }
  const withThem = input.fieldMadePerHour != null ? s.climbPerDay + (pending * input.fieldMadePerHour) / s.days : null
  const warn = waitHours > 0 ? `Reads low for now. ${waitHours.toLocaleString('en-US')} ${waitHours === 1 ? 'hour still waits' : 'hours still wait'} on approval.${withThem != null ? ` With them it reads about ${money(withThem)} a day.` : ''}` : null
  return { weeks, eightWeeks, waterfall, sources, breakEven, note, noteTone, reading: 'approved', left: { usd: s.climbPerDay, days: s.days, approx: false }, warn }
}
