import { describe, expect, it } from 'vitest'
import {
  buildPayLinkPayload,
  formatPayLinkCents,
  isPayLinkId,
  parsePayLinkResponse,
  payLinkDisplay,
  payLinkPath,
  payLinkRowEligible,
  payLinkStateFrom,
  payLinkUrl,
  type PayLinkRow,
} from './payLink'

const ID = '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44'
const row = (over: Partial<PayLinkRow> = {}): PayLinkRow => ({
  id: ID,
  job_id: 'job-1',
  status: 'billed',
  stripe_invoice_id: 'in_123',
  stripe_mode: 'live',
  hosted_invoice_url: 'https://invoice.stripe.com/i/stored',
  stripe_invoice_status: 'open',
  ...over,
})

describe('payLink — the address', () => {
  it('is always the public site, lower-cased, with the id as the last segment', () => {
    expect(payLinkPath(ID.toUpperCase())).toBe(`/pay/${ID}`)
    expect(payLinkUrl(ID)).toBe(`https://clicktooling.com/pay/${ID}`)
    expect(payLinkUrl(ID, 'http://127.0.0.1:5190/')).toBe(`http://127.0.0.1:5190/pay/${ID}`)
    expect(payLinkDisplay(ID)).toBe(`clicktooling.com/pay/${ID}`)
  })

  it('accepts only a UUID as a bill id', () => {
    expect(isPayLinkId(ID)).toBe(true)
    expect(isPayLinkId(ID.toUpperCase())).toBe(true)
    expect(isPayLinkId('in_123')).toBe(false)
    expect(isPayLinkId(`${ID}x`)).toBe(false)
    expect(isPayLinkId('')).toBe(false)
    expect(isPayLinkId(null)).toBe(false)
  })
})

describe('payLink — which rows open', () => {
  it('billed or paid Stripe bills only; a paper bill or a draft has no payment page', () => {
    expect(payLinkRowEligible(row())).toBe(true)
    expect(payLinkRowEligible(row({ status: 'paid' }))).toBe(true)
    expect(payLinkRowEligible(row({ status: 'draft' }))).toBe(false)
    expect(payLinkRowEligible(row({ stripe_invoice_id: null }))).toBe(false)
    expect(payLinkRowEligible(row({ stripe_invoice_id: '  ' }))).toBe(false)
    expect(payLinkRowEligible(null)).toBe(false)
  })
})

describe('payLink — the state a scan lands in', () => {
  const facts = (status: string | null, remaining: number | null = 100) => ({ number: '1025-1', status, hosted_invoice_url: 'https://invoice.stripe.com/i/fresh', amount_remaining: remaining, currency: 'usd' })

  it("Stripe's word wins when it answered", () => {
    expect(payLinkStateFrom(row(), facts('open'))).toBe('open')
    expect(payLinkStateFrom(row(), facts('paid', 0))).toBe('paid')
    expect(payLinkStateFrom(row(), facts('open', 0))).toBe('paid')
    expect(payLinkStateFrom(row(), facts('void'))).toBe('void')
    expect(payLinkStateFrom(row(), facts('uncollectible'))).toBe('void')
    expect(payLinkStateFrom(row({ status: 'paid' }), facts('open', 4660))).toBe('open')
  })

  it("falls back to the row's own status when Stripe was not asked", () => {
    expect(payLinkStateFrom(row(), null)).toBe('open')
    expect(payLinkStateFrom(row({ status: 'paid' }), null)).toBe('paid')
    expect(payLinkStateFrom(row({ stripe_invoice_status: 'paid' }), null)).toBe('paid')
    expect(payLinkStateFrom(row({ stripe_invoice_status: 'void' }), null)).toBe('void')
  })
})

describe('payLink — the payload', () => {
  const base = { jobName: '  Dudley (Lennox) ', company: 'Click Plumbing and Electrical', phone: '(512) 360-0599' }

  it("carries Stripe's fresh link, number and balance for an open bill", () => {
    const p = buildPayLinkPayload({ row: row(), facts: { number: '1025-2609180905', status: 'open', hosted_invoice_url: 'https://invoice.stripe.com/i/fresh', amount_remaining: 466000, currency: 'USD' }, paidOn: null, ...base })
    expect(p).toEqual({
      ok: true,
      state: 'open',
      url: 'https://invoice.stripe.com/i/fresh',
      number: '1025-2609180905',
      jobName: 'Dudley (Lennox)',
      company: 'Click Plumbing and Electrical',
      phone: '(512) 360-0599',
      amountRemainingCents: 466000,
      currency: 'usd',
      paidOn: null,
    })
  })

  it('answers from the stored link with no amount when Stripe was unreachable', () => {
    const p = buildPayLinkPayload({ row: row(), facts: null, paidOn: null, ...base })
    expect(p.url).toBe('https://invoice.stripe.com/i/stored')
    expect(p.number).toBeNull()
    expect(p.amountRemainingCents).toBeNull()
    expect(p.state).toBe('open')
  })

  it('a paid bill owes nothing and carries the day it was paid; paidOn never leaks onto an open one', () => {
    const paid = buildPayLinkPayload({ row: row(), facts: { number: '1025-1', status: 'paid', hosted_invoice_url: 'https://invoice.stripe.com/i/fresh', amount_remaining: 0, currency: 'usd' }, paidOn: '2026-09-30', ...base })
    expect(paid.state).toBe('paid')
    expect(paid.amountRemainingCents).toBe(0)
    expect(paid.paidOn).toBe('2026-09-30')
    const open = buildPayLinkPayload({ row: row(), facts: { number: '1025-1', status: 'open', hosted_invoice_url: null, amount_remaining: 500, currency: 'usd' }, paidOn: '2026-09-30', ...base })
    expect(open.paidOn).toBeNull()
    expect(open.url).toBe('https://invoice.stripe.com/i/stored')
  })

  it('has no link at all when neither Stripe nor the row has one', () => {
    const p = buildPayLinkPayload({ row: row({ hosted_invoice_url: null }), facts: null, paidOn: null, ...base })
    expect(p.url).toBeNull()
  })
})

describe('payLink — the client read', () => {
  it('round-trips a payload and rejects anything else', () => {
    const p = buildPayLinkPayload({ row: row(), facts: { number: '1025-1', status: 'open', hosted_invoice_url: 'https://invoice.stripe.com/i/fresh', amount_remaining: 466000, currency: 'usd' }, paidOn: null, jobName: 'J', company: 'C', phone: 'P' })
    expect(parsePayLinkResponse(JSON.parse(JSON.stringify(p)))).toEqual(p)
    expect(parsePayLinkResponse({ error: 'not_found' })).toBeNull()
    expect(parsePayLinkResponse({ ok: true, state: 'lost' })).toBeNull()
    expect(parsePayLinkResponse(null)).toBeNull()
    expect(parsePayLinkResponse([])).toBeNull()
  })

  it('tolerates missing optional fields and a fractional cents value', () => {
    const p = parsePayLinkResponse({ ok: true, state: 'open', amountRemainingCents: 12.6, currency: 'USD' })
    expect(p).toEqual({ ok: true, state: 'open', url: null, number: null, jobName: '', company: '', phone: '', amountRemainingCents: 13, currency: 'usd', paidOn: null })
  })

  it('formats cents as dollars', () => {
    expect(formatPayLinkCents(466000)).toBe('$4,660.00')
    expect(formatPayLinkCents(5)).toBe('$0.05')
  })
})
