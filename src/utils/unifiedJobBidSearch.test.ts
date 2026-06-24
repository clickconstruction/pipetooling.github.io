import { describe, expect, it } from 'vitest'
import {
  customerTypePillForUnifiedRow,
  escapeLike,
  formatUnifiedResult,
  serviceTypeTagForUnifiedRow,
  type UnifiedSearchResult,
} from './unifiedJobBidSearch'

const customer = (over: Partial<Extract<UnifiedSearchResult, { source: 'customer' }>> = {}): UnifiedSearchResult => ({
  source: 'customer',
  id: 'c1',
  name: 'Acme LLC',
  address: '123 Main St',
  customer_type: 'commercial',
  ...over,
})

// formatUnifiedResult takes a prefix map only for job/bid rows; customers don't use it.
const noPrefixMap = {} as Parameters<typeof formatUnifiedResult>[1]

describe('formatUnifiedResult — customer branch', () => {
  it('shows "C · name - address" when both present', () => {
    expect(formatUnifiedResult(customer(), noPrefixMap)).toBe('C · Acme LLC - 123 Main St')
  })

  it('omits the address tail when address is null/blank', () => {
    expect(formatUnifiedResult(customer({ address: null }), noPrefixMap)).toBe('C · Acme LLC')
    expect(formatUnifiedResult(customer({ address: '   ' }), noPrefixMap)).toBe('C · Acme LLC')
  })

  it('renders an em dash when name is null/blank', () => {
    expect(formatUnifiedResult(customer({ name: null, address: null }), noPrefixMap)).toBe('C · —')
  })
})

describe('customerTypePillForUnifiedRow', () => {
  it('maps commercial and commercial_default to "com"', () => {
    expect(customerTypePillForUnifiedRow(customer({ customer_type: 'commercial' }))?.tag).toBe('com')
    expect(customerTypePillForUnifiedRow(customer({ customer_type: 'commercial_default' }))?.tag).toBe('com')
  })

  it('maps residential to "res"', () => {
    expect(customerTypePillForUnifiedRow(customer({ customer_type: 'residential' }))?.tag).toBe('res')
  })

  it('returns null for null/unknown type and for non-customer rows', () => {
    expect(customerTypePillForUnifiedRow(customer({ customer_type: null }))).toBeNull()
    expect(customerTypePillForUnifiedRow(customer({ customer_type: 'other' }))).toBeNull()
    const job: UnifiedSearchResult = {
      source: 'job',
      id: 'j1',
      hcp_number: 'J1',
      job_name: 'x',
      job_address: 'y',
    }
    expect(customerTypePillForUnifiedRow(job)).toBeNull()
  })
})

describe('serviceTypeTagForUnifiedRow — customers carry no trade pill', () => {
  it('returns null for a customer row', () => {
    expect(serviceTypeTagForUnifiedRow(customer())).toBeNull()
  })
})

describe('escapeLike', () => {
  it('escapes LIKE wildcards and PostgREST filter delimiters', () => {
    expect(escapeLike('a%b_c')).toBe('a\\%b\\_c')
    expect(escapeLike('Smith, Jones')).toBe('Smith\\, Jones')
    expect(escapeLike('A&B (LLC)')).toBe('A&B \\(LLC\\)')
    expect(escapeLike('back\\slash')).toBe('back\\\\slash')
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeLike('Acme Plumbing')).toBe('Acme Plumbing')
  })
})
