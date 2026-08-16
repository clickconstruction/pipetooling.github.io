import { describe, it, expect } from 'vitest'
import {
  bankingAttributionValueForSource,
  buildBankingAttributionOptions,
  parseBankingAttributionValue,
} from './bankingAttributionOptions'

describe('parseBankingAttributionValue', () => {
  it('decodes user / person / empty', () => {
    expect(parseBankingAttributionValue('u:abc')).toEqual({ userId: 'abc', personId: null })
    expect(parseBankingAttributionValue('p:xyz')).toEqual({ userId: null, personId: 'xyz' })
    expect(parseBankingAttributionValue('')).toEqual({ userId: null, personId: null })
  })
})

describe('bankingAttributionValueForSource', () => {
  it('encodes by source', () => {
    expect(bankingAttributionValueForSource('user', 'u1')).toBe('u:u1')
    expect(bankingAttributionValueForSource('person', 'p1')).toBe('p:p1')
    expect(bankingAttributionValueForSource('unassigned', null)).toBe('')
    expect(bankingAttributionValueForSource('user', null)).toBe('')
  })

  it('round-trips with parse', () => {
    expect(parseBankingAttributionValue(bankingAttributionValueForSource('person', 'p9'))).toEqual({
      userId: null,
      personId: 'p9',
    })
  })
})

describe('buildBankingAttributionOptions', () => {
  it('prefixes users and people, tags people by kind, skips separators', () => {
    const opts = buildBankingAttributionOptions(
      [
        { value: 'u1', label: 'Alice' },
        { kind: 'separator', id: 'sep' },
      ],
      [
        { id: 'p2', name: 'Bob', kind: 'sub' },
        { id: 'p1', name: 'Ada', kind: 'primary' },
      ],
    )
    expect(opts).toEqual([
      { value: 'u:u1', label: 'Alice' },
      { value: 'p:p1', label: 'Ada · Primary' }, // people sorted by name
      { value: 'p:p2', label: 'Bob · Sub' },
    ])
  })

  it('lists archived people last, behind a separator, tagged archived (v2.1728)', () => {
    const opts = buildBankingAttributionOptions(
      [{ value: 'u1', label: 'Alice' }],
      [
        { id: 'p1', name: 'Zed', kind: 'sub', archived: true },
        { id: 'p2', name: 'Ada', kind: 'sub' },
        { id: 'p3', name: 'Abe', kind: 'helper', archived: true },
      ],
    )
    expect(opts).toEqual([
      { value: 'u:u1', label: 'Alice' },
      { value: 'p:p2', label: 'Ada · Sub' },
      { kind: 'separator', id: 'archived-people', label: 'Archived' },
      { value: 'p:p3', label: 'Abe · Helper · archived' },
      { value: 'p:p1', label: 'Zed · Sub · archived' },
    ])
  })

  it('omits the archived separator when nobody is archived', () => {
    const opts = buildBankingAttributionOptions([], [{ id: 'p1', name: 'Ada', kind: 'sub', archived: false }])
    expect(opts).toEqual([{ value: 'p:p1', label: 'Ada · Sub' }])
  })
})
