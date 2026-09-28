import { describe, expect, it } from 'vitest'
import { estimateImportCustomerFields, estimateImportFixtureRows } from './jobImportFromEstimate'

const ids = () => {
  let n = 0
  return () => `id-${++n}`
}

describe('estimateImportFixtureRows', () => {
  it('is one line item per estimate line, each with a new id and no invoice', () => {
    expect(
      estimateImportFixtureRows(
        [
          { name: 'Water heater', count: 1, line_unit_price: 1_200, line_description: '50 gal' },
          { name: 'Credit', count: 1, line_unit_price: -100, line_description: null },
        ],
        ids(),
      ),
    ).toEqual([
      { id: 'id-1', name: 'Water heater', count: 1, line_unit_price: 1_200, line_description: '50 gal', invoice_id: null },
      { id: 'id-2', name: 'Credit', count: 1, line_unit_price: -100, line_description: '', invoice_id: null },
    ])
  })

  it('is one blank row when the estimate has no lines', () => {
    expect(estimateImportFixtureRows([], ids())).toEqual([{ id: 'id-1', name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null }])
  })
})

describe('estimateImportCustomerFields', () => {
  it('reads the customer’s name, contact and the day met', () => {
    expect(estimateImportCustomerFields({ name: 'Pat Doe', date_met: '2026-03-04T12:00:00Z', contact_info: { phone: '555-0100', email: 'pat@example.com' } }, 'other@example.com')).toEqual({
      customerName: 'Pat Doe',
      customerEmail: 'pat@example.com',
      customerPhone: '555-0100',
      dateMet: '2026-03-04',
    })
  })

  it('a customer with no contact reads blank, not the estimate’s email', () => {
    expect(estimateImportCustomerFields({ name: 'Pat Doe', date_met: null, contact_info: null }, 'other@example.com')).toEqual({ customerName: 'Pat Doe', customerEmail: '', customerPhone: '', dateMet: '' })
    expect(estimateImportCustomerFields({ name: null, contact_info: { phone: '555-0100' } }, null)).toEqual({ customerName: '', customerEmail: '', customerPhone: '555-0100', dateMet: '' })
  })

  it('with no customer row only the estimate’s email is kept', () => {
    expect(estimateImportCustomerFields(null, '  est@example.com ')).toEqual({ customerName: '', customerEmail: 'est@example.com', customerPhone: '', dateMet: '' })
    expect(estimateImportCustomerFields(undefined, null)).toEqual({ customerName: '', customerEmail: '', customerPhone: '', dateMet: '' })
  })
})
