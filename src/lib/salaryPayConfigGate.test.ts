import { describe, expect, it } from 'vitest'
import { filterSessionsToSalariedSalaryOrigin } from './salaryPayConfigGate'

const sessions = [
  { id: 1, user_id: 'u1', origin: 'salary_schedule' },
  { id: 2, user_id: 'u2', origin: 'salary_schedule' },
  { id: 3, user_id: 'u2', origin: 'user_punch' },
  { id: 4, user_id: 'u3', origin: null },
]

describe('filterSessionsToSalariedSalaryOrigin', () => {
  it('keeps salary_schedule sessions only for currently-salaried users', () => {
    const out = filterSessionsToSalariedSalaryOrigin(sessions, new Set(['u1']))
    expect(out.map((s) => s.id)).toEqual([1, 3, 4])
  })

  it('never drops manual punches or origin-less sessions', () => {
    const out = filterSessionsToSalariedSalaryOrigin(sessions, new Set())
    expect(out.map((s) => s.id)).toEqual([3, 4])
  })

  it('passes everything through when all users are salaried', () => {
    const out = filterSessionsToSalariedSalaryOrigin(sessions, new Set(['u1', 'u2', 'u3']))
    expect(out).toHaveLength(4)
  })
})
