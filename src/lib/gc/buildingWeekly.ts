/**
 * GC mode, the real build, the Building lane's U2: the weekly report to the customer, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcBuildingWeekly.ts`). The plan: to-dos/gc-mode/BUILDING_REAL_BUILD.md on that branch.
 */
// `weeklyReport` itself reads Owner Billing's late finish and waits for it (U7).
import { GC_COMPANY } from './company'
import { daysBetween, mondayOf } from './schedule/schedule'
import type { GcCustomer, GcProject, GcState } from './types'

/** The draft is ready from Friday (the owner's pick, 2026-10-05): 5 is Friday, Monday being 1. */
export const WEEKLY_REPORT_DAY = 5

export type WeeklySectionKey = 'glance' | 'schedule' | 'week' | 'inspections' | 'watching' | 'next' | 'changes'

export const WEEKLY_SECTIONS: { key: WeeklySectionKey; title: string }[] = [
  { key: 'glance', title: 'At a glance' },
  { key: 'schedule', title: 'The schedule' },
  { key: 'week', title: 'This week' },
  { key: 'inspections', title: 'Inspections' },
  { key: 'watching', title: 'What we are watching' },
  { key: 'next', title: 'Next week' },
  { key: 'changes', title: 'Changes' },
]

export interface WeeklySection {
  key: WeeklySectionKey
  title: string
  lines: string[]
}

export interface WeeklyReport {
  projectId: string
  weekOf: string
  /** The customer and the person there it goes to. */
  customer: GcCustomer | null
  to: { name: string; first: string; email: string }
  architect: { name: string; email: string } | null
  /** The sections with something to say, in order. */
  sections: WeeklySection[]
  /** Daily logs the week has, and the working days before today it has none for. */
  logs: number
  missing: string[]
  /** A short line for each section's tick box: "From 3 daily logs". */
  hints: Partial<Record<WeeklySectionKey, string>>
  /** The trades on next week's look-ahead, for the short report. */
  nextTrades: string[]
  subject: string
}

function sentence(text: string): string {
  const t = text.trim()
  return /[.!?]$/.test(t) ? t : `${t}.`
}

export interface WeeklyChoice {
  /** Me: in my name, replies come to me. The company: from Click. */
  from: 'me' | 'company'
  length: 'short' | 'full'
  /** The sections left out. */
  off: WeeklySectionKey[]
  /** A line of my own, after the opening. */
  mine: string
}

/** The report as the email says it, and as it is kept in their portal. */
export function weeklyReportText(report: WeeklyReport, project: GcProject, choice: WeeklyChoice, me: string | null): { subject: string; body: string } {
  const mine = choice.from === 'me' && me !== null
  const on = report.sections.filter((s) => !choice.off.includes(s.key))
  const parts: string[] = [mine ? `Hi ${report.to.first},` : `Hello ${report.to.first},`]
  const own = choice.mine.trim()
  parts.push(`${mine ? "Here's where" : 'Here is where'} ${project.name} stands this week.${own ? ` ${sentence(own)}` : ''}`)
  if (choice.length === 'short') {
    const glance = on.find((s) => s.key === 'glance')
    if (glance) parts.push(glance.lines.map((l) => `- ${l}`).join('\n'))
    const week = on.find((s) => s.key === 'week')
    const last = week?.lines.filter((l) => /^[A-Z][a-z]{2}: /.test(l)).pop()
    const showNext = on.some((s) => s.key === 'next') && report.nextTrades.length > 0
    const trades = report.nextTrades
    const list = trades.length === 1 ? trades[0] : `${trades.slice(0, -1).join(', ')} and ${trades[trades.length - 1]}`
    const short = [last ? `This week: ${last.slice(5)}` : '', showNext ? `Next week: ${list} ${trades.length === 1 ? 'is' : 'are'} on site.` : ''].filter(Boolean)
    if (short.length > 0) parts.push(short.join(' '))
  } else {
    for (const s of on) parts.push(`${s.title}\n${s.lines.map((l) => `- ${l}`).join('\n')}`)
  }
  parts.push(mine ? 'If anything here raises a question, reply and it comes straight to me.' : 'Reply to this email with any questions.')
  parts.push(mine ? `Thanks,\n${me}\n${GC_COMPANY.name}` : `Thank you,\n${GC_COMPANY.name}`)
  return { subject: report.subject, body: parts.join('\n\n') }
}

/** The newest report sent for a job's week. Undefined: none yet. */
export function weeklyReportSent(project: GcProject, weekOf: string) {
  return (project.weeklyReports ?? []).filter((r) => r.weekOf === weekOf).slice(-1)[0]
}

/**
 * The reports as the customer's portal shows them: the newest send for each week, newest week first.
 * Every send stays on the job, so their messages list each email they got.
 */
export function latestWeeklyReports(project: GcProject) {
  const byWeek = new Map<string, NonNullable<GcProject['weeklyReports']>[number]>()
  for (const r of project.weeklyReports ?? []) byWeek.set(r.weekOf, r)
  return [...byWeek.values()].sort((a, b) => (a.weekOf < b.weekOf ? 1 : -1))
}

/** The week's draft is ready: a job being built, Friday or later, a log this week, nothing sent for it yet. */
export function weeklyReportReady(state: GcState, project: GcProject): boolean {
  if (project.stage !== 'building' || project.closedOn) return false
  const weekOf = mondayOf(state.today)
  if (daysBetween(weekOf, state.today) < WEEKLY_REPORT_DAY - 1) return false
  if (weeklyReportSent(project, weekOf)) return false
  return (project.dailyLogs ?? []).some((l) => l.date >= weekOf && l.date <= state.today)
}
