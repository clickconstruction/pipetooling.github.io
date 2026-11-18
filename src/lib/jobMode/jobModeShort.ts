import { shortPageFor, type DashboardView } from '../dashboard/shortDashboard'
import { scheduleFormatTimeHm } from '../jobScheduleChicago'

/**
 * Job Mode, short (punch list #384). A superintendent's Job Mode page ran to about six phone screens, and he
 * used the first. The short page keeps that first screen and puts everything else one press away: the job
 * card's top, **Open this job**, the pace line, **Waiting on you**, **Tomorrow** in one line and one door,
 * **Everything else**.
 *
 * It rides the Dashboard view (`users.dashboard_view`): the office sets one person to Short, and nobody else's
 * page changes. This file is the rule and every word on the page. Pure: a view, a role and blocks in, words out.
 */

/**
 * Whether the short Job Mode page is drawn: the person's view is Short, Job Mode is on, and the role's short
 * page with Job Mode on is this one (`shortPageFor`: a superintendent, never a leader or a dev).
 */
export function jobModeShortOn(input: { view: DashboardView; role: string | null | undefined; jobModeOn: boolean }): boolean {
  return input.view === 'short' && input.jobModeOn && shortPageFor(input.role, true) === 'job_mode'
}

/** One stop of the next day: when it starts (a Postgres time) and what it is called on My Schedule. */
export type JobModeShortStop = { timeStart: string; label: string }

/** My Schedule's label is "number · name". On a line of prose the dot is read as a break, so it becomes a space. */
function plainLabel(label: string): string {
  return label.replace(/\s*·\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Whether tomorrow's blocks are in: the line never says *No stops yet* while the schedule is still being read. */
export type JobModeShortScheduleRead = 'ready' | 'reading' | 'failed'

/**
 * Tomorrow in one line: how many stops and when the first is. With no stop it says so, and the press still
 * opens the Schedule tab, where a stop the office adds later will show. While the schedule is being read, or
 * after its read failed, the line says that and counts nothing.
 */
export function jobModeShortTomorrow(stops: ReadonlyArray<JobModeShortStop>, read: JobModeShortScheduleRead = 'ready'): { title: string; note: string } {
  const w = JOB_MODE_SHORT_WORDS.tomorrow
  if (read === 'reading') return { title: w.title, note: w.reading }
  if (read === 'failed') return { title: w.title, note: w.failed }
  if (stops.length === 0) return { title: w.title, note: w.none }
  const first = [...stops].sort((a, b) => a.timeStart.localeCompare(b.timeStart))[0]!
  const count = stops.length === 1 ? '1 stop.' : `${stops.length} stops.`
  const name = plainLabel(first.label)
  return { title: w.title, note: `${count} First at ${scheduleFormatTimeHm(first.timeStart)}${name ? `, ${name}` : ''}.` }
}

/** The schedule's read, from what the Dashboard's schedule hook reports. A day kept on the phone counts as in. */
export function jobModeShortScheduleRead(input: { loading: boolean; failed: boolean; kept: boolean }): JobModeShortScheduleRead {
  if (input.kept) return 'ready'
  if (input.failed) return 'failed'
  return input.loading ? 'reading' : 'ready'
}

export const JOB_MODE_SHORT_WORDS = {
  /** The row that opens what the card's lower half holds. Folded, it says what is inside. */
  openJob: {
    title: 'Open this job',
    note: 'Customer, photos, notes, checklists and materials.',
    openTitle: 'This job',
    openNote: 'Tap to fold it away.',
  },
  /** The pace line: the headline is the project's own, from `projectPace`. This is the press under it. */
  pace: { open: 'Tap for the pace card.', fold: 'Fold the pace card' },
  /** Your record, moved up under the card. */
  waiting: 'Waiting on you',
  tomorrow: { title: 'Tomorrow', none: 'No stops yet. Tap for your schedule.', reading: 'Reading your schedule.', failed: 'Your schedule could not be read. Tap to open it.' },
  door: 'Everything else',
  /** The door's second line: what is behind it, and how many courses are owed. */
  doorNote: (coursesOwed: number): string => {
    const behind = 'Your hours, your schedule, training and the full Dashboard.'
    if (coursesOwed <= 0) return behind
    return `${behind} ${coursesOwed === 1 ? '1 course to do.' : `${coursesOwed} courses to do.`}`
  },
  /** On top of the full Dashboard, for a person who came through the door. */
  back: 'Back to the short page',
} as const
