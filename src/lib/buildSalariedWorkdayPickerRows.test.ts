import { describe, expect, it } from 'vitest'
import { buildSalariedWorkdayPickerRows } from './buildSalariedWorkdayPickerRows'
import type { PayConfigRow } from '../types/peoplePayConfig'

function cfg(personName: string, isSalary: boolean): PayConfigRow {
  return {
    person_name: personName,
    hourly_wage: null,
    is_salary: isSalary,
    show_in_hours: false,
    show_in_cost_matrix: false,
    record_hours_but_salary: false,
  }
}

describe('buildSalariedWorkdayPickerRows', () => {
  it('includes only salaried people', () => {
    const rows = buildSalariedWorkdayPickerRows(
      { Alice: cfg('Alice', true), Bob: cfg('Bob', false) },
      [],
    )
    expect(rows.map((r) => r.personName)).toEqual(['Alice'])
  })

  it('matches login user id by trimmed name, null when no user matches', () => {
    const rows = buildSalariedWorkdayPickerRows(
      { Alice: cfg('Alice', true), Cara: cfg('Cara', true) },
      [
        { id: 'u-alice', name: '  Alice ' },
        { id: 'u-other', name: 'Zed' },
      ],
    )
    expect(rows).toEqual([
      { personName: 'Alice', userId: 'u-alice' },
      { personName: 'Cara', userId: null },
    ])
  })

  it('sorts case-insensitively by person name', () => {
    const rows = buildSalariedWorkdayPickerRows(
      { zed: cfg('zed', true), Alice: cfg('Alice', true), bob: cfg('bob', true) },
      [],
    )
    expect(rows.map((r) => r.personName)).toEqual(['Alice', 'bob', 'zed'])
  })
})
