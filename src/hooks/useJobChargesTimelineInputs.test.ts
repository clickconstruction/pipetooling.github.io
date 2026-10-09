/**
 * `loadJobChargesTimelineInputs` (lifted out of the hook in v2.5046) is the one loader the job's
 * Costs tab and Bids → Bid vs actual both read. These pin what it hands back from a job row and
 * its reads: the price, the % fallback off the job, team labor (only when asked), sub sheets,
 * billed materials and the hand-set percents. The reads are stubbed; the event kernels are real.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tables: Record<string, unknown[]> = {}
vi.mock('../lib/supabase', () => {
  const chain = (table: string) => {
    const result = () => Promise.resolve({ data: tables[table] ?? [], error: null })
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order']) b[m] = () => b
    b.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => result().then(ok, bad)
    return b
  }
  return { supabase: { from: (t: string) => chain(t) } }
})
const team = vi.fn()
vi.mock('../utils/teamLabor', () => ({ fetchTeamLaborBreakdownForJob: (_sb: unknown, jobId: string) => team(jobId) }))
vi.mock('../lib/fetchJobMaterialsCostSnapshot', () => ({
  fetchJobMaterialsCostSnapshot: async () => ({ mercuryAllocLines: [], cardExclusions: undefined, cardFuelTxIds: new Set(), supplyInvoiceLines: [{ invoiceDate: '2026-09-02', allocatedAmount: 6_000, supplyHouseName: 'Ferguson', invoiceNumber: 'F-1' }], tallyPartLines: [], mercuryFetchFailed: false }),
}))

import { loadJobChargesTimelineInputs, type JobChargesTimelineJob } from './useJobChargesTimelineInputs'

const job: JobChargesTimelineJob = {
  id: 'j879',
  revenue: 41_550,
  pct_complete: 40,
  invoices: [],
  materials: [{ created_at: '2026-09-03T15:00:00Z', amount: 250, description: 'Fittings' }],
  payments: [{ paid_on: '2026-09-10', created_at: null, amount: 10_000, payment_type: 'check', note: null }],
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  team.mockReset()
  team.mockResolvedValue([{ personName: 'Mike Z', byWorkDate: [{ workDate: '2026-09-01', hours: 8, cost: 300 }, { workDate: '2026-09-02', hours: 6, cost: 225 }] }])
})

describe('loadJobChargesTimelineInputs (v2.5046)', () => {
  it('hands back the price, the % off the job, team labor, supply invoices, billed materials and payments', async () => {
    const i = await loadJobChargesTimelineInputs(job, true)
    expect(i.revenue).toBe(41_550)
    expect(i.fallbackPercent).toBe(40)
    expect(i.teamHours).toBe(14)
    expect(i.cardChargesExcluded).toBe(false)
    const bySource = (s: string) => i.chargeEvents.filter((e) => e.source === s).reduce((t, e) => t + e.amount, 0)
    expect(bySource('team_labor')).toBe(525)
    expect(bySource('supply_house')).toBe(6_000)
    expect(i.chargeEvents.some((e) => e.amount === 250)).toBe(true)
    expect(i.paymentEvents.map((p) => [p.dateKey, p.amount])).toEqual([['2026-09-10', 10_000]])
  })
  it('without team labor the wage read never runs', async () => {
    const i = await loadJobChargesTimelineInputs(job, false)
    expect(team).not.toHaveBeenCalled()
    expect(i.teamHours).toBe(0)
    expect(i.chargeEvents.some((e) => e.source === 'team_labor')).toBe(false)
  })
  it('a hand-set % and a sub sheet come through; a job with no price reads none', async () => {
    tables.job_pct_events = [{ pct: 55, changed_at: '2026-09-11T14:00:00Z', users: { name: 'Taunya' } }]
    tables.people_labor_jobs = [{ id: 'lj1', assigned_to_name: 'Edgar', job_date: '2026-09-04', created_at: null, labor_rate: 50, distance_miles: 0 }]
    tables.people_labor_job_items = [{ job_id: 'lj1', fixture: 'Toilet', count: 2, hrs_per_unit: 3, is_fixed: false, labor_rate: 50, direct_labor_amount: null }]
    const i = await loadJobChargesTimelineInputs({ ...job, revenue: null }, true)
    expect(i.revenue).toBeNull()
    expect(i.valueEvents.some((v) => v.kind === 'manual' && v.percent === 55)).toBe(true)
    expect(i.chargeEvents.filter((e) => e.source === 'sub_labor').reduce((t, e) => t + e.amount, 0)).toBe(300)
  })
})
