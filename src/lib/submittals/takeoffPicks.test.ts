import { describe, expect, it } from 'vitest'
import type { TakeoffCandidate } from './takeoffCandidates'
import { pickChangeWords, pickCounts, planIsEmpty, planRowsAdded, planSummary, planTakeoffPicks, startingPick, type FixturePick } from './takeoffPicks'

const cand = (id: string, o: Partial<TakeoffCandidate> = {}): TakeoffCandidate => ({
  countRowId: id, fixture: id.toUpperCase(), count: 2, tagText: id.toUpperCase(), tags: [id.toUpperCase()], product: 'a product', pieces: [], storedProductKeys: null, productKeys: [], partId: null,
  supplyHouseId: null, supplyHouseName: null, group: 'fixtures', defaultTicked: true, storedTick: null, ticked: true, alreadyOn: false, canSplit: false, storedSplit: null, split: false, ...o,
})
const picks = (o: Record<string, FixturePick>) => new Map(Object.entries(o))

describe('where a fixture starts', () => {
  it('as it sits on the draft, whatever the bid remembers', () => {
    expect(startingPick({ onAs: 'gc', ticked: false, storedOrderOnly: true })).toBe('gc')
    expect(startingPick({ onAs: 'order', ticked: true, storedOrderOnly: false })).toBe('order')
  })

  it('off the draft: the remembered tick and order-only pick, else the group’s rule', () => {
    expect(startingPick({ onAs: null, ticked: true, storedOrderOnly: false })).toBe('gc')
    expect(startingPick({ ticked: true, storedOrderOnly: true })).toBe('order')
    expect(startingPick({ ticked: false, storedOrderOnly: true })).toBe('out')
  })
})

describe('what the picks change on the draft', () => {
  const cands = [
    cand('fco', { onAs: 'gc', alreadyOn: true }),
    cand('fd', { onAs: 'gc', alreadyOn: true }),
    cand('wha', { onAs: 'order', alreadyOn: true }),
    cand('hb', { onAs: 'gc', alreadyOn: true }),
    cand('sink', { ticked: false }),
    cand('wc', { ticked: false, canSplit: true, tags: ['WC-1', 'WC-2'] }),
    cand('pipe', { ticked: false, group: 'pipe_allowance' }),
  ]

  it('nothing clicked: nothing changes, and every fixture is still remembered as it stands', () => {
    const plan = planTakeoffPicks(cands, new Map())
    expect(planIsEmpty(plan)).toBe(true)
    expect(planSummary(plan, 'Rev 1')).toBe('')
    expect([...plan.ticks]).toEqual([['fco', true], ['fd', true], ['wha', true], ['hb', true], ['sink', false], ['wc', false], ['pipe', false]])
    expect([...plan.orderOnly].filter(([, v]) => v).map(([k]) => k)).toEqual(['wha'])
    expect(pickCounts(cands, new Map())).toEqual({ gc: 3, order: 1, out: 3 })
  })

  it('a row on the draft moves to order only, back to the GC, or off; a fixture off it comes on either way', () => {
    const p = picks({ fco: 'order', wha: 'gc', hb: 'out', sink: 'order', wc: 'gc' })
    const plan = planTakeoffPicks(cands, p, new Map([['wc', true]]))
    expect(plan.toOrderOnly).toEqual(['fco'])
    expect(plan.toGc).toEqual(['wha'])
    expect(plan.remove).toEqual(['hb'])
    expect(plan.add.map((a) => [a.candidate.countRowId, a.orderOnly, a.candidate.split])).toEqual([['sink', true, false], ['wc', false, true]])
    // The split fixture is two rows.
    expect(planRowsAdded(plan)).toBe(3)
    expect(planSummary(plan, 'Rev 1')).toBe('3 rows go on Rev 1 (1 order only) · 1 fixture moves to order only · 1 fixture goes back to the GC · 1 comes off Rev 1')
    expect(plan.ticks.get('hb')).toBe(false)
    expect(plan.orderOnly.get('fco')).toBe(true)
    expect(plan.orderOnly.get('wha')).toBe(false)
    expect(pickCounts(cands, p)).toEqual({ gc: 3, order: 2, out: 2 })
  })

  it('says what a click will do to a row already on the draft, and nothing for one that is not', () => {
    expect(pickChangeWords({ onAs: 'gc' }, 'order', 'Rev 1')).toBe('On Rev 1 now. It moves to order only: off the GC’s list, still on the log.')
    expect(pickChangeWords({ onAs: 'gc' }, 'out', 'Rev 1')).toBe('On Rev 1 now. It comes off Rev 1 and off the procurement log.')
    expect(pickChangeWords({ onAs: 'order' }, 'gc', 'Rev 1')).toBe('Order only now. It goes back on the GC’s list.')
    expect(pickChangeWords({ onAs: 'gc' }, 'gc', 'Rev 1')).toBe('')
    expect(pickChangeWords({ onAs: null }, 'order', 'Rev 1')).toBe('')
  })
})
