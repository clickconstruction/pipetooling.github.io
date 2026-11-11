import { describe, expect, it } from 'vitest'
import { addMergeCounts, allCalledDistinct, mergeAsk, mergeOutcome, NO_MERGE_COUNTS, pairKey } from './mergeParts'

// Every part and count here is made up.
describe('mergeAsk', () => {
  it('names both parts, what moves, and that it cannot be undone', () => {
    const ask = mergeAsk('AX8802XL-LR-PC ARLO SUPPLY KIT', ['ARLO AX8802XL LAV SUPPLY KIT'])
    expect(ask.title).toBe('Merge these two parts into one?')
    expect(ask.confirmLabel).toBe('Merge the two parts')
    expect(ask.message).toContain('“ARLO AX8802XL LAV SUPPLY KIT” goes into “AX8802XL-LR-PC ARLO SUPPLY KIT”.')
    expect(ask.message).toContain('the newer one stays')
    expect(ask.message).toContain('A merge cannot be undone.')
  })
  it('counts a group of three', () => {
    const ask = mergeAsk('A', ['B', 'C'])
    expect(ask.title).toBe('Merge these 3 parts into one?')
    expect(ask.confirmLabel).toBe('Merge the 3 parts')
    expect(ask.message).toContain('2 other parts go into “A”.')
  })
})

describe('mergeOutcome', () => {
  it('says what now points at the part that stays', () => {
    expect(mergeOutcome('AX8802XL-LR-PC ARLO SUPPLY KIT', 1, { pricesMoved: 1, pricesMerged: 1, assemblies: 2, takeoffLines: 7, purchaseOrderLines: 0, houseNumbers: 1 })).toBe(
      '1 part was merged into “AX8802XL-LR-PC ARLO SUPPLY KIT”. 2 prices, 2 assemblies, 7 takeoff lines and 1 house number now point at it. 1 price was on both: the newer one stayed.',
    )
  })
  it('one thing points, and nothing at all', () => {
    expect(mergeOutcome('A', 1, { ...NO_MERGE_COUNTS, assemblies: 1 })).toBe('1 part was merged into “A”. 1 assembly now points at it.')
    expect(mergeOutcome('A', 2, NO_MERGE_COUNTS)).toBe('2 parts were merged into “A”. Nothing else pointed at them.')
  })
  it('adds the counts of several merges', () => {
    expect(addMergeCounts({ ...NO_MERGE_COUNTS, assemblies: 2 }, { ...NO_MERGE_COUNTS, assemblies: 1, takeoffLines: 4 })).toMatchObject({ assemblies: 3, takeoffLines: 4 })
  })
})

describe('parts called not the same', () => {
  it('a pair is one key whichever way round', () => {
    expect(pairKey('b', 'a')).toBe('a|b')
    expect(pairKey('a', 'b')).toBe('a|b')
  })
  it('a group is put away only when every two of its parts were called different', () => {
    const distinct = new Set(['a|b', 'a|c'])
    expect(allCalledDistinct(['a', 'b'], distinct)).toBe(true)
    expect(allCalledDistinct(['a', 'b', 'c'], distinct)).toBe(false)
    expect(allCalledDistinct(['a', 'b', 'c'], new Set(['a|b', 'a|c', 'b|c']))).toBe(true)
    expect(allCalledDistinct(['a'], distinct)).toBe(false)
  })
})
