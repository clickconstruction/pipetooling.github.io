import { describe, expect, it } from 'vitest'
import type { ChaseTouch } from '../../jobs/paymentChase'
import type { PaySpeedData } from '../../jobs/billedExpectedPay'
import { buildCollectPile, type CollectBill } from './collectPile'
import { buildCollectPayers } from './collectPayers'

const TODAY = '2026-10-25'
const speeds: PaySpeedData = {
  company: { medianDays: 7, samples: 286 },
  customers: { rmc: { medianDays: 35, samples: 4 }, harper: { medianDays: 74, samples: 1 }, handi: { medianDays: 6, samples: 10 }, knight: { medianDays: 30, samples: 31 } },
  segments: { residential: { medianDays: 2, samples: 136 }, commercial: { medianDays: 12, samples: 150 } },
  customerTypes: { structura: 'commercial', rmc: 'commercial', southern: 'commercial', harper: 'commercial', handi: 'commercial', knight: 'commercial' },
  receipts: {},
  quality: null,
}
const gcPayers = new Set(['rmc', 'harper', 'knight', 'southern'])
const bill = (key: string, payerId: string, payerName: string, billedYmd: string, usd: number, over: Partial<CollectBill> = {}): CollectBill => ({ key, jobId: `j-${key}`, payerId, payerName, billedYmd, usd, ...over })

// Six payers and a tail, in the Monday board's proportions.
const bills: CollectBill[] = [
  bill('spacex', 'structura', 'Structura, Inc. – Austin', '2026-09-24', 103_386, { sentFromHere: false }),
  bill('rmc-a', 'rmc', 'RMC- Dudley Mason', '2026-03-16', 13_420),
  bill('rmc-b', 'rmc', 'RMC- Dudley Mason', '2026-08-20', 9_800),
  bill('rmc-c', 'rmc', 'RMC- Dudley Mason', '2026-09-21', 8_780, { sentFromHere: false }),
  bill('rmc-d', 'rmc', 'RMC- Dudley Mason', '2026-08-18', 45_351, { jobId: 'j-rmc-b' }),
  bill('sp', 'southern', 'Southern Post Construction', '2026-09-16', 38_625, { sentFromHere: false }),
  bill('tfh', 'harper', 'TF Harper', '2026-09-16', 32_242, { sentFromHere: false }),
  bill('hi', 'handi', 'H & I Construction', '2026-10-23', 14_570),
  bill('kn', 'knight', 'Knight Contracting', '2026-07-06', 7_838),
  // The tail: nine payers, $24.6k, none over $6.6k, so five payers hold under nine tenths and the cut is six.
  bill('r1', 'lim', 'Limitless Renovations', '2026-10-23', 6_530),
  bill('r2', 'summit', 'Summit General Contractors', '2026-09-15', 3_553),
  bill('r3', 'austin', 'Austin Real Estate', '2026-09-25', 2_300),
  bill('r4', 'gillis', 'Tommy Gillis', '2026-08-18', 1_650),
  bill('r5', 'gctest', 'GC Test Owner LLC', '2026-10-10', 4_436),
  bill('r6', 'holub', 'Michael Holub', '2026-09-25', 1_499),
  bill('r7', 'randolph', 'Randolph Field Reality', '2026-09-28', 1_050),
  bill('r8', 'loberg', 'Loberg Contracting', '2026-09-10', 1_000),
  bill('r9', 'misc', 'Someone Else', '2026-10-20', 2_600),
  bill('coll', 'old', 'An old GC', '2026-02-01', 19_522, { inCollections: true }),
]
const touches: ChaseTouch[] = [
  { id: 't1', customerId: 'southern', jobId: 'j-sp', outcome: 'promised', note: null, promisedYmd: '2026-10-16', snoozeDays: null, resolvedAt: null, createdAt: '2026-10-13T20:30:05Z', createdByName: 'Taunya' },
  { id: 't0', customerId: 'southern', jobId: 'j-sp', outcome: 'cant_reach', note: null, promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt: '2026-10-10T15:00:00Z', createdByName: 'Taunya' },
]
const pile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: { 'j-sp': { promisedYmd: '2026-10-16', markedByName: 'Taunya' } }, payAppJobIds: new Set(['j-spacex']), gcPayerIds: gcPayers, todayYmd: TODAY })

describe('buildCollectPayers (v2.5848)', () => {
  const cut = buildCollectPayers(pile, { touches })

  it('groups the bills by payer, biggest first, Collections left out', () => {
    expect(cut.payers.slice(0, 7).map((p) => p.payerName)).toEqual(['Structura, Inc. – Austin', 'RMC- Dudley Mason', 'Southern Post Construction', 'TF Harper', 'H & I Construction', 'Knight Contracting', 'Limitless Renovations'])
    expect(cut.payers).toHaveLength(15)
    expect(cut.payers.some((p) => p.payerName === 'An old GC')).toBe(false)
  })

  it('cuts the fewest payers that hold nine tenths of the headline, at most six', () => {
    expect(cut.cut.map((p) => p.payerName)).toEqual(['Structura, Inc. – Austin', 'RMC- Dudley Mason', 'Southern Post Construction', 'TF Harper', 'H & I Construction', 'Knight Contracting'])
    expect(cut.cutUsd).toBe(103_386 + 77_351 + 38_625 + 32_242 + 14_570 + 7_838)
    expect(cut.cutShare).toBeCloseTo(cut.cutUsd / pile.headlineUsd, 9)
    const tail = pile.bills.filter((b) => /^r\d$/.test(b.key))
    expect(cut.rest).toEqual({ payers: 9, bills: 9, usd: 24_618, maxUsd: 6_530, oldestAgeDays: 68, latePileUsd: tail.filter((b) => b.state === 'late' || b.state === 'broken').reduce((s, b) => s + b.usd, 0) })
    expect(cut.rest.latePileUsd).toBeGreaterThan(0)
    const two = buildCollectPayers(pile, { maxCut: 2 })
    expect(two.cut).toHaveLength(2)
    const half = buildCollectPayers(pile, { shareTarget: 0.5 })
    expect(half.cut.map((p) => p.payerName)).toEqual(['Structura, Inc. – Austin', 'RMC- Dudley Mason'])
  })

  it('reads each payer: bills, jobs, the oldest, the pace and its source, the states, the hand-marked share', () => {
    const rmc = cut.cut[1]!
    expect(rmc).toMatchObject({ usd: 77_351, billCount: 4, jobCount: 3, oldestAgeDays: 223, isGc: true, paceDays: 35, paceSource: 'own', paceSamples: 4, handMarkedUsd: 8_780, worstState: 'doubtful' })
    expect(rmc.over60Usd).toBe(13_420 + 9_800 + 45_351)
    expect(rmc.byState).toMatchObject({ doubtful: 13_420, late: 9_800 + 45_351, notdue: 8_780 })
    expect(rmc.latePileUsd).toBe(9_800 + 45_351)
    expect(rmc.bills.map((b) => b.usd)).toEqual([45_351, 13_420, 9_800, 8_780])
    const structura = cut.cut[0]!
    expect(structura).toMatchObject({ isGc: true, paceSource: 'gc', paceDays: 35, worstState: 'notdue', handMarkedUsd: 103_386, promise: { state: 'none', promise: null, usd: 0 } })
  })

  it('carries the promise state and the newest chase touch', () => {
    const sp = cut.cut[2]!
    expect(sp.promise).toEqual({ state: 'broken', promise: { promisedYmd: '2026-10-16', markedByName: 'Taunya' }, usd: 38_625 })
    expect(sp.worstState).toBe('broken')
    expect(sp.lastTouch?.id).toBe('t1')
    expect(cut.cut[0]!.lastTouch).toBeNull()
  })

  it('counts a miss on Chicago’s day: a no-answer the evening before the bill is not a miss on it (v2.5956)', () => {
    const noAnswer = (createdAt: string): ChaseTouch => ({ id: createdAt, customerId: 'handi', jobId: 'j-hi', outcome: 'cant_reach', note: null, promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt, createdByName: 'Taunya' })
    const misses = (createdAt: string) => buildCollectPayers(pile, { touches: [noAnswer(createdAt)] }).payers.find((p) => p.payerId === 'handi')!.misses
    // H & I's one bill went out on Oct 23. 01:30 UTC on Oct 23 is 8:30 PM on Oct 22, the evening before.
    expect(misses('2026-10-23T01:30:00Z')).toBe(0)
    expect(misses('2026-10-24T01:30:00Z')).toBe(1)
  })

  it('reads an empty pile as nothing', () => {
    const empty = buildCollectPayers(buildCollectPile({ bills: [], paySpeeds: speeds, promisesByJob: null, payAppJobIds: new Set(), gcPayerIds: new Set(), todayYmd: TODAY }))
    expect(empty).toEqual({ payers: [], cut: [], cutUsd: 0, cutShare: 0, rest: { payers: 0, bills: 0, usd: 0, maxUsd: 0, oldestAgeDays: null, latePileUsd: 0 } })
  })
})
