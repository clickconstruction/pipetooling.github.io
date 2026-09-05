import { describe, expect, it } from 'vitest'
import {
  isStaffFullJobLedgerDetailRole,
  resolveJobWindowMode,
  showJobCostBreakdownTeamLabor,
  showJobDetailProfitSection,
} from './jobDetailModalRole'

describe('showJobCostBreakdownTeamLabor', () => {
  it('allows devs, master technicians, and controllers', () => {
    expect(showJobCostBreakdownTeamLabor('dev')).toBe(true)
    expect(showJobCostBreakdownTeamLabor('master_technician')).toBe(true)
    expect(showJobCostBreakdownTeamLabor('controller')).toBe(true)
  })

  it('denies every other role (wage-derivation risk)', () => {
    for (const role of ['assistant', 'primary', 'superintendent', 'estimator', 'subcontractor', null]) {
      expect(showJobCostBreakdownTeamLabor(role)).toBe(false)
    }
  })

  it('matches the profit-band gate (both protect wage-derived dollars)', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'primary', 'superintendent', null]) {
      expect(showJobCostBreakdownTeamLabor(role)).toBe(showJobDetailProfitSection(role))
    }
  })
})

describe('resolveJobWindowMode', () => {
  it('gives the tabbed Job window only to roles whose full-ledger fetch RLS admits', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'primary']) {
      expect(resolveJobWindowMode(role)).toBe('window')
    }
  })

  it('gives superintendent, estimator, and controller the read-only pane (the window self-closed for them)', () => {
    for (const role of ['superintendent', 'estimator', 'controller']) {
      expect(resolveJobWindowMode(role)).toBe('read-only')
    }
  })

  it('keeps sub-like and signed-out callers on the read-only pane', () => {
    for (const role of ['subcontractor', 'helpers', null, 'nonsense']) {
      expect(resolveJobWindowMode(role)).toBe('read-only')
    }
  })

  it('is exactly the full-ledger predicate — the window is never offered to a role whose edit-form fetch would return null', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'primary', 'superintendent', 'estimator', 'controller', 'subcontractor', 'helpers', null]) {
      expect(resolveJobWindowMode(role) === 'window').toBe(isStaffFullJobLedgerDetailRole(role))
    }
  })
})
