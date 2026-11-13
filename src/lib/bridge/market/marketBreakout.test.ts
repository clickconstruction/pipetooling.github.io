import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { buildBidWins, type BidSent } from '../bidWins'
import { buildEstimateWins, type EstimateSent } from '../estimateWins'
import { stageUsd } from '../stageFlow'
import { bidsBreakout, breakoutPressLabel, breakoutRowLabel, estimatesBreakout } from './marketBreakout'

// Made-up bids and estimates.
const todayYmd = '2026-03-02'
const windowStart = '2026-01-05'
const bid = (sentYmd: string, outcome: string | null, usd: number): BidSent => ({ sentYmd, outcome, usd, hasJob: false, jobUsd: null })
const bids: BidSent[] = [
  bid('2026-02-02', 'won', 8_000),
  bid('2026-02-09', 'lost', 4_000),
  bid('2026-02-10', 'lost', 40_000),
  bid('2026-02-11', 'won', 20_000),
  bid('2026-02-16', null, 30_000),
  bid('2026-02-17', 'lost', 200_000),
]
const est = (sentYmd: string, status: string, usd: number, more: Partial<EstimateSent> = {}): EstimateSent => ({ sentYmd, status, usd, ...more })
const estimates: EstimateSent[] = [
  est('2026-02-03', 'customer_accepted', 6_000, { answeredYmd: '2026-02-05' }),
  est('2026-02-10', 'declined', 2_000),
  est('2025-10-01', 'sent', 4_000),
  est('2026-02-20', 'sent', 3_000),
  est('2026-02-01', 'sent', 1_000),
]

describe('bidsBreakout', () => {
  const wins = buildBidWins({ todayYmd, windowStart, bids })
  const b = bidsBreakout(wins)

  it('has a row for each size and a row they add up to', () => {
    expect(b?.columns).toEqual(['Bid size', 'Sent a week', 'Won rate', 'Worth a week'])
    expect(b?.rows.map((r) => r.label)).toEqual([...wins.sizes.map((s) => s.label), 'All bids'])
    expect(b?.rows[b.rows.length - 1]?.total).toBe(true)
  })

  it('reads the same amount as the tile it opens under', () => {
    const all = b?.rows.find((r) => r.key === 'all')
    expect(all?.cells[2]).toBe(stageUsd(wins.wonPerWeekUsd!))
    // The sizes' worth adds up to the whole, to the cent.
    expect(wins.sizes.reduce((s, x) => s + (x.wonPerWeekUsd ?? 0), 0)).toBeCloseTo(wins.wonPerWeekUsd!, 6)
  })

  it('says how each size’s rate is made, and when a size borrows the rate for all bids', () => {
    const small = b?.rows[0]
    expect(small?.note).toBe('1 won, 1 lost, 0 with no mark.')
    const top = b?.rows.find((r) => r.key === wins.sizes[wins.sizes.length - 1]?.id)
    expect(top?.note).toBe('0 won, 0 lost, 0 with no mark. Read at the rate for all bids.')
  })

  it('says what can make it wrong, in plain words', () => {
    expect(b?.notes[0]).toBe('Sent a week is the bids sent over the last 8 weeks.')
    expect(b?.notes.some((n) => n.startsWith(`1 bid has no mark, for ${stageUsd(30_000)}.`))).toBe(true)
    for (const n of b?.notes ?? []) expect(plainWordsFailures(n)).toEqual([])
    for (const r of b?.rows ?? []) if (r.note) expect(plainWordsFailures(r.note)).toEqual([])
  })

  it('opens a size on the bids behind it, by name, when the bids are handed in', () => {
    const named = bids.map((x, i) => ({ ...x, id: `b${i}`, name: `Made-up bid ${i}` }))
    const withNames = bidsBreakout(buildBidWins({ todayYmd, windowStart, bids: named }), named, todayYmd)
    // $10k to $50k holds three: lost $40k, won $20k, no mark $30k. All three were sent in the window.
    const mid = withNames?.rows.find((r) => r.key === wins.sizes[1]?.id)
    expect(mid?.groups?.map((g) => [g.key, g.title, g.words])).toEqual([
      ['sent', 'Sent in the last 8 weeks', `3 bids · ${stageUsd(90_000)}`],
      ['won', 'Won, behind the rate', `1 bid · ${stageUsd(20_000)}`],
      ['lost', 'Lost, behind the rate', `1 bid · ${stageUsd(40_000)}`],
      ['noMark', 'No mark, behind the rate', `1 bid · ${stageUsd(30_000)}`],
    ])
    // Largest first, each with its mark and a press to that bid.
    expect(mid?.groups?.[0]?.items).toEqual([
      { key: 'b2', title: 'Made-up bid 2', detail: 'sent 2/10 · lost', amount: stageUsd(40_000), to: '/bids?tab=bid-board&bidId=b2' },
      { key: 'b4', title: 'Made-up bid 4', detail: 'sent 2/16 · no mark', amount: stageUsd(30_000), to: '/bids?tab=bid-board&bidId=b4' },
      { key: 'b3', title: 'Made-up bid 3', detail: 'sent 2/11 · won', amount: stageUsd(20_000), to: '/bids?tab=bid-board&bidId=b3' },
    ])
    // Each list is as long as the count on its row's note says.
    const small = withNames?.rows[0]
    expect(small?.groups?.find((g) => g.key === 'won')?.items.length).toBe(1)
    expect(small?.groups?.find((g) => g.key === 'lost')?.items.length).toBe(1)
    expect(small?.groups?.some((g) => g.key === 'noMark')).toBe(false)
    // A size with no bid in it does not open, the row they add up to never does, and nothing opens with no bids handed in.
    expect(withNames?.rows.find((r) => r.key === wins.sizes[wins.sizes.length - 1]?.id)?.groups).toBeUndefined()
    expect(withNames?.rows.find((r) => r.key === 'all')?.groups).toBeUndefined()
    expect(b?.rows.every((r) => r.groups === undefined)).toBe(true)
  })

  it('is not there until a won rate reads', () => {
    expect(bidsBreakout(null)).toBeNull()
    expect(bidsBreakout(buildBidWins({ todayYmd, windowStart, bids: [bid('2026-02-16', null, 30_000)] }))).toBeNull()
  })
})

describe('estimatesBreakout', () => {
  const wins = buildEstimateWins({ todayYmd, windowStart, estimates })
  const e = estimatesBreakout(wins)

  it('shows how the won rate is made, by count and dollars', () => {
    expect(e?.columns).toEqual(['Estimates', 'Count', 'Dollars'])
    expect(e?.rows.map((r) => [r.label, ...r.cells])).toEqual([
      ['Approved', '1', stageUsd(6_000)],
      ['Declined', '1', stageUsd(2_000)],
      ['Passed over', '0', stageUsd(0)],
      ['No answer', '1', stageUsd(4_000)],
      ['Won rate, by dollars', '', '50%'],
      // What is still out follows the rate it is not part of.
      ['Still out', '2', stageUsd(4_000)],
    ])
    expect(e?.rows[3]?.note).toBe('Sent over 90 days ago.')
    expect(e?.rows[5]?.note).toBe('No answer yet. Not in the rate.')
  })

  it('opens each row on the estimates behind it, by name, largest first, when the estimates are handed in', () => {
    const named = estimates.map((x, i) => ({ ...x, id: `e${i}`, number: 100 + i, name: i === 3 ? '' : `Made-up estimate ${i}` }))
    const withNames = estimatesBreakout(buildEstimateWins({ todayYmd, windowStart, estimates: named }), named, todayYmd)
    const row = (key: string) => withNames?.rows.find((r) => r.key === key)
    expect(row('won')?.groups).toEqual([{ key: 'won', title: 'Approved', words: `1 estimate · ${stageUsd(6_000)}`, items: [{ key: 'e0', title: 'Made-up estimate 0', detail: 'number 100 · sent 2/3', amount: stageUsd(6_000), to: '/estimates/100' }] }])
    // Still out: two, the larger first; one has no title and is named by its number.
    expect(row('out')?.groups?.[0]?.items.map((x) => [x.title, x.amount, x.to])).toEqual([
      ['Estimate 103', stageUsd(3_000), '/estimates/103'],
      ['Made-up estimate 4', stageUsd(1_000), '/estimates/104'],
    ])
    // A sent day in another year carries its year.
    expect(row('expired')?.groups?.[0]?.items[0]?.detail).toBe('number 102 · sent 10/1/25')
    // A row with nothing behind it does not open, and nor does any row when the estimates are not handed in.
    expect(row('notChosen')?.groups).toBeUndefined()
    expect(e?.rows.every((r) => r.groups === undefined)).toBe(true)
    // Each list is as long as its count.
    for (const r of withNames?.rows ?? []) if (r.groups) expect(String(r.groups[0]?.items.length)).toBe(r.cells[0])
  })

  it('then says what went out a week and what that sells, the tile’s own amount', () => {
    expect(e?.notes[1]).toBe(`At 50% that sells ${stageUsd(wins.soldPerWeekUsd!)} a week.`)
    expect(e?.notes.some((n) => n.startsWith(`2 estimates are still out, for ${stageUsd(4_000)}.`))).toBe(true)
    expect(e?.notes.some((n) => n.startsWith('1 of those has waited over 14 days'))).toBe(true)
    for (const n of e?.notes ?? []) expect(plainWordsFailures(n)).toEqual([])
  })

  it('is not there until a won rate reads', () => {
    expect(estimatesBreakout(null)).toBeNull()
    expect(estimatesBreakout(buildEstimateWins({ todayYmd, windowStart, estimates: [est('2026-02-20', 'sent', 3_000)] }))).toBeNull()
  })
})

describe('breakoutPressLabel', () => {
  it('says the amount and what the press opens', () => {
    expect(breakoutPressLabel('$25.2k', 'bids, at 7% won')).toBe('$25.2k bids, at 7% won. Show what makes it up.')
  })

  it('says what a row opens on, and how many', () => {
    const groups = [
      { key: 'a', title: '', words: '', items: [{ key: '1', title: '', detail: '', amount: '', to: null }] },
      { key: 'b', title: '', words: '', items: [{ key: '2', title: '', detail: '', amount: '', to: null }, { key: '3', title: '', detail: '', amount: '', to: null }] },
    ]
    expect(breakoutRowLabel({ label: 'Under $10k', groups }, false)).toBe('Under $10k. Show the 3 behind it.')
    expect(breakoutRowLabel({ label: 'Under $10k', groups }, true)).toBe('Under $10k. Close the list.')
  })
})
