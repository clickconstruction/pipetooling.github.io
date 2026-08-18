import { describe, expect, it } from 'vitest'
import { isOfficeRosterEligibleRole, officeRosterTimeLabel } from './dispatchOfficeRoster'

describe('isOfficeRosterEligibleRole', () => {
  it('offers assistants, controllers, and estimators', () => {
    expect(isOfficeRosterEligibleRole('assistant')).toBe(true)
    expect(isOfficeRosterEligibleRole('controller')).toBe(true)
    expect(isOfficeRosterEligibleRole('estimator')).toBe(true)
  })

  it('excludes field and admin roles', () => {
    for (const r of ['subcontractor', 'helpers', 'master_technician', 'dev', 'primary', 'superintendent', null, undefined]) {
      expect(isOfficeRosterEligibleRole(r)).toBe(false)
    }
  })
})

describe('officeRosterTimeLabel', () => {
  it('formats Postgres time strings as 12-hour labels', () => {
    expect(officeRosterTimeLabel('08:00:00')).toBe('8:00 AM')
    expect(officeRosterTimeLabel('16:00:00')).toBe('4:00 PM')
    expect(officeRosterTimeLabel('12:30')).toBe('12:30 PM')
    expect(officeRosterTimeLabel('00:15:00')).toBe('12:15 AM')
  })

  it('passes through anything unparseable', () => {
    expect(officeRosterTimeLabel('noon')).toBe('noon')
  })
})
