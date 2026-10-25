import { describe, expect, it } from 'vitest'
import type { BridgeCall } from '../calls'
import type { ChaseTouch } from '../../jobs/paymentChase'
import type { PaySpeedData } from '../../jobs/billedExpectedPay'
import { plainWordsFailures } from '../../plainWords'
import { buildCollectPile, type CollectBill } from './collectPile'
import { buildCollectPayers } from './collectPayers'
import { buildCollectSheet, collectMoveFor } from './collectMoves'
import { collectScorecard } from './collectScorecard'

const md = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const speeds: PaySpeedData = { company: { medianDays: 7, samples: 286 }, customers: { rmc: { medianDays: 35, samples: 4 }, handi: { medianDays: 6, samples: 10 } }, segments: { residential: null, commercial: { medianDays: 12, samples: 150 } }, customerTypes: { structura: 'commercial', rmc: 'commercial', southern: 'commercial', handi: 'commercial', knight: 'commercial' }, receipts: {}, quality: null }
const bill = (key: string, payerId: string, payerName: string, billedYmd: string, usd: number, over: Partial<CollectBill> = {}): CollectBill => ({ key, jobId: `j-${key}`, payerId, payerName, billedYmd, usd, ...over })
// Friday Oct 30: Structura paid in full on its own pace, RMC paid part after a call and promised the rest, Southern Post spoke with no date, H & I paid its $350, Knight got a statement.
const bills = [
  bill('rmc-a', 'rmc', 'RMC- Dudley Mason', '2026-08-18', 20_000),
  ...[1, 2, 3, 4, 5, 6, 7].map((i) => bill(`rmc-${i}`, 'rmc', 'RMC- Dudley Mason', '2026-08-20', 6_000)),
  bill('sp', 'southern', 'Southern Post Construction', '2026-09-16', 38_625, { sentFromHere: false }),
  bill('kn', 'knight', 'Knight Contracting', '2026-09-20', 4_000),
]
const pile = buildCollectPile({ bills, paySpeeds: speeds, promisesByJob: { 'j-rmc-a': { promisedYmd: '2026-11-06', markedByName: 'Taunya' } }, payAppJobIds: new Set(), gcPayerIds: new Set(['rmc', 'southern', 'knight']), todayYmd: '2026-10-30' })
const sheet = buildCollectSheet(buildCollectPayers(pile), (p) => collectMoveFor(p, { todayYmd: '2026-10-30', dayLabel: md }))
const call: BridgeCall = {
  id: 'c1',
  weekStart: '2026-10-25',
  calledOn: '2026-10-26',
  calledByName: 'Robert',
  link: 'collect',
  moves: [
    { key: 'chase', title: 'Structura, Inc. – Austin: Call for the pay date', who: 'Taunya · Mon', then: 103_386 },
    { key: 'chase', title: 'RMC- Dudley Mason: Send the statement, then call', who: 'Taunya · Tue', then: 76_600 },
    { key: 'chase', title: 'Southern Post Construction: Call: the Oct 16 promise', who: 'Taunya · Mon', then: 38_625 },
    { key: 'chase', title: 'H & I Construction: Ask about the $350', who: '', then: 350 },
    { key: 'chase', title: 'Knight Contracting: Send the statement', who: '', then: 4_000 },
  ],
  measures: { linkWeeks: 10.2, stageWeeks: {}, keys: {} },
  note: null,
  outcome: null,
  outcomeAt: null,
  outcomeNote: null,
}
const touch = (id: string, customerId: string, outcome: ChaseTouch['outcome'], createdAt: string, note: string | null = null): ChaseTouch => ({ id, customerId, jobId: null, outcome, note, promisedYmd: null, snoozeDays: null, resolvedAt: null, createdAt, createdByName: 'Taunya' })
const touches = [
  touch('t1', 'structura', 'promised', '2026-10-26T15:00:00Z'),
  touch('t2', 'rmc', 'note', '2026-10-28T15:00:00Z', 'called after the statement'),
  touch('t3', 'rmc', 'promised', '2026-10-28T15:30:00Z'),
  touch('t4', 'southern', 'cant_reach', '2026-10-26T16:00:00Z'),
  touch('t5', 'southern', 'note', '2026-10-28T16:00:00Z', 'the check went out Friday'),
  touch('t0', 'handi', 'promised', '2026-10-20T10:00:00Z'),
]
const payments = [
  { payerId: 'structura', payerName: 'Structura, Inc. – Austin', usd: 103_386, paidOn: '2026-10-29' },
  { payerId: 'rmc', payerName: 'RMC- Dudley Mason', usd: 14_600, paidOn: '2026-10-28' },
  { payerId: 'handi', payerName: 'H & I Construction', usd: 350, paidOn: '2026-10-27' },
  { payerId: 'rmc', payerName: 'RMC- Dudley Mason', usd: 1_000, paidOn: '2026-10-24' },
]
const plain = (s: string) => expect(plainWordsFailures(s), s).toEqual([])

describe('collectScorecard (v2.5858)', () => {
  const card = collectScorecard({ call, sheet, touches, payments, notices: { drafted: 6, signed: 8, mailed: 0, affidavitsFiled: 0 }, todayYmd: '2026-10-30' })

  it('counts what landed since the plan, and what landed after a call', () => {
    expect(card.askUsd).toBe(103_386 + 76_600 + 38_625 + 350 + 4_000)
    expect(card.landedUsd).toBe(103_386 + 14_600 + 350)
    // Structura paid three days after a recorded touch: after a call by the rule as written; H & I's touch was before the plan.
    expect(card.landedAfterCallUsd).toBe(103_386 + 14_600)
    expect(card.landedShare).toBeCloseTo(card.landedUsd / card.askUsd, 9)
  })

  it('counts the calls that ended with a date, a statement never in the denominator', () => {
    // The plan named five moves; Knight's statement is not a call.
    expect(card.calls).toBe(4)
    expect(card.datedCalls).toBe(3)
    expect(card.noDateCalls).toBe(1)
    expect(card.rows.find((r) => r.payerName === 'Structura, Inc. – Austin')).toMatchObject({ row: null, landedUsd: 103_386, dated: true, isCall: true })
    const sp = card.rows.find((r) => r.payerName === 'Southern Post Construction')!
    expect(sp.dated).toBe(false)
    expect(sp.touchesSince).toBe(2)
    const rmc = card.rows.find((r) => r.payerName === 'RMC- Dudley Mason')!
    expect(rmc).toMatchObject({ dated: true, landedUsd: 14_600, landedAfterCallUsd: 14_600 })
    expect(rmc.planned?.who).toBe('Taunya · Tue')
  })

  it('says the verdict and what Monday carries, in plain words', () => {
    expect(card.words).toContain('of it after a call.')
    expect(card.words).toContain('8 notices signed, none mailed yet.')
    plain(card.words)
    expect(card.carries.some((c) => c.startsWith('Southern Post Construction: Call'))).toBe(true)
    expect(card.carries.some((c) => c.startsWith('RMC- Dudley Mason: watch 2026-11-06'))).toBe(true)
    for (const c of card.carries) plain(c.replace(/\d{4}-\d{2}-\d{2}/, 'Nov 6'))
    const none = collectScorecard({ call, sheet, touches: null, payments: [], notices: null, todayYmd: '2026-10-30' })
    expect(none.landedUsd).toBe(0)
    expect(none.words).toContain('The notices are not read.')
  })
})
