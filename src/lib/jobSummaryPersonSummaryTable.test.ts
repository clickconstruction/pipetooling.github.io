import { describe, expect, it } from 'vitest'
import type { PartsPerPersonCostRow } from './partsPerPersonCostSummary'
import { buildJobSummaryPersonSummaryRows } from './jobSummaryPersonSummaryTable'

function row(
  r: Pick<PartsPerPersonCostRow, 'key' | 'displayName' | 'cardCharges'> & Partial<PartsPerPersonCostRow>,
): PartsPerPersonCostRow {
  return {
    partsFromTally: 0,
    otherJobCharges: 0,
    invoicesFromSupply: 0,
    rowKind: 'card',
    ...r,
  } as PartsPerPersonCostRow
}

describe('buildJobSummaryPersonSummaryRows', () => {
  it('team only', () => {
    const out = buildJobSummaryPersonSummaryRows({
      teamBreakdown: [{ personName: '  Alice  ', cost: 100, hours: 8.25 }],
      ppRows: [],
    })
    expect(out).toEqual([
      expect.objectContaining({ displayName: 'Alice', teamLabor: 100, card: 0, hours: 8.25 }),
    ])
  })

  it('card only (no team)', () => {
    const out = buildJobSummaryPersonSummaryRows({
      teamBreakdown: [],
      ppRows: [row({ key: 'c:1', displayName: 'Bob', cardCharges: 42 })],
    })
    expect(out).toEqual([expect.objectContaining({ displayName: 'Bob', teamLabor: 0, card: 42, hours: 0 })])
  })

  it('merges same person in team and card (case/trim)', () => {
    const out = buildJobSummaryPersonSummaryRows({
      teamBreakdown: [{ personName: 'carol', cost: 50, hours: 2 }],
      ppRows: [row({ key: 'c:x', displayName: '  Carol ', cardCharges: 25 })],
    })
    const one = out.find((r) => r.displayName === 'carol' || r.displayName === 'Carol')
    expect(out.length).toBe(1)
    expect(one?.teamLabor).toBe(50)
    expect(one?.card).toBe(25)
    expect(one?.hours).toBe(2)
  })

  it('sums hours when same person key appears twice in team breakdown', () => {
    const out = buildJobSummaryPersonSummaryRows({
      teamBreakdown: [
        { personName: 'Ann', cost: 10, hours: 1 },
        { personName: 'Ann', cost: 20, hours: 2 },
      ],
      ppRows: [],
    })
    expect(out).toEqual([expect.objectContaining({ displayName: 'Ann', teamLabor: 30, hours: 3, card: 0 })])
  })

  it('sorts Unattributed last', () => {
    const out = buildJobSummaryPersonSummaryRows({
      teamBreakdown: [],
      ppRows: [
        row({ key: 'c:a', displayName: 'Unattributed', cardCharges: 1 }),
        row({ key: 'c:b', displayName: 'Zed', cardCharges: 2 }),
        row({ key: 'c:c', displayName: 'Ann', cardCharges: 3 }),
      ],
    })
    expect(out.map((r) => r.displayName)).toEqual(['Ann', 'Zed', 'Unattributed'])
  })

  it('sums card from two pp rows with same normalized name', () => {
    const out = buildJobSummaryPersonSummaryRows({
      teamBreakdown: [],
      ppRows: [
        row({ key: 'c:1', displayName: 'Dana', cardCharges: 10 }),
        row({ key: 'c:2', displayName: 'Dana', cardCharges: 5 }),
      ],
    })
    expect(out).toEqual([expect.objectContaining({ displayName: 'Dana', card: 15, hours: 0 })])
  })

  it('ignores g:job row in pp', () => {
    const out = buildJobSummaryPersonSummaryRows({
      teamBreakdown: [],
      ppRows: [
        row({ key: 'g:job', displayName: 'Job (no per-person split)', cardCharges: 0 }),
        row({ key: 'c:1', displayName: 'Eve', cardCharges: 1 }),
      ],
    })
    expect(out.length).toBe(1)
    expect(out[0]?.displayName).toBe('Eve')
  })
})
