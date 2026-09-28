import { describe, expect, it, vi } from 'vitest'
import { payrollEffectiveHours, uniqueUserIdByPayName } from './payrollPreviewPricing'

// 2026-09-21 is a Monday, 2026-09-26 a Saturday.
describe('payrollEffectiveHours', () => {
  const base = { personName: 'Alex Rivera', workDate: '2026-09-21', salaryWindows: {}, recordedHours: () => 6.5 }

  it('is the recorded hours for an hourly person', () => {
    expect(payrollEffectiveHours({ ...base, isSalary: false })).toBe(6.5)
    expect(payrollEffectiveHours({ ...base, isSalary: null })).toBe(6.5)
    expect(payrollEffectiveHours({ ...base, isSalary: undefined })).toBe(6.5)
  })

  it('is the flat 8 on a weekday and 0 on a weekend for a salaried person, whatever was recorded', () => {
    const recordedHours = vi.fn(() => 11)
    expect(payrollEffectiveHours({ ...base, isSalary: true, recordedHours })).toBe(8)
    expect(payrollEffectiveHours({ ...base, isSalary: true, workDate: '2026-09-26', recordedHours })).toBe(0)
    expect(recordedHours).not.toHaveBeenCalled()
  })

  it('pays nothing on an unpaid day off, and the 8 on a paid one', () => {
    const unpaid = { 'Alex Rivera': { timeOff: [{ start_date: '2026-09-21', end_date: '2026-09-22', kind: 'unpaid' }], employmentStart: null, employmentEnd: null } }
    const paid = { 'Alex Rivera': { timeOff: [{ start_date: '2026-09-21', end_date: '2026-09-22', kind: 'paid' }], employmentStart: null, employmentEnd: null } }
    expect(payrollEffectiveHours({ ...base, isSalary: true, salaryWindows: unpaid })).toBe(0)
    expect(payrollEffectiveHours({ ...base, isSalary: true, salaryWindows: paid })).toBe(8)
  })

  it('pays nothing before the start date or after the end date', () => {
    const notStarted = { 'Alex Rivera': { timeOff: [], employmentStart: '2026-09-28', employmentEnd: null } }
    const left = { 'Alex Rivera': { timeOff: [], employmentStart: null, employmentEnd: '2026-09-18' } }
    expect(payrollEffectiveHours({ ...base, isSalary: true, salaryWindows: notStarted })).toBe(0)
    expect(payrollEffectiveHours({ ...base, isSalary: true, salaryWindows: left })).toBe(0)
  })

  it('finds the window by the trimmed name', () => {
    const windows = { 'Alex Rivera': { timeOff: [], employmentStart: '2026-09-28', employmentEnd: null } }
    expect(payrollEffectiveHours({ ...base, isSalary: true, personName: ' Alex Rivera ', salaryWindows: windows })).toBe(0)
  })
})

describe('uniqueUserIdByPayName', () => {
  const users = [
    { id: 'u1', name: 'Alex Rivera' },
    { id: 'u2', name: ' Sam Lee ' },
    { id: 'u3', name: 'Jo Park' },
    { id: 'u4', name: 'Jo Park' },
    { id: 'u5', name: null },
  ]

  it('maps a name one user carries, trimmed on both sides', () => {
    expect([...uniqueUserIdByPayName(['Alex Rivera', 'Sam Lee '], users)]).toEqual([['Alex Rivera', 'u1'], ['Sam Lee ', 'u2']])
  })

  it('leaves out a name two users share, and one nobody has', () => {
    expect(uniqueUserIdByPayName(['Jo Park', 'Nobody'], users).size).toBe(0)
  })
})
