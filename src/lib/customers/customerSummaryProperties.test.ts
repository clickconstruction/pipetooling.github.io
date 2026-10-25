import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_ADDRESS_FALLBACK_ID,
  canEditCustomerFromSummary,
  customerSummaryProperties,
  customerSummaryPropertyNoteWords,
  type CustomerSummaryAddressRow,
} from './customerSummaryProperties'

const row = (over: Partial<CustomerSummaryAddressRow> & { id: string }): CustomerSummaryAddressRow => ({
  address: '1 Main St',
  note: null,
  is_primary: false,
  sequence_order: 0,
  ...over,
})

describe('customerSummaryProperties', () => {
  it('draws the primary first, then the rest by sequence_order, each with its trimmed note', () => {
    const out = customerSummaryProperties('12 Lenox Ct', [
      row({ id: 'b', address: '9 Elm', note: '  shop, side door  ', sequence_order: 2 }),
      row({ id: 'a', address: '12 Lenox Ct', note: 'Gate code 4411', is_primary: true, sequence_order: 5 }),
      row({ id: 'c', address: '3 Oak', note: '', sequence_order: 1 }),
    ])
    expect(out.map((p) => [p.id, p.isPrimary, p.note])).toEqual([
      ['a', true, 'Gate code 4411'],
      ['c', false, null],
      ['b', false, 'shop, side door'],
    ])
    expect(out[0]!.mapsHref).toBe('https://www.google.com/maps/search/?api=1&query=12%20Lenox%20Ct')
  })

  it('drops blank addresses and sorts a missing sequence_order last, ties in the order given', () => {
    const out = customerSummaryProperties(null, [
      row({ id: 'x', address: 'X', sequence_order: null }),
      row({ id: 'blank', address: '   ' }),
      row({ id: 'y', address: 'Y', sequence_order: null }),
      row({ id: 'z', address: 'Z', sequence_order: 0 }),
    ])
    expect(out.map((p) => p.id)).toEqual(['z', 'x', 'y'])
  })

  it('with no rows, the customer’s own address stands in as the one property, no note', () => {
    expect(customerSummaryProperties(' 12 Lenox Ct ', [])).toEqual([
      {
        id: CUSTOMER_ADDRESS_FALLBACK_ID,
        address: '12 Lenox Ct',
        note: null,
        isPrimary: true,
        mapsHref: 'https://www.google.com/maps/search/?api=1&query=12%20Lenox%20Ct',
      },
    ])
    expect(customerSummaryProperties(null, null)).toEqual([])
    expect(customerSummaryProperties('  ', undefined)).toEqual([])
  })

  it('when the rows do not carry the customer’s address, that address leads the list', () => {
    const out = customerSummaryProperties('12 Lenox Ct', [row({ id: 'b', address: '9 Elm', note: 'shop' })])
    expect(out.map((p) => [p.id, p.address])).toEqual([
      [CUSTOMER_ADDRESS_FALLBACK_ID, '12 Lenox Ct'],
      ['b', '9 Elm'],
    ])
  })

  it('a row that spells the customer’s address with other spacing or case is the same property, not a second one', () => {
    const out = customerSummaryProperties('12 Lenox Ct', [row({ id: 'a', address: '12  lenox ct', note: 'code 4411' })])
    expect(out.map((p) => p.id)).toEqual(['a'])
  })
})

describe('customerSummaryPropertyNoteWords', () => {
  it('gives the note in full, or No note', () => {
    expect(customerSummaryPropertyNoteWords(' Gate code 4411. Dog in the yard. ')).toEqual({
      kind: 'note',
      text: 'Gate code 4411. Dog in the yard.',
    })
    expect(customerSummaryPropertyNoteWords(null)).toEqual({ kind: 'none', text: 'No note' })
    expect(customerSummaryPropertyNoteWords('   ')).toEqual({ kind: 'none', text: 'No note' })
  })
})

describe('canEditCustomerFromSummary', () => {
  it('opens the door for the roles whose RLS lets them update customers', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) {
      expect(canEditCustomerFromSummary(r), r).toBe(true)
    }
  })
  it('never for a sub, a helper, a primary, a superintendent or an unknown role', () => {
    for (const r of ['subcontractor', 'helpers', 'primary', 'superintendent', null, undefined, '']) {
      expect(canEditCustomerFromSummary(r), String(r)).toBe(false)
    }
  })
})
