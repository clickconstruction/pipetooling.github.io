import { describe, expect, it } from 'vitest'
import {
  bidJobLinkLabel,
  canCreateJobFromBid,
  jobCreatedTelemetryTarget,
  secondConversionMessage,
  wonMomentActions,
} from './wonMomentActions'

describe('wonMomentActions (Tier-1 #8)', () => {
  it('office roles and the estimator get "Open the job" when no job exists yet', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) {
      expect(wonMomentActions({ hasJob: false, role })).toEqual([{ key: 'create', label: 'Open the job', primary: true }])
    }
  })
  it('a job already exists: roles that can open Jobs get open + create-another; the estimator only create-another', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
      expect(wonMomentActions({ hasJob: true, role }).map((a) => a.key)).toEqual(['open_existing', 'create_another'])
      expect(wonMomentActions({ hasJob: true, role }).find((a) => a.key === 'open_existing')?.primary).toBe(true)
      expect(wonMomentActions({ hasJob: true, role }).find((a) => a.key === 'create_another')?.primary).toBe(false)
    }
    expect(wonMomentActions({ hasJob: true, role: 'estimator' })).toEqual([{ key: 'create_another', label: 'Create another job', primary: false }])
  })
  it('the read-only board roles get nothing', () => {
    for (const role of ['superintendent', 'subcontractor', 'helpers', 'primary', null, undefined, '']) {
      expect(wonMomentActions({ hasJob: false, role })).toEqual([])
      expect(wonMomentActions({ hasJob: true, role })).toEqual([])
    }
  })
  it('canCreateJobs overrides the role rule both ways', () => {
    expect(wonMomentActions({ hasJob: false, role: 'superintendent', canCreateJobs: true }).map((a) => a.key)).toEqual(['create'])
    expect(wonMomentActions({ hasJob: false, role: 'dev', canCreateJobs: false })).toEqual([])
  })
  it('canCreateJobFromBid mirrors the create set', () => {
    expect(canCreateJobFromBid('estimator')).toBe(true)
    expect(canCreateJobFromBid('superintendent')).toBe(false)
    expect(canCreateJobFromBid(null)).toBe(false)
  })
})

describe('bidJobLinkLabel', () => {
  it('reads "J1007 opened from this bid"', () => {
    expect(bidJobLinkLabel({ hcpNumber: '1007' })).toBe('J1007 opened from this bid')
    expect(bidJobLinkLabel({ hcpNumber: 'J1007' })).toBe('J1007 opened from this bid')
  })
  it('says so when there is no job', () => {
    expect(bidJobLinkLabel(null)).toBe('No job yet from this bid')
    expect(bidJobLinkLabel(undefined)).toBe('No job yet from this bid')
  })
})

describe('secondConversionMessage', () => {
  it('names the existing job and the bid', () => {
    expect(secondConversionMessage([{ hcpNumber: '1007' }], 'B398')).toBe(
      'J1007 was already opened from B398. Open it from the bid\'s Job block, or create another job here.',
    )
  })
  it('lists several', () => {
    expect(secondConversionMessage([{ hcpNumber: '1007' }, { hcpNumber: '1008' }], 'B398')).toMatch(/^J1007, J1008 were already opened from B398\./)
  })
})

describe('jobCreatedTelemetryTarget', () => {
  it('bid wins, then project, then blank', () => {
    expect(jobCreatedTelemetryTarget({ bidId: 'b1', projectId: 'p1' })).toBe('source:bid:b1')
    expect(jobCreatedTelemetryTarget({ bidId: '  ', projectId: 'p1' })).toBe('source:project')
    expect(jobCreatedTelemetryTarget({ bidId: null, projectId: null })).toBe('source:blank')
  })
})
