import { describe, expect, it } from 'vitest'
import { buildMoneyRows } from './jobMoneyTable'

const base = { supplyUsd: 42_599.49, supplyCount: 3, supplyFailed: false, teamUsd: 32_814.43, teamHours: 959, teamPeople: 13, teamLoading: false, teamFailed: false, cardUsd: 3_776.72, cardCount: 4, cardFailed: false, subUsd: 1_408.97, subCount: 2, subLoading: false, subFailed: false, tallyUsd: 0, tallyCount: 0, tallyFailed: false, otherUsd: 0, otherCount: 0 }

describe('buildMoneyRows', () => {
  it('sorts the sources largest first, shares them of the direct total, keeps the zero rows, and totals', () => {
    const rows = buildMoneyRows(base)
    expect(rows.map((r) => r.key)).toEqual(['supply', 'team', 'card', 'sub', 'tally', 'other', 'total'])
    expect(rows[0]!.sharePct).toBeCloseTo(52.85, 1)
    expect(rows[1]).toMatchObject({ hours: 959, sub: '13 people' })
    expect(rows.find((r) => r.key === 'other')).toMatchObject({ usd: 0, sharePct: null, sub: '+ Add other charge below', accordion: 'billed' })
    expect(rows[rows.length - 1]).toMatchObject({ key: 'total', usd: 42_599.49 + 32_814.43 + 3_776.72 + 1_408.97, hours: 959, sub: '' })
  })
  it('a source that failed or is loading carries no share and is left out of the total, and the total says so', () => {
    const rows = buildMoneyRows({ ...base, cardFailed: true, subLoading: true })
    expect(rows.find((r) => r.key === 'card')).toMatchObject({ state: 'failed', sharePct: null })
    expect(rows.find((r) => r.key === 'sub')).toMatchObject({ state: 'loading' })
    expect(rows[rows.length - 1]).toMatchObject({ usd: 42_599.49 + 32_814.43, sub: 'some sources did not load' })
    expect(buildMoneyRows({ ...base, supplyUsd: 0, teamUsd: 0, cardUsd: 0, subUsd: 0 }).every((r) => r.sharePct == null)).toBe(true)
  })
  it('draws a cost line (⛽ Fuel & gas) as its own row, taken out of the card charges — the total does not move', () => {
    const fuel = { tagId: 'fuel', name: 'Fuel & gas', icon: '⛽', usd: 1_200 }
    const rows = buildMoneyRows({ ...base, cardCostLines: [fuel] })
    expect(rows.find((r) => r.key === 'card')).toMatchObject({ label: 'Other card charges', usd: 3_776.72 - 1_200 })
    expect(rows.find((r) => r.key === 'tag:fuel')).toMatchObject({ label: '⛽ Fuel & gas', usd: 1_200, accordion: 'mercury', state: 'ok' })
    expect(rows[rows.length - 1]!.usd).toBeCloseTo(buildMoneyRows(base)[buildMoneyRows(base).length - 1]!.usd, 8)
    expect(rows.find((r) => r.key === 'tag:fuel')!.sharePct).toBeGreaterThan(0)
  })
  it('without cost lines, or with the card charges failed, Card charges is one row as before', () => {
    expect(buildMoneyRows({ ...base, cardCostLines: [] }).find((r) => r.key === 'card')).toMatchObject({ label: 'Card charges', usd: 3_776.72 })
    const failed = buildMoneyRows({ ...base, cardFailed: true, cardCostLines: [{ tagId: 'fuel', name: 'Fuel & gas', icon: '⛽', usd: 100 }] })
    expect(failed.some((r) => r.key.startsWith('tag:'))).toBe(false)
    expect(buildMoneyRows({ ...base, cardCostLines: [{ tagId: 'fuel', name: 'Fuel & gas', icon: '⛽', usd: 0 }] }).some((r) => r.key.startsWith('tag:'))).toBe(false)
  })
})
