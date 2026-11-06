// License hours log kernel: groups one user's approved clock sessions
// (list_user_license_hours_log RPC rows) by job and company week, and builds
// the licensing-board CSV. Pure — no React, no Supabase.
//
// Hours rule matches every other surface (see scheduleDispatchJobHistory.ts):
// the RPC already filters to approved + not rejected/revoked + clocked out,
// so every row here is countable. Sessions with no job link still count
// toward the total but land in the "Unassigned / office" (or "Estimating")
// bucket so the log reconciles against payroll hours.

import { escapeCsvField } from './domTableToCsv'
import { companyWeekStartSundayContaining, ymdAddDays } from '../utils/dateUtils'

export type LicenseHoursLogRow = {
  session_id: string
  work_date: string
  clocked_in_at: string
  clocked_out_at: string
  hours: number
  job_ledger_id: string | null
  job_number: string
  job_name: string
  job_address: string
  service_type_name: string
  bid_id: string | null
  notes: string
}

export type LicenseHoursWeek = {
  weekStartYmd: string
  weekEndYmd: string
  sessionCount: number
  hours: number
}

export type LicenseHoursJobGroup = {
  /** job_ledger_id, or 'bid' / 'unassigned' bucket keys */
  jobKey: string
  jobNumber: string
  jobLabel: string
  jobAddress: string
  serviceTypeName: string
  firstWorkDateYmd: string
  lastWorkDateYmd: string
  sessionCount: number
  totalHours: number
  weeks: LicenseHoursWeek[]
}

export type LicenseHoursSummary = {
  totalHours: number
  jobHours: number
  estimatingHours: number
  unassignedHours: number
  jobCount: number
  sessionCount: number
  firstWorkDateYmd: string | null
  lastWorkDateYmd: string | null
}

export const LICENSE_LOG_BID_KEY = 'bid'
export const LICENSE_LOG_UNASSIGNED_KEY = 'unassigned'
export const LICENSE_LOG_BID_LABEL = 'Estimating (bid work)'
export const LICENSE_LOG_UNASSIGNED_LABEL = 'Unassigned / office'

function jobKeyForRow(row: LicenseHoursLogRow): string {
  if (row.job_ledger_id) return row.job_ledger_id
  if (row.bid_id) return LICENSE_LOG_BID_KEY
  return LICENSE_LOG_UNASSIGNED_KEY
}

function weekStartFor(ymd: string): string {
  return companyWeekStartSundayContaining(ymd) ?? ymd
}

export function roundHours(h: number): number {
  return Math.round(h * 100) / 100
}

/** Group rows by job (then company week inside each job). Jobs ordered by first work date; buckets last. */
export function buildLicenseHoursJobGroups(rows: LicenseHoursLogRow[]): LicenseHoursJobGroup[] {
  const byJob = new Map<string, { rows: LicenseHoursLogRow[] }>()
  for (const row of rows) {
    const key = jobKeyForRow(row)
    const entry = byJob.get(key)
    if (entry) entry.rows.push(row)
    else byJob.set(key, { rows: [row] })
  }

  const groups: LicenseHoursJobGroup[] = []
  for (const [jobKey, { rows: jobRows }] of byJob) {
    const sorted = [...jobRows].sort((a, b) => a.work_date.localeCompare(b.work_date))
    const byWeek = new Map<string, LicenseHoursWeek>()
    for (const row of sorted) {
      const weekStartYmd = weekStartFor(row.work_date)
      const week = byWeek.get(weekStartYmd)
      if (week) {
        week.sessionCount += 1
        week.hours += row.hours
      } else {
        byWeek.set(weekStartYmd, {
          weekStartYmd,
          weekEndYmd: ymdAddDays(weekStartYmd, 6),
          sessionCount: 1,
          hours: row.hours,
        })
      }
    }
    const weeks = [...byWeek.values()]
      .sort((a, b) => a.weekStartYmd.localeCompare(b.weekStartYmd))
      .map((w) => ({ ...w, hours: roundHours(w.hours) }))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (!first || !last) continue
    const isBid = jobKey === LICENSE_LOG_BID_KEY
    const isUnassigned = jobKey === LICENSE_LOG_UNASSIGNED_KEY
    groups.push({
      jobKey,
      jobNumber: isBid || isUnassigned ? '' : first.job_number,
      jobLabel: isBid
        ? LICENSE_LOG_BID_LABEL
        : isUnassigned
          ? LICENSE_LOG_UNASSIGNED_LABEL
          : first.job_name || first.job_number || 'Untitled job',
      jobAddress: isBid || isUnassigned ? '' : first.job_address,
      serviceTypeName: isBid || isUnassigned ? '' : first.service_type_name,
      firstWorkDateYmd: first.work_date,
      lastWorkDateYmd: last.work_date,
      sessionCount: sorted.length,
      totalHours: roundHours(sorted.reduce((s, r) => s + r.hours, 0)),
      weeks,
    })
  }

  return groups.sort((a, b) => {
    const aBucket = a.jobKey === LICENSE_LOG_BID_KEY || a.jobKey === LICENSE_LOG_UNASSIGNED_KEY
    const bBucket = b.jobKey === LICENSE_LOG_BID_KEY || b.jobKey === LICENSE_LOG_UNASSIGNED_KEY
    if (aBucket !== bBucket) return aBucket ? 1 : -1
    return a.firstWorkDateYmd.localeCompare(b.firstWorkDateYmd)
  })
}

export function buildLicenseHoursSummary(groups: LicenseHoursJobGroup[]): LicenseHoursSummary {
  let totalHours = 0
  let jobHours = 0
  let estimatingHours = 0
  let unassignedHours = 0
  let jobCount = 0
  let sessionCount = 0
  let firstWorkDateYmd: string | null = null
  let lastWorkDateYmd: string | null = null
  for (const g of groups) {
    totalHours += g.totalHours
    sessionCount += g.sessionCount
    if (g.jobKey === LICENSE_LOG_BID_KEY) estimatingHours += g.totalHours
    else if (g.jobKey === LICENSE_LOG_UNASSIGNED_KEY) unassignedHours += g.totalHours
    else {
      jobHours += g.totalHours
      jobCount += 1
    }
    if (firstWorkDateYmd === null || g.firstWorkDateYmd < firstWorkDateYmd) firstWorkDateYmd = g.firstWorkDateYmd
    if (lastWorkDateYmd === null || g.lastWorkDateYmd > lastWorkDateYmd) lastWorkDateYmd = g.lastWorkDateYmd
  }
  return {
    totalHours: roundHours(totalHours),
    jobHours: roundHours(jobHours),
    estimatingHours: roundHours(estimatingHours),
    unassignedHours: roundHours(unassignedHours),
    jobCount,
    sessionCount,
    firstWorkDateYmd,
    lastWorkDateYmd,
  }
}

export type LicenseHoursCsvHeader = {
  personName: string
  registrationNumber: string
  employerName: string
  supervisingLicensee: string
  generatedOnYmd: string
  periodStartYmd: string | null
  periodEndYmd: string | null
}

/**
 * Licensing-board CSV: a certification-style header block, then one detail row
 * per job × company week (buckets included), then a reconciling total row.
 */
export function buildLicenseHoursCsv(
  header: LicenseHoursCsvHeader,
  groups: LicenseHoursJobGroup[],
  summary: LicenseHoursSummary,
): string {
  const lines: string[] = []
  const put = (...cells: (string | number)[]) => {
    lines.push(cells.map((c) => escapeCsvField(String(c))).join(','))
  }

  put('Employee', header.personName)
  put('Registration / license #', header.registrationNumber || '')
  put('Employer', header.employerName || '')
  put('Supervising licensee', header.supervisingLicensee || '')
  const periodLabel =
    header.periodStartYmd || header.periodEndYmd
      ? `${header.periodStartYmd ?? 'start'} to ${header.periodEndYmd ?? header.generatedOnYmd}`
      : `all recorded time (through ${header.generatedOnYmd})`
  put('Period', periodLabel)
  put('First work date', summary.firstWorkDateYmd ?? '')
  put('Last work date', summary.lastWorkDateYmd ?? '')
  put('Total hours', summary.totalHours.toFixed(2))
  put('Hours on jobs', summary.jobHours.toFixed(2))
  if (summary.estimatingHours > 0) put(LICENSE_LOG_BID_LABEL + ' hours', summary.estimatingHours.toFixed(2))
  if (summary.unassignedHours > 0) put(LICENSE_LOG_UNASSIGNED_LABEL + ' hours', summary.unassignedHours.toFixed(2))
  put('Generated on', header.generatedOnYmd)
  lines.push('')

  put('Week start', 'Week end', 'Job #', 'Job name', 'Job address', 'Service type', 'Sessions', 'Hours')
  type FlatRow = { week: LicenseHoursWeek; group: LicenseHoursJobGroup }
  const flat: FlatRow[] = []
  for (const group of groups) for (const week of group.weeks) flat.push({ week, group })
  flat.sort(
    (a, b) =>
      a.week.weekStartYmd.localeCompare(b.week.weekStartYmd) || a.group.jobLabel.localeCompare(b.group.jobLabel),
  )
  for (const { week, group } of flat) {
    put(
      week.weekStartYmd,
      week.weekEndYmd,
      group.jobNumber,
      group.jobLabel,
      group.jobAddress,
      group.serviceTypeName,
      week.sessionCount,
      week.hours.toFixed(2),
    )
  }
  put('Total', '', '', '', '', '', summary.sessionCount, summary.totalHours.toFixed(2))

  return lines.join('\n')
}
