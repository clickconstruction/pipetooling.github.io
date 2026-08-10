import { describe, expect, it } from 'vitest'
import {
  buildEvenSortModeSplit,
  setSortModeSplitAmount,
  sortModeSplitRemainder,
} from './sortModeSplit'

describe('buildEvenSortModeSplit', () => {
  it('splits a negative purchase evenly in whole cents, summing exactly', () => {
    const lines = buildEvenSortModeSplit(-90.42, ['a', 'b'])
    expect(lines).toEqual([
      { jobId: 'a', amount: -45.21 },
      { jobId: 'b', amount: -45.21 },
    ])
  })

  it('distributes the odd cent and keeps the exact sum', () => {
    const lines = buildEvenSortModeSplit(-45.56, ['a', 'b', 'c'])
    expect(sortModeSplitRemainder(lines, -45.56)).toBe(0)
    expect(lines.map((l) => Math.abs(l.amount)).sort((x, y) => y - x)[0]).toBeCloseTo(15.19, 2)
  })

  it('empty job list yields no lines', () => {
    expect(buildEvenSortModeSplit(-10, [])).toEqual([])
  })
})

describe('setSortModeSplitAmount', () => {
  const start = buildEvenSortModeSplit(-90.42, ['a', 'b'])

  it('edits one line and auto-balances the other so the sum holds', () => {
    const next = setSortModeSplitAmount(start, 'a', 60, -90.42)
    expect(next.find((l) => l.jobId === 'a')?.amount).toBe(-60)
    expect(next.find((l) => l.jobId === 'b')?.amount).toBe(-30.42)
    expect(sortModeSplitRemainder(next, -90.42)).toBe(0)
  })

  it('editing the last line balances into an earlier one', () => {
    const next = setSortModeSplitAmount(start, 'b', 10.42, -90.42)
    expect(next.find((l) => l.jobId === 'b')?.amount).toBe(-10.42)
    expect(next.find((l) => l.jobId === 'a')?.amount).toBe(-80)
  })

  it('clamps an over-total entry to the whole amount, zeroing the balancer', () => {
    const next = setSortModeSplitAmount(start, 'a', 500, -90.42)
    expect(next.find((l) => l.jobId === 'a')?.amount).toBe(-90.42)
    expect(next.find((l) => l.jobId === 'b')?.amount).toBe(0)
    expect(sortModeSplitRemainder(next, -90.42)).toBe(0)
  })

  it('with three lines, the balancer is the last non-edited line', () => {
    const three = buildEvenSortModeSplit(-30, ['a', 'b', 'c'])
    const next = setSortModeSplitAmount(three, 'a', 20, -30)
    expect(next.find((l) => l.jobId === 'a')?.amount).toBe(-20)
    expect(next.find((l) => l.jobId === 'b')?.amount).toBe(-10)
    expect(next.find((l) => l.jobId === 'c')?.amount).toBe(0)
    expect(sortModeSplitRemainder(next, -30)).toBe(0)
  })

  it('unknown job id is a no-op', () => {
    expect(setSortModeSplitAmount(start, 'zz', 5, -90.42)).toEqual(start)
  })
})
