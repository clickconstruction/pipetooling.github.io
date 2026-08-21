import { describe, expect, it } from 'vitest'
import {
  BID_LOSS_CATEGORIES,
  bidLossCategoryLabel,
  buildLossRollup,
  groupLossTriageByBuilder,
  isBidLossCategoryKey,
  nextLossTriageBidIndex,
  suggestLossCategoryFromNote,
  type LossTriageBid,
} from './bidLossCategories'

const bid = (o: Partial<LossTriageBid> = {}): LossTriageBid => ({
  id: 'b1',
  builderKey: 'k1',
  builderName: 'Knight Contracting',
  value: 100000,
  category: null,
  ...o,
})

describe('category vocabulary', () => {
  it('has the six migration keys', () => {
    expect(BID_LOSS_CATEGORIES.map((c) => c.key)).toEqual([
      'gc_lost', 'price', 'other_sub', 'project_died', 'no_bid', 'no_answer',
    ])
  })

  it('validates keys and rejects free text / null', () => {
    expect(isBidLossCategoryKey('price')).toBe(true)
    expect(isBidLossCategoryKey('6 grand over')).toBe(false)
    expect(isBidLossCategoryKey(null)).toBe(false)
    expect(isBidLossCategoryKey(undefined)).toBe(false)
  })

  it('labels known keys, null for unknown', () => {
    expect(bidLossCategoryLabel('gc_lost')).toBe('GC lost the project')
    expect(bidLossCategoryLabel('nope')).toBeNull()
  })
})

describe('groupLossTriageByBuilder', () => {
  it('groups by builderKey and counts unexplained bids and value', () => {
    const groups = groupLossTriageByBuilder([
      bid({ id: 'a', builderKey: 'k1', value: 100 }),
      bid({ id: 'b', builderKey: 'k1', value: 50, category: 'price' }),
      bid({ id: 'c', builderKey: 'k2', builderName: 'Heron', value: 200 }),
    ])
    expect(groups).toHaveLength(2)
    const k1 = groups.find((g) => g.builderKey === 'k1')!
    expect(k1.bids.map((b) => b.id)).toEqual(['a', 'b'])
    expect(k1.needsCount).toBe(1)
    expect(k1.needsValue).toBe(100)
  })

  it('puts builders with unexplained bids first, biggest unexplained value on top', () => {
    const groups = groupLossTriageByBuilder([
      bid({ id: 'a', builderKey: 'small', builderName: 'Small', value: 10 }),
      bid({ id: 'b', builderKey: 'big', builderName: 'Big', value: 999 }),
      bid({ id: 'c', builderKey: 'done', builderName: 'Aaa Done', category: 'gc_lost' }),
    ])
    expect(groups.map((g) => g.builderKey)).toEqual(['big', 'small', 'done'])
  })

  it('treats free-text junk in category as uncategorized', () => {
    const groups = groupLossTriageByBuilder([bid({ category: 'fuckin dale sauer' })])
    expect(groups[0]!.needsCount).toBe(1)
  })

  it('ignores non-finite values in needsValue', () => {
    const groups = groupLossTriageByBuilder([bid({ value: Number.NaN })])
    expect(groups[0]!.needsValue).toBe(0)
  })
})

describe('buildLossRollup', () => {
  it('tallies counts and value per category plus uncategorized', () => {
    const r = buildLossRollup(
      [
        { value: 100, category: 'gc_lost' },
        { value: 50, category: 'gc_lost' },
        { value: 30, category: 'price' },
        { value: 20, category: null },
      ],
      6,
    )
    expect(r.lostCount).toBe(4)
    expect(r.lostValue).toBe(200)
    expect(r.uncategorizedCount).toBe(1)
    expect(r.uncategorizedValue).toBe(20)
    expect(r.lines[0]).toMatchObject({ key: 'gc_lost', count: 2, value: 150 })
  })

  it('computes loss rate and the gc_lost-excluded loss rate', () => {
    const r = buildLossRollup(
      [
        { value: 0, category: 'gc_lost' },
        { value: 0, category: 'gc_lost' },
        { value: 0, category: 'price' },
        { value: 0, category: null },
      ],
      6,
    )
    expect(r.lossRatePct).toBe(40)
    expect(r.lossRateExclGcLostPct).toBe(25)
  })

  it('returns null rates when nothing is decided', () => {
    const r = buildLossRollup([], 0)
    expect(r.lossRatePct).toBeNull()
    expect(r.lossRateExclGcLostPct).toBeNull()
  })

  it('returns null excluded rate when every decided bid is gc_lost', () => {
    const r = buildLossRollup([{ value: 0, category: 'gc_lost' }], 0)
    expect(r.lossRatePct).toBe(100)
    expect(r.lossRateExclGcLostPct).toBeNull()
  })
})

describe('nextLossTriageBidIndex', () => {
  const group = {
    bids: [
      bid({ id: 'a', category: 'price' }),
      bid({ id: 'b' }),
      bid({ id: 'c', category: 'gc_lost' }),
      bid({ id: 'd' }),
    ],
  }

  it('finds the next uncategorized bid after the given index', () => {
    expect(nextLossTriageBidIndex(group, 1)).toBe(3)
  })

  it('wraps to the first uncategorized bid', () => {
    expect(nextLossTriageBidIndex(group, 3)).toBe(1)
  })

  it('returns null when the group is fully categorized', () => {
    expect(
      nextLossTriageBidIndex({ bids: [bid({ category: 'price' }), bid({ category: 'no_answer' })] }, 0),
    ).toBeNull()
  })
})

describe('suggestLossCategoryFromNote', () => {
  it("maps Wendi's exact case: 'gc not awarded' → gc_lost", () => {
    expect(suggestLossCategoryFromNote('gc not awarded')).toBe('gc_lost')
  })

  it('maps common phrasings to their categories', () => {
    expect(suggestLossCategoryFromNote('Price too high for them')).toBe('price')
    expect(suggestLossCategoryFromNote('went with another sub')).toBe('other_sub')
    expect(suggestLossCategoryFromNote('project is ON HOLD until spring')).toBe('project_died')
    expect(suggestLossCategoryFromNote('never finished the bid')).toBe('no_bid')
    expect(suggestLossCategoryFromNote('no response after 3 calls')).toBe('no_answer')
  })

  it('suggests nothing on an ambiguous note (matches two categories)', () => {
    expect(suggestLossCategoryFromNote('not awarded but they liked our price')).toBeNull()
  })

  it('suggests nothing on empty or unmapped notes', () => {
    expect(suggestLossCategoryFromNote(null)).toBeNull()
    expect(suggestLossCategoryFromNote('')).toBeNull()
    expect(suggestLossCategoryFromNote('longshot in the dark')).toBeNull()
  })
})
