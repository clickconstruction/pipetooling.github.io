import { describe, expect, it } from 'vitest'
import {
  LICENSE_LOG_BID_KEY,
  LICENSE_LOG_BID_LABEL,
  LICENSE_LOG_UNASSIGNED_KEY,
  LICENSE_LOG_UNASSIGNED_LABEL,
  buildLicenseHoursCsv,
  buildLicenseHoursJobGroups,
  buildLicenseHoursSummary,
  roundHours,
  type LicenseHoursLogRow,
} from './licenseHoursLog'

function row(overrides: Partial<LicenseHoursLogRow>): LicenseHoursLogRow {
  return {
    session_id: 's1',
    work_date: '2026-03-09',
    clocked_in_at: '2026-03-09T13:00:00Z',
    clocked_out_at: '2026-03-09T21:00:00Z',
    hours: 8,
    job_ledger_id: 'job-a',
    job_number: '12345',
    job_name: 'Smith repipe',
    job_address: '12 Main St',
    service_type_name: 'Plumbing',
    bid_id: null,
    notes: 'installed drains',
    ...overrides,
  }
}

describe('buildLicenseHoursJobGroups', () => {
  it('groups sessions by job, then company week (Sunday start) inside each job', () => {
    const rows = [
      // 2026-03-09 is a Monday → week starts Sunday 2026-03-08
      row({ session_id: 's1', work_date: '2026-03-09', hours: 8 }),
      row({ session_id: 's2', work_date: '2026-03-10', hours: 4.5 }),
      // next week, same job
      row({ session_id: 's3', work_date: '2026-03-16', hours: 6 }),
      // different job, same first week
      row({ session_id: 's4', work_date: '2026-03-11', hours: 3, job_ledger_id: 'job-b', job_name: 'Jones remodel', job_number: 'C77' }),
    ]
    const groups = buildLicenseHoursJobGroups(rows)
    expect(groups.map((g) => g.jobKey)).toEqual(['job-a', 'job-b'])

    const jobA = groups[0]
    if (!jobA) throw new Error('expected job-a group')
    expect(jobA.totalHours).toBe(18.5)
    expect(jobA.sessionCount).toBe(3)
    expect(jobA.firstWorkDateYmd).toBe('2026-03-09')
    expect(jobA.lastWorkDateYmd).toBe('2026-03-16')
    expect(jobA.weeks).toHaveLength(2)
    expect(jobA.weeks[0]).toMatchObject({ weekStartYmd: '2026-03-08', weekEndYmd: '2026-03-14', sessionCount: 2, hours: 12.5 })
    expect(jobA.weeks[1]).toMatchObject({ weekStartYmd: '2026-03-15', weekEndYmd: '2026-03-21', sessionCount: 1, hours: 6 })

    expect(groups[1]).toMatchObject({ jobLabel: 'Jones remodel', jobNumber: 'C77', totalHours: 3 })
  })

  it('routes bid sessions and unlinked sessions into buckets, ordered after real jobs', () => {
    const rows = [
      row({ session_id: 's1', work_date: '2026-01-05', job_ledger_id: null, bid_id: 'bid-1', job_number: '', job_name: '', job_address: '', service_type_name: '', hours: 2 }),
      row({ session_id: 's2', work_date: '2026-01-06', job_ledger_id: null, bid_id: null, job_number: '', job_name: '', job_address: '', service_type_name: '', hours: 1 }),
      row({ session_id: 's3', work_date: '2026-06-01', hours: 8 }),
    ]
    const groups = buildLicenseHoursJobGroups(rows)
    expect(groups.map((g) => g.jobKey)).toEqual(['job-a', LICENSE_LOG_BID_KEY, LICENSE_LOG_UNASSIGNED_KEY])
    expect(groups[1]?.jobLabel).toBe(LICENSE_LOG_BID_LABEL)
    expect(groups[2]?.jobLabel).toBe(LICENSE_LOG_UNASSIGNED_LABEL)
    expect(groups[1]?.jobNumber).toBe('')
    expect(groups[1]?.jobAddress).toBe('')
  })

  it('orders real jobs by first work date and falls back to job number for untitled jobs', () => {
    const rows = [
      row({ session_id: 's1', work_date: '2026-05-01', job_ledger_id: 'job-late' }),
      row({ session_id: 's2', work_date: '2026-02-01', job_ledger_id: 'job-early', job_name: '', job_number: 'C9' }),
    ]
    const groups = buildLicenseHoursJobGroups(rows)
    expect(groups.map((g) => g.jobKey)).toEqual(['job-early', 'job-late'])
    expect(groups[0]?.jobLabel).toBe('C9')
  })

  it('returns empty for no rows', () => {
    expect(buildLicenseHoursJobGroups([])).toEqual([])
  })
})

describe('buildLicenseHoursSummary', () => {
  it('reconciles: job + estimating + unassigned hours sum to total; jobCount excludes buckets', () => {
    const rows = [
      row({ session_id: 's1', work_date: '2026-03-09', hours: 8 }),
      row({ session_id: 's2', work_date: '2026-03-10', hours: 4, job_ledger_id: 'job-b' }),
      row({ session_id: 's3', work_date: '2026-03-11', hours: 2, job_ledger_id: null, bid_id: 'bid-1' }),
      row({ session_id: 's4', work_date: '2026-03-12', hours: 1.25, job_ledger_id: null, bid_id: null }),
    ]
    const summary = buildLicenseHoursSummary(buildLicenseHoursJobGroups(rows))
    expect(summary.totalHours).toBe(15.25)
    expect(summary.jobHours).toBe(12)
    expect(summary.estimatingHours).toBe(2)
    expect(summary.unassignedHours).toBe(1.25)
    expect(summary.jobCount).toBe(2)
    expect(summary.sessionCount).toBe(4)
    expect(summary.firstWorkDateYmd).toBe('2026-03-09')
    expect(summary.lastWorkDateYmd).toBe('2026-03-12')
  })

  it('handles empty groups', () => {
    const summary = buildLicenseHoursSummary([])
    expect(summary.totalHours).toBe(0)
    expect(summary.firstWorkDateYmd).toBeNull()
    expect(summary.lastWorkDateYmd).toBeNull()
  })
})

describe('buildLicenseHoursCsv', () => {
  const header = {
    personName: 'Alex Doe',
    registrationNumber: 'AP-1234',
    employerName: 'Click Construction, "Plumbing" Division',
    supervisingLicensee: 'R. Douglas, M-40000',
    generatedOnYmd: '2026-07-19',
    periodStartYmd: null,
    periodEndYmd: null,
  }

  it('emits header block, detail rows sorted by week then job, and a reconciling total row', () => {
    const rows = [
      row({ session_id: 's1', work_date: '2026-03-09', hours: 8 }),
      row({ session_id: 's2', work_date: '2026-03-16', hours: 6 }),
      row({ session_id: 's3', work_date: '2026-03-10', hours: 3, job_ledger_id: 'job-b', job_name: 'Jones remodel', job_number: 'C77' }),
    ]
    const groups = buildLicenseHoursJobGroups(rows)
    const csv = buildLicenseHoursCsv(header, groups, buildLicenseHoursSummary(groups))
    const lines = csv.split('\n')

    expect(lines[0]).toBe('Employee,Alex Doe')
    expect(lines[1]).toBe('Registration / license #,AP-1234')
    // quotes escaped RFC-4180 style
    expect(lines[2]).toBe('Employer,"Click Construction, ""Plumbing"" Division"')
    expect(csv).toContain('Period,all recorded time (through 2026-07-19)')
    expect(csv).toContain('Total hours,17.00')
    expect(csv).toContain('Hours on jobs,17.00')
    // no bucket lines when buckets are empty
    expect(csv).not.toContain(LICENSE_LOG_UNASSIGNED_LABEL)

    const headerRowIdx = lines.findIndex((l) => l.startsWith('Week start,'))
    expect(headerRowIdx).toBeGreaterThan(0)
    // same week: both jobs, alphabetical by label (Jones remodel < Smith repipe)
    expect(lines[headerRowIdx + 1]).toBe('2026-03-08,2026-03-14,C77,Jones remodel,12 Main St,Plumbing,1,3.00')
    expect(lines[headerRowIdx + 2]).toBe('2026-03-08,2026-03-14,12345,Smith repipe,12 Main St,Plumbing,1,8.00')
    expect(lines[headerRowIdx + 3]).toBe('2026-03-15,2026-03-21,12345,Smith repipe,12 Main St,Plumbing,1,6.00')
    expect(lines[lines.length - 1]).toBe('Total,,,,,,3,17.00')
  })

  it('labels an explicit period and includes bucket hours lines when present', () => {
    const rows = [row({ job_ledger_id: null, bid_id: null, hours: 2 })]
    const groups = buildLicenseHoursJobGroups(rows)
    const csv = buildLicenseHoursCsv(
      { ...header, periodStartYmd: '2026-01-01', periodEndYmd: '2026-06-30' },
      groups,
      buildLicenseHoursSummary(groups),
    )
    expect(csv).toContain('Period,2026-01-01 to 2026-06-30')
    expect(csv).toContain(`${LICENSE_LOG_UNASSIGNED_LABEL} hours,2.00`)
  })
})

describe('roundHours', () => {
  it('rounds to 2 decimals', () => {
    expect(roundHours(8.004999)).toBe(8)
    expect(roundHours(4.505)).toBe(4.51)
  })
})
