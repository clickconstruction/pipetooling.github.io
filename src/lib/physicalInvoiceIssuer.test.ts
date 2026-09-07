import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import {
  getPhysicalInvoiceIssuerDraft,
  getPhysicalInvoiceIssuerForDocument,
  parsePhysicalInvoiceIssuerStoredJson,
} from './physicalInvoiceIssuer'

const EMPTY = { companyName: '', addressText: '', phone: '', email: '', tagline: '', licenseLine: '' }

describe('parsePhysicalInvoiceIssuerStoredJson', () => {
  it('returns all-empty fields for anything that is not an object', () => {
    expect(parsePhysicalInvoiceIssuerStoredJson(null)).toEqual(EMPTY)
    expect(parsePhysicalInvoiceIssuerStoredJson('x')).toEqual(EMPTY)
    expect(parsePhysicalInvoiceIssuerStoredJson([1])).toEqual(EMPTY)
    expect(parsePhysicalInvoiceIssuerStoredJson(42)).toEqual(EMPTY)
  })
  it('keeps only string fields it knows, blanking the rest', () => {
    expect(
      parsePhysicalInvoiceIssuerStoredJson({
        companyName: 'Click Plumbing',
        addressText: '12925 FM 20\nKingsbury TX',
        phone: 5551234, // wrong type → blank
        email: 'office@example.com',
        licenseLine: 'M-12345',
        unknownField: 'ignored',
      }),
    ).toEqual({
      companyName: 'Click Plumbing',
      addressText: '12925 FM 20\nKingsbury TX',
      phone: '',
      email: 'office@example.com',
      tagline: '',
      licenseLine: 'M-12345',
    })
  })
})

describe('draft resolution with no window and no fetch yet', () => {
  it('is all-empty, and the document getter is the same view', () => {
    expect(getPhysicalInvoiceIssuerDraft()).toEqual(EMPTY)
    expect(getPhysicalInvoiceIssuerForDocument()).toEqual(EMPTY)
    // a fresh copy each call — callers may mutate it
    expect(getPhysicalInvoiceIssuerDraft()).not.toBe(getPhysicalInvoiceIssuerDraft())
  })
})
