import { describe, expect, it } from 'vitest'
import { assembleLeanStatsJobs, computeStagesHeaderStats } from './stagesHeaderStats'
import { liveBilledStats, overlayLiveBilledStats } from './stagesLiveHeaderStats'

const NOW = new Date('2026-09-28T17:00:00Z')

const jobRows = [
  { id: 'shell', status: 'billed', revenue: 900, payments_made: 200 },
  { id: 'multi', status: 'billed', revenue: 3000, payments_made: 0 },
  { id: 'coll', status: 'billed', revenue: 800, payments_made: 0, collections_at: '2026-07-01T00:00:00Z' },
  { id: 'moved', status: 'billed', revenue: 350, payments_made: 0 },
  { id: 'working', status: 'working', revenue: 5000, payments_made: 0 },
].map((j) => ({ pct_complete: null, collections_at: null, hcp_number: j.id, click_number: null, customer_id: null, gc_customer_id: null, ...j }))
const invoiceRows = [
  { id: 'm1', job_id: 'multi', amount: 1000, status: 'billed', billed_at: '2026-08-04' },
  { id: 'm2', job_id: 'multi', amount: 2000, status: 'billed', billed_at: '2026-06-01' },
  { id: 'c1', job_id: 'coll', amount: 800, status: 'billed', billed_at: '2026-04-13' },
  { id: 'v1', job_id: 'moved', amount: 350, status: 'billed', billed_at: '2026-08-20' },
].map((i, n) => ({ sequence_order: n + 1, is_primary_rtb_bundle: null, estimated_bill_date: null, ...i }))
const paymentRows = [{ job_id: 'multi', invoice_id: 'm1', amount: 1000, paid_on: '2026-08-01' }]

describe('liveBilledStats', () => {
  it('reads the same Billed / Collections figures as the cached header stats on the same rows', () => {
    const jobs = assembleLeanStatsJobs(jobRows, invoiceRows, paymentRows)
    const cached = computeStagesHeaderStats(jobs, NOW)
    const live = liveBilledStats(jobs, NOW)
    expect(live.billed).toEqual(cached.billed)
    expect(live.collections).toEqual(cached.collections)
    expect(live.billedAging).toEqual(cached.billedAging)
    expect(live.billedNoDate).toBe(cached.billedNoDate)
    expect(live.billed).toEqual({ count: 4, total: 700 + 2000 + 350 + 0 })
    expect(live.collections).toEqual({ count: 1, total: 800 })
  })

  it('follows a job moved to Collections while the cached stats still hold the old split', () => {
    const before = assembleLeanStatsJobs(jobRows, invoiceRows, paymentRows)
    const cached = computeStagesHeaderStats(before, NOW)
    const after = assembleLeanStatsJobs(
      jobRows.map((j) => (j.id === 'moved' ? { ...j, collections_at: '2026-09-28T16:00:00Z' } : j)),
      invoiceRows,
      paymentRows,
    )
    const live = liveBilledStats(after, NOW)
    expect(live.billed).toEqual({ count: 3, total: 2700 })
    expect(live.collections).toEqual({ count: 2, total: 1150 })
    const shown = overlayLiveBilledStats(cached, live)!
    expect(shown.billed).toEqual(live.billed)
    expect(shown.collections).toEqual(live.collections)
    expect(shown.billedAging).toEqual(live.billedAging)
    // everything the rows cannot speak for stays cached
    expect(shown.capableToBill).toBe(cached.capableToBill)
    expect(shown.working).toEqual(cached.working)
    expect(shown.collectedByDay).toEqual(cached.collectedByDay)
    expect(shown.billTruth).toBe(cached.billTruth)
  })

  it('leaves the cache alone when the billed scope is not loaded, and has nothing to show before the cache arrives', () => {
    const jobs = assembleLeanStatsJobs(jobRows, invoiceRows, paymentRows)
    const cached = computeStagesHeaderStats(jobs, NOW)
    expect(overlayLiveBilledStats(cached, null)).toBe(cached)
    expect(overlayLiveBilledStats(null, liveBilledStats(jobs, NOW))).toBeNull()
  })
})
