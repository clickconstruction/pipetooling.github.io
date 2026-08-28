import { describe, expect, it } from 'vitest'
import { isMintedPrimaryDraftStillUntouched, type MintedPrimaryDraftRow } from './mintedPrimaryDraftCleanup'

const untouched: MintedPrimaryDraftRow = {
  status: 'ready_to_bill',
  is_primary_rtb_bundle: true,
  stripe_invoice_id: null,
  stripe_invoice_status: null,
  hosted_invoice_url: null,
  sent_to_customer_at: null,
  billed_at: null,
  external_send_channel: null,
  bill_to_name: null,
  bill_to_email: null,
  bill_to_phone: null,
  bill_to_stripe_customer_id: null,
}

describe('isMintedPrimaryDraftStillUntouched', () => {
  it('accepts a freshly minted never-touched primary draft', () => {
    expect(isMintedPrimaryDraftStillUntouched(untouched, 0)).toBe(true)
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, stripe_invoice_id: '  ' }, 0)).toBe(true)
  })

  it('rejects a missing row (already deleted or fetch failed)', () => {
    expect(isMintedPrimaryDraftStillUntouched(null, 0)).toBe(false)
    expect(isMintedPrimaryDraftStillUntouched(undefined, 0)).toBe(false)
  })

  it('rejects once any billing channel touched the row', () => {
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, status: 'billed' }, 0)).toBe(false)
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, stripe_invoice_id: 'in_123' }, 0)).toBe(false)
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, stripe_invoice_status: 'draft' }, 0)).toBe(false)
    expect(
      isMintedPrimaryDraftStillUntouched({ ...untouched, hosted_invoice_url: 'https://stripe/x' }, 0),
    ).toBe(false)
    expect(
      isMintedPrimaryDraftStillUntouched({ ...untouched, sent_to_customer_at: '2026-08-28T00:00:00Z' }, 0),
    ).toBe(false)
    expect(
      isMintedPrimaryDraftStillUntouched({ ...untouched, billed_at: '2026-08-28T00:00:00Z' }, 0),
    ).toBe(false)
    expect(
      isMintedPrimaryDraftStillUntouched({ ...untouched, external_send_channel: 'housecallpro' }, 0),
    ).toBe(false)
  })

  it('rejects when a bill-to override was configured', () => {
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, bill_to_name: 'GC Corp' }, 0)).toBe(false)
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, bill_to_email: 'x@y.z' }, 0)).toBe(false)
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, bill_to_phone: '555' }, 0)).toBe(false)
    expect(
      isMintedPrimaryDraftStillUntouched({ ...untouched, bill_to_stripe_customer_id: 'cus_1' }, 0),
    ).toBe(false)
  })

  it('rejects when a payment references the row', () => {
    expect(isMintedPrimaryDraftStillUntouched(untouched, 1)).toBe(false)
  })

  it('rejects a non-primary row (never delete a partial by mistake)', () => {
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, is_primary_rtb_bundle: false }, 0)).toBe(false)
    expect(isMintedPrimaryDraftStillUntouched({ ...untouched, is_primary_rtb_bundle: null }, 0)).toBe(false)
  })
})
