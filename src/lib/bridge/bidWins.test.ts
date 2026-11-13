import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { BID_AGING, BID_SIZES, buildBidWins, buildMarketWorth, type BidSent } from './bidWins'

const TODAY = '2026-11-11'
const WINDOW_START = '2026-09-16'
const bid = (over: Partial<BidSent> & Pick<BidSent, 'sentYmd' | 'usd'>): BidSent => ({ outcome: null, hasJob: false, jobUsd: null, ...over })
const build = (bids: BidSent[]) => buildBidWins({ todayYmd: TODAY, windowStart: WINDOW_START, bids })
const size = (w: ReturnType<typeof build>, id: string) => w.sizes.find((s) => s.id === id)!

describe('buildBidWins: only a mark decides', () => {
  it('counts a bid as won when it is marked won, or marked started or complete', () => {
    const w = build([bid({ sentYmd: '2026-10-01', usd: 20_000, outcome: 'won' }), bid({ sentYmd: '2026-10-02', usd: 30_000, outcome: 'started_or_complete' }), bid({ sentYmd: '2026-10-03', usd: 50_000, outcome: 'lost' })])
    expect(w.won).toEqual({ count: 2, usd: 50_000 })
    expect(w.lost).toEqual({ count: 1, usd: 50_000 })
    expect(w.coefficient).toBe(0.5)
  })

  it('does not count a bid as won because a job was made from it', () => {
    const w = build([bid({ sentYmd: '2026-10-01', usd: 20_000, hasJob: true, jobUsd: 20_000 })])
    expect(w.won.count).toBe(0)
    expect(w.noMark).toEqual({ count: 1, usd: 20_000 })
    // Young and unmarked: nothing is won or lost yet, so there is no rate.
    expect(w.coefficient).toBeNull()
  })

  it('reads a won bid with no value at its job’s revenue, and says when a won bid has no dollars at all', () => {
    const w = build([bid({ sentYmd: '2026-10-01', usd: 0, outcome: 'won', hasJob: true, jobUsd: 12_000 }), bid({ sentYmd: '2026-10-02', usd: 0, outcome: 'won' })])
    expect(w.won).toEqual({ count: 2, usd: 12_000 })
    expect(w.wonNoValue).toBe(1)
  })

  it('leaves out a bid sent on a day that cannot be real, and one sent after today', () => {
    const w = build([bid({ sentYmd: '0002-04-09', usd: 40_000, outcome: 'lost' }), bid({ sentYmd: '2026-12-01', usd: 40_000, outcome: 'won' })])
    expect(w.won.count + w.lost.count + w.noMark.count).toBe(0)
  })
})

describe('buildBidWins: a bid with no mark, by its age', () => {
  it('counts nothing as lost under 90 days, half after 90 and 95% after 180', () => {
    expect(BID_AGING).toEqual([
      { afterDays: 180, lostShare: 0.95 },
      { afterDays: 90, lostShare: 0.5 },
    ])
    // 89, 90 and 180 days before 2026-11-11.
    const w = build([bid({ sentYmd: '2026-08-14', usd: 20_000 }), bid({ sentYmd: '2026-08-13', usd: 20_000 }), bid({ sentYmd: '2026-05-15', usd: 20_000 }), bid({ sentYmd: '2026-10-01', usd: 20_000, outcome: 'won' })])
    expect(w.noMark).toEqual({ count: 3, usd: 60_000 })
    expect(w.noMarkOld).toEqual({ count: 1, usd: 20_000 })
    expect(w.agedLostUsd).toBe(0 + 10_000 + 19_000)
    // Won 20,000 against 29,000 counted as lost.
    expect(w.coefficient).toBeCloseTo(20_000 / 49_000, 10)
  })

  it('never counts an unmarked bid as part won', () => {
    const w = build([bid({ sentYmd: '2026-01-01', usd: 100_000 })])
    expect(w.won.usd).toBe(0)
    expect(w.coefficient).toBe(0)
  })
})

describe('buildBidWins: a rate for each size', () => {
  it('sorts a bid into its size by its dollars', () => {
    expect(BID_SIZES.map((s) => s.label)).toEqual(['Under $10k', '$10k to $50k', '$50k to $500k', 'Over $500k'])
    const w = build([bid({ sentYmd: '2026-10-01', usd: 9_999, outcome: 'won' }), bid({ sentYmd: '2026-10-01', usd: 10_000, outcome: 'won' }), bid({ sentYmd: '2026-10-01', usd: 499_999, outcome: 'lost' }), bid({ sentYmd: '2026-10-01', usd: 500_000, outcome: 'lost' })])
    expect(w.sizes.map((s) => [s.id, s.won.count, s.lost.count])).toEqual([
      ['small', 1, 0],
      ['mid', 1, 0],
      ['large', 0, 1],
      ['giant', 0, 1],
    ])
  })

  it('reads the week’s bids at the rate for their own size, so one giant bid adds almost nothing', () => {
    const history = [
      // Mid: 1 of 4 by dollars. Giant: none of 2.
      bid({ sentYmd: '2026-03-01', usd: 20_000, outcome: 'won' }),
      bid({ sentYmd: '2026-03-02', usd: 60_000 / 3, outcome: 'lost' }),
      bid({ sentYmd: '2026-03-03', usd: 60_000 / 3, outcome: 'lost' }),
      bid({ sentYmd: '2026-03-04', usd: 60_000 / 3, outcome: 'lost' }),
      bid({ sentYmd: '2026-03-05', usd: 900_000, outcome: 'lost' }),
      bid({ sentYmd: '2026-03-06', usd: 900_000, outcome: 'lost' }),
    ]
    // In the eight week window: one mid bid and one giant, both too young to age.
    const w = build([...history, bid({ sentYmd: '2026-10-20', usd: 40_000 }), bid({ sentYmd: '2026-10-21', usd: 2_000_000 })])
    expect(size(w, 'mid').rate).toBeCloseTo(0.25, 10)
    expect(size(w, 'giant').rate).toBe(0)
    expect(size(w, 'mid').sentPerWeekUsd).toBe(5_000)
    expect(size(w, 'giant').sentPerWeekUsd).toBe(250_000)
    // 5,000 a week at 25%, and 250,000 a week at nothing.
    expect(w.wonPerWeekUsd).toBeCloseTo(1_250, 6)
    expect(w.windowRate).toBeCloseTo(1_250 / 255_000, 10)
  })

  it('reads a size with nothing won or lost at the rate of all sizes together', () => {
    const w = build([bid({ sentYmd: '2026-03-01', usd: 20_000, outcome: 'won' }), bid({ sentYmd: '2026-03-02', usd: 20_000, outcome: 'lost' }), bid({ sentYmd: '2026-10-20', usd: 4_000 })])
    expect(size(w, 'small').rate).toBeNull()
    expect(size(w, 'small').usedRate).toBe(0.5)
    expect(size(w, 'small').wonPerWeekUsd).toBe(250)
  })
})

describe('buildBidWins: what is left out, and the words', () => {
  it('leaves a bid on something the Bridge leaves out from every count, and says how many', () => {
    const w = build([bid({ sentYmd: '2026-10-01', usd: 20_000, outcome: 'won' }), bid({ sentYmd: '2026-10-02', usd: 20_000, outcome: 'lost' }), bid({ sentYmd: '2026-10-03', usd: 900_000, outcome: 'lost', leftOut: true })])
    expect(w.lost).toEqual({ count: 1, usd: 20_000 })
    expect(w.leftOutCount).toBe(1)
    expect(w.detail).toContain('1 sent bid is on what the Bridge leaves out, and is not counted.')
  })

  it('says there is no rate while nothing is marked and nothing has aged', () => {
    const w = build([bid({ sentYmd: '2026-10-20', usd: 40_000 })])
    expect(w.wonPerWeekUsd).toBeNull()
    expect(w.line).toBe('bids: no won rate yet')
    expect(w.detail).toEqual(['No bid is marked won or lost yet, so there is no won rate to use.'])
  })

  it('writes every sentence in plain words', () => {
    const many: BidSent[] = []
    for (let i = 0; i < 12; i++) many.push(bid({ sentYmd: '2026-03-01', usd: 15_000 + i * 40_000, outcome: i % 3 === 0 ? 'won' : 'lost' }))
    many.push(bid({ sentYmd: '2026-01-05', usd: 80_000 }), bid({ sentYmd: '2026-10-20', usd: 30_000 }), bid({ sentYmd: '2026-10-20', usd: 0, outcome: 'won' }))
    const w = build(many)
    expect(w.thin).toBe(false)
    for (const sentence of w.detail) expect({ sentence, failures: plainWordsFailures(sentence) }).toEqual({ sentence, failures: [] })
  })

  it('marks a thin count', () => {
    const w = build([bid({ sentYmd: '2026-10-01', usd: 20_000, outcome: 'won' }), bid({ sentYmd: '2026-10-02', usd: 20_000, outcome: 'lost' })])
    expect(w.thin).toBe(true)
    expect(w.line).toContain('a thin count')
  })
})

describe('buildMarketWorth', () => {
  it('adds what the bids win and what the estimates sell, and keeps both lines', () => {
    const m = buildMarketWorth({ wonPerWeekUsd: 24_000, line: 'bids $24k at 7% won', detail: ['Bids.'] }, { soldPerWeekUsd: 7_000, line: 'estimates $7k at 48% won', detail: ['Estimates.'] })
    expect(m.perWeekUsd).toBe(31_000)
    expect(m.pace).toBe('worth $31k a week')
    expect(m.parts).toEqual(['bids $24k at 7% won', 'estimates $7k at 48% won'])
    expect(m.detail).toEqual(['Bids.', 'Estimates.'])
  })

  it('reads on one kind alone, and not at all with neither', () => {
    expect(buildMarketWorth({ wonPerWeekUsd: null, line: 'bids: no won rate yet', detail: [] }, { soldPerWeekUsd: 7_000, line: 'estimates $7k at 48% won', detail: [] }).perWeekUsd).toBe(7_000)
    const none = buildMarketWorth(null, null)
    expect(none.perWeekUsd).toBeNull()
    expect(none.pace).toBe('not read yet')
  })
})

describe('buildBidWins: which bids are behind each count (punch list #334, PR 4)', () => {
  it('keeps each size’s bids by their place in the list handed in, and a left-out bid in none', () => {
    // 2026-06-01 is before the window: it is behind the rate and not among the bids sent in the window.
    const w = build([
      bid({ sentYmd: '2026-10-01', usd: 20_000, outcome: 'won' }),
      bid({ sentYmd: '2026-10-02', usd: 5_000, outcome: 'lost' }),
      bid({ sentYmd: '2026-06-01', usd: 30_000, outcome: 'lost' }),
      bid({ sentYmd: '2026-10-03', usd: 900_000, outcome: 'lost', leftOut: true }),
      bid({ sentYmd: '2026-10-04', usd: 40_000 }),
    ])
    expect(size(w, 'mid').members).toEqual({ sent: [0, 4], won: [0], lost: [2], noMark: [4] })
    expect(size(w, 'small').members).toEqual({ sent: [1], won: [], lost: [1], noMark: [] })
    expect(size(w, 'giant').members).toEqual({ sent: [], won: [], lost: [], noMark: [] })
    // The lists and the counts are one count.
    for (const s of w.sizes) expect([s.members.won.length, s.members.lost.length, s.members.noMark.length]).toEqual([s.won.count, s.lost.count, s.noMark.count])
  })
})
