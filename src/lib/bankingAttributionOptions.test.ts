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
})
