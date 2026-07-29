import { describe, expect, it } from 'vitest'
import { fixtureInvoiceLinkChip, fixtureRowIsLocked } from './jobFormFixtureLinks'

const statuses = { i1: 'ready_to_bill', i2: 'billed', i3: 'paid' }

describe('fixtureInvoiceLinkChip', () => {
  it('returns null for an unlinked row', () => {
    expect(fixtureInvoiceLinkChip(null, statuses)).toBeNull()
  })

  it('returns null when the invoice is missing from the map (just deleted)', () => {
    expect(fixtureInvoiceLinkChip('gone', statuses)).toBeNull()
  })

  it('labels the three lifecycle stages', () => {
    expect(fixtureInvoiceLinkChip('i1', statuses)?.label).toBe('Invoiced · Ready to Bill')
    expect(fixtureInvoiceLinkChip('i2', statuses)?.label).toBe('Invoiced · Billed')
    expect(fixtureInvoiceLinkChip('i3', statuses)?.label).toBe('Invoiced · Paid')
  })
})

describe('fixtureRowIsLocked', () => {
  it('locks only linked rows', () => {
    expect(fixtureRowIsLocked({ invoice_id: 'i1' })).toBe(true)
    expect(fixtureRowIsLocked({ invoice_id: null })).toBe(false)
  })
})
