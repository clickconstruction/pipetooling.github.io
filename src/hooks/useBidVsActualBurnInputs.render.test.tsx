// @vitest-environment jsdom
/**
 * Bid vs actual's per-job burn read (v2.5046): one lean jobs read, then each job through the Costs
 * tab's own loader a few at a time, filling in as they land; nothing at all for a role without
 * wages, and a failed job marked without stopping the rest.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const jobsRead = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { from: (table: string) => ({ select: (cols: string) => ({ in: (col: string, ids: string[]) => jobsRead(table, cols, col, ids) }) }) },
}))
let inFlight = 0
let maxInFlight = 0
const load = vi.fn()
vi.mock('./useJobChargesTimelineInputs', () => ({ loadJobChargesTimelineInputs: (job: { id: string }, team: boolean) => load(job, team) }))

import { BID_VS_ACTUAL_BURN_CONCURRENCY, useBidVsActualBurnInputs } from './useBidVsActualBurnInputs'

const inputsFor = (id: string) => ({ chargeEvents: [], valueEvents: [], paymentEvents: [], revenue: 1_000, fallbackPercent: 50, teamHours: 0, cardChargesExcluded: false, id })

beforeEach(() => {
  jobsRead.mockReset()
  load.mockReset()
  inFlight = 0
  maxInFlight = 0
  load.mockImplementation(async (job: { id: string }) => {
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((r) => setTimeout(r, 5))
    inFlight--
    if (job.id === 'j-bad') throw new Error('offline')
    return inputsFor(job.id)
  })
})

describe('useBidVsActualBurnInputs', () => {
  it('reads every linked job through the Costs tab’s loader, a few at a time, team labor included', async () => {
    const ids = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j-bad']
    jobsRead.mockResolvedValue({
      data: ids.map((id) => ({ id, revenue: 1_000, pct_complete: 50, invoices: [{ status: 'paid', amount: 500 }], materials: null })),
      error: null,
    })
    const { result } = renderHook(() => useBidVsActualBurnInputs(true, [...ids, 'j-gone']))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(jobsRead).toHaveBeenCalledWith('jobs_ledger', 'id, revenue, pct_complete, invoices:jobs_ledger_invoices(status, amount), materials:jobs_ledger_materials(amount, created_at, description)', 'id', [...ids, 'j-gone'].sort())
    expect(load).toHaveBeenCalledTimes(7)
    expect(load).toHaveBeenCalledWith({ id: 'j1', revenue: 1_000, pct_complete: 50, invoices: [{ status: 'paid', amount: 500 }], materials: [], payments: [] }, true)
    expect(maxInFlight).toBeLessThanOrEqual(BID_VS_ACTUAL_BURN_CONCURRENCY)
    expect(maxInFlight).toBeGreaterThan(1)
    expect(result.current.inputsByJob.get('j6')).toMatchObject({ revenue: 1_000 })
    // A failed read marks its row; a job the read did not return (another role's) too.
    expect(result.current.inputsByJob.get('j-bad')).toBe('error')
    expect(result.current.inputsByJob.get('j-gone')).toBe('error')
  })
  it('reads nothing for a role without wages, or with no linked jobs', () => {
    const off = renderHook(() => useBidVsActualBurnInputs(false, ['j1']))
    const none = renderHook(() => useBidVsActualBurnInputs(true, []))
    expect(off.result.current).toEqual({ loading: false, inputsByJob: new Map() })
    expect(none.result.current.inputsByJob.size).toBe(0)
    expect(jobsRead).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
  })
})
