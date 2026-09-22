import { describe, expect, it } from 'vitest'
import {
  applyChecklistResolutions,
  buildEndEmploymentChecklist,
  buildStartEmploymentChecklist,
  checklistItemBlocker,
  checklistSummary,
  endEmploymentHrLine,
  finalPayReportPeriod,
  type EndEmploymentFacts,
  type StartEmploymentFacts,
} from './lifecycleChecklist'

function endFacts(p: Partial<EndEmploymentFacts> = {}): EndEmploymentFacts {
  return {
    endDateYmd: '2026-09-05',
    isSub: false,
    hasPayConfig: true,
    isSalary: false,
    hourlyWage: 20,
    openSession: false,
    pendingSessions: { count: 0, hours: 0 },
    lastPayReportEnd: '2026-09-05',
    subBalance: null,
    portalOn: null,
    vehiclesHeld: [],
    housing: [],
    workOrders: { offered: 0, accepted: 0 },
    missingDocs: [],
    ...p,
  }
}

describe('buildEndEmploymentChecklist', () => {
  it('a clean hourly helper finishes immediately', () => {
    const items = buildEndEmploymentChecklist(endFacts())
    const s = checklistSummary(items)
    expect(s.open).toBe(0)
    expect(s.canFinish).toBe(true)
    expect(items.map((i) => i.kind)).toEqual(['open_session', 'pending_sessions', 'final_pay_report', 'salary_schedule', 'vehicle_held', 'housing_occupied'])
    expect(items.find((i) => i.kind === 'salary_schedule')?.state).toBe('skipped')
  })

  it('Leave (v2.3700): the final report is generated here, and a salaried person waits for it before the template goes', () => {
    const items = buildEndEmploymentChecklist(endFacts({ isSalary: true, lastPayReportEnd: '2026-08-29' }))
    const report = items.find((i) => i.kind === 'final_pay_report')!
    const salary = items.find((i) => i.kind === 'salary_schedule')!
    expect(report.state).toBe('open')
    expect(report.action).toEqual({ kind: 'generate_pay_report' })
    expect(salary.state).toBe('open')
    expect(salary.action).toEqual({ kind: 'clear_salary' })
    expect(salary.canLeaveOpen).toBe(false)
    expect(checklistItemBlocker(items, salary)).toBe('final_pay_report')
    // Once the report is done the template may go.
    const after = applyChecklistResolutions(items, { final_pay_report: { state: 'done' } })
    expect(checklistItemBlocker(after, after.find((i) => i.kind === 'salary_schedule')!)).toBeNull()
    // A report already covering the end date never blocks.
    const covered = buildEndEmploymentChecklist(endFacts({ isSalary: true }))
    expect(checklistItemBlocker(covered, covered.find((i) => i.kind === 'salary_schedule')!)).toBeNull()
  })

  it('Leave (v2.3700): a pay row with no wage and not salaried has nothing to pay — the report row is skipped, not open', () => {
    const items = buildEndEmploymentChecklist(endFacts({ hourlyWage: null, lastPayReportEnd: null }))
    const report = items.find((i) => i.kind === 'final_pay_report')!
    expect(report.state).toBe('skipped')
    expect(report.action).toBeNull()
    expect(checklistSummary(items).canFinish).toBe(true)
  })

  it('Leave (v2.3700): the final report runs from the day after the last one, or from the end week\'s Sunday when there is none', () => {
    expect(finalPayReportPeriod('2026-08-29', '2026-09-05')).toEqual({ periodStart: '2026-08-30', periodEnd: '2026-09-05' })
    // 2026-09-09 is a Wednesday; its week starts Sunday 2026-09-06.
    expect(finalPayReportPeriod(null, '2026-09-09')).toEqual({ periodStart: '2026-09-06', periodEnd: '2026-09-09' })
    // A report past the end date: the same week rule (the row is done anyway).
    expect(finalPayReportPeriod('2026-09-12', '2026-09-09')).toEqual({ periodStart: '2026-09-06', periodEnd: '2026-09-09' })
  })

  it('a sub with everything open lists every item with its action and blocks the finish', () => {
    const items = buildEndEmploymentChecklist(
      endFacts({
        isSub: true,
        openSession: true,
        pendingSessions: { count: 19, hours: 109 },
        lastPayReportEnd: '2026-08-15',
        subBalance: { balance: 0, backcharges: 50, sheets: 2 },
        portalOn: true,
        vehiclesHeld: [{ possessionId: 'vp1', vehicleId: 'v1', label: '2019 Ford F-150', since: '2026-08-20' }],
        housing: [{ possessionId: 'hp1', label: '12 Elm', since: '2026-06-01' }],
        workOrders: { offered: 1, accepted: 0 },
        missingDocs: ['COI missing', 'W-9 missing'],
      }),
    )
    const byId = Object.fromEntries(items.map((i) => [i.id, i]))
    expect(byId.open_session!.state).toBe('open')
    expect(byId.open_session!.action).toEqual({ kind: 'force_clock_out' })
    expect(byId.pending_sessions!.detail).toBe('19 sessions · 109h not yet in payroll')
    expect(byId.final_pay_report!.detail).toContain('one more covers through 2026-09-05')
    expect(byId.sub_balance!.detail).toBe('$0.00 open · $50.00 in backcharges across 2 sheets')
    expect(byId.portal_on!.action).toEqual({ kind: 'revoke_portal' })
    expect(byId.portal_on!.canLeaveOpen).toBe(false)
    expect(byId['vehicle:vp1']!.action).toEqual({ kind: 'park_vehicle', possessionId: 'vp1', vehicleId: 'v1' })
    expect(byId['housing:hp1']!.action).toEqual({ kind: 'end_housing', possessionId: 'hp1' })
    expect(byId.open_work_orders!.state).toBe('open')
    expect(byId.paperwork!.detail).toBe('COI missing · W-9 missing — never received')
    expect(checklistSummary(items).canFinish).toBe(false)
    expect(checklistSummary(items).open).toBe(9)
  })

  it('skips the pay report when there is no pay config and the portal when there is no roster row', () => {
    const items = buildEndEmploymentChecklist(endFacts({ hasPayConfig: false, isSub: true, portalOn: null, subBalance: null }))
    expect(items.find((i) => i.kind === 'final_pay_report')).toBeUndefined()
    expect(items.find((i) => i.kind === 'portal_on')).toBeUndefined()
    expect(items.find((i) => i.kind === 'sub_balance')).toBeUndefined()
  })
})

describe('resolutions and summary', () => {
  it('leaving an item open with a reason unblocks the finish; a done resolution drops its action', () => {
    const items = buildEndEmploymentChecklist(endFacts({ lastPayReportEnd: null, vehiclesHeld: [{ possessionId: 'vp1', vehicleId: 'v1', label: 'Truck', since: '2026-08-20' }] }))
    expect(checklistSummary(items).canFinish).toBe(false)
    const resolved = applyChecklistResolutions(items, {
      final_pay_report: { state: 'left_open', reason: 'runs Friday' },
      'vehicle:vp1': { state: 'done' },
    })
    const s = checklistSummary(resolved)
    expect(s.canFinish).toBe(true)
    expect(s.leftOpen).toBe(1)
    expect(resolved.find((i) => i.id === 'vehicle:vp1')!.action).toBeNull()
    expect(resolved.find((i) => i.id === 'final_pay_report')!.leaveReason).toBe('runs Friday')
  })

  it('writes one factual HR line naming what was closed and what was left open', () => {
    const items = applyChecklistResolutions(
      buildEndEmploymentChecklist(endFacts({ lastPayReportEnd: null })),
      { final_pay_report: { state: 'left_open', reason: 'runs Friday' } },
    )
    expect(endEmploymentHrLine('Isiah', '2026-09-05', items)).toBe(
      'Employment ended 2026-09-05 for Isiah. Closed out: pending sessions. Left open on purpose: final pay report (runs Friday).',
    )
  })
})

describe('buildStartEmploymentChecklist', () => {
  function startFacts(p: Partial<StartEmploymentFacts> = {}): StartEmploymentFacts {
    return { hasRosterRow: true, startDate: null, hasPayConfig: false, payConfigured: false, paperworkAssigned: false, vehiclesHeld: 0, housing: 0, hasLogin: true, ...p }
  }

  it('a brand-new helper has three open items and two optional ones', () => {
    const items = buildStartEmploymentChecklist(startFacts())
    const s = checklistSummary(items)
    expect(s.open).toBe(3)
    expect(s.skipped).toBe(2)
    expect(items.find((i) => i.kind === 'employment_start')!.action).toEqual({ kind: 'set_start_date' })
    expect(items.find((i) => i.kind === 'pay_setup')!.action).toEqual({ kind: 'set_wage' })
  })

  it('without a roster row the start date cannot be set', () => {
    const items = buildStartEmploymentChecklist(startFacts({ hasRosterRow: false, hasLogin: false }))
    expect(items.find((i) => i.kind === 'employment_start')!.action).toBeNull()
    expect(items.find((i) => i.kind === 'employment_start')!.detail).toContain('roster row')
  })

  it('a configured person is all done', () => {
    const items = buildStartEmploymentChecklist(startFacts({ startDate: '2026-06-02', hasPayConfig: true, payConfigured: true, paperworkAssigned: true, vehiclesHeld: 1, housing: 1 }))
    expect(checklistSummary(items).open).toBe(0)
    expect(checklistSummary(items).done).toBe(5)
  })
})
