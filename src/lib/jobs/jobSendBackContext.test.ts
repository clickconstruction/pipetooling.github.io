import { describe, expect, it } from 'vitest'
import {
  sendBackJobBillingContext,
  sendBackRequiresVoidAttestation,
} from './jobSendBackContext'

const inv = (status: string, amount: number, primary = false) => ({
  status,
  amount,
  is_primary_rtb_bundle: primary,
})

describe('sendBackJobBillingContext', () => {
  it('classifies the routine stage-billed round trip (billed line + only the elastic remainder)', () => {
    // Taunya's case: one stage billed, the auto-remainder draft is the only
    // thing the send-back deletes — nothing is voided.
    const ctx = sendBackJobBillingContext([inv('billed', 11770), inv('ready_to_bill', 18588, true)])
    expect(ctx).toEqual({
      rtbDraftCount: 1,
      rtbNonPrimaryDraftCount: 0,
      billedCount: 1,
      billedTotalDollars: 11770,
      stageBilledContinues: true,
    })
    expect(sendBackRequiresVoidAttestation(ctx)).toBe(false)
  })

  it('a deliberate draft carve keeps the attestation and breaks the routine framing', () => {
    const ctx = sendBackJobBillingContext([
      inv('billed', 5000),
      inv('ready_to_bill', 2000, false),
      inv('ready_to_bill', 3000, true),
    ])
    expect(ctx.stageBilledContinues).toBe(false)
    expect(ctx.rtbNonPrimaryDraftCount).toBe(1)
    expect(ctx.rtbDraftCount).toBe(2)
    expect(sendBackRequiresVoidAttestation(ctx)).toBe(true)
  })

  it('no billed lines → not the stage-billed move, but a primary-only removal still skips the attestation', () => {
    const ctx = sendBackJobBillingContext([inv('ready_to_bill', 9000, true)])
    expect(ctx.stageBilledContinues).toBe(false)
    expect(sendBackRequiresVoidAttestation(ctx)).toBe(false)
  })

  it('paid lines count as surviving billed lines; junk amounts are ignored in the total', () => {
    const ctx = sendBackJobBillingContext([
      inv('paid', 250),
      { status: 'billed', amount: 'nope' },
      inv('ready_to_bill', 100, true),
    ])
    expect(ctx.billedCount).toBe(2)
    expect(ctx.billedTotalDollars).toBe(250)
    expect(ctx.stageBilledContinues).toBe(true)
  })

  it('handles empty/absent invoice lists', () => {
    const ctx = sendBackJobBillingContext(null)
    expect(ctx.stageBilledContinues).toBe(false)
    expect(ctx.rtbDraftCount).toBe(0)
    expect(sendBackRequiresVoidAttestation(ctx)).toBe(false)
  })
})
