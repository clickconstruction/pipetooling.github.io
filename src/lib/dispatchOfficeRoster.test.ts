import { describe, expect, it } from 'vitest'
import { clampOfficeEnsureRange, isOfficeRosterEligibleRole, officeRosterTimeLabel } from './dispatchOfficeRoster'

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

describe('clampOfficeEnsureRange', () => {
  const today = '2026-09-24'

  it('skips a week that ended before today — nothing to fill', () => {
    expect(clampOfficeEnsureRange('2026-04-26', '2026-05-02', today)).toBeNull()
    expect(clampOfficeEnsureRange('2026-09-13', '2026-09-19', today)).toBeNull()
    expect(clampOfficeEnsureRange('2026-09-17', '2026-09-23', today)).toBeNull()
  })

  it('starts a week that straddles today at today', () => {
    expect(clampOfficeEnsureRange('2026-09-20', '2026-09-26', today)).toEqual({ from: '2026-09-24', to: '2026-09-26' })
  })

  it('keeps a week ending today', () => {
    expect(clampOfficeEnsureRange('2026-09-18', '2026-09-24', today)).toEqual({ from: '2026-09-24', to: '2026-09-24' })
  })

  it('leaves a current or future week alone', () => {
    expect(clampOfficeEnsureRange('2026-09-24', '2026-09-30', today)).toEqual({ from: '2026-09-24', to: '2026-09-30' })
    expect(clampOfficeEnsureRange('2026-10-04', '2026-10-10', today)).toEqual({ from: '2026-10-04', to: '2026-10-10' })
  })

  it('rejects an empty or inverted window', () => {
    expect(clampOfficeEnsureRange('', '2026-09-30', today)).toBeNull()
    expect(clampOfficeEnsureRange('2026-09-30', '2026-09-24', today)).toBeNull()
  })
})
