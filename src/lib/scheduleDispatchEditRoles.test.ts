import { describe, expect, it } from 'vitest'
import {
  CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES,
  CAN_VIEW_SCHEDULE_DISPATCH_ROLES,
  CAN_WRITE_SCHEDULE_TIME_OFF_ROLES,
  canWriteTimeOff,
} from './scheduleDispatchEditRoles'

/**
 * `canWriteTimeOff` mirrors the gate inside the `pay_staff_bulk_insert_user_time_off` RPC
 * (baseline `20250101000000_baseline.sql`):
 *   is_dev() OR is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()
 * `is_assistant()` is assistant-LIKE (assistant + controller, v2.662). Superintendent is refused.
 */
describe('canWriteTimeOff — mirrors the pay_staff_bulk_insert_user_time_off gate', () => {
  it.each([
    ['dev', true],
    ['master_technician', true],
    ['assistant', true],
    ['controller', true],
    ['superintendent', false],
    ['primary', false],
    ['estimator', false],
    ['helpers', false],
    ['subcontractor', false],
    ['owner', false],
    ['master', false],
  ])('%s → %s', (role, expected) => {
    expect(canWriteTimeOff(role)).toBe(expected)
  })

  it('null / undefined / unknown roles are refused', () => {
    expect(canWriteTimeOff(null)).toBe(false)
    expect(canWriteTimeOff(undefined)).toBe(false)
    expect(canWriteTimeOff('')).toBe(false)
    expect(canWriteTimeOff('nobody')).toBe(false)
  })

  it('the time-off set is exactly the RPC gate roles', () => {
    expect([...CAN_WRITE_SCHEDULE_TIME_OFF_ROLES].sort()).toEqual(
      ['assistant', 'controller', 'dev', 'master_technician'].sort(),
    )
  })
})

describe('view vs edit roles', () => {
  it('a superintendent can view and edit blocks but not write time off (J18-N2)', () => {
    expect(CAN_VIEW_SCHEDULE_DISPATCH_ROLES.has('superintendent')).toBe(true)
    expect(CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has('superintendent')).toBe(true)
    expect(canWriteTimeOff('superintendent')).toBe(false)
  })

  it('every time-off writer is also a viewer and an editor', () => {
    for (const role of CAN_WRITE_SCHEDULE_TIME_OFF_ROLES) {
      expect(CAN_VIEW_SCHEDULE_DISPATCH_ROLES.has(role)).toBe(true)
      expect(CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)).toBe(true)
    }
  })

  it('every editor is a viewer (never the other way round silently)', () => {
    for (const role of CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES) {
      expect(CAN_VIEW_SCHEDULE_DISPATCH_ROLES.has(role)).toBe(true)
    }
  })
})
