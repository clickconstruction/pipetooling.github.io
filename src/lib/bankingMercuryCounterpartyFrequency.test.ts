import { describe, expect, it } from 'vitest'
import {
  counterpartyFrequencyCountMap,
  counterpartyFrequenciesAboveMin,
  counterpartyNameFrequencyKey,
} from './bankingMercuryCounterpartyFrequency'

describe('counterpartyNameFrequencyKey', () => {
  it('trims whitespace', () => {
    expect(counterpartyNameFrequencyKey('  Ace Hardware  ')).toBe('Ace Hardware')
  })

  it('blank for null and empty', () => {
    expect(counterpartyNameFrequencyKey(null)).toBe('')
    expect(counterpartyNameFrequencyKey(undefined)).toBe('')
    expect(counterpartyNameFrequencyKey('   ')).toBe('')
  })
})

describe('counterpartyFrequencyCountMap', () => {
  it('counts duplicates by trimmed name', () => {
    const rows = [
      { counterparty_name: 'Ace Hardware' },
      { counterparty_name: 'Ace Hardware' },
      { counterparty_name: ' Other Co ' },
    ]
    const m = counterpartyFrequencyCountMap(rows)
    expect(m.get('Ace Hardware')).toBe(2)
    expect(m.get('Other Co')).toBe(1)
  })

  it('groups blank counterparties', () => {
    const rows = [
      { counterparty_name: null },
      { counterparty_name: '' },
      { counterparty_name: '  ' },
    ]
    const m = counterpartyFrequencyCountMap(rows)
    expect(m.get('')).toBe(3)
  })
})

describe('counterpartyFrequenciesAboveMin', () => {
  it('keeps only counts strictly greater than min (default 2)', () => {
    const rows = [
      { counterparty_name: 'A' },
      { counterparty_name: 'A' },
      { counterparty_name: 'A' },
      { counterparty_name: 'B' },
      { counterparty_name: 'B' },
    ]
    const list = counterpartyFrequenciesAboveMin(rows)
    expect(list).toEqual([
      { label: 'A', count: 3 },
    ])
  })

  it('sorts by count desc then label', () => {
    const rows = [
      { counterparty_name: 'Zebra' },
      { counterparty_name: 'Zebra' },
      { counterparty_name: 'Zebra' },
      { counterparty_name: 'Alpha' },
      { counterparty_name: 'Alpha' },
      { counterparty_name: 'Alpha' },
      { counterparty_name: 'Beta' },
      { counterparty_name: 'Beta' },
      { counterparty_name: 'Beta' },
    ]
    const list = counterpartyFrequenciesAboveMin(rows)
    expect(list.map((x) => x.label)).toEqual(['Alpha', 'Beta', 'Zebra'])
  })

  it('omits blank counterparties', () => {
    const rows = [
      { counterparty_name: null },
      { counterparty_name: null },
      { counterparty_name: null },
      { counterparty_name: 'X' },
      { counterparty_name: 'X' },
      { counterparty_name: 'X' },
    ]
    const list = counterpartyFrequenciesAboveMin(rows)
    expect(list).toEqual([{ label: 'X', count: 3 }])
  })
})
