import { describe, it, expect } from 'vitest'
import { buildPayConfigById, payConfigForPerson } from './payConfigLookup'
import type { PayConfigRow } from '../../types/peoplePayConfig'

const row = (person_name: string, person_id: string | null, is_salary = false): PayConfigRow => ({
  person_name,
  person_id,
  hourly_wage: 30,
  office_hourly_wage: null,
  is_salary,
  record_hours_but_salary: false,
})

const payConfig: Record<string, PayConfigRow> = {
  'Mario Lozano': row('Mario Lozano', 'p-mario', true),
  'Old Zach Name': row('Old Zach Name', 'p-zach'),
  'No Id Person': row('No Id Person', null),
}
const byId = buildPayConfigById(payConfig)

describe('buildPayConfigById', () => {
  it('indexes rows by person_id, skipping null ids', () => {
    expect(Object.keys(byId).sort()).toEqual(['p-mario', 'p-zach'])
    expect(byId['p-mario']?.is_salary).toBe(true)
  })
})

describe('payConfigForPerson', () => {
  it('resolves by id even when the display name drifted', () => {
    expect(payConfigForPerson(payConfig, byId, 'Zach W', 'p-zach')?.person_name).toBe('Old Zach Name')
  })

  it('falls back to the name when the id is unknown or absent', () => {
    expect(payConfigForPerson(payConfig, byId, 'No Id Person', null)?.person_name).toBe('No Id Person')
    expect(payConfigForPerson(payConfig, byId, 'Mario Lozano', 'p-unknown')?.person_name).toBe('Mario Lozano')
  })

  it('returns undefined when neither key matches', () => {
    expect(payConfigForPerson(payConfig, byId, 'Ghost', 'p-ghost')).toBeUndefined()
  })
})
