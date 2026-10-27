import { describe, expect, it } from 'vitest'
import {
  approvalGroupAge,
  filterApprovalItems,
  groupApprovalItemsByLabel,
  type ApprovalGroupItem,
} from './accountingApprovalGroups'

function item(over: Partial<ApprovalGroupItem> & { suggestionId: string }): ApprovalGroupItem {
  return {
    txId: `tx-${over.suggestionId}`,
    suggestedLabelId: 'L1',
    suggestedLabelName: 'Materials',
    ruleName: 'Some rule',
    amount: -100,
    counterpartyName: 'Gajeske',
    createdAt: '2026-10-01T12:00:00+00:00',
    ...over,
  }
}

describe('filterApprovalItems', () => {
  const items = [
    item({ suggestionId: 's1', counterpartyName: 'Gajeske', suggestedLabelName: 'Materials', ruleName: 'GAJESKE' }),
    item({ suggestionId: 's2', counterpartyName: 'T-Mobile', suggestedLabelName: 'Phone', ruleName: 'TMOBILE WEB' }),
    item({ suggestionId: 's3', counterpartyName: null, suggestedLabelName: 'Fuel', ruleName: 'Shell' }),
  ]

  it('returns the list unchanged for an empty/whitespace query', () => {
    expect(filterApprovalItems(items, '')).toBe(items)
    expect(filterApprovalItems(items, '   ')).toBe(items)
  })

  it('matches counterparty case-insensitively', () => {
    expect(filterApprovalItems(items, 'gaj').map((i) => i.suggestionId)).toEqual(['s1'])
  })

  it('matches suggested label name', () => {
    expect(filterApprovalItems(items, 'phone').map((i) => i.suggestionId)).toEqual(['s2'])
  })

  it('matches rule name', () => {
    expect(filterApprovalItems(items, 'shell').map((i) => i.suggestionId)).toEqual(['s3'])
  })

  it('tolerates null counterparty', () => {
    expect(filterApprovalItems(items, 'fuel').map((i) => i.suggestionId)).toEqual(['s3'])
  })

  it('returns nothing when no field matches', () => {
    expect(filterApprovalItems(items, 'zzz')).toEqual([])
  })
})

describe('groupApprovalItemsByLabel', () => {
  it('buckets by suggested label and sums signed amounts', () => {
    const items = [
      item({ suggestionId: 's1', suggestedLabelId: 'L1', suggestedLabelName: 'Materials', amount: -100 }),
      item({ suggestionId: 's2', suggestedLabelId: 'L1', suggestedLabelName: 'Materials', amount: -50 }),
      item({ suggestionId: 's3', suggestedLabelId: 'L2', suggestedLabelName: 'Income', amount: 200 }),
    ]
    const groups = groupApprovalItemsByLabel(items, new Set())
    expect(groups).toHaveLength(2)
    const materials = groups.find((g) => g.labelId === 'L1')!
    expect(materials.count).toBe(2)
    expect(materials.totalAmount).toBe(-150)
    expect(materials.conflictCount).toBe(0)
    expect(materials.items.map((i) => i.suggestionId)).toEqual(['s1', 's2'])
  })

  it('with the same oldest stamp, sorts by count desc, then label name asc', () => {
    const items = [
      item({ suggestionId: 'a1', suggestedLabelId: 'A', suggestedLabelName: 'Zeta' }),
      item({ suggestionId: 'b1', suggestedLabelId: 'B', suggestedLabelName: 'Alpha' }),
      item({ suggestionId: 'b2', suggestedLabelId: 'B', suggestedLabelName: 'Alpha' }),
      item({ suggestionId: 'c1', suggestedLabelId: 'C', suggestedLabelName: 'Beta' }),
    ]
    const groups = groupApprovalItemsByLabel(items, new Set())
    // B has count 2 (first); A "Zeta" and C "Beta" both count 1 → "Beta" before "Zeta".
    expect(groups.map((g) => g.labelId)).toEqual(['B', 'C', 'A'])
  })

  it('ignores null/non-finite amounts in the total', () => {
    const items = [
      item({ suggestionId: 's1', amount: -100 }),
      item({ suggestionId: 's2', amount: null }),
      item({ suggestionId: 's3', amount: Number.NaN }),
    ]
    const g = groupApprovalItemsByLabel(items, new Set())[0]!
    expect(g.count).toBe(3)
    expect(g.totalAmount).toBe(-100)
  })

  it('counts conflicts by suggestion id membership', () => {
    const items = [
      item({ suggestionId: 's1' }),
      item({ suggestionId: 's2' }),
      item({ suggestionId: 's3' }),
    ]
    const g = groupApprovalItemsByLabel(items, new Set(['s1', 's3']))[0]!
    expect(g.conflictCount).toBe(2)
  })

  it('returns an empty array for no items', () => {
    expect(groupApprovalItemsByLabel([], new Set())).toEqual([])
  })
})

describe('the oldest suggestion leads (punch list #184 sweep B)', () => {
  it('orders the groups by their oldest suggestion, ahead of the count; an unstamped group sinks last', () => {
    const items = [
      item({ suggestionId: 'm1', suggestedLabelId: 'M', suggestedLabelName: 'Materials', createdAt: '2026-10-24T09:00:00+00:00' }),
      item({ suggestionId: 'm2', suggestedLabelId: 'M', suggestedLabelName: 'Materials', createdAt: '2026-10-25T09:00:00+00:00' }),
      item({ suggestionId: 'm3', suggestedLabelId: 'M', suggestedLabelName: 'Materials', createdAt: '2026-10-25T10:00:00+00:00' }),
      item({ suggestionId: 'f1', suggestedLabelId: 'F', suggestedLabelName: 'Fuel', createdAt: '2026-10-26T08:00:00+00:00' }),
      item({ suggestionId: 'f2', suggestedLabelId: 'F', suggestedLabelName: 'Fuel', createdAt: '2026-10-12T08:00:00+00:00' }),
      item({ suggestionId: 'u1', suggestedLabelId: 'U', suggestedLabelName: 'Unstamped', createdAt: null }),
    ]
    const groups = groupApprovalItemsByLabel(items, new Set())
    expect(groups.map((g) => g.labelId)).toEqual(['F', 'M', 'U'])
    expect(groups.map((g) => g.oldestCreatedAt)).toEqual(['2026-10-12T08:00:00+00:00', '2026-10-24T09:00:00+00:00', null])
    // The items keep the order they came in.
    expect(groups[0]!.items.map((i) => i.suggestionId)).toEqual(['f1', 'f2'])
  })

  it('the header chip ages the oldest suggestion on the LABEL_APPROVAL_AGE scale: amber at 3 days, red at 7', () => {
    const now = Date.parse('2026-10-26T12:00:00Z')
    expect(approvalGroupAge({ oldestCreatedAt: '2026-10-25T12:00:00+00:00' }, now)).toEqual({ days: 1, state: 'fresh', label: '1 day waiting' })
    expect(approvalGroupAge({ oldestCreatedAt: '2026-10-23T12:00:00+00:00' }, now)).toEqual({ days: 3, state: 'amber', label: '3 days waiting' })
    expect(approvalGroupAge({ oldestCreatedAt: '2026-10-12T08:00:00+00:00' }, now)).toEqual({ days: 14, state: 'red', label: '14 days waiting' })
    expect(approvalGroupAge({ oldestCreatedAt: null }, now)).toBeNull()
  })
})
