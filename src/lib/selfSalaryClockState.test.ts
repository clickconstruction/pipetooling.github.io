/**
 * The dashboard's salary probe carries the caller's own set week (v2.7948): off the RPC's row, as the
 * default week from a server that does not send it yet, and off the pay row when the RPC fails.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  rpc: { data: null as unknown, error: null as unknown },
  pay: null as unknown,
  template: null as unknown,
  selects: [] as string[],
}))

vi.mock('./supabase', () => ({
  supabase: {
    rpc: vi.fn(async () => h.rpc),
    from: (table: string) => ({
      select: (cols: string) => {
        h.selects.push(`${table}: ${cols}`)
        return { eq: () => ({ maybeSingle: async () => ({ data: table === 'people_pay_config' ? h.pay : h.template }) }) }
      },
    }),
  },
}))

import { fetchSelfSalaryClockState } from './selfSalaryClockState'

beforeEach(() => {
  h.rpc = { data: null, error: null }
  h.pay = null
  h.template = null
  h.selects.length = 0
})

describe('fetchSelfSalaryClockState', () => {
  it('reads the caller’s own week off the probe’s row', async () => {
    h.rpc = { data: [{ is_salary: true, record_hours_but_salary: true, has_template: false, salaried_week_hours: [0, 6, 6, 6, 6, 6, 0] }], error: null }
    expect(await fetchSelfSalaryClockState('u1', 'Rosa Sample')).toEqual({ isSalary: true, hasTemplate: false, week: [0, 6, 6, 6, 6, 6, 0] })
    expect(h.selects).toEqual([])
  })

  it('reads the default week from a row with no week on it', async () => {
    h.rpc = { data: [{ is_salary: true, record_hours_but_salary: false, has_template: true }], error: null }
    expect(await fetchSelfSalaryClockState('u1', 'Rosa Sample')).toEqual({ isSalary: true, hasTemplate: true, week: [0, 8, 8, 8, 8, 8, 0] })
  })

  it('falls back to the pay row by name when the probe fails, the week with it', async () => {
    h.rpc = { data: null, error: { message: 'Could not find the function' } }
    h.pay = { is_salary: true, salaried_week_hours: ['0.00', '8.00', '8.00', '8.00', '8.00', '4.00', '0.00'] }
    h.template = { user_id: 'u1' }
    expect(await fetchSelfSalaryClockState('u1', ' Rosa Sample ')).toEqual({ isSalary: true, hasTemplate: true, week: [0, 8, 8, 8, 8, 4, 0] })
    expect(h.selects).toEqual(['people_pay_config: is_salary, salaried_week_hours', 'salary_work_schedule_templates: user_id'])
  })
})
