import { describe, expect, it } from 'vitest'
import { ACTIVITY_FILTERS, visibleActivityFilters } from '../jobActivityFilter'
import { activityChipQuestions, activityFilterAccessForRole, settleActivityFilterAccess } from './jobActivityChipAccess'

const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'estimator', 'helpers', 'subcontractor'] as const

describe('activityFilterAccessForRole', () => {
  it('opens both chips to the office and to no one else on the role alone', () => {
    const open = ROLES.filter((r) => {
      const a = activityFilterAccessForRole(r)
      return a.canSeeBilling && a.canSeeReports
    })
    expect(open).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
    for (const r of ['primary', 'superintendent', 'estimator', 'helpers', 'subcontractor', null, undefined, 'nobody']) {
      expect(activityFilterAccessForRole(r)).toEqual({ canSeeBilling: false, canSeeReports: false })
    }
  })
})

describe('activityChipQuestions', () => {
  it('asks nothing for the office or the field roles', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'helpers', 'subcontractor', null]) {
      expect(activityChipQuestions(r, 'job-1')).toEqual([])
    }
  })

  it('asks a primary the money half of the activity gate and the reports rule of their own', () => {
    expect(activityChipQuestions('primary', 'job-1')).toEqual([
      { chip: 'billing', rpc: 'can_read_job_activity', args: { p_job_id: 'job-1', p_financial: true } },
      { chip: 'reports', rpc: 'primary_can_read_job_reports', args: { p_job_id: 'job-1' } },
    ])
  })

  it('asks a superintendent the reports anchor only, never the money', () => {
    expect(activityChipQuestions('superintendent', 'job-1')).toEqual([
      { chip: 'reports', rpc: 'superintendent_report_job_anchor_allowed', args: { p_job_ledger_id: 'job-1' } },
    ])
  })
})

describe('settleActivityFilterAccess', () => {
  it('keeps the office open whatever came back', () => {
    expect(settleActivityFilterAccess('assistant', {})).toEqual({ canSeeBilling: true, canSeeReports: true })
    expect(settleActivityFilterAccess('dev', { billing: false, reports: false })).toEqual({ canSeeBilling: true, canSeeReports: true })
  })

  it('opens a chip on a plain true and on nothing else', () => {
    expect(settleActivityFilterAccess('primary', { billing: true, reports: false })).toEqual({ canSeeBilling: true, canSeeReports: false })
    expect(settleActivityFilterAccess('primary', { billing: null, reports: undefined })).toEqual({ canSeeBilling: false, canSeeReports: false })
    expect(settleActivityFilterAccess('superintendent', { reports: true })).toEqual({ canSeeBilling: false, canSeeReports: true })
    expect(settleActivityFilterAccess('helpers', {})).toEqual({ canSeeBilling: false, canSeeReports: false })
  })
})

describe('the chips each role is drawn', () => {
  const chips = (role: string, answers: Parameters<typeof settleActivityFilterAccess>[1] = {}, counts: Record<string, number> = {}) =>
    visibleActivityFilters(ACTIVITY_FILTERS, settleActivityFilterAccess(role, answers), counts).map((f) => f.label)

  it('a field hand: All, Notes, Status, Crew', () => {
    for (const r of ['helpers', 'subcontractor', 'estimator']) {
      expect(chips(r)).toEqual(['All', 'Notes', 'Status', 'Crew'])
    }
  })

  it('the office: all six, with nothing under any of them', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) {
      expect(chips(r)).toEqual(['All', 'Notes', 'Reports', 'Status', 'Billing', 'Crew'])
    }
  })

  it('a helper who left a report on the job is drawn Reports, with its count', () => {
    expect(chips('helpers', {}, { reports: 1 })).toEqual(['All', 'Notes', 'Reports', 'Status', 'Crew'])
  })

  it('a primary on a job that is theirs, and on one that is not', () => {
    expect(chips('primary', { billing: true, reports: true })).toEqual(['All', 'Notes', 'Reports', 'Status', 'Billing', 'Crew'])
    expect(chips('primary', { billing: false, reports: false })).toEqual(['All', 'Notes', 'Status', 'Crew'])
  })

  it('a superintendent on their project: Reports, never Billing', () => {
    expect(chips('superintendent', { reports: true })).toEqual(['All', 'Notes', 'Reports', 'Status', 'Crew'])
  })
})
