import { describe, expect, it } from 'vitest'
import type { PaySpeedData, PromisedPayDate } from '../../jobs/billedExpectedPay'
import { COLLECT_RULES_DEFAULT, buildCollectPile, collectPaceFor, gcPaceHere, type CollectBill } from './collectPile'

// The pile as read on Sunday 2026-10-25, the figures the Monday board drew.
const TODAY = '2026-10-25'
const STRUCTURA = 'c-structura'
const RMC = 'c-rmc'
const SOUTHERN = 'c-southern'
const HARPER = 'c-harper'
const HANDI = 'c-handi'
const KNIGHT = 'c-knight'
const TOM = 'c-tom'

const speeds: PaySpeedData = {
  company: { medianDays: 7, samples: 286 },
  customers: { [RMC]: { medianDays: 35, samples: 4 }, [HARPER]: { medianDays: 74, samples: 1 }, [HANDI]: { medianDays: 6, samples: 10 }, [KNIGHT]: { medianDays: 30, samples: 31 } },
  segments: { residential: { medianDays: 2, samples: 136 }, commercial: { medianDays: 12, samples: 150 } },
  customerTypes: { [STRUCTURA]: 'commercial', [RMC]: 'commercial', [SOUTHERN]: 'commercial', [HARPER]: 'commercial', [HANDI]: 'commercial', [KNIGHT]: 'commercial', [TOM]: 'residential' },
  receipts: {},
  quality: null,
}
const gcPayers = new Set([RMC, HARPER, KNIGHT, SOUTHERN])
const bill = (key: string, payerId: string, payerName: string, billedYmd: string | null, usd: number, over: Partial<CollectBill> = {}): CollectBill => ({ key, jobId: `j-${key}`, payerId, payerName, billedYmd, usd, ...over })
const promise = (ymd: string, by = 'Taunya'): PromisedPayDate => ({ promisedYmd: ymd, markedByName: by })

describe('gcPaceHere', () => {
  it('is the median of the GC payers with enough samples, with how many it rests on', () => {
    expect(gcPaceHere(speeds, gcPayers, 1)).toEqual({ stat: { medianDays: 35, samples: 36 }, payers: 3 })
    expect(gcPaceHere(speeds, new Set([RMC, HARPER]), 1)).toEqual({ stat: { medianDays: 55, samples: 5 }, payers: 2 })
    expect(gcPaceHere(speeds, new Set([SOUTHERN]), 1)).toEqual({ stat: null, payers: 0 })
    expect(gcPaceHere(null, gcPayers, 1)).toEqual({ stat: null, payers: 0 })
  })
})

describe('collectPaceFor', () => {
  const gcPace = { medianDays: 35, samples: 36 }
  it('reads the payer’s own median first, then the GC pace for a GC, then the segment, then the company', () => {
    expect(collectPaceFor({ payerId: HARPER, isGc: true, paySpeeds: speeds, gcPace, rules: COLLECT_RULES_DEFAULT })).toEqual({ paceDays: 74, source: 'own', samples: 1 })
    expect(collectPaceFor({ payerId: STRUCTURA, isGc: true, paySpeeds: speeds, gcPace, rules: COLLECT_RULES_DEFAULT })).toEqual({ paceDays: 35, source: 'gc', samples: 36 })
    expect(collectPaceFor({ payerId: STRUCTURA, isGc: false, paySpeeds: speeds, gcPace, rules: COLLECT_RULES_DEFAULT })).toEqual({ paceDays: 12, source: 'segment', samples: 150 })
    expect(collectPaceFor({ payerId: 'c-unknown', isGc: false, paySpeeds: speeds, gcPace, rules: COLLECT_RULES_DEFAULT })).toEqual({ paceDays: 7, source: 'company', samples: 286 })
    expect(collectPaceFor({ payerId: STRUCTURA, isGc: true, paySpeeds: speeds, gcPace, rules: { ...COLLECT_RULES_DEFAULT, gcPaceForNewGc: false } })).toEqual({ paceDays: 12, source: 'segment', samples: 150 })
    expect(collectPaceFor({ payerId: STRUCTURA, isGc: true, paySpeeds: null, gcPace, rules: COLLECT_RULES_DEFAULT })).toEqual({ paceDays: null, source: 'none', samples: 0 })
  })
})

describe('buildCollectPile (v2.5848)', () => {
  const bills: CollectBill[] = [
    // SpaceX: a pay application marked billed by hand Sep 24; Structura is the job's customer, not a GC by record.
    bill('spacex', STRUCTURA, 'Structura, Inc. – Austin', '2026-09-24', 103_386.4, { sentFromHere: false }),
    // RMC: the oldest from March, a hand-marked one from Sep 21, one at 66 days.
    bill('rmc-273', RMC, 'RMC- Dudley Mason', '2026-03-16', 13_420),
    bill('rmc-651', RMC, 'RMC- Dudley Mason', '2026-09-21', 8_780, { sentFromHere: false }),
    bill('rmc-258', RMC, 'RMC- Dudley Mason', '2026-08-20', 9_800),
    // Southern Post: three hand-marked bills from Sep 16 and one from Oct 5, all promised for Oct 16 on one job.
    bill('sp-1', SOUTHERN, 'Southern Post Construction', '2026-09-16', 15_200, { jobId: 'j-take5', sentFromHere: false }),
    bill('sp-2', SOUTHERN, 'Southern Post Construction', '2026-10-05', 625, { jobId: 'j-take5' }),
    // TF Harper: $29k hand-marked Sep 16 inside a 74-day pace; a $2.9k from July.
    bill('tfh-523', HARPER, 'TF Harper', '2026-09-16', 29_323.4, { sentFromHere: false }),
    bill('tfh-883', HARPER, 'TF Harper', '2026-07-06', 2_918),
    // H & I: three bills from Friday and a $350 from Sep 3.
    bill('hi-1', HANDI, 'H & I Construction', '2026-10-23', 6_380),
    bill('hi-2', HANDI, 'H & I Construction', '2026-09-03', 350),
    // Knight: a doubtful one from July, a promise broken since Sep 15.
    bill('kn-663', KNIGHT, 'Knight Contracting', '2026-07-06', 1_829),
    bill('kn-789', KNIGHT, 'Knight Contracting', '2026-07-31', 454),
    // A residential customer with no history, two days old.
    bill('tom', TOM, 'Tom Coyle', '2026-10-23', 215),
    // A Collections job, a settled row and a shell with no day.
    bill('coll', 'c-old', 'An old GC', '2026-02-01', 19_522, { inCollections: true }),
    bill('settled', HANDI, 'H & I Construction', null, 0),
    bill('shell', 'c-shell', 'Shell job', null, 1_000),
  ]
  const promises = { 'j-take5': promise('2026-10-16'), 'j-kn-789': promise('2026-09-15') }
  const pile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: promises, payAppJobIds: new Set(['j-spacex']), gcPayerIds: gcPayers, todayYmd: TODAY })
  const read = (key: string) => pile.bills.find((b) => b.key === key)!

  it('reads a pay application’s payer as a GC at the GC pace here, due on the billed day plus that pace', () => {
    const s = read('spacex')
    expect(s.isGc).toBe(true)
    expect(s).toMatchObject({ paceDays: 35, paceSource: 'gc', paceSamples: 36, expectedYmd: '2026-10-29', daysPastExpected: -4, state: 'notdue', ageDays: 31 })
  })

  it('reads a commercial payer’s hand-marked bill as a GC too, and the same bill as late at the segment pace with both rules off', () => {
    const byHand = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: promises, payAppJobIds: new Set(), gcPayerIds: gcPayers, todayYmd: TODAY })
    expect(byHand.bills.find((b) => b.key === 'spacex')).toMatchObject({ isGc: true, paceSource: 'gc', state: 'notdue' })
    const off = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: promises, payAppJobIds: new Set(['j-spacex']), gcPayerIds: gcPayers, todayYmd: TODAY, rules: { gcByPayApp: false, gcByHandMarked: false } })
    expect(off.bills.find((b) => b.key === 'spacex')).toMatchObject({ isGc: false, paceDays: 12, paceSource: 'segment', expectedYmd: '2026-10-06', state: 'late' })
  })

  it('reads late, doubtful and not yet due against the payer’s own pace', () => {
    expect(read('rmc-273')).toMatchObject({ paceSource: 'own', paceDays: 35, expectedYmd: '2026-04-20', state: 'doubtful', ageDays: 223 })
    expect(read('rmc-651')).toMatchObject({ expectedYmd: '2026-10-26', state: 'notdue' })
    expect(read('rmc-258')).toMatchObject({ expectedYmd: '2026-09-24', state: 'late', daysPastExpected: 31 })
    expect(read('tfh-523')).toMatchObject({ paceDays: 74, expectedYmd: '2026-11-29', state: 'notdue' })
    expect(read('tfh-883')).toMatchObject({ expectedYmd: '2026-09-18', state: 'late' })
    expect(read('hi-1')).toMatchObject({ paceDays: 6, state: 'notdue' })
    expect(read('hi-2')).toMatchObject({ state: 'late', ageDays: 52 })
    expect(read('kn-663')).toMatchObject({ paceDays: 30, expectedYmd: '2026-08-05', state: 'doubtful' })
  })

  it('reads a promise as promised until its day plus the grace, then broken, whatever the pace', () => {
    expect(read('sp-1')).toMatchObject({ state: 'broken', expectedYmd: '2026-10-16', daysPastExpected: 9, promise: promises['j-take5'] })
    expect(read('sp-2')).toMatchObject({ state: 'broken' })
    expect(read('kn-789')).toMatchObject({ state: 'broken', daysPastExpected: 40 })
    const kept = buildCollectPile({ bills: [bill('x', RMC, 'RMC', '2026-09-01', 100)], paySpeeds: speeds, promisesByJob: { 'j-x': promise('2026-10-30') }, payAppJobIds: new Set(), gcPayerIds: gcPayers, todayYmd: TODAY })
    expect(kept.bills[0]).toMatchObject({ state: 'promised', expectedYmd: '2026-10-30', daysPastExpected: -5 })
    const inGrace = buildCollectPile({ bills: [bill('x', RMC, 'RMC', '2026-09-01', 100)], paySpeeds: speeds, promisesByJob: { 'j-x': promise('2026-10-20') }, payAppJobIds: new Set(), gcPayerIds: gcPayers, todayYmd: TODAY })
    expect(inGrace.bills[0]!.state).toBe('promised')
  })

  it('reads a customer with no history at its segment median, and a row with no day as not yet due', () => {
    expect(read('tom')).toMatchObject({ paceDays: 2, paceSource: 'segment', expectedYmd: '2026-10-25', state: 'notdue' })
    expect(read('shell')).toMatchObject({ paceSource: 'company', expectedYmd: null, state: 'notdue', ageDays: null })
  })

  it('keeps Collections apart, drops settled rows, and sums the headline, the late pile and the past-due count', () => {
    expect(read('coll').state).toBe('collections')
    expect(pile.bills.some((b) => b.key === 'settled')).toBe(false)
    expect(pile.byState.collections).toEqual({ usd: 19_522, count: 1 })
    const all = pile.bills.filter((b) => b.state !== 'collections').reduce((s, b) => s + b.usd, 0)
    expect(pile.headlineUsd).toBeCloseTo(all, 6)
    expect(pile.headlineCount).toBe(14)
    expect(pile.latePileUsd).toBeCloseTo(9_800 + 2_918 + 350 + 15_200 + 625 + 454, 6)
    expect(pile.latePileCount).toBe(6)
    expect(pile.pastDueCount).toBe(8)
    expect(pile.byState.doubtful).toEqual({ usd: 13_420 + 1_829, count: 2 })
    expect(pile.gcPace).toEqual({ medianDays: 35, samples: 36 })
    expect(pile.gcPacePayers).toBe(3)
  })

  it('rests the GC pace on the payers named, when given', () => {
    const inPile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: promises, payAppJobIds: new Set(['j-spacex']), gcPayerIds: gcPayers, gcPaceFromIds: new Set([RMC, HARPER]), todayYmd: TODAY })
    expect(inPile.gcPace).toEqual({ medianDays: 55, samples: 5 })
    expect(inPile.gcPacePayers).toBe(2)
    expect(inPile.bills.find((b) => b.key === 'spacex')).toMatchObject({ paceDays: 55, expectedYmd: '2026-11-18' })
  })

  it('takes the rules as inputs', () => {
    const strict = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: promises, payAppJobIds: new Set(['j-spacex']), gcPayerIds: gcPayers, todayYmd: TODAY, rules: { brokenGraceDays: 10, doubtfulAfterDays: 30 } })
    expect(strict.rules).toMatchObject({ brokenGraceDays: 10, doubtfulAfterDays: 30, minSamples: 1 })
    expect(strict.bills.find((b) => b.key === 'sp-1')!.state).toBe('promised')
    expect(strict.bills.find((b) => b.key === 'rmc-258')!.state).toBe('doubtful')
  })
})
