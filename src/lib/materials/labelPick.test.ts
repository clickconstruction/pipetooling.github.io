import { describe, expect, it } from 'vitest'
import { afterStop, leftAfterRangePick, partialThatHolds, rangeCountWords, restCountWords, runStrips, stoppedDetailWords, tickedRange } from './labelPick'

const ids = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']
const ticked = (left: ReadonlySet<string>) => ids.filter((id) => !left.has(id))

describe('a range of boxes by its two ends (Taunya’s ask of 2026-11-15)', () => {
  it('reads the first and the last ticked box, and nothing when none is ticked', () => {
    expect(tickedRange(ids, new Set())).toEqual({ fromId: 'g1', toId: 'g6' })
    expect(tickedRange(ids, new Set(['g1', 'g6']))).toEqual({ fromId: 'g2', toId: 'g5' })
    // a pick with a hole in it still has two ends
    expect(tickedRange(ids, new Set(['g1', 'g3']))).toEqual({ fromId: 'g2', toId: 'g6' })
    expect(tickedRange(ids, new Set(ids))).toBeNull()
    expect(tickedRange([], new Set())).toBeNull()
  })

  it('From keeps the far end and ticks every box between', () => {
    expect(ticked(leftAfterRangePick(ids, new Set(), 'from', 'g3'))).toEqual(['g3', 'g4', 'g5', 'g6'])
    expect(ticked(leftAfterRangePick(ids, new Set(['g6']), 'from', 'g2'))).toEqual(['g2', 'g3', 'g4', 'g5'])
  })

  it('to keeps the near end and ticks every box between', () => {
    expect(ticked(leftAfterRangePick(ids, new Set(), 'to', 'g4'))).toEqual(['g1', 'g2', 'g3', 'g4'])
    expect(ticked(leftAfterRangePick(ids, new Set(['g1', 'g2']), 'to', 'g5'))).toEqual(['g3', 'g4', 'g5'])
  })

  it('fills a hole, since a range is every box between its ends', () => {
    expect(ticked(leftAfterRangePick(ids, new Set(['g3', 'g4']), 'to', 'g5'))).toEqual(['g1', 'g2', 'g3', 'g4', 'g5'])
  })

  it('an end picked past the other pulls it along, so the range is that box alone', () => {
    expect(ticked(leftAfterRangePick(ids, new Set(['g4', 'g5', 'g6']), 'from', 'g5'))).toEqual(['g5'])
    expect(ticked(leftAfterRangePick(ids, new Set(['g1', 'g2', 'g3']), 'to', 'g2'))).toEqual(['g2'])
  })

  it('with nothing ticked an end runs to the list’s far end', () => {
    expect(ticked(leftAfterRangePick(ids, new Set(ids), 'from', 'g4'))).toEqual(['g4', 'g5', 'g6'])
    expect(ticked(leftAfterRangePick(ids, new Set(ids), 'to', 'g2'))).toEqual(['g1', 'g2'])
  })

  it('a box that is not in the list changes nothing', () => {
    expect([...leftAfterRangePick(ids, new Set(['g1']), 'from', 'zz')]).toEqual(['g1'])
  })

  it('says how many that is, and when chips are unticked inside it', () => {
    expect(rangeCountWords(ids, new Set())).toBe('6 of 6 boxes')
    expect(rangeCountWords(ids, new Set(['g1']))).toBe('5 of 6 boxes')
    expect(rangeCountWords(ids, new Set(['g1', 'g3', 'g4']))).toBe('3 of 6 boxes, 2 left out between')
    expect(rangeCountWords(ids, new Set(ids))).toBe('No box is ticked.')
    expect(rangeCountWords(['s1', 's2', 's3'], new Set(['s1']), ['sticker', 'stickers'])).toBe('2 of 3 stickers')
  })
})

describe('the run as its strips', () => {
  it('prints each box’s copies together, each strip knowing which copy it is', () => {
    expect(runStrips(['g1', 'g2'], 2)).toEqual([{ id: 'g1', copy: 1 }, { id: 'g1', copy: 2 }, { id: 'g2', copy: 1 }, { id: 'g2', copy: 2 }])
    expect(runStrips(['g1', 'g2', 'g3'], 1).map((s) => s.id)).toEqual(['g1', 'g2', 'g3'])
    expect(runStrips([], 5)).toEqual([])
    expect(runStrips(ids, 5)).toHaveLength(30)
  })

  it('a box left part way prints only the copies it is missing', () => {
    const strips = runStrips(['g2', 'g3'], 5, { id: 'g2', done: 3, copies: 5 })
    expect(strips.filter((s) => s.id === 'g2')).toEqual([{ id: 'g2', copy: 4 }, { id: 'g2', copy: 5 }])
    expect(strips).toHaveLength(7)
  })

  it('the part-way box is forgotten once its box is unticked or the copies change', () => {
    const partial = { id: 'g2', done: 3, copies: 5 }
    expect(partialThatHolds(partial, ['g2', 'g3'], 5)).toEqual(partial)
    expect(partialThatHolds(partial, ['g3'], 5)).toBeNull()
    expect(partialThatHolds(partial, ['g2', 'g3'], 4)).toBeNull()
    expect(partialThatHolds(null, ['g2'], 5)).toBeNull()
    // and the run is then the box's every copy again
    expect(runStrips(['g2'], 4, partial)).toHaveLength(4)
  })
})

describe('a run that stops part way', () => {
  it('unticks the boxes whose last copy went and remembers the one part way', () => {
    const strips = runStrips(ids, 5)
    // 5 of 30: the first box whole, nothing part way
    expect(afterStop(strips, 5, 5)).toEqual({ wholeIds: ['g1'], partial: null })
    // 8 of 30: the first whole, the second at 3 of 5
    expect(afterStop(strips, 8, 5)).toEqual({ wholeIds: ['g1'], partial: { id: 'g2', done: 3, copies: 5 } })
    expect(afterStop(strips, 2, 5)).toEqual({ wholeIds: [], partial: { id: 'g1', done: 2, copies: 5 } })
    expect(afterStop(strips, 0, 5)).toEqual({ wholeIds: [], partial: null })
    expect(afterStop(strips, 30, 5)).toEqual({ wholeIds: ids, partial: null })
    expect(afterStop(runStrips(ids, 1), 4, 1)).toEqual({ wholeIds: ['g1', 'g2', 'g3', 'g4'], partial: null })
  })

  it('a second stop carries on from the first: nothing prints twice and no box comes up short', () => {
    const first = afterStop(runStrips(['g1', 'g2', 'g3'], 5), 8, 5)
    expect(first).toEqual({ wholeIds: ['g1'], partial: { id: 'g2', done: 3, copies: 5 } })
    // the rest: g2's two missing strips, then g3's five
    const rest = runStrips(['g2', 'g3'], 5, first.partial)
    expect(rest).toHaveLength(7)
    // stopped again after one more strip: g2 is at 4 of 5
    expect(afterStop(rest, 1, 5)).toEqual({ wholeIds: [], partial: { id: 'g2', done: 4, copies: 5 } })
    // and after two: g2 is whole
    expect(afterStop(rest, 2, 5)).toEqual({ wholeIds: ['g2'], partial: null })
    // every strip of the three boxes is out exactly once across the three runs
    const third = runStrips(['g2', 'g3'], 5, { id: 'g2', done: 4, copies: 5 })
    expect(8 + 1 + third.length).toBe(15)
  })

  it('says which boxes are done, which is part way, and what the press does now', () => {
    expect(stoppedDetailWords(['G1'], { name: 'G2', toGo: 2, copies: 5 }, 447)).toBe('G1 is done and unticked. G2 has 2 of its 5 strips to go. The press prints the rest.')
    expect(stoppedDetailWords(['G1', 'G2'], null, 445)).toBe('G1 and G2 are done and unticked. The press prints the rest.')
    expect(stoppedDetailWords(['G1', 'G2', 'G3', 'G4'], null, 435)).toBe('G1 to G4 are done and unticked. The press prints the rest.')
    expect(stoppedDetailWords([], { name: 'G1', toGo: 3, copies: 5 }, 453)).toBe('G1 has 3 of its 5 strips to go. The press prints the rest.')
    expect(stoppedDetailWords([], null, 455)).toBe('The press prints the rest.')
    // the run's last box went: nothing is left for the press
    expect(stoppedDetailWords(['G1', 'G2'], null, 0)).toBe('G1 and G2 are done and unticked.')
    expect(restCountWords(90, 447)).toBe('90 boxes, 447 strips to go.')
    expect(restCountWords(1, 1)).toBe('1 box, 1 strip to go.')
  })
})
