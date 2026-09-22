import { describe, expect, it } from 'vitest'
import { hirePlan, type HireInput } from './hireWrites'

const base: HireInput = {
  name: 'Ana Ruiz',
  kind: 'helper',
  email: 'ana@example.com',
  invite: true,
  startInTraining: false,
  startDate: '2026-09-22',
  hourlyWage: 22,
  isSalary: false,
  workdayStart: '08:00',
  packetTemplateId: null,
}
const devCaps = { canInvite: true, canAccessPay: true, canAccessContracts: true }

describe('hirePlan', () => {
  it('an hourly helper with a login: invite (born linked), then pay', () => {
    const { steps, problems } = hirePlan(base, devCaps)
    expect(problems).toEqual([])
    expect(steps.map((s) => s.id)).toEqual(['account', 'pay'])
    expect(steps[0]!.detail).toContain('ana@example.com')
  })

  it('a salaried hire adds the workday step after pay, and needs a login', () => {
    const { steps } = hirePlan({ ...base, isSalary: true, hourlyWage: 30 }, devCaps)
    expect(steps.map((s) => s.id)).toEqual(['account', 'pay', 'workday'])
    const { problems } = hirePlan({ ...base, isSalary: true, hourlyWage: 30, invite: false, email: '' }, devCaps)
    expect(problems).toContain('A salaried hire needs a login: the workday template belongs to the account.')
  })

  it('no email means a roster row, not an invite; a packet adds the paperwork step', () => {
    const { steps, problems } = hirePlan({ ...base, email: '', invite: false, packetTemplateId: 'tpl-1' }, devCaps)
    expect(problems).toEqual([])
    expect(steps.map((s) => s.id)).toEqual(['roster', 'pay', 'packet'])
  })

  it('a pay row with no wage cannot be paid — the plan refuses it (the 2026-09-21 Training Helper)', () => {
    expect(hirePlan({ ...base, hourlyWage: null }, devCaps).problems).toContain('An hourly wage is required — a pay row with no wage cannot be paid.')
    expect(hirePlan({ ...base, isSalary: true, hourlyWage: 0 }, devCaps).problems).toContain('A salaried hire needs the hourly rate the flat 8-hour day is priced at.')
    // A primary is never paid through the pay tables: no pay step, no wage needed.
    const primary = hirePlan({ ...base, kind: 'primary', hourlyWage: null }, devCaps)
    expect(primary.problems).toEqual([])
    expect(primary.steps.map((s) => s.id)).toEqual(['account'])
  })

  it('a non-dev cannot send the invite, and a viewer without pay access gets no pay step', () => {
    const { problems } = hirePlan(base, { canInvite: false, canAccessPay: true, canAccessContracts: true })
    expect(problems.some((p) => p.startsWith('Only a dev can send the invite'))).toBe(true)
    const { steps } = hirePlan({ ...base, invite: false, email: '' }, { canInvite: false, canAccessPay: false, canAccessContracts: false })
    expect(steps.map((s) => s.id)).toEqual(['roster'])
  })

  it('names, emails and dates are checked before anything is written', () => {
    const { problems } = hirePlan({ ...base, name: ' ', email: 'not-an-email', startDate: 'soon' }, devCaps)
    expect(problems).toEqual(expect.arrayContaining(['A name is required.', 'That email does not look right.', 'Pick a start date.']))
  })
})
