/**
 * The Build desk (punch list #192, v2.5929): hours in, work out. The one
 * question behind the Build card: the field worked all week, so did the
 * money move, and where do the crews go tomorrow? One row per open job over
 * the last BUILD_DESK_DAYS days: the clock hours that went in against the
 * movement that came out, the job's % change times its contract. Worst
 * divergence first: the jobs that ate hours and moved nothing, then the
 * jobs that sat with nobody on them, then the jobs that moved, then the
 * finished ones. It explains the Build card's by-hours against by-percents
 * gap row by row. Every sentence here is held to the plain-words rule by
 * `buildDesk.test.ts`. Pure: no React, no Supabase.
 */
import type { BuildJob, PctPoint } from '../buildPace'
import type { VectorSession } from '../vectors'
import { expectedHoursForJob } from '../earnedRevenue'
import { stageUsd } from '../stageFlow'

/** Owner call (punch list #192): the ledger's window, and the days a job can go quiet before it reads stalled. Default 14. */
export const BUILD_DESK_DAYS = 14
/** Owner call (punch list #192): how far ahead the crew chips read the Schedule, today included. Default 7. */
export const BUILD_DESK_CREW_DAYS = 7
/** The moved rows shown before the rest fold under one line. */
export const BUILD_DESK_MOVED_SHOWN = 3

export type BuildDeskBlock = { jobId: string; workDate: string; assigneeUserId: string }

/** The reads the desk makes on its first open (`loadBuildDesk.ts`); null until they land. */
export type BuildDeskReads = {
  blocks: ReadonlyArray<BuildDeskBlock>
  /** User id → name, for the crew chips. */
  names: ReadonlyMap<string, string>
  /** Job id → lifetime approved field hours, the earned rule's denominator. */
  lifetimeHours: ReadonlyMap<string, number>
}

export type BuildDeskInput = {
  openJobs: ReadonlyArray<BuildJob>
  /** Every percent point the Build card walks, hand set and from reports. */
  points: ReadonlyArray<PctPoint>
  /** The closed clock sessions the top line reads: the last `spanWeeks` pay weeks. */
  sessions: ReadonlyArray<VectorSession>
  /** How many pay weeks the sessions cover, for the words on a job with none. */
  spanWeeks?: number
  todayYmd: string
  reads: BuildDeskReads | null
  /** The Build card's two paces, when both read. */
  paces: { byPercentUsd: number; byHoursUsd: number } | null
  /** The Build card's out-rate, the larger of the two paces. */
  outPerWeekUsd: number | null
  /** The Build card's weeks to clear what is sold; null when it has no pace. */
  weeks: number | null
  days?: number
  crewDays?: number
}

export type BuildDeskGroup = 'ate' | 'stalled' | 'moved' | 'finished'
export type BuildDeskTone = 'red' | 'amber' | 'green' | 'grey'

export type BuildDeskDoor = { label: string; href: string }

export type BuildDeskRow = {
  id: string
  label: string
  contractUsd: number | null
  pctNow: number | null
  pctFrom: number | null
  /** Days since the newest percent point on or before today; null when the job has none. */
  pctAgeDays: number | null
  /** The job's first % ever was set inside the window, so there is no earlier % to measure from. */
  pctFirstInWindow: boolean
  /** The newest % point before the window read above the job's own % (v2.5938): the row's % is the office's word, the point a report or an older set; the cell and the why say both. */
  pctAbove: { pct: number; atYmd: string; source: PctPoint['source'] } | null
  /** Counted hours in the window. */
  hours: number
  /** Days since the job's newest counted session anywhere in the span; null when it had hours in the window. */
  quietDays: number | null
  /** True when the job had no counted session in the whole span. */
  quietAll: boolean
  movedUsd: number
  leftUsd: number | null
  /** Expected hours less lifetime hours, floored at 0; null with no %, no contract or no reads. */
  expectedMoreHours: number | null
  group: BuildDeskGroup
  noPrice: boolean
  biggestIdle: boolean
  /** The row head's small line under the name: "$39k left of $71k · 45%". A label, not a sentence. */
  sub: string
  /** The row head's hours cell: "22h" or "0h · 19 d quiet". A label. */
  hoursWords: string
  /** The row head's percent cell: "45 → 45" or "—". A label. */
  pctWords: string
  /** The row head's moved cell: "$20.4k" or "reads $0". A label. */
  movedWords: string
  chip: { tone: BuildDeskTone; words: string }
  /** The crew chip from the Schedule; null until the reads land, or when nothing is owed on the job. A label. */
  crew: { tone: BuildDeskTone; words: string } | null
  /** The why-line, in plain words. */
  why: string
  doors: BuildDeskDoor[]
  /** The row offers Set the %: the job has a contract. */
  canSetPct: boolean
  /** The job as the crews' percent window takes it. */
  modalJob: { id: string; hcpNumber: string; jobName: string; label: string }
}

export type BuildDeskTile = { head: string; value: string; words: string; tone: BuildDeskTone }

export type BuildDesk = {
  windowStart: string
  todayYmd: string
  days: number
  totals: { hours: number; movedUsd: number; movedJobs: number; ateHours: number; ateJobs: number; stalledUsd: number; stalledJobs: number; finishedJobs: number; noPctJobs: number }
  headline: string
  verdict: string
  /** The muted line under the verdict: the card's paces, and its weeks when it has them. */
  subLine: string
  tiles: [BuildDeskTile, BuildDeskTile, BuildDeskTile]
  rows: BuildDeskRow[]
  /** The moved rows past the first BUILD_DESK_MOVED_SHOWN, folded: null when none fold. */
  movedFold: { count: number; usd: number; words: string } | null
  /** One line on the jobs with a contract and no %; '' when every priced job has one. */
  noPctLine: string
  footnote: string
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const ymdDays = (ymd: string): number => Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000)
const addDays = (ymd: string, n: number): string => new Date((ymdDays(ymd) + n) * 86_400_000).toISOString().slice(0, 10)
const daysBetween = (fromYmd: string, toYmd: string): number => ymdDays(toYmd) - ymdDays(fromYmd)
const weekdayOf = (ymd: string): string => WEEKDAY[new Date(`${ymd}T12:00:00Z`).getUTCDay()]!
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const hoursText = (h: number): string => `${Math.round(h)}h`
const jobs = (n: number): string => `${n} ${plural(n, 'job', 'jobs')}`

/** A session counts the way `fieldPace.ts` counts it: closed, approved or still waiting, on a job, not the office, not a bid. */
export function countsForBuildDesk(s: VectorSession): boolean {
  return (s.approved || s.pending) && !s.onBid && !s.officeJob && !!s.jobId && s.hours > 0
}

const ageWords = (days: number): string => (days >= 7 ? `${Math.round(days / 7)} ${plural(Math.round(days / 7), 'week', 'weeks')} old` : `${days} ${plural(days, 'day', 'days')} old`)

function crewFor(jobId: string, reads: BuildDeskReads, leftUsd: number | null, group: BuildDeskGroup, noPrice: boolean): { chip: BuildDeskRow['crew']; crewDays: number; names: string[]; range: string } {
  const blocks = reads.blocks.filter((b) => b.jobId === jobId)
  const pairs = new Set<string>()
  const byUser = new Map<string, number>()
  let first = ''
  let last = ''
  for (const b of blocks) {
    const key = `${b.assigneeUserId}|${b.workDate}`
    if (pairs.has(key)) continue
    pairs.add(key)
    byUser.set(b.assigneeUserId, (byUser.get(b.assigneeUserId) ?? 0) + 1)
    if (!first || b.workDate < first) first = b.workDate
    if (!last || b.workDate > last) last = b.workDate
  }
  const crewDays = pairs.size
  if (crewDays === 0) {
    const owed = leftUsd != null && leftUsd > 0
    return { chip: owed ? { tone: 'red', words: 'Nobody scheduled, all week' } : null, crewDays: 0, names: [], range: '' }
  }
  const ranked = [...byUser.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const names = ranked.map(([id]) => reads.names.get(id) ?? 'Someone')
  const lead = names[0]!
  const others = ranked.length - 1
  const range = first === last ? weekdayOf(first) : `${weekdayOf(first)} to ${weekdayOf(last)}`
  const tone: BuildDeskTone = noPrice ? 'red' : group === 'moved' || group === 'finished' ? 'green' : 'amber'
  const words = `${lead}${others > 0 ? ` + ${others}` : ''} · ${crewDays} ${plural(crewDays, 'crew-day', 'crew-days')} · ${range}`
  return { chip: { tone, words }, crewDays, names, range }
}

/** The one sentence the Schedule adds to a stalled row. */
function scheduleSentence(crew: { crewDays: number; names: string[]; range: string }): string {
  if (crew.crewDays === 0) return 'The Schedule shows nobody this week either.'
  const who = crew.names.length === 1 ? crew.names[0]! : `${crew.names[0]} and ${crew.names.length - 1} more`
  return `The Schedule puts ${who} on it ${crew.range}.`
}

function whyFor(r: Omit<BuildDeskRow, 'why' | 'doors' | 'crew' | 'canSetPct' | 'modalJob'>, crew: { crewDays: number; names: string[]; range: string } | null, days: number, spanWeeks: number, todayYmd?: string): string {
  const hours = hoursText(r.hours)
  if (r.pctAbove && (r.group === 'ate' || r.group === 'stalled') && r.pctNow != null) {
    const ago = todayYmd ? ` ${ageWords(daysBetween(r.pctAbove.atYmd, todayYmd)).replace(' old', ' ago')}` : ''
    const lead = `The job says ${Math.round(r.pctNow)}%. ${r.pctAbove.source === 'report' ? 'A report read' : 'The % was set to'} ${Math.round(r.pctAbove.pct)}%${ago}. One look at the job says which is true.`
    return `${lead} ${whyFor({ ...r, pctAbove: null }, crew, days, spanWeeks, todayYmd)}`
  }
  if (r.group === 'finished') return 'Finished. Done work is Bill’s row now.'
  if (r.group === 'moved') {
    if (r.hours <= 0) return `The % moved ${stageUsd(r.movedUsd)} with no hours on the clock. The work was a sub’s, or the hours are not in yet. One look at the job says which.`
    const expects = r.expectedMoreHours == null ? '' : r.expectedMoreHours > 0 ? ` The job expects about ${Math.round(r.expectedMoreHours)} hours more.` : ' The job is past its expected hours.'
    return `Hours and % agree.${expects} Leave it alone.`
  }
  if (r.group === 'ate') {
    if (r.noPrice) {
      const onto = crew && crew.crewDays > 0 ? ` ${crew.crewDays} more ${plural(crew.crewDays, 'crew-day is', 'crew-days are')} on the Schedule for it.` : ''
      return `No price on the job. The ${Math.round(r.hours)} hours earned $0 on paper.${onto}`
    }
    if (r.pctNow == null) return `No % on the job. ${hours} went on and the desk cannot say what they built. Set the % so it can.`
    if (r.pctFirstInWindow) return `The first % on the job was set ${ageWords(r.pctAgeDays ?? 0).replace(' old', ' ago')}. The desk has no earlier % to measure from. ${hours} went on in the last ${days} days.`
    const age = r.pctAgeDays == null ? 'The % has no date on record.' : `The % is ${ageWords(r.pctAgeDays)}.`
    return `${age} ${hours} went on in the last ${days} days. Either the crew built and nobody wrote it, or the hours vanished. One look at the job says which.`
  }
  // Stalled.
  const quiet = r.quietAll ? `no hours in ${spanWeeks} weeks` : `nobody on it for ${r.quietDays} ${plural(r.quietDays ?? 0, 'day', 'days')}`
  const sched = crew ? ` ${scheduleSentence(crew)}` : ''
  const close = crew && crew.crewDays > 0 ? ' Watch the hours land.' : ' Crew it, or name why it waits.'
  if (r.noPrice) return `No price on the job and ${quiet}. Price it, or name why it waits.`
  if (r.pctNow == null || r.leftUsd == null) return `${stageUsd(r.contractUsd ?? 0)} of contract has had ${quiet}. No % on the job, so what is left is a guess.${sched}${close}`
  return `${stageUsd(r.leftUsd)} of sold work has had ${quiet}.${sched}${close}`
}

export function buildBuildDesk(input: BuildDeskInput): BuildDesk {
  const days = input.days ?? BUILD_DESK_DAYS
  const crewDays = input.crewDays ?? BUILD_DESK_CREW_DAYS
  const spanWeeks = input.spanWeeks ?? 13
  const today = input.todayYmd
  const windowStart = addDays(today, -(days - 1))
  const crewEnd = addDays(today, crewDays - 1)
  const reads: BuildDeskReads | null = input.reads ? { ...input.reads, blocks: input.reads.blocks.filter((b) => b.workDate >= today && b.workDate <= crewEnd) } : null

  // Hours in the window and the newest counted session, per job.
  const hoursByJob = new Map<string, number>()
  const newestByJob = new Map<string, string>()
  for (const s of input.sessions) {
    if (!countsForBuildDesk(s) || s.workDate > today) continue
    const id = s.jobId as string
    if (s.workDate >= windowStart) hoursByJob.set(id, (hoursByJob.get(id) ?? 0) + s.hours)
    const newest = newestByJob.get(id)
    if (!newest || s.workDate > newest) newestByJob.set(id, s.workDate)
  }

  // The percent points per job, newest first.
  const pointsByJob = new Map<string, PctPoint[]>()
  for (const p of input.points) {
    if (p.atYmd > today) continue
    const list = pointsByJob.get(p.jobId) ?? []
    list.push(p)
    pointsByJob.set(p.jobId, list)
  }
  for (const list of pointsByJob.values()) list.sort((a, b) => (a.atYmd < b.atYmd ? 1 : a.atYmd > b.atYmd ? -1 : 0))

  type Draft = Omit<BuildDeskRow, 'why' | 'doors' | 'crew' | 'canSetPct' | 'modalJob'> & { crewInfo: { crewDays: number; names: string[]; range: string } | null; crewChip: BuildDeskRow['crew'] }
  const drafts: Draft[] = []
  let noPctJobs = 0
  for (const j of input.openJobs) {
    const contract = j.revenueUsd != null && j.revenueUsd > 0 ? j.revenueUsd : null
    const noPrice = contract == null
    const pts = pointsByJob.get(j.id) ?? []
    const newest = pts[0] ?? null
    const pctNow = j.pctComplete ?? newest?.pct ?? null
    const before = pts.find((p) => p.atYmd < windowStart) ?? null
    const oldestInWindow = pts.length ? pts[pts.length - 1]! : null
    let pctFrom: number | null
    let pctFirstInWindow = false
    if (before) pctFrom = before.pct
    else if (pctNow == null) pctFrom = null
    else if (oldestInWindow && j.createdYmd && j.createdYmd >= windowStart) pctFrom = 0
    else if (oldestInWindow) {
      // The job's first % ever landed in the window: `buildPace.ts` measures from it, so nothing before it counts as built.
      pctFrom = oldestInWindow.pct
      pctFirstInWindow = true
    } else pctFrom = pctNow
    const pctAbove = before && pctNow != null && j.pctComplete != null && before.pct > pctNow ? { pct: before.pct, atYmd: before.atYmd, source: before.source } : null
    const movedUsd = contract != null && pctNow != null && pctFrom != null ? Math.max(0, ((pctNow - pctFrom) / 100) * contract) : 0
    const leftUsd = contract != null && pctNow != null ? Math.max(0, (1 - Math.min(100, pctNow) / 100) * contract) : null
    const hours = hoursByJob.get(j.id) ?? 0
    const newestSession = newestByJob.get(j.id) ?? null
    const quietAll = hours <= 0 && !newestSession
    const quietDays = hours > 0 ? null : newestSession ? daysBetween(newestSession, today) : null
    const pctAgeDays = newest ? daysBetween(newest.atYmd, today) : null
    const group: BuildDeskGroup = pctNow != null && pctNow >= 100 ? 'finished' : movedUsd > 0 ? 'moved' : hours > 0 ? 'ate' : 'stalled'
    if (contract != null && pctNow == null) noPctJobs += 1
    let expectedMoreHours: number | null = null
    if (reads && contract != null && pctNow != null) {
      const life = reads.lifetimeHours.get(j.id) ?? 0
      const expected = expectedHoursForJob({ id: j.id, revenueUsd: contract, pctComplete: pctNow, status: j.status, lifetimeHours: life })
      expectedMoreHours = expected.assumedHalf ? null : Math.max(0, expected.hours - life)
    }
    const sub = noPrice ? 'no contract price' : pctNow == null ? `${stageUsd(contract)} contract · no %` : `${stageUsd(leftUsd ?? 0)} left of ${stageUsd(contract)} · ${Math.round(pctNow)}%`
    const hoursWords = hours > 0 ? hoursText(hours) : quietAll ? `0h · no hours in ${spanWeeks} weeks` : `0h · ${quietDays} d quiet`
    const pctWords = pctNow == null ? '—' : pctAbove ? `${Math.round(pctNow)} · ${pctAbove.source === 'report' ? 'a report read' : 'was set to'} ${Math.round(pctAbove.pct)}` : `${Math.round(pctFrom ?? pctNow)} → ${Math.round(pctNow)}`
    const movedWords = noPrice ? 'reads $0' : stageUsd(movedUsd)
    const chip: BuildDeskRow['chip'] =
      group === 'finished'
        ? { tone: 'green', words: 'finished' }
        : group === 'moved'
          ? { tone: 'green', words: hours > 0 ? `moving · $${Math.round(movedUsd / hours)}/h` : 'moved, no hours' }
          : group === 'ate'
            ? noPrice
              ? { tone: 'red', words: `${hoursText(hours)} earning zero` }
              : { tone: 'amber', words: 'hours in, nothing moved' }
            : { tone: 'red', words: 'stalled' }
    const crew = reads ? crewFor(j.id, reads, leftUsd, group, noPrice) : null
    drafts.push({ id: j.id, label: j.label, contractUsd: contract, pctNow, pctFrom, pctAgeDays, pctFirstInWindow, pctAbove, hours, quietDays, quietAll, movedUsd, leftUsd, expectedMoreHours, group, noPrice, biggestIdle: false, sub, hoursWords, pctWords, movedWords, chip, crewInfo: crew ? { crewDays: crew.crewDays, names: crew.names, range: crew.range } : null, crewChip: crew ? crew.chip : null })
  }

  // The order: ate by hours, stalled by money idle, moved by money moved, finished last.
  const rank: Record<BuildDeskGroup, number> = { ate: 0, stalled: 1, moved: 2, finished: 3 }
  drafts.sort((a, b) => {
    if (rank[a.group] !== rank[b.group]) return rank[a.group] - rank[b.group]
    if (a.group === 'ate') return b.hours - a.hours || a.label.localeCompare(b.label)
    if (a.group === 'stalled') return (b.leftUsd ?? 0) - (a.leftUsd ?? 0) || a.label.localeCompare(b.label)
    return b.movedUsd - a.movedUsd || a.label.localeCompare(b.label)
  })
  const biggest = drafts.find((d) => d.group === 'stalled' && d.leftUsd != null && d.leftUsd > 0)
  if (biggest) {
    biggest.biggestIdle = true
    biggest.chip = { tone: 'red', words: 'stalled · biggest money idle' }
  }

  const rows: BuildDeskRow[] = drafts.map((d) => {
    const { crewInfo, crewChip, ...rest } = d
    const doors: BuildDeskDoor[] = [{ label: 'Open the job', href: `/jobs?tab=stages&edit=${d.id}` }]
    if (d.group === 'stalled') doors.unshift({ label: 'Open the Schedule', href: '/schedule-dispatch' })
    if (d.noPrice) doors.unshift({ label: 'Price the job', href: `/jobs?tab=stages&edit=${d.id}` })
    if (d.group === 'finished') doors.unshift({ label: 'Bill it', href: '/jobs?tab=billing' })
    const job = input.openJobs.find((j) => j.id === d.id)!
    return {
      ...rest,
      why: whyFor(rest, crewInfo, days, spanWeeks, today),
      crew: crewChip,
      doors,
      canSetPct: d.contractUsd != null,
      // The percent window's toast names the job by its number; a job with none is named by its name (`pctPrompt.ts`).
      modalJob: { id: job.id, hcpNumber: job.hcpNumber || job.jobName || job.label, jobName: job.jobName, label: job.label },
    }
  })

  // The totals: a finished job that moved counts in Moved; one that did not is Bill's and counts nowhere.
  const totals = { hours: 0, movedUsd: 0, movedJobs: 0, ateHours: 0, ateJobs: 0, stalledUsd: 0, stalledJobs: 0, finishedJobs: 0, noPctJobs }
  for (const r of rows) {
    totals.hours += r.hours
    if (r.group === 'moved' || (r.group === 'finished' && r.movedUsd > 0)) {
      totals.movedUsd += r.movedUsd
      totals.movedJobs += 1
    }
    if (r.group === 'finished') totals.finishedJobs += 1
    if (r.group === 'ate') {
      totals.ateHours += r.hours
      totals.ateJobs += 1
    }
    if (r.group === 'stalled') {
      totals.stalledUsd += r.leftUsd ?? 0
      totals.stalledJobs += 1
    }
  }

  const headline = `${hoursText(totals.hours)} went in. ${stageUsd(totals.movedUsd)} of work came out.`
  const verdictParts: string[] = []
  if (totals.ateJobs > 0) verdictParts.push(`${jobs(totals.ateJobs)} ate ${Math.round(totals.ateHours)} hours and moved nothing.`)
  if (totals.stalledJobs > 0) verdictParts.push(`${jobs(totals.stalledJobs)} ${plural(totals.stalledJobs, 'holds', 'hold')} ${stageUsd(totals.stalledUsd)} and saw nobody.`)
  if (verdictParts.length === 0) verdictParts.push('Every job with hours moved.')
  const verdict = `${verdictParts.join(' ')} That is the week.`

  const paceWords =
    input.paces && input.paces.byHoursUsd > input.paces.byPercentUsd
      ? `by hours the field builds ${stageUsd(input.paces.byHoursUsd)} a week. By the percents ${stageUsd(input.paces.byPercentUsd)}. These rows are where the missing ${stageUsd(input.paces.byHoursUsd - input.paces.byPercentUsd)} a week hides.`
      : input.outPerWeekUsd != null
        ? `the field builds ${stageUsd(input.outPerWeekUsd)} a week.`
        : 'the field has no pace to read yet.'
  const weeksWords = input.weeks != null ? ` ${input.weeks >= 100 ? Math.round(input.weeks) : input.weeks.toFixed(1)} weeks to build what is already sold at that pace.` : ''
  const subLine = `${paceWords}${weeksWords}`

  const tiles: [BuildDeskTile, BuildDeskTile, BuildDeskTile] = [
    { head: 'Moved', value: `${stageUsd(totals.movedUsd)} on ${jobs(totals.movedJobs)}`, words: 'The hours and the % agree. The pace lives here.', tone: 'green' },
    { head: 'Ate hours, moved nothing', value: `${hoursText(totals.ateHours)} on ${jobs(totals.ateJobs)}`, words: 'A stale % or work going nowhere. One look each says which.', tone: 'amber' },
    { head: 'Stalled', value: `${stageUsd(totals.stalledUsd)}, nobody on it`, words: `${jobs(totals.stalledJobs)} with no field hours in ${days} days.`, tone: 'red' },
  ]

  const movedRows = rows.filter((r) => r.group === 'moved')
  const folded = movedRows.slice(BUILD_DESK_MOVED_SHOWN)
  const foldUsd = folded.reduce((s, r) => s + r.movedUsd, 0)
  const movedFold = folded.length > 0 ? { count: folded.length, usd: foldUsd, words: `${folded.length} more ${plural(folded.length, 'job', 'jobs')} moving, ${stageUsd(foldUsd)}` } : null

  const noPctLine = noPctJobs > 0 ? `${jobs(noPctJobs)} ${plural(noPctJobs, 'has', 'have')} a contract and no %. ${plural(noPctJobs, 'It shows', 'They show')} hours here but no movement until a % exists. Set the % and ${plural(noPctJobs, 'it joins', 'they join')} the ledger.` : ''

  const footnote = [
    `Hours are each job’s closed clock sessions over the last ${days} days, the read Vectors makes.`,
    'Hours waiting on approval count, the way the top line counts them.',
    `Movement is the job’s % change over the same ${days} days, times its contract.`,
    'The % points come from job_pct_events and the reports’ answers, the same points the Build card walks.',
    'Expected hours are the earned rule’s expected hours less the hours already clocked.',
    `The crew chips read the Schedule’s blocks for the next ${crewDays} days.`,
    'A job with hours and no movement is a stale % or work going nowhere.',
    'The desk cannot tell which. One look at the job can.',
    'A job with no price shows hours but never movement.',
    'Set the % files a status report on the job, the way a crew’s does.',
    'The week’s call is recorded on the link desk above, not here.',
  ].join(' ')

  return { windowStart, todayYmd: today, days, totals, headline, verdict, subLine, tiles, rows, movedFold, noPctLine, footnote }
}
