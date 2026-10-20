/**
 * gc-card-bill's pure half (GC mode, Owner Billing's O8b): the switch, the Stripe mode, the fee, the request, the
 * refusals, the Stripe invoice's lines and the portal's offers. The function's own source and the two it touches
 * (customer-portal's offer, create-stripe-invoice's staff refusal) are read as text, so a later edit that drops a
 * rule fails here. The database's words are held to O8a's migration, so a refusal renamed there is caught.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GC_BILL_PORTAL_CARD_ONLY,
  GC_CARD_BILL_SETTING_KEY,
  GC_CARD_BILL_UNDO_ROLES,
  GC_CARD_FEE_LINE,
  GC_CARD_FEE_PCT,
  gcCardBillDbWords,
  gcCardBillDue,
  gcCardBillOn,
  gcCardBillStripeLines,
  gcCardBillStripeMode,
  gcCardFee,
  gcCardShortDate,
  gcEmailCardFee,
  gcPortalCardBills,
  parseGcCardBillBegun,
  parseGcCardBillRequest,
} from '../../../supabase/functions/_shared/gcCardBill'
import { GC_MONEY_TEAM } from './access'

const ROOT = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8')
const MIGRATION = read('supabase/migrations/20261010026000_gc_owner_card_bills.sql')
const FUNCTION = read('supabase/functions/gc-card-bill/index.ts')
const PORTAL = read('supabase/functions/customer-portal/index.ts')
const CREATE = read('supabase/functions/create-stripe-invoice/index.ts')
const CONFIG = read('supabase/config.toml')
const SWITCH = read('supabase/migrations/20261010042000_gc_card_bill_switch.sql')
const EMAIL = read('supabase/functions/gc-customer-email/index.ts')

const INV = '11111111-2222-3333-4444-555555555555'
const TOKEN = 'abcdef1234567890abcdef'

describe('the switch and the Stripe mode start off', () => {
  it('the offer shows only when the app_settings switch says true (O8c; a missing row is off)', () => {
    expect(GC_CARD_BILL_SETTING_KEY).toBe('gc_card_bill_on_v1')
    expect(gcCardBillOn('true')).toBe(true)
    expect(gcCardBillOn(' TRUE ')).toBe(true)
    for (const v of [undefined, null, '', 'false', 'on', '1', 'yes']) expect(gcCardBillOn(v as string | undefined)).toBe(false)
    // The migration inserts it off, and the owner and dev flip it.
    expect(SWITCH).toContain("VALUES ('gc_card_bill_on_v1', 'false')")
    expect(SWITCH).toContain("USING (key = 'gc_card_bill_on_v1' AND public.is_master_or_dev())")
  })

  it('Stripe is in test mode unless GC_CARD_BILL_STRIPE_MODE says live', () => {
    expect(gcCardBillStripeMode('live')).toBe('live')
    for (const v of [undefined, null, '', 'test', 'production', 'LIVE!']) expect(gcCardBillStripeMode(v as string | undefined)).toBe('test')
  })
})

describe('the fee: 3% of the bill, to the cent, as gc_card_bill_begin rounds it', () => {
  it('reads the owner’s figures', () => {
    expect(GC_CARD_FEE_PCT).toBe(3)
    expect(gcCardFee(288_879)).toBe(8_666.37)
    expect(gcCardFee(42_750)).toBe(1_282.5)
    expect(gcCardFee(5_000)).toBe(150)
  })

  it('a half cent rounds up, as the bed’s 12,345.50 does', () => {
    expect(gcCardFee(12_345.5)).toBe(370.37)
    expect(gcCardFee(0.5)).toBe(0.02)
  })

  it('its line is the rider the database writes', () => {
    expect(GC_CARD_FEE_LINE).toBe('Credit card fee (3%)')
    expect(MIGRATION).toContain("format('Credit card fee (%s%%)', trim_scale(v_card.fee_pct))")
  })
})

describe('the request', () => {
  it('the portal door takes a token and a bill', () => {
    expect(parseGcCardBillRequest({ token: TOKEN, invoiceId: INV })).toEqual({ ok: true, req: { door: 'portal', token: TOKEN, invoiceId: INV } })
  })

  it('the undo door takes a bill alone', () => {
    expect(parseGcCardBillRequest({ undo: INV })).toEqual({ ok: true, req: { door: 'undo', invoiceId: INV } })
  })

  it('refuses anything else', () => {
    for (const body of [null, 'x', {}, { token: 'short', invoiceId: INV }, { token: TOKEN, invoiceId: 'nope' }, { token: TOKEN }, { undo: 'nope' }, { undo: INV, token: TOKEN }, { token: 'x'.repeat(129), invoiceId: INV }])
      expect(parseGcCardBillRequest(body).ok).toBe(false)
  })
})

describe('the database’s refusals reach the customer as O8a wrote them, and nothing else does', () => {
  const ours = [
    'Only a certified bill goes on card.',
    'This bill is paid already.',
    'This bill is on Stripe already.',
    'A payment is on this bill already, so it cannot move to card.',
    'This bill went back to a check bill. Call our office to pay it by card.',
    'This bill is being set up for card. Try again in a minute.',
    'There is nothing to pay on this bill.',
    'That bill is not there.',
    'The bill changed while its card page was made. Call our office.',
    'Sign in to take a bill off card.',
    'A training account cannot take a bill off card.',
    'A digital twin cannot take a bill off card.',
    'Only the money team takes a bill off card.',
    'That bill is not on card.',
    'A payment is on this bill, so it stays on card.',
  ]

  it.each(ours)('“%s” is in the migration, and passes as it is', (words) => {
    expect(MIGRATION).toContain(words.replace(/'/g, "''"))
    expect(gcCardBillDbWords(words)).toBe(words)
  })

  it('a refusal with a prefix still reads; anything else reads as nothing', () => {
    expect(gcCardBillDbWords('ERROR: This bill is paid already.')).toBe('This bill is paid already.')
    expect(gcCardBillDbWords('permission denied for function gc_card_bill_begin')).toBeNull()
    expect(gcCardBillDbWords('relation "x" does not exist')).toBeNull()
    expect(gcCardBillDbWords(null)).toBeNull()
  })
})

describe('the Stripe invoice', () => {
  it('falls due by the contract when that is ahead, else today', () => {
    expect(gcCardBillDue('2026-10-10', '2026-10-09', 30)).toEqual({ dueYmd: '2026-11-08', daysUntilDue: 29 })
    expect(gcCardBillDue('2026-10-10', '2026-09-01', 30)).toEqual({ dueYmd: '2026-10-10', daysUntilDue: 0 })
    expect(gcCardBillDue('2026-10-10', '2026-10-09', null)).toEqual({ dueYmd: '2026-10-10', daysUntilDue: 0 })
    expect(gcCardBillDue('2026-10-10', null, 30)).toEqual({ dueYmd: '2026-10-10', daysUntilDue: 0 })
  })

  it('has two lines in cents: the bill as certified, then the fee on its own', () => {
    expect(gcCardBillStripeLines({ base: 288_879, fee: 8_666.37, number: 3, final: false, certifiedOn: '2026-10-09' }, 'Oak Ridge Clinic')).toEqual([
      { amountCents: 28_887_900, description: 'Pay application 3 for Oak Ridge Clinic, certified Oct 9' },
      { amountCents: 866_637, description: 'Credit card fee (3%)' },
    ])
    expect(gcCardBillStripeLines({ base: 100, fee: 3, number: 7, final: true, certifiedOn: null }, '')[0]!.description).toBe('Pay application 7, final,')
  })

  it('reads begin’s answer, pending or on card', () => {
    const pending = parseGcCardBillBegun({ state: 'pending', base: 42750.0, fee_pct: 3, fee: 1282.5, total: 44032.5, project_id: 'p', job_id: 'j', number: 1, final: false, certified_on: '2026-09-08', owner_pay_days: 30 })
    expect(pending).toMatchObject({ state: 'pending', base: 42750, fee: 1282.5, total: 44032.5, jobId: 'j', number: 1, certifiedOn: '2026-09-08', ownerPayDays: 30, hostedInvoiceUrl: null })
    expect(parseGcCardBillBegun({ state: 'on_card', base: '42750.00', fee: '1282.50', total: '44032.50', hosted_invoice_url: 'https://invoice.stripe.com/i/x' })).toMatchObject({ state: 'on_card', total: 44032.5, hostedInvoiceUrl: 'https://invoice.stripe.com/i/x' })
    expect(parseGcCardBillBegun({ state: 'other', base: 1, fee: 1 })).toBeNull()
    expect(parseGcCardBillBegun(null)).toBeNull()
  })

  it('short dates read as the bill does', () => {
    expect(gcCardShortDate('2026-10-09')).toBe('Oct 9')
    expect(gcCardShortDate('2026-01-31')).toBe('Jan 31')
  })
})

describe('the portal’s offers', () => {
  const bill = (invoiceId: string, over: Partial<{ amount: number; totalPaid: number; payUrl: string | null }> = {}) => ({ invoiceId, amount: 42_750, totalPaid: 0, payUrl: null, ...over })
  const base = { on: true, hasEmail: true, certifiedInvoiceIds: new Set(['b1', 'b2', 'b3', 'b4', 'b5']), cardRows: [] as { invoice_id: string; status: string; base: number | string; fee: number | string }[] }

  it('a certified bill with nothing paid and no Stripe page is offered at its 3%', () => {
    expect(gcPortalCardBills({ ...base, bills: [bill('b1')] })).toEqual([{ invoiceId: 'b1', state: 'offer', base: 42_750, fee: 1_282.5, total: 44_032.5 }])
  })

  it('no offer with the switch off, with no email, on an uncertified bill, on a Stripe bill, or with a payment', () => {
    expect(gcPortalCardBills({ ...base, on: false, bills: [bill('b1')] })).toEqual([])
    expect(gcPortalCardBills({ ...base, hasEmail: false, bills: [bill('b1')] })).toEqual([])
    expect(gcPortalCardBills({ ...base, bills: [bill('x9')] })).toEqual([])
    expect(gcPortalCardBills({ ...base, bills: [bill('b1', { payUrl: 'https://invoice.stripe.com/i/x' })] })).toEqual([])
    expect(gcPortalCardBills({ ...base, bills: [bill('b1', { totalPaid: 10 })] })).toEqual([])
    expect(gcPortalCardBills({ ...base, bills: [{ invoiceId: null, amount: 10, totalPaid: 0, payUrl: null }] })).toEqual([])
  })

  it('a bill on card shows its fee even with the switch off; one taken back is offered no more', () => {
    const cardRows = [
      { invoice_id: 'b2', status: 'on_card', base: '5000.00', fee: '150.00' },
      { invoice_id: 'b3', status: 'undone', base: '5000', fee: '150' },
      { invoice_id: 'b4', status: 'pending', base: '42750', fee: '1282.50' },
    ]
    expect(gcPortalCardBills({ ...base, on: false, cardRows, bills: [bill('b2', { payUrl: 'https://invoice.stripe.com/i/2', amount: 5_150 }), bill('b3'), bill('b4')] })).toEqual([
      { invoiceId: 'b2', state: 'onCard', base: 5_000, fee: 150, total: 5_150 },
    ])
    // A page still being made is offered again: begin says to wait, or begins again once ten minutes pass.
    expect(gcPortalCardBills({ ...base, cardRows, bills: [bill('b4')] })).toEqual([{ invoiceId: 'b4', state: 'offer', base: 42_750, fee: 1_282.5, total: 44_032.5 }])
  })
})

describe('the card offer in our emails (O8c)', () => {
  const bill = (over: Partial<{ amount: number | string; status: string; stripe_invoice_id: string | null }> = {}) => ({ amount: '288879.00', status: 'billed', stripe_invoice_id: null, ...over })

  it('a certified bill not on Stripe, with nothing paid, offers its 3%', () => {
    expect(gcEmailCardFee({ on: true, bill: bill(), paid: false, cardStatus: null })).toBe(8_666.37)
    // A turn still being made is still an offer.
    expect(gcEmailCardFee({ on: true, bill: bill(), paid: false, cardStatus: 'pending' })).toBe(8_666.37)
  })

  it('no offer with the switch off, a payment, a Stripe bill, a bill not billed, one on card or taken back', () => {
    expect(gcEmailCardFee({ on: false, bill: bill(), paid: false, cardStatus: null })).toBeNull()
    expect(gcEmailCardFee({ on: true, bill: bill(), paid: true, cardStatus: null })).toBeNull()
    expect(gcEmailCardFee({ on: true, bill: bill({ stripe_invoice_id: 'in_1' }), paid: false, cardStatus: null })).toBeNull()
    expect(gcEmailCardFee({ on: true, bill: bill({ status: 'paid' }), paid: false, cardStatus: null })).toBeNull()
    expect(gcEmailCardFee({ on: true, bill: bill(), paid: false, cardStatus: 'on_card' })).toBeNull()
    expect(gcEmailCardFee({ on: true, bill: bill(), paid: false, cardStatus: 'undone' })).toBeNull()
    expect(gcEmailCardFee({ on: true, bill: null, paid: false, cardStatus: null })).toBeNull()
  })

  it('gc-customer-email reads the switch and the bill for a certified email and a reminder, and passes the fee to the frame', () => {
    expect(EMAIL).toContain(".eq('key', GC_CARD_BILL_SETTING_KEY)")
    expect(EMAIL).toContain("(m.kind === 'certified' || m.kind === 'reminder')")
    expect(EMAIL).toContain('portalUrl, cardFee })')
  })
})

describe('the function, the portal and the staff refusal, read as text', () => {
  it('only the money team takes a bill back, the same team the client opens Money to', () => {
    expect([...GC_CARD_BILL_UNDO_ROLES].sort()).toEqual([...GC_MONEY_TEAM].sort())
  })

  it('gc-card-bill runs with verify_jwt off, checks the switch, the link and the customer, and is card only', () => {
    expect(CONFIG).toMatch(/\[functions\.gc-card-bill\]\nverify_jwt = false/)
    expect(FUNCTION).toContain(".eq('key', GC_CARD_BILL_SETTING_KEY)")
    expect(FUNCTION).not.toContain("Deno.env.get('GC_CARD_BILL_ON')")
    expect(FUNCTION).toContain("gcCardBillStripeMode(Deno.env.get('GC_CARD_BILL_STRIPE_MODE'))")
    expect(FUNCTION).toContain('gcPortalOwns(')
    expect(FUNCTION).toContain("payment_settings: { payment_method_types: ['card'] }")
    expect(FUNCTION).toContain("admin.rpc('gc_card_bill_begin'")
    expect(FUNCTION).toContain("admin.rpc('gc_card_bill_finish'")
    // Undo goes through the caller's own rights, after Stripe's page is down.
    expect(FUNCTION).toContain("userClient.rpc('gc_card_bill_undo'")
    expect(FUNCTION.indexOf('stripe.invoices.voidInvoice(stripeInvoiceId)')).toBeLessThan(FUNCTION.indexOf("userClient.rpc('gc_card_bill_undo'"))
    // It sends no email: the customer is on the card page already.
    expect(FUNCTION).not.toMatch(/sendEmailViaResend|sendInvoice\(/)
  })

  it('customer-portal adds the offers behind the switch', () => {
    expect(PORTAL).toContain('gcPortalCardBills({')
    expect(PORTAL).toContain(".eq('key', GC_CARD_BILL_SETTING_KEY)")
    expect(PORTAL).not.toContain("Deno.env.get('GC_CARD_BILL_ON')")
    expect(PORTAL).toMatch(/\n\s+cardBills,\n\s+\}\)/)
  })

  it('create-stripe-invoice refuses a GC bill, read as the service role, before any Stripe call', () => {
    expect(GC_BILL_PORTAL_CARD_ONLY).toBe("A GC bill goes on card only from the customer's portal.")
    const guard = CREATE.indexOf('jsonResponse({ error: GC_BILL_PORTAL_CARD_ONLY }, 409)')
    expect(guard).toBeGreaterThan(0)
    expect(CREATE.slice(guard - 600, guard)).toContain("admin.from('gc_owner_pay_apps')")
    expect(CREATE.slice(guard - 600, guard)).toContain("admin.from('gc_owner_interest_bills')")
    expect(guard).toBeLessThan(CREATE.indexOf('stripe.invoices.create('))
  })
})
