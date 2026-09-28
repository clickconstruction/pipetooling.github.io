import { describe, expect, it } from 'vitest'
import { billCopiesFailedMessage, billCopiesSentHint, billEmailSentMessage, parseBillCopiesOutcome, parseBillEmailOutcome } from './billEmailOutcome'

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

describe('parseBillCopiesOutcome', () => {
  it('a live bill: who got a copy and how many failed', () => {
    expect(parseBillCopiesOutcome({ copies_sent: [' pm@hartwell.example ', 7, ''], copies_failed: [{ email: 'ap@drf.example', error: 'bounced' }] })).toEqual({
      sent: ['pm@hartwell.example'],
      failedCount: 1,
      testTo: null,
      heldBack: null,
    })
  })
  it('an answer that names no copies is a bill with none', () => {
    for (const body of [null, undefined, 'ok', {}, { success: true }]) {
      expect(parseBillCopiesOutcome(body)).toEqual({ sent: [], failedCount: 0, testTo: null, heldBack: null })
    }
  })
  it('a test bill: where the one copy went and who was held back', () => {
    expect(parseBillCopiesOutcome({ copies_sent: [], copies_failed: [], copies_test_to: 'office@click.example', copies_held_back: ['pm@hartwell.example', 'ap@drf.example'] })).toEqual({
      sent: [],
      failedCount: 0,
      testTo: 'office@click.example',
      heldBack: ['pm@hartwell.example', 'ap@drf.example'],
    })
  })
  it('a test bill is one even when nothing is held back or nothing went out', () => {
    expect(parseBillCopiesOutcome({ copies_test_to: 'office@click.example', copies_held_back: [] }).heldBack).toEqual([])
    expect(parseBillCopiesOutcome({ copies_skipped: 'test_without_sender' }).heldBack).toEqual([])
    expect(parseBillCopiesOutcome({ copies_skipped: 'no_resend_key' }).heldBack).toBeNull()
  })
})

describe('billCopiesSentHint', () => {
  const none = { sent: [], failedCount: 0, testTo: null, heldBack: null }
  it('a live bill names who got a copy, or says nothing', () => {
    expect(billCopiesSentHint({ ...none, sent: ['pm@hartwell.example', 'ap@drf.example'] })).toBe(' Copies went to pm@hartwell.example, ap@drf.example.')
    expect(billCopiesSentHint(none)).toBe('')
  })
  it('a test bill says the copy came to the sender and names who got nothing', () => {
    expect(billCopiesSentHint({ ...none, testTo: 'office@click.example', heldBack: ['pm@hartwell.example', 'ap@drf.example'] })).toBe(
      ' The copy came to you too; nothing went to pm@hartwell.example, ap@drf.example.',
    )
    expect(billCopiesSentHint({ ...none, testTo: 'office@click.example', heldBack: [] })).toBe(' The copy came to you too.')
  })
  it('a test bill whose copy did not go out still names who got nothing', () => {
    expect(billCopiesSentHint({ ...none, heldBack: ['pm@hartwell.example'] })).toBe(' No copy went out; nothing went to pm@hartwell.example.')
    expect(billCopiesSentHint({ ...none, heldBack: [] })).toBe('')
  })
  it('a test bill never reads as copies sent to the list', () => {
    expect(billCopiesSentHint({ ...none, sent: ['pm@hartwell.example'], testTo: 'office@click.example', heldBack: ['pm@hartwell.example'] })).not.toContain('Copies went to')
  })
})

describe('billCopiesFailedMessage', () => {
  it('is null when nothing failed', () => {
    expect(billCopiesFailedMessage({ sent: ['pm@hartwell.example'], failedCount: 0, testTo: null, heldBack: null })).toBeNull()
  })
  it('counts the copies a live bill could not send', () => {
    expect(billCopiesFailedMessage({ sent: [], failedCount: 1, testTo: null, heldBack: null })).toBe('1 copy email failed to send — the payer\'s own email went out.')
    expect(billCopiesFailedMessage({ sent: [], failedCount: 2, testTo: null, heldBack: null })).toBe('2 copy emails failed to send — the payer\'s own email went out.')
  })
  it('a test bill says its copy was the sender’s, and that the list got nothing', () => {
    expect(billCopiesFailedMessage({ sent: [], failedCount: 1, testTo: null, heldBack: ['pm@hartwell.example'] })).toBe('The test copy could not be sent to you. Nothing went to the copy list.')
  })
})
