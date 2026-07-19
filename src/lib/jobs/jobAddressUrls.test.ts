import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildClickToolingUrl, formatAddressTwoLines, googleMapsSearchUrl, resolvedLaborInvoiceLink } from './jobAddressUrls'

describe('googleMapsSearchUrl', () => {
  it('builds an encoded maps search url', () => {
    expect(googleMapsSearchUrl('123 Main St, Austin, TX')).toBe(
      'https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Austin%2C%20TX',
    )
  })
  it('trims and tolerates null/empty', () => {
    expect(googleMapsSearchUrl('  456 Oak Ave  ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=456%20Oak%20Ave',
    )
    expect(googleMapsSearchUrl(null)).toBe('https://www.google.com/maps/search/?api=1&query=')
    expect(googleMapsSearchUrl(undefined)).toBe('https://www.google.com/maps/search/?api=1&query=')
  })
})

describe('resolvedLaborInvoiceLink', () => {
  it('returns null for blank input', () => {
    expect(resolvedLaborInvoiceLink('')).toBe(null)
    expect(resolvedLaborInvoiceLink('   ')).toBe(null)
  })
  it('normalizes a bare host to https', () => {
    expect(resolvedLaborInvoiceLink('example.com')).toBe('https://example.com')
  })
  it('leaves an already-qualified url intact', () => {
    expect(resolvedLaborInvoiceLink('https://x.com/a')).toBe('https://x.com/a')
  })
})

describe('buildClickToolingUrl', () => {
  it('encodes customer fields into the query string', () => {
    const job = {
      customer_name: 'John Doe',
      customer_email: 'john@x.com',
      customer_phone: '555-1234',
      job_address: '123 Main St',
    } as unknown as JobWithDetails
    expect(buildClickToolingUrl(job)).toBe(
      'https://clicktooling.com/?name=John+Doe&email=john%40x.com&phone=555-1234&location=123+Main+St',
    )
  })
  it('treats missing fields as empty strings', () => {
    const job = {} as unknown as JobWithDetails
    expect(buildClickToolingUrl(job)).toBe('https://clicktooling.com/?name=&email=&phone=&location=')
  })
})

describe('formatAddressTwoLines', () => {
  it('returns null for blank input', () => {
    expect(formatAddressTwoLines(null)).toBe(null)
    expect(formatAddressTwoLines('   ')).toBe(null)
  })
  it('keeps a bare street address on a single line', () => {
    expect(formatAddressTwoLines('123 Main Street')).toEqual({ line1: '123 Main Street' })
  })
  it('splits on the first comma when no TX locality precedes it', () => {
    expect(formatAddressTwoLines('456 Oak Ave, Apt 5')).toEqual({ line1: '456 Oak Ave', line2: 'Apt 5' })
  })
  it('splits at the TX locality (with comma)', () => {
    expect(formatAddressTwoLines('789 Elm Rd, Dallas TX 75001')).toEqual({
      line1: '789 Elm Rd',
      line2: 'Dallas TX 75001',
    })
  })
  it('splits at the TX locality (no comma)', () => {
    expect(formatAddressTwoLines('100 First Avenue Houston TX')).toEqual({
      line1: '100 First Avenue',
      line2: 'Houston TX',
    })
  })
})
