import { describe, expect, it } from 'vitest'
import { HOURS_PER_THOUSAND_OUTLIER, bidVsActualTiles, buildBidVsActualRows, readBidVsActual, type BidVsActualBudgetInput, type BidVsActualJobInput } from './bidVsActual'

// Today's linked jobs, trimmed to the shapes that matter.
const job = (o: Partial<BidVsActualJobInput> & { id: string; bid_id: string }): BidVsActualJobInput => ({ hcp_number: null, job_name: null, revenue: null, status: 'working', pct_complete: null, ...o })
const budget = (o: Partial<BidVsActualBudgetInput> & { job_id: string }): BidVsActualBudgetInput => ({ bid_id: 'b', labor_hours: 0, labor_usd: 0, materials_usd: 0, subs_usd: 0, total_direct_usd: 0, completeness: { usable: false }, ...o })

const jobs = [
  job({ id: 'j523', hcp_number: '523', job_name: 'Mission Hills', revenue: '123600', pct_complete: 90, bid_id: 'b66' }),
  job({ id: 'j650', hcp_number: 'J 650', job_name: 'ATI Schertz', revenue: 33500, status: 'billed', pct_complete: 100, bid_id: 'b34' }),
  job({ id: 'jsx', hcp_number: null, job_name: 'SPACEX BA-02N', revenue: 249715.66, bid_id: 'b375' }),
  job({ id: 'j843', hcp_number: '843', job_name: 'Palmer · Jacob Roberts', revenue: 11920, bid_id: 'b75' }),
  job({ id: 'j775', hcp_number: '775', job_name: 'NexGen Custom Homes', revenue: 16700, bid_id: 'b211' }),
  job({ id: 'j892', hcp_number: '892', job_name: 'Megan Connell', revenue: 37745, bid_id: 'b118' }),
  job({ id: 'j879', hcp_number: '879', job_name: 'Palmer · Moses Hughes', revenue: 41550, status: 'waiting', pct_complete: 50, bid_id: 'b76' }),
  job({ id: 'unlinked', hcp_number: '1', job_name: 'No bid', revenue: 5, bid_id: '' }),
]
const budgets = [
  budget({ job_id: 'j523' }),
  budget({ job_id: 'jsx', materials_usd: 64167.61, total_direct_usd: 64167.61 }),
  budget({ job_id: 'j843', labor_hours: 603, total_direct_usd: 11438.91 }),
  budget({ job_id: 'j775', labor_hours: 13, total_direct_usd: 369.46 }),
  budget({ job_id: 'j892', labor_hours: 47, total_direct_usd: 608.65 }),
  budget({ job_id: 'j879', labor_hours: 36, total_direct_usd: 689.22, completeness: { usable: true } }),
]
const bids = new Map([
  ['b66', { id: 'b66', bid_number: '66', project_name: 'Mission Hill Park', estimatorName: 'Juan' }],
  ['b34', { id: 'b34', bid_number: '34', project_name: 'ATI Schertz, TX', estimatorName: 'Malachi' }],
  ['b375', { id: 'b375', bid_number: '375', project_name: 'SPACEX BA-02N Architectural', estimatorName: 'Wendi' }],
  ['b75', { id: 'b75', bid_number: '75', project_name: 'Lagan Casita', estimatorName: 'Malachi' }],
  ['b211', { id: 'b211', bid_number: '211', project_name: 'Wadelyn Unit Arch Ray #169', estimatorName: 'William' }],
  ['b118', { id: 'b118', bid_number: '118', project_name: 'Connell House - Curvatura', estimatorName: 'Wendi' }],
])
const hoursByJob = new Map([['j523', 959], ['j650', 341], ['jsx', 43], ['j843', 26], ['j775', 18], ['j892', 17], ['j879', 6]])
const pursuitByBid = new Map([['b34', { usd: 6.04, hours: 0.23 }], ['b375', { usd: 141.78, hours: 2.45 }]])
const rows = buildBidVsActualRows({ jobs, budgets, bids, hoursByJob, pursuitByBid })

describe('buildBidVsActualRows', () => {
  it('one row per linked job, largest price first, labels from both sides', () => {
    expect(rows.map((r) => r.jobLabel)).toEqual(['J SPACEX BA-02N', 'J523 Mission Hills', 'J879 Palmer · Moses Hughes', 'J892 Megan Connell', 'J650 ATI Schertz', 'J775 NexGen Custom Homes', 'J843 Palmer · Jacob Roberts'].map((s) => s.replace('J SPACEX', 'SPACEX')))
    const sx = rows[0]!
    expect(sx).toMatchObject({ bidLabel: 'B375 SPACEX BA-02N Architectural', estimatorName: 'Wendi', pursuitUsd: 141.78, predictedHours: null, predictedDirectUsd: 64167.61, materialsOnly: true, read: 'hours-missing', words: 'hours missing', recordedHours: 43, pctDone: null })
    const ati = rows.find((r) => r.jobId === 'j650')!
    expect(ati).toMatchObject({ jobLabel: 'J650 ATI Schertz', pctDone: 100, read: 'not-costed', detail: '341 h recorded, nothing to hold it against', pursuitUsd: 6.04 })
    expect(rows.find((r) => r.jobId === 'j523')).toMatchObject({ read: 'not-costed', estimatorName: 'Juan', pctDone: 90, revenue: 123600 })
    expect(rows.find((r) => r.jobId === 'unlinked')).toBeUndefined()
  })
  it('reads the count sheet: outlier, over, near, under', () => {
    const j843 = rows.find((r) => r.jobId === 'j843')!
    expect(603 / (11920 / 1000)).toBeGreaterThan(HOURS_PER_THOUSAND_OUTLIER)
    expect(j843).toMatchObject({ read: 'outlier', words: '603 h on $11,920', detail: 'check the count sheet' })
    const j775 = rows.find((r) => r.jobId === 'j775')!
    expect(j775.hoursShare).toBeCloseTo(18 / 13, 4)
    expect(j775).toMatchObject({ read: 'over', words: '138% of hours', detail: '% done unknown · over the book' })
    const j892 = rows.find((r) => r.jobId === 'j892')!
    expect(j892).toMatchObject({ read: 'under', words: '36% of hours', detail: '% done unknown' })
    const j879 = rows.find((r) => r.jobId === 'j879')!
    // 6 of 36 h at 50 % done → 17 % of hours against 50 % expected → under; the snapshot is usable (rate set)
    expect(j879).toMatchObject({ read: 'under', words: '17% of hours', detail: 'at 50% done', usable: true })
    expect(readBidVsActual({ predictedHours: 100, predictedDirectUsd: 5000, recordedHours: 95, revenue: 20000, pctDone: 100, materialsOnly: false })).toMatchObject({ read: 'near', words: '95% of hours', detail: 'at 100% done' })
    expect(readBidVsActual({ predictedHours: 100, predictedDirectUsd: 5000, recordedHours: 60, revenue: 20000, pctDone: 100, materialsOnly: false })).toMatchObject({ read: 'under', detail: 'at 100% done · under the book' })
    expect(readBidVsActual({ predictedHours: 100, predictedDirectUsd: 5000, recordedHours: 70, revenue: 20000, pctDone: 50, materialsOnly: false })).toMatchObject({ read: 'over', detail: 'at 50% done · over the book' })
  })
  it('tiles count the linked, the costed, the usable, and the trouble', () => {
    const t = bidVsActualTiles(rows)
    expect(t).toMatchObject({ linked: 7, withPredictedHours: 4, rateSet: 1, notCosted: 3, over: 1, outliers: 1, recordedHours: 1410, predictedHoursWhereAny: 699, recordedHoursWhereAny: 67 })
  })
})
