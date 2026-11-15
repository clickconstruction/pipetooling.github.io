import { describe, expect, it } from 'vitest'
import { boxesPrintedWhole, leftAfterRangePick, leftAfterStop, printedUntickedWords, tickedRange } from './labelPick'

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
    const left = new Set(['g1'])
    expect([...leftAfterRangePick(ids, left, 'from', 'zz')]).toEqual(['g1'])
  })
})

describe('a run that stops part way', () => {
  it('counts the boxes whose every strip went, a box’s copies together', () => {
    expect(boxesPrintedWhole(ids, 5, 5)).toEqual(['g1'])
    expect(boxesPrintedWhole(ids, 7, 5)).toEqual(['g1'])
    expect(boxesPrintedWhole(ids, 3, 2)).toEqual(['g1'])
    expect(boxesPrintedWhole(ids, 4, 1)).toEqual(['g1', 'g2', 'g3', 'g4'])
    expect(boxesPrintedWhole(ids, 0, 2)).toEqual([])
    expect(boxesPrintedWhole(ids, 99, 1)).toEqual(ids)
  })

  it('takes the printed boxes off the pick and keeps the ones already left out', () => {
    expect([...leftAfterStop(new Set(['g6']), ['g1', 'g2'])].sort()).toEqual(['g1', 'g2', 'g6'])
    expect([...leftAfterStop(new Set(), [])]).toEqual([])
  })

  it('says which boxes are done and what the press does now', () => {
    expect(printedUntickedWords(['G1'], 90)).toBe('G1 printed whole and is unticked. The press prints the rest.')
    expect(printedUntickedWords(['G1', 'G2'], 89)).toBe('G1 and G2 printed whole and are unticked. The press prints the rest.')
    expect(printedUntickedWords(['G1', 'G2', 'G3', 'G4'], 87)).toBe('G1 to G4 printed whole and are unticked. The press prints the rest.')
    expect(printedUntickedWords([], 91)).toBe('No box printed whole, so every box is still ticked.')
    // the run's last box went: nothing is left for the press
    expect(printedUntickedWords(['G1', 'G2'], 0)).toBe('G1 and G2 printed whole and are unticked.')
    expect(printedUntickedWords([], 0)).toBe('')
  })
})
