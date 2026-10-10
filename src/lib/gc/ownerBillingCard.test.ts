/**
 * GC mode, Owner Billing's O8c: a bill on card read the office's way. The mapper reads a card bill at its base, so the
 * fee never reaches a GC figure, and a card payment is laid on the pay application only up to what was certified.
 * The window's card line says where the bill stands. A reminder on card says where to pay. Our email's portal line
 * offers the card, with its fee, when the switch is on.
 */
import { describe, expect, it } from 'vitest'
import { billCard, billMoney, payAppFromRows, type OwnerBillingMoney, type OwnerPayAppRow } from './ownerBillingRows'
import { appOpen, appPaid } from './ownerBilling'
import { cardLineWords } from './ownerBillingCard'
import { payReminderMail } from './ownerBillingRemind'
import { buildGcCustomerEmail, GC_CUSTOMER_EMAIL_CARD_PORTAL_WORDS, GC_CUSTOMER_EMAIL_PORTAL_WORDS } from '../../../supabase/functions/_shared/gcCustomerEmails'
import type { OwnerPayAppSent } from './types'

const app = (over: Partial<OwnerPayAppRow> = {}): OwnerPayAppRow => ({
  id: 'a1',
  project_id: 'p1',
  number: 3,
  final: false,
  period_to: '2026-09-25',
  sent_on: '2026-09-25',
  sent_by: null,
  retainage_pct: 10,
  retainage_step_at_pct: null,
  retainage_step_to_pct: null,
  retainage_step_way: null,
  retainage: 100,
  work_to_date: 1000,
  due: 900,
  certified: 900,
  certified_on: '2026-09-30',
  certified_note: '',
  certified_by: null,
  invoice_id: 'inv-1',
  conditional_waiver_id: null,
  created_at: '2026-09-25T15:00:00Z',
  ...over,
})

/** Bill 1 turned to card: 900 certified, 27 fee, 927 on the row (O8b's finish). */
const onCard = (over: Partial<OwnerBillingMoney> = {}): OwnerBillingMoney => ({
  bills: [{ id: 'inv-1', amount: 927, status: 'billed', payUrl: 'https://invoice.stripe.com/i/test1' }],
  payments: [],
  promises: [],
  cards: [{ invoice_id: 'inv-1', status: 'on_card', base: 900, fee: 27, chosen_on: '2026-10-02', undone_on: null }],
  ...over,
})

describe('a bill on card reads at its base (O8c)', () => {
  it('open, it asks the certified amount, never the fee', () => {
    const sent = payAppFromRows(app(), [], [], onCard())
    expect(appOpen(sent)).toBe(900)
    expect(sent.card).toEqual({ invoiceId: 'inv-1', state: 'onCard', base: 900, fee: 27, total: 927, chosenOn: '2026-10-02', payUrl: 'https://invoice.stripe.com/i/test1', undoneOn: null })
  })

  it('paid by card, the payment carries the fee: only the base is laid on the pay application', () => {
    const m = onCard({ bills: [{ id: 'inv-1', amount: 927, status: 'paid', payUrl: 'https://invoice.stripe.com/i/test1' }], payments: [{ invoice_id: 'inv-1', amount: 927, paid_on: '2026-10-05' }] })
    expect(billMoney(m, 'inv-1')).toEqual({ payments: [{ on: '2026-10-05', amount: 900 }], paidOn: '2026-10-05' })
    const sent = payAppFromRows(app(), [], [], m)
    expect(appPaid(sent)).toBe(900)
    expect(sent.paidOn).toBe('2026-10-05')
  })

  it('a bill never on card reads as before, its payments as they came', () => {
    const m: OwnerBillingMoney = { bills: [{ id: 'inv-1', amount: 900, status: 'billed' }], payments: [{ invoice_id: 'inv-1', amount: 400, paid_on: '2026-10-05' }], promises: [] }
    expect(billMoney(m, 'inv-1')).toEqual({ payments: [{ on: '2026-10-05', amount: 400 }], paidOn: null })
    expect(payAppFromRows(app(), [], [], m).card).toBeUndefined()
  })

  it('taken back to a check bill, the row is back at its base and the card says so, with no card page', () => {
    const m = onCard({
      bills: [{ id: 'inv-1', amount: 900, status: 'billed', payUrl: null }],
      cards: [{ invoice_id: 'inv-1', status: 'undone', base: 900, fee: 27, chosen_on: '2026-10-02', undone_on: '2026-10-03' }],
    })
    expect(billCard(m, 'inv-1')).toMatchObject({ state: 'undone', payUrl: null, undoneOn: '2026-10-03' })
    expect(appOpen(payAppFromRows(app(), [], [], m))).toBe(900)
  })

  it('a pending turn is not on card yet', () => {
    const m = onCard({ bills: [{ id: 'inv-1', amount: 900, status: 'billed' }], cards: [{ invoice_id: 'inv-1', status: 'pending', base: 900, fee: 27, chosen_on: '2026-10-02', undone_on: null }] })
    expect(billCard(m, 'inv-1')).toBeNull()
    expect(appOpen(payAppFromRows(app(), [], [], m))).toBe(900)
  })
})

describe('the window’s card line', () => {
  const sentWith = (money: OwnerBillingMoney | undefined): OwnerPayAppSent => payAppFromRows(app(), [], [], money)

  it('on card: the day they chose it, what Stripe asks and the fee', () => {
    expect(cardLineWords(sentWith(onCard()), false)).toBe('They chose card in their portal on Oct 2. Stripe asks $927.00 with the $27.00 card fee.')
  })

  it('paid by card', () => {
    const m = onCard({ bills: [{ id: 'inv-1', amount: 927, status: 'paid' }], payments: [{ invoice_id: 'inv-1', amount: 927, paid_on: '2026-10-05' }] })
    expect(cardLineWords(sentWith(m), false)).toBe('Paid by card on Oct 5, with the $27.00 card fee.')
  })

  it('taken back', () => {
    const m = onCard({ cards: [{ invoice_id: 'inv-1', status: 'undone', base: 900, fee: 27, chosen_on: '2026-10-02', undone_on: '2026-10-03' }] })
    expect(cardLineWords(sentWith(m), false)).toBe('Back to a check bill on Oct 3.')
  })

  it('not on card: says they can choose it only with the switch on, a certificate and nothing paid', () => {
    const plain: OwnerBillingMoney = { bills: [{ id: 'inv-1', amount: 900, status: 'billed' }], payments: [], promises: [] }
    expect(cardLineWords(sentWith(plain), true)).toBe('Not on card. They can choose card in their portal.')
    expect(cardLineWords(sentWith(plain), false)).toBeNull()
    expect(cardLineWords(payAppFromRows(app({ certified: null, certified_on: null, invoice_id: null }), [], [], plain), true)).toBeNull()
    expect(cardLineWords(sentWith({ ...plain, payments: [{ invoice_id: 'inv-1', amount: 100, paid_on: '2026-10-04' }] }), true)).toBeNull()
  })
})

describe('the reminder on a bill on card', () => {
  const facts = { greeting: 'Elena', job: 'Oak Ridge Clinic', bill: 'pay application 3', open: 288_879, dueOn: '2026-10-16', promised: false, lastPaid: null, interest: null, by: '2026-10-21', note: '' }

  it('says what the card page asks and where to pay, and asks for no day', () => {
    const { lines } = payReminderMail({ ...facts, card: { total: 297_545.37, payUrl: 'https://clicktooling.com/pay/inv-1' } })
    expect(lines).toContain('You chose to pay it by card. With the 3% card fee, the card page asks $297,545.37.')
    expect(lines).toContain('Pay it here: https://clicktooling.com/pay/inv-1')
    expect(lines).not.toContain('Reply with the day you will pay.')
    expect(lines[lines.length - 1]).toBe('Our unconditional lien waiver for it follows once it is paid.')
  })

  it('a bill not on card reads as before', () => {
    const { lines } = payReminderMail(facts)
    expect(lines).toContain('Reply with the day you will pay.')
    expect(lines.some((l) => /card/.test(l))).toBe(false)
  })
})

describe('our email’s portal line offers the card (gc-customer-email’s frame)', () => {
  const base = { subject: 'S', lines: ['Hello Elena,', 'Reply with the day you will pay.'], signer: 'Robert', gc: 'Click Construction', portalUrl: 'https://clicktooling.com/p/abc' }

  it('with a fee and a portal link: the card words and the fee line', () => {
    const email = buildGcCustomerEmail({ ...base, cardFee: 8_666.37 })
    expect(email.text).toContain(`${GC_CUSTOMER_EMAIL_CARD_PORTAL_WORDS} https://clicktooling.com/p/abc`)
    expect(email.text).toContain('Paying by card adds a 3% card fee of $8,666.37.')
    expect(email.text).not.toContain(GC_CUSTOMER_EMAIL_PORTAL_WORDS)
    expect(email.html).toContain('Paying by card adds a 3% card fee of $8,666.37.')
  })

  it('no fee, or no portal link: as before, and never a card line without the portal', () => {
    expect(buildGcCustomerEmail(base).text).toContain(`${GC_CUSTOMER_EMAIL_PORTAL_WORDS} https://clicktooling.com/p/abc`)
    const noPortal = buildGcCustomerEmail({ ...base, portalUrl: null, cardFee: 8_666.37 })
    expect(noPortal.text).not.toMatch(/card/)
  })
})
