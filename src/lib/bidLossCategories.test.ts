import { describe, expect, it } from 'vitest'
import {
  BID_LOSS_CATEGORIES,
  bidLossCategoryLabel,
  buildLossRollup,
  groupLossTriageByBuilder,
  isBidLossCategoryKey,
  nextLossTriageBidIndex,
  suggestLossCategoryFromNote,
  lossReasonState,
  lossReasonWords,
  lossReasonPacketsFromVersions,
  type LossTriageBid,
} from './bidLossCategories'

const bid = (o: Partial<LossTriageBid> = {}): LossTriageBid => ({
  id: 'b1',
  builderKey: 'k1',
  builderName: 'Kestrin Contracting',
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


describe('lossReasonState — the one "needs a reason" rule over the bid and its GC packets (v2.6409)', () => {
  const pk = (name: string, outcome: string | null, versions: Array<{ loss_category?: string | null; outcome_note?: string | null }>, sharedLetter = false) => ({ name, outcome, versions, sharedLetter })
  const NOTE = 'Low bid was $63,500. There were 12 bidders. Click was the highest.'

  it("BP391 (2026-11-03): the bid's own category is empty, both lost GC packets carry one — categorized from the packets, one line per GC", () => {
    const s = lossReasonState({ loss_category: null, loss_reason: null }, [
      pk('Structura, Inc. – San Antonio', 'lost', [{ loss_category: 'gc_lost', outcome_note: null }]),
      pk('PlanHub - Subcontractor Prime Opportunity', 'lost', [{ loss_category: 'price', outcome_note: NOTE }, { loss_category: 'price', outcome_note: NOTE }]),
      pk('Wrenman Commercial', null, [], true),
    ])
    expect(s.categorized).toBe(true)
    expect(s.source).toBe('packets')
    expect(s.lines).toEqual([
      { gcName: 'Structura, Inc. – San Antonio', category: 'gc_lost', label: 'GC lost the project', note: null },
      { gcName: 'PlanHub - Subcontractor Prime Opportunity', category: 'price', label: 'Price too high', note: NOTE },
    ])
    expect(s.missing).toEqual([])
    expect(s.hasNote).toBe(true)
  })

  it('a single-GC bid marked lost from the Sent panel keeps its reason on its one version — categorized, one line', () => {
    const s = lossReasonState({ loss_category: null, loss_reason: '' }, [pk('Kestrin Contracting', 'lost', [{ loss_category: 'other_sub', outcome_note: null }])])
    expect(s.categorized).toBe(true)
    expect(s.source).toBe('packets')
    expect(s.lines.map((l) => l.label)).toEqual(['Went with another sub'])
  })

  it('one lost GC still without a reason: not categorized, missing names it, the recorded lines still read', () => {
    const s = lossReasonState({ loss_category: null, loss_reason: null }, [
      pk('Structura', 'lost', [{ loss_category: 'gc_lost' }]),
      pk('Brund & Assoc.', 'lost', [{ loss_category: null }]),
    ])
    expect(s.categorized).toBe(false)
    expect(s.source).toBe('none')
    expect(s.missing).toEqual(['Brund & Assoc.'])
    expect(s.lines.map((l) => l.gcName)).toEqual(['Structura'])
  })

  it("the bid's own category wins and reads as before; the GC lines are still listed for a reader that wants them", () => {
    const s = lossReasonState({ loss_category: 'project_died', loss_reason: 'shelved till spring' }, [pk('Structura', 'lost', [{ loss_category: 'gc_lost' }])])
    expect(s).toMatchObject({ categorized: true, source: 'bid', category: 'project_died', note: 'shelved till spring', hasNote: true })
    expect(s.lines.map((l) => l.category)).toEqual(['gc_lost'])
  })

  it('no packets: the bid alone — a category is categorized, a note alone is only a note, nothing is nothing', () => {
    expect(lossReasonState({ loss_category: 'price', loss_reason: null })).toMatchObject({ categorized: true, source: 'bid', hasNote: false, missing: [] })
    expect(lossReasonState({ loss_category: null, loss_reason: 'they went cheaper' })).toMatchObject({ categorized: false, source: 'none', hasNote: true, note: 'they went cheaper' })
    expect(lossReasonState({ loss_category: null, loss_reason: '  ' }, [])).toMatchObject({ categorized: false, source: 'none', hasNote: false, note: null, lines: [], missing: [] })
  })

  it('a shared-letter GC and a GC not marked lost never count either way; a bad category key on a version is no reason', () => {
    expect(lossReasonState({ loss_category: null }, [pk('Structura', 'lost', [{ loss_category: 'gc_lost' }]), pk('Kestrin', null, [{ loss_category: null }]), pk('Wrenman', null, [], true)]).categorized).toBe(true)
    expect(lossReasonState({ loss_category: null }, [pk('Structura', 'lost', [{ loss_category: 'nonsense' }])])).toMatchObject({ categorized: false, missing: ['Structura'] })
  })

  it('no lost packet and no category: not categorized and nothing named — the chips write the bid', () => {
    expect(lossReasonState({ loss_category: null }, [pk('Structura', null, [{}])])).toMatchObject({ categorized: false, missing: [], lines: [] })
  })
})

describe('lossReasonPacketsFromVersions — the Dashboard reads versions alone', () => {
  it('groups by customer_id (null = the own GC), the packet outcome is its first answered version, and the kernel reads the result', () => {
    const packets = lossReasonPacketsFromVersions([
      { customer_id: null, outcome: 'lost', loss_category: 'gc_lost', outcome_note: null },
      { customer_id: 'c-planhub', outcome: 'lost', loss_category: 'price', outcome_note: 'note' },
      { customer_id: 'c-planhub', outcome: 'lost', loss_category: 'price', outcome_note: 'note' },
    ])
    expect(packets.map((p) => [p.name, p.outcome, p.versions.length])).toEqual([['', 'lost', 1], ['c-planhub', 'lost', 2]])
    expect(lossReasonState({ loss_category: null }, packets)).toMatchObject({ categorized: true, source: 'packets' })
    expect(lossReasonPacketsFromVersions([])).toEqual([])
  })
})

describe('lossReasonWords — the Lost row\'s one-line words', () => {
  it("the bid's own, the GCs' joined, or not recorded", () => {
    expect(lossReasonWords(lossReasonState({ loss_category: 'price', loss_reason: 'cheaper' }))).toBe('Price too high — cheaper')
    expect(lossReasonWords(lossReasonState({ loss_category: null }, [{ name: 'Structura', outcome: 'lost', versions: [{ loss_category: 'gc_lost' }] }, { name: 'PlanHub', outcome: 'lost', versions: [{ loss_category: 'price' }] }]))).toBe('Structura: GC lost the project; PlanHub: Price too high')
    expect(lossReasonWords(lossReasonState({ loss_category: null, loss_reason: null }))).toBe('not recorded')
    expect(lossReasonWords(lossReasonState({ loss_category: null, loss_reason: 'a note' }))).toBe('a note')
  })
})
