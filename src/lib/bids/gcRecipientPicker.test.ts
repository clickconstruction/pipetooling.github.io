import { describe, expect, it } from 'vitest'

import { addGcsButtonLabel, filterPickableGcs, tickedSummary } from './gcRecipientPicker'

const customers = [
  { id: 'loberg', name: 'Loberg Contracting', address: '311 E Illinois Ave, Palatine, IL' },
  { id: 'turner', name: 'Turner Construction', address: '550 W Adams St, Chicago, IL' },
  { id: 'pepper', name: 'Pepper Construction', address: '643 N Orleans St, Chicago, IL' },
  { id: 'skender', name: 'Skender', address: null },
]

describe('filterPickableGcs', () => {
  it('excludes the bid GC and existing recipients', () => {
    const out = filterPickableGcs(customers, { bidCustomerId: 'loberg', recipientIds: new Set(['pepper']), search: '' })
    expect(out.map((c) => c.id)).toEqual(['turner', 'skender'])
  })

  it('matches search on name or address, case-insensitive', () => {
    const base = { bidCustomerId: null, recipientIds: new Set<string>() }
    expect(filterPickableGcs(customers, { ...base, search: 'TURNER' }).map((c) => c.id)).toEqual(['turner'])
    expect(filterPickableGcs(customers, { ...base, search: 'orleans' }).map((c) => c.id)).toEqual(['pepper'])
    expect(filterPickableGcs(customers, { ...base, search: '  ' }).length).toBe(4)
  })

  it('handles a null address without matching it', () => {
    const out = filterPickableGcs(customers, { bidCustomerId: null, recipientIds: new Set(), search: 'chicago' })
    expect(out.map((c) => c.id)).toEqual(['turner', 'pepper'])
  })
})

describe('picker labels', () => {
  it('button stays "Add" for 0 or 1, counts beyond that', () => {
    expect(addGcsButtonLabel(0)).toBe('Add')
    expect(addGcsButtonLabel(1)).toBe('Add')
    expect(addGcsButtonLabel(3)).toBe('Add 3 GCs')
  })

  it('summary reads as a running tally', () => {
    expect(tickedSummary(0)).toBe('Nothing ticked yet')
    expect(tickedSummary(1)).toBe('1 ticked')
    expect(tickedSummary(4)).toBe('4 ticked')
  })
})
