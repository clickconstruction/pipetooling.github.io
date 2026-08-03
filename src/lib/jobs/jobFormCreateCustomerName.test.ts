import { describe, expect, it } from 'vitest'
import { resolveCreateCustomerName } from './jobFormCreateCustomerName'

describe('resolveCreateCustomerName', () => {
  it('uses the typed search text when nothing is linked', () => {
    expect(
      resolveCreateCustomerName({ customerName: '', customerSearch: 'Zeta Mechanical', customerId: null }),
    ).toBe('Zeta Mechanical')
  })

  it('prefers the typed search text over a stale Customer Name prefill', () => {
    expect(
      resolveCreateCustomerName({ customerName: 'Old Job Name', customerSearch: 'Zeta Mechanical', customerId: null }),
    ).toBe('Zeta Mechanical')
  })

  it('trims the typed text', () => {
    expect(
      resolveCreateCustomerName({ customerName: '', customerSearch: '  Zeta Mechanical  ', customerId: null }),
    ).toBe('Zeta Mechanical')
  })

  it('falls back to Customer Name when the search box is empty', () => {
    expect(
      resolveCreateCustomerName({ customerName: 'Typed In Name Field', customerSearch: '', customerId: null }),
    ).toBe('Typed In Name Field')
  })

  it('falls back to Customer Name when the search box is only whitespace', () => {
    expect(
      resolveCreateCustomerName({ customerName: 'Typed In Name Field', customerSearch: '   ', customerId: null }),
    ).toBe('Typed In Name Field')
  })

  it('ignores search text once a customer is linked (the box shows the linked display)', () => {
    expect(
      resolveCreateCustomerName({ customerName: 'Alpha Builders', customerSearch: 'Alpha Builders · 1 Main St', customerId: 'cust-1' }),
    ).toBe('Alpha Builders')
  })

  it('returns empty when neither field has content', () => {
    expect(resolveCreateCustomerName({ customerName: '  ', customerSearch: '', customerId: null })).toBe('')
  })
})
