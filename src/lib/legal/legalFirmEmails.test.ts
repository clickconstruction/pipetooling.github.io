import { describe, expect, it } from 'vitest'
import { buildLegalDigestEmail, buildLegalNowEmail, legalNowTriggerOf, legalTriggerSendsNow } from '../legalEmails'

const base = { companyName: 'Click', firmName: 'Example Law', payer: 'Lenox Builders', portalUrl: 'https://x', unsubscribeUrl: 'https://y' }

describe('every office event emails the firm (#85 item 17, PR 2)', () => {
  it('knows each trigger, skips an unknown one, and keeps a seen fee for the digest', () => {
    expect(['referred', 'answer', 'pulled', 'ask', 'note', 'applied', 'fee_seen'].map(legalNowTriggerOf)).toEqual(['referred', 'answer', 'pulled', 'ask', 'note', 'applied', 'fee_seen'])
    expect(legalNowTriggerOf('void')).toBeNull()
    expect(legalNowTriggerOf(null)).toBeNull()
    expect(legalTriggerSendsNow('fee_seen')).toBe(false)
    expect(legalTriggerSendsNow('ask')).toBe(true)
  })
  it('the answer carries the firm’s question', () => {
    const m = buildLegalNowEmail({ ...base, trigger: 'answer', body: 'Yes, signed 4/2.', question: 'Signed change order?' })
    expect(m.subject).toBe('Click answered on Lenox Builders')
    expect(m.html).toContain('You asked: <i>Signed change order?</i><br>The office: <i>Yes, signed 4/2.</i>')
  })
  it('an ask, a note, a payment applied, a fee seen', () => {
    const ask = buildLegalNowEmail({ ...base, trigger: 'ask', flavor: 'signoff', jobLabel: '273', body: 'May we take the check?' })
    expect(ask.subject).toBe('Click asks your sign-off on Lenox Builders')
    expect(ask.html).toContain('for your sign-off on job 273')
    expect(buildLegalNowEmail({ ...base, trigger: 'ask', body: 'Which form?' }).subject).toBe('Click asks you about Lenox Builders')
    expect(buildLegalNowEmail({ ...base, trigger: 'note', body: 'Settlement floor set' }).subject).toBe('A note from Click on Lenox Builders')
    const applied = buildLegalNowEmail({ ...base, trigger: 'applied', amount: 14000 })
    expect(applied.subject).toBe('Payment applied on Lenox Builders')
    expect(applied.html).toContain('<b>$14,000.00</b>')
    expect(buildLegalNowEmail({ ...base, trigger: 'fee_seen', amount: 450, body: 'Demand letter' }).html).toContain('saw <b>$450.00</b>')
  })
  it('the digest names each kind of event', () => {
    const d = buildLegalDigestEmail({ companyName: 'Click', recipientName: 'Dana', matters: [], portalUrl: 'https://x', unsubscribeUrl: 'https://y', events: [
      { createdAt: '2026-10-05T15:00:00Z', trigger: 'fee_seen', payer: 'Lenox Builders', body: 'Demand letter', amount: 450 },
      { createdAt: '2026-10-05T16:00:00Z', trigger: 'ask', payer: 'Lenox Builders', body: 'Which form?' },
      { createdAt: '2026-10-05T17:00:00Z', trigger: 'applied', payer: 'Lenox Builders', amount: 14000 },
    ] })
    expect(d.html).toContain('Fee seen by the office: <b>Lenox Builders</b> $450.00 — Demand letter')
    expect(d.html).toContain('The office asks: <b>Lenox Builders</b> — Which form?')
    expect(d.html).toContain('Payment applied: <b>Lenox Builders</b> $14,000.00')
  })
})
