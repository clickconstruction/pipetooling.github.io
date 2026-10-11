/**
 * The week cards (link PR 8): what a headline bar is made of. For each pay
 * week, the arithmetic (earned less field wages), the effort (hours,
 * sessions, people, dollars an hour), the jobs that made the week, and the
 * verdict against the 8-week average; a waiting week says what it would read
 * once its hours are approved. Read from the recorded weekly grid the headline
 * already draws. Pure.
 */
import type { Headline, HeadlineWeek } from './headline'
import type { VectorGrid } from './vectorDays'

export type WeekCardJob = { label: string; usd: string; share: number }

export type WeekCard = {
  start: string
  title: string
  contribution: string
  earned: string
  wages: string
  effort: string
  jobs: WeekCardJob[]
  foot: string
  footTone: 'amber' | 'muted'
  /** For the keyboard and screen readers. */
  aria: string
}

const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const hrs = (h: number): string => `${Math.round(h)}h`
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)

export function buildWeekCards(input: { headline: Headline; recorded: VectorGrid; approved: VectorGrid; sessionsByWeek?: Map<string, number>; dateRange: (start: string, end: string) => string }): WeekCard[] {
  const { headline, recorded } = input
  const weeks = headline.weeks
  const withUsd = weeks.filter((w) => w.recordedUsd != null)
  const avg = withUsd.length ? withUsd.reduce((s, w) => s + (w.recordedUsd as number), 0) / withUsd.length : 0
  const best = withUsd.length ? Math.max(...withUsd.map((w) => w.recordedUsd as number)) : null
  return weeks.map((w) => buildOne(w, input, avg, best, recorded))
}

function buildOne(w: HeadlineWeek, input: Parameters<typeof buildWeekCards>[0], avg: number, best: number | null, recorded: VectorGrid): WeekCard {
  const i = recorded.columns.findIndex((c) => c.start === w.start)
  const bucket = i >= 0 ? recorded.company.cells[i] ?? null : null
  const people = i >= 0 ? recorded.rows.filter((r) => (r.cells[i]?.fieldHours ?? 0) > 0).length : 0
  const sessions = input.sessionsByWeek?.get(w.start) ?? null
  const earned = bucket?.earnedUsd ?? 0
  const wages = bucket?.laborUsd ?? 0
  const contribution = w.recordedUsd
  const perHour = contribution != null && w.recordedHours > 0 ? Math.round(contribution / w.recordedHours) : null
  const jobsSorted = [...(bucket?.jobs ?? [])].sort((a, b) => b.earnedUsd - a.earnedUsd)
  const top = jobsSorted.slice(0, 3)
  const rest = jobsSorted.slice(3)
  const maxJob = top[0]?.earnedUsd ?? 0
  const jobs: WeekCardJob[] = top.map((j) => ({ label: j.label, usd: shortK(j.earnedUsd), share: maxJob > 0 ? j.earnedUsd / maxJob : 0 }))
  if (rest.length) {
    const restUsd = rest.reduce((s, j) => s + j.earnedUsd, 0)
    jobs.push({ label: `${rest.length} more`, usd: shortK(restUsd), share: maxJob > 0 ? Math.min(1, restUsd / maxJob) : 0 })
  }
  const effortParts = [`${hrs(w.recordedHours)} on record`]
  if (sessions != null) effortParts.push(`${sessions} ${plural(sessions, 'session', 'sessions')}`)
  effortParts.push(`${people} ${plural(people, 'person', 'people')}`)
  if (perHour != null) effortParts.push(`$${perHour} an hour`)
  let foot: string
  let footTone: WeekCard['footTone'] = 'muted'
  if (w.waiting && w.pendingHours > 0) {
    foot = `${hrs(w.pendingHours)} waiting. Reads ${contribution == null ? '—' : shortK(contribution)} on recorded time; approved only ${w.approvedUsd == null ? '—' : shortK(w.approvedUsd)}. Approve on the schedule.`
    footTone = 'amber'
  } else if (contribution == null) {
    foot = 'No field hours on record this week.'
  } else {
    const diff = contribution - avg
    foot = `${diff >= 0 ? '+' : '−'}${shortK(Math.abs(diff))} against the ${input.headline.weeks.length}-week average of ${shortK(avg)}${best != null && contribution === best ? ' · the best of the ' + input.headline.weeks.length : ''}`
  }
  const title = `Pay week ${input.dateRange(w.start, w.end)}`
  return {
    start: w.start,
    title,
    contribution: contribution == null ? 'no contribution to read' : `${shortK(contribution)} contribution${w.current ? ' so far' : ''}`,
    earned: shortK(earned),
    wages: shortK(wages),
    effort: effortParts.join(' · '),
    jobs,
    foot,
    footTone,
    aria: `${title}: ${contribution == null ? 'no field hours' : `${shortK(contribution)} contribution on ${hrs(w.recordedHours)}`}`,
  }
}
