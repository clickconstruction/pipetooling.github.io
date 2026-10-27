// @vitest-environment jsdom
/**
 * Render smokes for Dashboard → Your money (punch list #184 sweep B): the sub's sheets read by the
 * day each open balance becomes payable, the soonest first, with the due chip: red once the day
 * has passed with money open, amber on the day, the date in words before it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const tables: Record<string, unknown[]> = {}
vi.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    const result = () => Promise.resolve({ data: tables[table] ?? [], error: null })
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'in', 'eq']) b[m] = () => b
    b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => result().then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table), rpc: () => Promise.resolve({ data: null, error: null }), auth: { getUser: async () => ({ data: { user: null } }) } } }
})

import { DashboardSubMoneySection } from './DashboardSubMoneySection'

const sheet = (id: string, job_number: string, payable_after: string | null, created_at: string, rate: number) => ({
  id,
  assigned_to_name: 'Sample Sub',
  address: `${id} Main St`,
  job_number,
  labor_rate: rate,
  job_date: null,
  created_at,
  project_id: null,
  step_id: null,
  payable_after,
})

describe('DashboardSubMoneySection · Your sheets', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T17:00:00Z'))
    tables.people_labor_jobs = [
      sheet('s-new-later', '903', '2026-11-02', '2026-10-20T12:00:00Z', 50),
      sheet('s-settled', '701', null, '2026-10-22T12:00:00Z', 40),
      sheet('s-today', '812', '2026-10-26', '2026-10-05T12:00:00Z', 50),
      sheet('s-late', '777', '2026-10-20', '2026-09-15T12:00:00Z', 50),
      sheet('s-nodate', '655', null, '2026-09-01T12:00:00Z', 50),
    ]
    tables.people_labor_job_items = ['s-new-later', 's-settled', 's-today', 's-late', 's-nodate'].map((job_id) => ({ job_id, fixture: 'Rough in', count: 1, hrs_per_unit: 10, is_fixed: false, labor_rate: null, direct_labor_amount: null }))
    tables.people_labor_job_payments = [{ id: 'p1', job_id: 's-settled', amount: 400, memo: null, created_at: '2026-10-23T12:00:00Z' }]
    tables.step_commitments = []
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reads soonest payable first, with the payable day in neutral words, never a late chip on the sub\'s own screen', async () => {
    renderWithProviders(<DashboardSubMoneySection visible />)
    expect(await screen.findByText('Your sheets')).toBeTruthy()
    const labels = [...document.querySelectorAll('#dash-sub-money button')].map((b) => b.textContent ?? '').filter((t) => /Main St/.test(t))
    expect(labels.map((t) => t.match(/^. (\d+)/)?.[1])).toEqual(['777', '812', '903', '655', '701'])
    const payable = [...document.querySelectorAll('[data-sheet-payable]')].map((n) => n.textContent)
    expect(payable).toEqual(['payable since Oct 20', 'payable today', 'payable after Nov 2'])
    expect(document.querySelector('#dash-sub-money')!.textContent).not.toMatch(/\d+ days? late|due today/)
    expect(labels[4]).toContain('settled')
  })
})
