import type { JobScheduleBlockRow } from './jobScheduleBlocks'
import { scheduleFormatWindow } from './jobScheduleChicago'
import { scheduleBlockToRange } from './jobScheduleOverlap'

/** Hub Expected Manpower tab value; not a calendar `YYYY-MM-DD`. */
export const HUB_EXPECTED_MANPOWER_ALL_WEEK = '__hub_expected_manpower_all_week__' as const

export type ExpectedManpowerDayRow = {
  blockId: string
  jobId: string
  /** Distinct assignee for people count (not display name). */
  assigneeUserId: string
  jobTitle: string
  personName: string
  personHours: number
  windowLabel: string
  /** For stable sort */
  timeStart: string
  /** Block `work_date` (`YYYY-MM-DD`); used for week view detail. */
  workDate: string
}

export type ExpectedManpowerJobDayGroup = {
  jobId: string
  jobTitle: string
  totalPersonHours: number
  distinctPeopleCount: number
  rows: ExpectedManpowerDayRow[]
}

export function expectedManpowerBlockPersonHours(
  block: Pick<JobScheduleBlockRow, 'time_start' | 'time_end'>,
): number {
  const { startMin, endMin } = scheduleBlockToRange(block.time_start, block.time_end)
  return Math.max(0, (endMin - startMin) / 60)
}

export function expectedManpowerWeekPersonHoursTotal(blocks: JobScheduleBlockRow[]): number {
  let sum = 0
  for (const b of blocks) {
    sum += expectedManpowerBlockPersonHours(b)
  }
  return sum
}

/** Person-hours for blocks whose `work_date` is in `dayKeys` (e.g. visible hub columns only). */
export function expectedManpowerPersonHoursTotalForDayKeys(
  blocks: JobScheduleBlockRow[],
  dayKeys: readonly string[],
): number {
  if (dayKeys.length === 0) return 0
  const set = new Set(dayKeys)
  let sum = 0
  for (const b of blocks) {
    if (set.has(b.work_date)) sum += expectedManpowerBlockPersonHours(b)
  }
  return sum
}

export function formatExpectedManpowerPersonHours(hours: number): string {
  if (!Number.isFinite(hours) || hours === 0) return '0'
  const rounded = Math.round(hours * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function expectedManpowerRowsForDay(
  blocks: JobScheduleBlockRow[],
  dayKey: string,
  resolveJobTitle: (jobId: string) => string,
  resolvePersonName: (userId: string) => string,
): ExpectedManpowerDayRow[] {
  const rows: ExpectedManpowerDayRow[] = []
  for (const b of blocks) {
    if (b.work_date !== dayKey) continue
    rows.push({
      blockId: b.id,
      jobId: b.job_id,
      assigneeUserId: b.assignee_user_id,
      jobTitle: resolveJobTitle(b.job_id),
      personName: resolvePersonName(b.assignee_user_id),
      personHours: expectedManpowerBlockPersonHours(b),
      windowLabel: scheduleFormatWindow(b.time_start, b.time_end),
      timeStart: b.time_start,
      workDate: b.work_date,
    })
  }
  rows.sort((a, b) => {
    const j = a.jobTitle.localeCompare(b.jobTitle, undefined, { sensitivity: 'base' })
    if (j !== 0) return j
    const wd = a.workDate.localeCompare(b.workDate)
    if (wd !== 0) return wd
    return a.timeStart.localeCompare(b.timeStart)
  })
  return rows
}

export function expectedManpowerRowsForVisibleDays(
  blocks: JobScheduleBlockRow[],
  dayKeys: readonly string[],
  resolveJobTitle: (jobId: string) => string,
  resolvePersonName: (userId: string) => string,
): ExpectedManpowerDayRow[] {
  if (dayKeys.length === 0) return []
  const set = new Set(dayKeys)
  const rows: ExpectedManpowerDayRow[] = []
  for (const b of blocks) {
    if (!set.has(b.work_date)) continue
    rows.push({
      blockId: b.id,
      jobId: b.job_id,
      assigneeUserId: b.assignee_user_id,
      jobTitle: resolveJobTitle(b.job_id),
      personName: resolvePersonName(b.assignee_user_id),
      personHours: expectedManpowerBlockPersonHours(b),
      windowLabel: scheduleFormatWindow(b.time_start, b.time_end),
      timeStart: b.time_start,
      workDate: b.work_date,
    })
  }
  rows.sort((a, b) => {
    const j = a.jobTitle.localeCompare(b.jobTitle, undefined, { sensitivity: 'base' })
    if (j !== 0) return j
    const wd = a.workDate.localeCompare(b.workDate)
    if (wd !== 0) return wd
    return a.timeStart.localeCompare(b.timeStart)
  })
  return rows
}

/** Roll up flat day rows by job: sort groups by total person-hours desc, then title. */
export function expectedManpowerJobGroupsForDay(rows: ExpectedManpowerDayRow[]): ExpectedManpowerJobDayGroup[] {
  const byJob = new Map<string, ExpectedManpowerDayRow[]>()
  for (const r of rows) {
    const list = byJob.get(r.jobId)
    if (list) list.push(r)
    else byJob.set(r.jobId, [r])
  }
  const groups: ExpectedManpowerJobDayGroup[] = []
  for (const [, groupRows] of byJob) {
    const sortedRows = [...groupRows].sort((a, b) => {
      const d = a.workDate.localeCompare(b.workDate)
      if (d !== 0) return d
      const t = a.timeStart.localeCompare(b.timeStart)
      if (t !== 0) return t
      return a.personName.localeCompare(b.personName, undefined, { sensitivity: 'base' })
    })
    const assignees = new Set(sortedRows.map((x) => x.assigneeUserId))
    let total = 0
    for (const x of sortedRows) total += x.personHours
    groups.push({
      jobId: sortedRows[0]?.jobId ?? '',
      jobTitle: sortedRows[0]?.jobTitle ?? '',
      totalPersonHours: total,
      distinctPeopleCount: assignees.size,
      rows: sortedRows,
    })
  }
  groups.sort((a, b) => {
    if (b.totalPersonHours !== a.totalPersonHours) return b.totalPersonHours - a.totalPersonHours
    return a.jobTitle.localeCompare(b.jobTitle, undefined, { sensitivity: 'base' })
  })
  return groups
}

/** Sum of personHours × hourlyWage for each assignee leg (wage 0 if unknown). */
export function expectedManpowerJobGroupPayrollEstimate(
  rows: ExpectedManpowerDayRow[],
  hourlyWageForUserId: (assigneeUserId: string) => number,
): number {
  let sum = 0
  for (const r of rows) {
    const rate = hourlyWageForUserId(r.assigneeUserId)
    if (!Number.isFinite(rate) || !Number.isFinite(r.personHours)) continue
    sum += r.personHours * rate
  }
  return sum
}
