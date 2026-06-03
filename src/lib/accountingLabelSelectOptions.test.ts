import { describe, expect, it } from 'vitest'
import {
  buildSortedAccountingLabelRows,
  filterAccountingLabelsByQuery,
  type AccountingDragLabelRow,
} from './accountingLabelSelectOptions'

function label(id: string, name: string, sort_order: number): AccountingDragLabelRow {
  return {
    id,
    name,
    sort_order,
    created_at: '',
    description: null,
    is_system_default: false,
    default_key: null,
    schedule_c_line: null,
    account_type: null,
  }
}

describe('accountingLabelSelectOptions', () => {
  it('sorts by assignment count desc then sort_order then name', () => {
    const rows = [
      label('a', 'Zebra', 1),
      label('b', 'Alpha', 0),
      label('c', 'Beta', 2),
    ]
    const sorted = buildSortedAccountingLabelRows(rows, { b: 5, a: 2, c: 2 })
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a', 'c'])
  })

  it('filters labels by case-insensitive substring', () => {
    const rows = [label('a', 'Office Supplies', 0), label('b', 'Travel', 1)]
    expect(filterAccountingLabelsByQuery(rows, 'office').map((r) => r.id)).toEqual(['a'])
    expect(filterAccountingLabelsByQuery(rows, '').map((r) => r.id)).toEqual(['a', 'b'])
  })
})
