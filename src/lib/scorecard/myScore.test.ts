import { describe, expect, it } from 'vitest'
import { buildEstimatorScore, type EstimatorBidInput } from './estimatorScore'
import { buildHurdle } from './hurdle'
import { MY_SCORE_WORDS, closeoutChip, closeoutChipsByBid, myScoreHasAnything, myScoreRowWords, myScoreStripWords } from './myScore'
import { estimatorScoresFromWire, estimatorScoresToWire, teamScoresView, teamScoresViewAllowed } from './scorecardWire'

const hurdle = buildHurdle({ overheadUsd: 12_000, paidFieldHours: 1_000, windowDays: 56, setting: { targetProfitPerHourUsd: 25 } }) // $37/h
const usable = { usable: true, rowsWithHours: 10, rowsTotal: 10, rateSet: true }
const bid = (over: Partial<EstimatorBidInput>): EstimatorBidInput => ({
  bidId: 'b1',
  bidNumber: '512',
  projectName: 'Riverside Lofts',
  customerName: 'Seguin Ridge',
  estimatorName: 'Wendi',
  accountManagerName: null,
  outcome: 'won',
  outcomeYmd: '2026-11-01',
  sentYmd: '2026-10-10',
  pricedRevenueUsd: 100_000,
  pricedCostUsd: 80_000,
  pricedUncostedUsd: 0,
  labor: usable,
  awardedHours: 400,
  job: null,
  ...over,
})
const score = (bids: EstimatorBidInput[]) => buildEstimatorScore({ bids, hurdle, fromYmd: '2026-09-21', toYmd: '2026-11-15', todayYmd: '2026-11-15' })
const closedJob = (actual: number) => ({ jobId: 'j1', label: '1042 Riverside', status: 'billed', finished: true, closedYmd: '2026-11-10', actualGrossProfitUsd: actual })

describe('the estimator’s own row', () => {
  it('the ramp: how many priced bids can be scored, and how many need their Labor tab', () => {
    const e = score([bid({ outcome: null, outcomeYmd: null, labor: { usable: false, rowsWithHours: 1, rowsTotal: 10, rateSet: true } }), bid({ bidId: 'b2', outcome: null, outcomeYmd: null })])
    expect(e.ramp).toBe(true)
    expect(myScoreStripWords(e)).toEqual({ figure: '1 of 2', words: 'of your priced bids can be scored · 1 needs its Labor tab finished' })
    expect(myScoreHasAnything(e)).toBe(true)
  })

  it('once a judged bid is awarded: the dollars, and what a closed job moved', () => {
    const e = score([bid({}), bid({ bidId: 'b2', bidNumber: '498', outcomeYmd: '2026-10-01', job: closedJob(22_300) })])
    // $20,000 over 400 h is $50/h, over the $37/h hurdle: both count; the closed one moved by +$2,300.
    expect(myScoreStripWords(e)).toEqual({ figure: '$42,300', words: 'won above the hurdle on 2 bids · 1 job closed and moved it by +$2,300' })
  })

  it('a person with no bid in the window has no row', () => {
    const e = score([])
    expect(myScoreHasAnything(e)).toBe(false)
    expect(myScoreStripWords(e).words).toBe('no bid of yours awarded or closed in the window')
  })

  it('says the hurdle as one figure', () => {
    expect(MY_SCORE_WORDS.hurdle(37)).toBe('The hurdle is $37/h: a bid scores when its priced profit on each labor hour clears it.')
    expect(MY_SCORE_WORDS.hurdle(null)).toContain('no hurdle yet')
    expect(MY_SCORE_WORDS.windowLead(56)).toBe('Your bids over the last 8 weeks, as estimator or account manager.')
  })
})

describe('a closeout’s chip on the bid', () => {
  it('names what the job made against the estimate, up or down', () => {
    const up = score([bid({ job: closedJob(22_300) })]).closeouts[0]!
    expect(closeoutChip(up)).toEqual({ text: 'Closed +$2,300', tone: 'up', title: 'The job closed on 2026-11-10. It made $22,300 against the $20,000 the bid was priced to make. The estimating score moved by +$2,300.' })
    const down = score([bid({ job: closedJob(18_900) })]).closeouts[0]!
    expect(closeoutChip(down)).toMatchObject({ text: 'Closed −$1,100', tone: 'down' })
    const even = score([bid({ job: closedJob(20_000) })]).closeouts[0]!
    expect(closeoutChip(even)).toMatchObject({ text: 'Closed on its estimate', tone: 'even' })
    expect(closeoutChip(even)!.title).toContain('The estimating score did not move.')
  })
  it('only a closed bid has one, and the board finds them by bid', () => {
    const e = score([bid({}), bid({ bidId: 'b2', job: closedJob(22_300) })])
    expect(closeoutChip(e.awarded.find((r) => r.bidId === 'b1')!)).toBeNull()
    expect([...closeoutChipsByBid(e).keys()]).toEqual(['b2'])
    expect(closeoutChipsByBid(null).size).toBe(0)
  })
  it('reads each kind of row in the sheet', () => {
    const e = score([bid({}), bid({ bidId: 'b2', bidNumber: '498', job: closedJob(22_300) }), bid({ bidId: 'b3', bidNumber: '530', outcome: null, outcomeYmd: null, sentYmd: '2026-11-05' })])
    expect(myScoreRowWords(e.awarded.find((r) => r.bidId === 'b1')!)).toBe('B512 Riverside Lofts · $20,000 at $50/h')
    expect(myScoreRowWords(e.closeouts[0]!)).toBe('B498 Riverside Lofts · Closed +$2,300')
    expect(myScoreRowWords(e.waiting[0]!)).toBe('B530 Riverside Lofts · out 10 days')
  })
})

describe('the function’s views', () => {
  it('reads the view asked for, full when none', () => {
    expect([undefined, 'full', 'bids', 'mine', 'everything'].map(teamScoresView)).toEqual(['full', 'full', 'bids', 'mine', 'full'])
  })
  it('mine is anyone’s; full and bids are the scoreboard’s gate', () => {
    expect((['full', 'bids', 'mine'] as const).map((v) => teamScoresViewAllowed(v, false))).toEqual([false, false, true])
    expect((['full', 'bids', 'mine'] as const).map((v) => teamScoresViewAllowed(v, true))).toEqual([true, true, true])
  })
  it('the estimating score travels with the hurdle as one figure, never the overhead behind it', () => {
    const read = { fromYmd: '2026-09-21', toYmd: '2026-11-15', todayYmd: '2026-11-15', windowDays: 56, hurdle, estimator: score([bid({})]), actualsUnread: 0 }
    const wire = JSON.parse(JSON.stringify(estimatorScoresToWire(read, 'mine')))
    expect(wire.hurdlePerHourUsd).toBe(37)
    expect(wire.targetProfitPerHourUsd).toBe(25)
    expect(JSON.stringify(wire)).not.toContain('overheadUsd')
    expect(JSON.stringify(wire)).not.toContain('paidFieldHours')
    expect(estimatorScoresFromWire(wire)?.estimator.awarded).toHaveLength(1)
    expect(estimatorScoresFromWire({ view: 'mine' })).toBeNull()
    expect(estimatorScoresFromWire(null)).toBeNull()
  })
})
