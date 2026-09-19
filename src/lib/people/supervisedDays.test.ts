import { describe, expect, it } from 'vitest'
import { buildSupervisedView, reportsSummary, sessionHours, supervisedJobLabel, type SupervisedDaysPayload } from './supervisedDays'

const TODAY = '2026-09-16'
const NOW = Date.parse('2026-09-16T20:00:00Z')

function payload(over: Partial<SupervisedDaysPayload> = {}): SupervisedDaysPayload {
  return {
    supervisor: true,
    from: '2026-09-13',
    to: '2026-09-19',
    job_days: [
      { job_id: 'oak', work_date: '2026-09-15', hcp_number: '258', click_number: null, job_name: 'Oak St', customer_name: 'Ramirez', job_address: '1408 Oak St', report_count: 1, my_report_count: 1, crew: [{ user_id: 'bryan', name: 'Bryan Ortiz', role: 'helpers' }] },
      { job_id: 'oak', work_date: '2026-09-16', hcp_number: '258', click_number: null, job_name: 'Oak St', customer_name: 'Ramirez', job_address: '1408 Oak St', report_count: 0, my_report_count: 0, crew: [{ user_id: 'bryan', name: 'Bryan Ortiz', role: 'helpers' }, { user_id: 'sam', name: 'Sam Reyes', role: 'helpers' }] },
      { job_id: 'elm', work_date: '2026-09-14', hcp_number: '291', click_number: null, job_name: null, customer_name: 'Whitfield', job_address: null, report_count: 0, my_report_count: 0, crew: [] },
      { job_id: 'elm', work_date: '2026-09-18', hcp_number: '291', click_number: null, job_name: null, customer_name: 'Whitfield', job_address: null, report_count: 0, my_report_count: 0, crew: [] }, // the future: not owed yet
    ],
    sessions: [
      { id: 's1', user_id: 'bryan', name: 'Bryan Ortiz', job_id: 'oak', work_date: '2026-09-15', clocked_in_at: '2026-09-15T12:00:00Z', clocked_out_at: '2026-09-15T20:30:00Z', notes: null, approved: true },
      { id: 's2', user_id: 'bryan', name: 'Bryan Ortiz', job_id: 'oak', work_date: '2026-09-16', clocked_in_at: '2026-09-16T12:00:00Z', clocked_out_at: null, notes: 'ran late', approved: false },
      { id: 's3', user_id: 'sam', name: 'Sam Reyes', job_id: 'oak', work_date: '2026-09-16', clocked_in_at: '2026-09-16T12:15:00Z', clocked_out_at: '2026-09-16T16:15:00Z', notes: null, approved: false },
    ],
    ...over,
  }
}

describe('supervisedJobLabel / sessionHours', () => {
  it('labels a job like the ledger, falling back to the customer', () => {
    expect(supervisedJobLabel({ hcp_number: '258', click_number: null, job_name: 'Oak St', customer_name: 'Ramirez' })).toBe('J258 · Oak St')
    expect(supervisedJobLabel({ hcp_number: '291', click_number: null, job_name: null, customer_name: 'Whitfield' })).toBe('J291 · Whitfield')
  })
  it('counts hours to the clock-out, or to now while open', () => {
    expect(sessionHours({ clocked_in_at: '2026-09-15T12:00:00Z', clocked_out_at: '2026-09-15T20:30:00Z' }, NOW)).toBe(8.5)
    expect(sessionHours({ clocked_in_at: '2026-09-16T12:00:00Z', clocked_out_at: null }, NOW)).toBe(8)
    expect(sessionHours({ clocked_in_at: '2026-09-16T12:00:00Z', clocked_out_at: '2026-09-16T11:00:00Z' }, NOW)).toBe(0)
  })
})

describe('buildSupervisedView', () => {
  it('owes a report for every supervised job-day up to today with none, newest first, and counts the filed ones', () => {
    const v = buildSupervisedView(payload(), { todayYmd: TODAY, nowMs: NOW })
    expect(v.supervisor).toBe(true)
    expect(v.jobDays).toBe(4)
    expect(v.reportsOwed.map((r) => `${r.label} ${r.workDate}${r.isToday ? ' (today)' : ''}`)).toEqual(['J258 · Oak St 2026-09-16 (today)', 'J291 · Whitfield 2026-09-14'])
    expect(v.reportsOwed[0]?.crewNames).toEqual(['Bryan Ortiz', 'Sam Reyes'])
    expect(v.reportsOwed[0]?.hcpNumber).toBe('258')
    expect(v.reportsFiled).toBe(1)
    expect(reportsSummary(v)).toBe('2 owed')
  })
  it("groups the crew's hours by person, newest day first, open sessions counted to now", () => {
    const v = buildSupervisedView(payload(), { todayYmd: TODAY, nowMs: NOW })
    expect(v.crew.map((p) => `${p.name}:${p.totalHours}`)).toEqual(['Bryan Ortiz:16.5', 'Sam Reyes:4'])
    const bryan = v.crew[0]!
    expect(bryan.role).toBe('helpers')
    expect(bryan.days.map((d) => `${d.workDate} ${d.jobLabel} ${d.hours}${d.open ? ' open' : ''}${d.approved ? ' ✓' : ''}`)).toEqual(['2026-09-16 J258 · Oak St 8 open', '2026-09-15 J258 · Oak St 8.5 ✓'])
    expect(bryan.days[0]?.notes).toBe('ran late')
  })
  it('a non-supervisor, or no payload, is an empty view', () => {
    expect(buildSupervisedView(payload({ supervisor: false }), { todayYmd: TODAY, nowMs: NOW })).toEqual({ supervisor: false, jobDays: 0, reportsOwed: [], reportsFiled: 0, crew: [] })
    expect(buildSupervisedView(null, { todayYmd: TODAY, nowMs: NOW }).supervisor).toBe(false)
  })
  it('reports summary reads all filed, or nothing when there was nothing to file', () => {
    const allFiled = buildSupervisedView(payload({ job_days: payload().job_days.map((d) => ({ ...d, report_count: 1 })) }), { todayYmd: TODAY, nowMs: NOW })
    expect(reportsSummary(allFiled)).toBe('all filed')
    expect(reportsSummary(buildSupervisedView(payload({ job_days: [] }), { todayYmd: TODAY, nowMs: NOW }))).toBeNull()
  })
})
