/**
 * Punch list #205, row 1 (PR 2): the job head at the top of a trade partner's job page. JobTread opens a sub's job on its
 * dates, a progress bar and the GC's contacts; ours had the same facts in three places and the job's dates nowhere. The
 * head reads the start (the day we pressed Start, else the planned start), the day we plan to finish (the function's
 * `finish`, from the same schedule read as the chart) and the days left, and one bar from the company's own signed
 * statements of work, each line weighted by its amount. The company's own percent names only its own pace; the whole
 * job's would name the other trades', which the schedule never leaks (the card's trade-off). Pure: the page words it.
 */
import type { GcProject } from './types'
import { daysUntil } from './words'

/** One line of the company's own work on the job, with the percent it reported. */
export interface JobHeadLine {
  id: string
  label: string
  pct: number
  amount: number
}

export interface JobHead {
  /** The day we pressed Start, else the planned start. Null: neither is set. */
  started: string | null
  /** `started` is the planned start, not the day we pressed Start. */
  startedIsPlan: boolean
  /** The day we plan to finish, as the function sent it. Null: no schedule, or an older function. */
  finish: string | null
  /** Days from today to the planned finish, negative once past it. Null: no finish. */
  daysLeft: number | null
  /** The company's own percent done, its lines weighted by their amount. 0 with no signed lines. */
  pct: number
  /** The dollars of its own work done and in all, from the percents it reported. */
  done: number
  total: number
  lines: JobHeadLine[]
}

/** The head shows on a job being built where a trade is awarded to the company through one of its own invites. */
export function jobHeadShown(project: GcProject, partnerId: string): boolean {
  return project.stage === 'building' && project.packages.some((pkg) => pkg.invites.some((i) => i.id === pkg.awardedInviteId && i.partnerId === partnerId))
}

/** The head's facts for one company on one job. `finish` is the function's planned finish, or none. */
export function jobHead(project: GcProject, partnerId: string, today: string, finish: string | null | undefined): JobHead {
  const mine = project.packages.filter((pkg) => pkg.invites.some((i) => i.id === pkg.awardedInviteId && i.partnerId === partnerId))
  const lines: JobHeadLine[] = mine.flatMap((pkg) =>
    pkg.sow && pkg.sow.status === 'signed' ? pkg.sow.sov.map((l) => ({ id: l.id, label: l.label, pct: Math.max(0, Math.min(100, l.pctReported)), amount: Math.max(0, l.amount) })) : [],
  )
  const total = lines.reduce((sum, l) => sum + l.amount, 0)
  const done = lines.reduce((sum, l) => sum + (l.amount * l.pct) / 100, 0)
  const planned = finish ?? null
  return {
    started: project.startedOn ?? project.startDate ?? null,
    startedIsPlan: !project.startedOn,
    finish: planned,
    daysLeft: planned ? daysUntil(planned, today) : null,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
    done: Math.round(done),
    total: Math.round(total),
    lines,
  }
}
