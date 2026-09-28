import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — the pure plan, tested here.
import { billEmailSenderFromEnv, planBillEmail } from '../../../supabase/functions/_shared/billEmailPlan'

const live = { sender: 'clicktooling' as const, hasResendKey: true, stripeMode: 'live' as const, customerEmail: ' ap@hartwell.example ', callerEmail: 'office@click.example' }

describe('billEmailSenderFromEnv', () => {
  it('is ours unless the secret says stripe', () => {
    expect(billEmailSenderFromEnv(undefined)).toBe('clicktooling')
    expect(billEmailSenderFromEnv('')).toBe('clicktooling')
    expect(billEmailSenderFromEnv('own')).toBe('clicktooling')
    expect(billEmailSenderFromEnv(' Stripe ')).toBe('stripe')
  })
})

describe('planBillEmail (who sends the bill, and to whom)', () => {
  it('a live bill goes from us to the customer', () => {
    expect(planBillEmail(live)).toEqual({ via: 'clicktooling', to: 'ap@hartwell.example', testIntendedFor: null })
  })

  it('the secret hands every bill back to Stripe', () => {
    expect(planBillEmail({ ...live, sender: 'stripe' })).toEqual({ via: 'stripe', reason: 'configured' })
    expect(planBillEmail({ ...live, sender: 'stripe', stripeMode: 'test' })).toEqual({ via: 'stripe', reason: 'configured' })
  })

  it('no Resend key → Stripe sends, so the bill still goes out', () => {
    expect(planBillEmail({ ...live, hasResendKey: false })).toEqual({ via: 'stripe', reason: 'no_resend_key' })
  })

  it('a test bill goes to whoever pressed Send, never to the customer', () => {
    expect(planBillEmail({ ...live, stripeMode: 'test' })).toEqual({ via: 'clicktooling', to: 'office@click.example', testIntendedFor: 'ap@hartwell.example' })
  })

  it('a test bill with no sender address falls to Stripe, which delivers nothing in test mode', () => {
    expect(planBillEmail({ ...live, stripeMode: 'test', callerEmail: ' ' })).toEqual({ via: 'stripe', reason: 'test_without_sender' })
    expect(planBillEmail({ ...live, stripeMode: 'test', callerEmail: null })).toEqual({ via: 'stripe', reason: 'test_without_sender' })
  })
})
