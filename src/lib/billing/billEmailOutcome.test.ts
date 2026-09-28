import { describe, expect, it } from 'vitest'
import { billEmailSentMessage, parseBillEmailOutcome } from './billEmailOutcome'

describe('parseBillEmailOutcome', () => {
  it('reads our send and where it went', () => {
    expect(parseBillEmailOutcome({ success: true, sent_by: 'clicktooling', delivered_to: ' ap@hartwell.example ', customer_email: 'x@y.example' })).toEqual({
      sent_by: 'clicktooling',
      delivered_to: 'ap@hartwell.example',
    })
  })
  it('an answer that names no sender is the older function: Stripe, to the customer', () => {
    expect(parseBillEmailOutcome({ success: true, customer_email: 'ap@hartwell.example' })).toEqual({ sent_by: 'stripe', delivered_to: 'ap@hartwell.example' })
    expect(parseBillEmailOutcome(null)).toEqual({ sent_by: 'stripe', delivered_to: '' })
  })
  it('keeps a known fallback reason and the test redirect, drops anything else', () => {
    expect(parseBillEmailOutcome({ sent_by: 'stripe', delivered_to: 'a@b.example', fallback_reason: 'send_failed' }).fallback_reason).toBe('send_failed')
    expect(parseBillEmailOutcome({ sent_by: 'stripe', fallback_reason: 'because' }).fallback_reason).toBeUndefined()
    expect(parseBillEmailOutcome({ sent_by: 'clicktooling', delivered_to: 'me@click.example', test_redirected: true }).test_redirected).toBe(true)
    expect(parseBillEmailOutcome({ sent_by: 'clicktooling', test_redirected: 'yes' }).test_redirected).toBeUndefined()
  })
})

describe('billEmailSentMessage', () => {
  it('names the address our email went to', () => {
    expect(billEmailSentMessage({ sent_by: 'clicktooling', delivered_to: 'ap@hartwell.example' }, 'live')).toBe('Bill email sent to ap@hartwell.example.')
    expect(billEmailSentMessage({ sent_by: 'clicktooling', delivered_to: '' }, 'live')).toBe('Bill email sent.')
  })
  it('says a test bill came to the sender, not the customer', () => {
    expect(billEmailSentMessage({ sent_by: 'clicktooling', delivered_to: 'me@click.example', test_redirected: true }, 'test')).toBe(
      'Test bill: the email came to you (me@click.example), not the customer.',
    )
  })
  it('keeps Stripe’s wording when Stripe sent it, with the test-mode hint', () => {
    expect(billEmailSentMessage({ sent_by: 'stripe', delivered_to: 'a@b.example' }, 'live')).toBe('Stripe sent the invoice email.')
    expect(billEmailSentMessage({ sent_by: 'stripe', delivered_to: 'a@b.example', fallback_reason: 'test_without_sender' }, 'test')).toBe(
      'Stripe sent the invoice email. Test mode: Stripe does not deliver a real customer email, but the send succeeded.',
    )
  })
  it('says so when Stripe sent it because ours could not go', () => {
    for (const fallback_reason of ['send_failed', 'no_resend_key'] as const) {
      expect(billEmailSentMessage({ sent_by: 'stripe', delivered_to: 'a@b.example', fallback_reason }, 'live')).toBe(
        'Stripe sent the invoice email — ours could not go out, so this one has no account code.',
      )
    }
  })
})
