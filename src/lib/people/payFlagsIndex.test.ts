import { describe, expect, it } from 'vitest'
import { buildPayFlagsIndex, type PayFlagRpcRow } from './payFlagsIndex'

function row(over: Partial<PayFlagRpcRow>): PayFlagRpcRow {
  return {
    person_name: null,
    person_id: null,
    is_salary: null,
    record_hours_but_salary: null,
    show_in_hours: null,
    ...over,
  }
}

describe('buildPayFlagsIndex (C1 — id-first, name-fallback)', () => {
  it('resolves by person_id first, even when the name disagrees (post-rename)', () => {
    const idx = buildPayFlagsIndex([
      row({ person_id: 'p1', person_name: 'Old Name', is_salary: true }),
    ])
    // Renamed roster row: id still matches, stale display name does not.
    expect(idx.isSalaried({ personId: 'p1', name: 'New Name' })).toBe(true)
    expect(idx.get({ personId: 'p1' })?.isSalary).toBe(true)
  })

  it('falls back to trimmed-name match when person_id is absent or unknown', () => {
    const idx = buildPayFlagsIndex([
      row({ person_id: null, person_name: 'Behar Kraja', is_salary: true }),
    ])
    expect(idx.isSalaried({ name: '  Behar Kraja ' })).toBe(true)
    expect(idx.isSalaried({ personId: 'unknown-id', name: 'Behar Kraja' })).toBe(true)
    expect(idx.isSalaried({ personId: 'unknown-id', name: 'Nobody' })).toBe(false)
  })

  it('null flags read as false; missing person reads as null flags', () => {
    const idx = buildPayFlagsIndex([row({ person_id: 'p1', person_name: 'A', is_salary: null })])
    expect(idx.get({ personId: 'p1' })).toEqual({
      isSalary: false,
      recordHoursButSalary: false,
      showInHours: false,
      salariedWeek: [0, 8, 8, 8, 8, 8, 0],
    })
    expect(idx.get({ name: 'Missing' })).toBeNull()
    expect(idx.isSalaried({ name: 'Missing' })).toBe(false)
  })

  it('tolerates empty/null input', () => {
    expect(buildPayFlagsIndex(null).get({ name: 'x' })).toBeNull()
    expect(buildPayFlagsIndex([]).isSalaried({ personId: 'p' })).toBe(false)
  })

  it('carries all three flags', () => {
    const idx = buildPayFlagsIndex([
      row({ person_id: 'p1', person_name: 'A', is_salary: true, record_hours_but_salary: true, show_in_hours: false }),
    ])
    expect(idx.get({ personId: 'p1' })).toEqual({
      isSalary: true,
      recordHoursButSalary: true,
      showInHours: false,
      salariedWeek: [0, 8, 8, 8, 8, 8, 0],
    })
  })

  it('carries the set week, and reads one that is not seven hours as the default week', () => {
    const idx = buildPayFlagsIndex([
      row({ person_id: 'p1', person_name: 'A', is_salary: true, salaried_week_hours: ['0.00', '6.00', '6.00', '6.00', '6.00', '6.00', '0.00'] }),
      row({ person_id: 'p2', person_name: 'B', is_salary: true, salaried_week_hours: [6, 6] }),
    ])
    expect(idx.get({ personId: 'p1' })?.salariedWeek).toEqual([0, 6, 6, 6, 6, 6, 0])
    expect(idx.get({ name: 'B' })?.salariedWeek).toEqual([0, 8, 8, 8, 8, 8, 0])
  })
})
