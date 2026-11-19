import { describe, expect, it } from 'vitest'
import { hasOfficeChecklistTabs, officeTabLandsOnToday } from './checklistTabs'

describe('Checklist’s office tabs', () => {
  it('are drawn for a dev, the owner and an assistant', () => {
    for (const role of ['dev', 'master_technician', 'assistant']) expect(hasOfficeChecklistTabs(role)).toBe(true)
  })

  it('are not drawn for the crew or a role not read yet', () => {
    for (const role of ['helpers', 'subcontractor', 'superintendent', 'estimator', null, undefined]) expect(hasOfficeChecklistTabs(role)).toBe(false)
  })

  it('send a crew person who lands on Review or Manage to Today', () => {
    expect(officeTabLandsOnToday('review', 'helpers')).toBe(true)
    expect(officeTabLandsOnToday('manage', 'subcontractor')).toBe(true)
  })

  it('leave an office role where it landed, and leave Today and History alone', () => {
    expect(officeTabLandsOnToday('review', 'master_technician')).toBe(false)
    expect(officeTabLandsOnToday('manage', 'dev')).toBe(false)
    expect(officeTabLandsOnToday('today', 'helpers')).toBe(false)
    expect(officeTabLandsOnToday('history', 'helpers')).toBe(false)
    expect(officeTabLandsOnToday(null, 'helpers')).toBe(false)
  })

  it('wait for the role before sending anyone anywhere', () => {
    expect(officeTabLandsOnToday('review', null)).toBe(false)
  })
})
