import { describe, expect, it } from 'vitest'
import { showJobCostBreakdownTeamLabor, showJobDetailProfitSection } from './jobDetailModalRole'

describe('showJobCostBreakdownTeamLabor', () => {
  it('allows devs and master technicians', () => {
    expect(showJobCostBreakdownTeamLabor('dev')).toBe(true)
    expect(showJobCostBreakdownTeamLabor('master_technician')).toBe(true)
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
