import { describe, expect, it } from 'vitest'
import { buildEstimatingStrip, type EstimatingPayload } from './dayBookEstimating'

const est = (now: Partial<EstimatingPayload['windows'] extends infer W ? (W extends { now?: infer N } ? NonNullable<N> : never) : never>, was = {}, money = true): EstimatingPayload => ({
  person: 'u-wendi',
  money,
  prev_from: '2026-07-19',
  prev_to: '2026-08-17',
  windows: { now, was },
})

describe('buildEstimatingStrip', () => {
  it('draws the nine tiles from a full window, with "was" beside the trailing measures', () => {
    const tiles = buildEstimatingStrip(
      est(
        { sent_n: 11, sent_usd: 2_140_000, late_n: 2, unfollowed_n: 3, won_n: 3, lost_n: 4, won_usd: 610_000, lost_usd: 1_020_000, lost_no_reason_n: 1, hit_rate: 0.38, hit_decided_n: 7, rfq_asks_n: 9, rfq_median_days: 2.4, robot_runs_n: 6, robot_median_delta: -4.1, bid_hours: 124 },
        { hit_rate: 0.34, hit_decided_n: 6, sent_usd: 1_900_000, bid_hours: 120 },
      ),
    )!
    expect(tiles.map((t) => t.key)).toEqual(['sent', 'late', 'decided', 'hit', 'no-reason', 'unfollowed', 'rfq', 'robot', 'hours'])
    expect(tiles[0]).toMatchObject({ value: '11', sub: '$2.14M', muted: false })
    expect(tiles[1]).toMatchObject({ value: '2 of 11' })
    expect(tiles[2]).toMatchObject({ value: '3 won · 4 lost', sub: '$610k · $1.02M' })
    expect(tiles[3]).toMatchObject({ value: '38%', sub: 'by value · 7 decided · was 34%', muted: false })
    expect(tiles[4]).toMatchObject({ value: '1', sub: 'of 4 lost' })
    expect(tiles[5]).toMatchObject({ value: '3 of 11 sent' })
    expect(tiles[6]).toMatchObject({ value: '2.4 d median', sub: '9 asks' })
    expect(tiles[7]).toMatchObject({ value: '−4.1% median', sub: '6 sealed runs' })
    expect(tiles[8]).toMatchObject({ value: '5.8', sub: 'was 6.3' })
  })

  it('Wendi as the census computed her: a hit rate on two decided is not a rate', () => {
    const tiles = buildEstimatingStrip(est({ sent_n: 5, sent_usd: 264_159, late_n: 4, unfollowed_n: 2, won_n: 0, lost_n: 2, lost_usd: 94_945, lost_no_reason_n: 2, hit_rate: 0, hit_decided_n: 2, rfq_asks_n: 0, robot_runs_n: 1, robot_median_delta: 44.2, bid_hours: 0 }))!
    expect(tiles[1]).toMatchObject({ value: '4 of 5' })
    expect(tiles[3]).toMatchObject({ value: '0%', sub: 'by value · 2 decided', muted: true })
    expect(tiles[4]).toMatchObject({ value: '2', sub: 'of 2 lost' })
    expect(tiles[6]).toMatchObject({ value: '—', muted: true })
    expect(tiles[7]).toMatchObject({ value: '+44.2% median', sub: '1 sealed run' })
    expect(tiles[8]).toMatchObject({ value: '—', sub: 'no bid hours clocked', muted: true })
  })

  it('an empty window reads "—", never 0 %', () => {
    const tiles = buildEstimatingStrip(est({}))!
    expect(tiles.every((t) => t.muted)).toBe(true)
    expect(tiles[3]).toMatchObject({ value: '—', sub: 'nothing decided' })
    expect(tiles[2]!.value).toBe('—')
  })

  it('hides money when the viewer may not see it, and returns null with no strip', () => {
    const tiles = buildEstimatingStrip(est({ sent_n: 3, sent_usd: null, won_n: 1, lost_n: 0, won_usd: null, hit_rate: null, hit_decided_n: 1, bid_hours: 12 }, {}, false))!
    expect(tiles[0]).toMatchObject({ value: '3', sub: 'amounts hidden' })
    expect(tiles[2]).toMatchObject({ value: '1 won · 0 lost', sub: null })
    expect(tiles[8]).toMatchObject({ value: '12.0h on bids', muted: true })
    expect(buildEstimatingStrip(null)).toBeNull()
    expect(buildEstimatingStrip({ ...est({}), windows: null })).toBeNull()
  })
})
