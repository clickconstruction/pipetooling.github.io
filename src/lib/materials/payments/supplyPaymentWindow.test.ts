import { describe, expect, it } from 'vitest'
import {
  EMPTY_PAY_WINDOW,
  amountBoxText,
  dueByCount,
  fillOldestFirst,
  nextPayDay,
  orderBillsOldestFirst,
  parsePayAmount,
  payWindowSummaryWords,
  planSupplyPayment,
  setBillBox,
  setInterest,
  setUseAccount,
  tickBill,
  tickCredit,
  tickDueBy,
  typeAmount,
  type PayWindowBill,
  type PayWindowContext,
  type PayWindowState,
} from './supplyPaymentWindow'

// Cedar Fork Supply's open bills, as the drawing has them. Made-up numbers.
const bills: PayWindowBill[] = [
  { id: 'b1', number: '77120', title: '188 · Juniper Ridge Bldg C', dueYmd: '2026-10-15', open: 1240 },
  { id: 'b2', number: '77264', title: '201 · Maple Lofts', dueYmd: '2026-10-31', open: 812.4 },
  { id: 'b3', number: '77401', title: '201 · Maple Lofts', dueYmd: '2026-11-20', open: 2147.6 },
  { id: 'b4', number: '77415', title: '214 · Hollis Street Clinic', dueYmd: '2026-11-20', open: 612.6 },
  { id: 'b5', number: '77502', title: 'No job yet', dueYmd: '2026-11-30', open: 389.15 },
]
const ctx = (over: Partial<PayWindowContext> = {}): PayWindowContext => ({ bills, credits: [{ id: 'c1', number: 'CM-2291', open: 212.4 }], account: [], parts: true, ...over })
const plan = (state: PayWindowState, c: PayWindowContext = ctx(), chip: 'ach' | 'later' | null = 'ach') => planSupplyPayment(state, c, { chip, paidOn: '2026-11-16', dayWords: '11/16', house: 'Cedar Fork Supply' })
const bill = (id: string): PayWindowBill => bills.find((b) => b.id === id) as PayWindowBill

describe('the amount box', () => {
  it('reads dollars with commas and a dollar sign, and nothing else', () => {
    expect(parsePayAmount(' $5,000 ')).toBe(5000)
    expect(parsePayAmount('12.')).toBe(12)
    expect(parsePayAmount('.5')).toBe(0.5)
    expect(parsePayAmount('five')).toBeNaN()
    expect(parsePayAmount('-5')).toBeNaN()
    expect(parsePayAmount('')).toBeNaN()
  })
})

describe('ticking bills leads, and the amount follows', () => {
  it('adds the bills ticked into the amount sent and names the press', () => {
    let s = tickBill(EMPTY_PAY_WINDOW, bill('b1'), true)
    s = tickBill(s, bill('b2'), true)
    const p = plan(s)
    expect(p.sent).toBe(2052.4)
    expect(p.placed).toBe(2052.4)
    expect(p.left).toBe(0)
    expect(p.reason).toBe('')
    expect(p.pressLabel).toBe('Record $2,052.40 on 2 bills')
    expect(amountBoxText(s, p)).toBe('2052.40')
    expect(p.leftWords).toBe('Every dollar is placed.')
    expect(p.afterWords).toBe('Each bill paid in full will read paid on 11/16.')
    expect(p.notes.b1).toEqual({ words: 'Paid in full.', tone: 'plain' })
    expect(p.record).toEqual({ amount: 2052.4, lines: [{ invoice_id: 'b1', amount: 1240 }, { invoice_id: 'b2', amount: 812.4 }], fromAccount: [], keepOnAccount: false, interest: null })
  })

  it('unticks back to a dead press that says what to do', () => {
    const s = tickBill(tickBill(EMPTY_PAY_WINDOW, bill('b1'), true), bill('b1'), false)
    const p = plan(s)
    expect(p.reason).toBe('Tick a bill, or type the amount sent.')
    expect(p.pressLabel).toBe('Record payment')
    expect(p.record).toBeNull()
  })

  it('reads a lowered box as a part payment', () => {
    const s = setBillBox(tickBill(EMPTY_PAY_WINDOW, bill('b2'), true), 'b2', '300')
    const p = plan(s)
    expect(p.sent).toBe(300)
    expect(p.notes.b2).toEqual({ words: 'A part payment. $512.40 stays open on the bill.', tone: 'plain' })
    expect(p.record?.lines).toEqual([{ invoice_id: 'b2', amount: 300 }])
    expect(p.pressLabel).toBe('Record $300.00 on 1 bill')
  })

  it('refuses a box past what its bill has open, and a box that is not an amount', () => {
    const over = plan(setBillBox(EMPTY_PAY_WINDOW, 'b5', '400'))
    expect(over.reason).toBe('One box is more than its bill has open.')
    expect(over.notes.b5).toEqual({ words: '$10.85 more than this bill has open.', tone: 'bad' })
    const bad = plan(setBillBox(EMPTY_PAY_WINDOW, 'b5', 'abc'))
    expect(bad.reason).toBe('One box is not an amount.')
    expect(bad.record).toBeNull()
  })

  it('says details later on the press when the method waits', () => {
    const s = tickBill(EMPTY_PAY_WINDOW, bill('b4'), true)
    expect(plan(s, ctx(), 'later').pressLabel).toBe('Record $612.60 on 1 bill, details later')
    expect(plan(s, ctx(), null).pressLabel).toBe('Record $612.60 on 1 bill, details later')
  })
})

describe('typing the amount fills the oldest bills first', () => {
  it('spreads 5,000 over the bills in due order and leaves the last one part paid', () => {
    const s = typeAmount(EMPTY_PAY_WINDOW, '5000', ctx())
    expect(s.boxes).toEqual({ b1: '1240.00', b2: '812.40', b3: '2147.60', b4: '612.60', b5: '187.40' })
    const p = plan(s)
    expect(p.sent).toBe(5000)
    expect(p.left).toBe(0)
    expect(p.notes.b5?.words).toBe('A part payment. $201.75 stays open on the bill.')
    expect(p.pressLabel).toBe('Record $5,000.00 on 5 bills')
  })

  it('asks where money past every bill goes, and keeps it on account when told to', () => {
    const s = typeAmount(EMPTY_PAY_WINDOW, '6,000', ctx())
    const p = plan(s)
    expect(p.left).toBe(798.25)
    expect(p.leftWords).toBe('$798.25 is not on a bill yet.')
    expect(p.reason).toBe('Put $798.25 on a bill, or keep it on account.')
    const kept = plan({ ...s, keepOnAccount: true })
    expect(kept.reason).toBe('')
    expect(kept.afterWords).toBe('$798.25 will wait on account with Cedar Fork Supply.')
    expect(kept.record?.keepOnAccount).toBe(true)
    expect(kept.record?.amount).toBe(6000)
  })

  it('records a round sum with no bill as money on account', () => {
    const s: PayWindowState = { ...typeAmount(EMPTY_PAY_WINDOW, '250', ctx({ bills: [] })), keepOnAccount: true }
    const p = plan(s, ctx({ bills: [] }))
    expect(p.pressLabel).toBe('Record $250.00 on account')
    expect(p.record).toEqual({ amount: 250, lines: [], fromAccount: [], keepOnAccount: true, interest: null })
  })

  it('says so when more is placed than was sent', () => {
    const s = setBillBox(typeAmount(EMPTY_PAY_WINDOW, '1000', ctx()), 'b2', '100')
    const p = plan(s)
    expect(p.left).toBe(-100)
    expect(p.leftTone).toBe('bad')
    expect(p.reason).toBe('More is placed than was sent. Lower a box or raise the amount.')
  })

  it('goes back to following the bills when the box is emptied', () => {
    const s = typeAmount(typeAmount(EMPTY_PAY_WINDOW, '1240', ctx()), '', ctx())
    expect(s.amountTyped).toBe(false)
    expect(plan(s).sent).toBe(1240)
  })

  it('refuses a typed amount that is not one', () => {
    expect(plan(typeAmount(EMPTY_PAY_WINDOW, '12x', ctx())).reason).toBe('Type the amount sent in dollars and cents.')
  })
})

describe('a credit memo is a line to tick', () => {
  it('lowers the money needed by the credit and records it as a line below zero', () => {
    let s = tickBill(tickBill(EMPTY_PAY_WINDOW, bill('b1'), true), bill('b2'), true)
    s = tickCredit(s, 'c1', true, ctx())
    const p = plan(s)
    expect(p.sent).toBe(1840)
    expect(p.creditUsed).toBe(212.4)
    expect(p.placedWords).toBe('$2,052.40 placed of $1,840.00 sent, with a $212.40 credit')
    expect(p.pressLabel).toBe('Record $1,840.00 on 2 bills, with a $212.40 credit')
    expect(p.record?.lines).toEqual([{ invoice_id: 'b1', amount: 1240 }, { invoice_id: 'b2', amount: 812.4 }, { invoice_id: 'c1', amount: -212.4 }])
    const sum = p.record?.lines.reduce((t, l) => t + l.amount, 0) ?? 0
    expect(Math.round(sum * 100) / 100).toBe(p.record?.amount)
  })

  it('fills further when a credit is ticked under a typed amount', () => {
    const s = tickCredit(typeAmount(EMPTY_PAY_WINDOW, '1240', ctx()), 'c1', true, ctx())
    expect(s.boxes).toEqual({ b1: '1240.00', b2: '212.40' })
    expect(plan(s).left).toBe(0)
  })

  it('refuses a credit bigger than the bills ticked, and a credit with no bill', () => {
    const small: PayWindowBill = { id: 's1', number: '1', title: 'Small', dueYmd: null, open: 50 }
    const c = ctx({ bills: [small] })
    expect(plan(tickCredit(tickBill(EMPTY_PAY_WINDOW, small, true), 'c1', true, c), c).reason).toBe('The credit is more than the bills ticked. Tick another bill, or untick the credit.')
    expect(plan(tickCredit(EMPTY_PAY_WINDOW, 'c1', true, c), c).reason).toBe('Tick the bills this credit goes on.')
  })

  it('settles a bill a credit covers whole with no money sent', () => {
    const even: PayWindowBill = { id: 'e1', number: '2', title: 'Even', dueYmd: null, open: 212.4 }
    const c = ctx({ bills: [even] })
    const p = plan(tickCredit(tickBill(EMPTY_PAY_WINDOW, even, true), 'c1', true, c), c)
    expect(p.sent).toBe(0)
    expect(p.reason).toBe('')
    expect(p.pressLabel).toBe('Settle 1 bill with no money sent')
    expect(p.record).toEqual({ amount: 0, lines: [{ invoice_id: 'e1', amount: 212.4 }, { invoice_id: 'c1', amount: -212.4 }], fromAccount: [], keepOnAccount: false, interest: null })
  })
})

describe('the house added interest or a late fee', () => {
  it('adds the interest to the amount sent, and records it as a bill of its own tied to the late bill', () => {
    let s = tickBill(EMPTY_PAY_WINDOW, bill('b1'), true)
    s = setInterest(s, { on: true, amountText: '18.60', lateBillId: 'b1' }, ctx())
    const p = plan(s)
    expect(p.sent).toBe(1258.6)
    expect(p.placed).toBe(1258.6)
    expect(p.billCount).toBe(1)
    expect(p.pressLabel).toBe('Record $1,258.60 on 1 bill and interest')
    expect(p.record).toEqual({ amount: 1258.6, lines: [{ invoice_id: 'b1', amount: 1240 }], fromAccount: [], keepOnAccount: false, interest: { amount: 18.6, lateInvoiceId: 'b1' } })
  })

  it('records interest alone, with no bill ticked and no late bill named', () => {
    const p = plan(setInterest(EMPTY_PAY_WINDOW, { on: true, amountText: '5' }, ctx()))
    expect(p.sent).toBe(5)
    expect(p.reason).toBe('')
    expect(p.pressLabel).toBe('Record $5.00 on interest')
    expect(p.record?.interest).toEqual({ amount: 5, lateInvoiceId: null })
  })

  it('takes the interest out of a typed amount before the bills are filled', () => {
    const s = setInterest(typeAmount(EMPTY_PAY_WINDOW, '1258.60', ctx()), { on: true, amountText: '18.60' }, ctx())
    expect(s.boxes).toEqual({ b1: '1240.00' })
    expect(plan(s).left).toBe(0)
  })

  it('counts nothing while the line is switched off or empty, and refuses an amount that is not one', () => {
    const ticked = tickBill(EMPTY_PAY_WINDOW, bill('b4'), true)
    expect(plan(setInterest(ticked, { on: false, amountText: '18.60' }, ctx())).sent).toBe(612.6)
    expect(plan(setInterest(ticked, { on: true, amountText: '' }, ctx())).record?.interest).toBeNull()
    expect(plan(setInterest(ticked, { on: true, amountText: 'abc' }, ctx())).reason).toBe('Type the interest or late fee as an amount above zero.')
  })
})

describe('money on account is used first', () => {
  const withAccount = ctx({ account: [{ paymentId: 'p-old', amount: 100 }, { paymentId: 'p-new', amount: 87.4 }] })

  it('puts the oldest money on the oldest bill and sends the rest', () => {
    let s = tickBill(EMPTY_PAY_WINDOW, bill('b1'), true)
    s = setUseAccount(s, true, withAccount)
    const p = plan(s, withAccount)
    expect(p.accountUsed).toBe(187.4)
    expect(p.sent).toBe(1052.6)
    expect(p.placedWords).toBe('$1,240.00 placed of $1,052.60 sent, with $187.40 from the account')
    expect(p.record).toEqual({
      amount: 1052.6,
      lines: [{ invoice_id: 'b1', amount: 1052.6 }],
      fromAccount: [{ payment_id: 'p-old', invoice_id: 'b1', amount: 100 }, { payment_id: 'p-new', invoice_id: 'b1', amount: 87.4 }],
      keepOnAccount: false,
      interest: null,
    })
  })

  it('uses only what the bills need, and sends nothing when the account covers them', () => {
    const tiny: PayWindowBill = { id: 't1', number: '9', title: 'Tiny', dueYmd: null, open: 60 }
    const c = { ...withAccount, bills: [tiny] }
    const p = plan(setUseAccount(tickBill(EMPTY_PAY_WINDOW, tiny, true), true, c), c)
    expect(p.accountUsed).toBe(60)
    expect(p.sent).toBe(0)
    expect(p.record).toEqual({ amount: 0, lines: [], fromAccount: [{ payment_id: 'p-old', invoice_id: 't1', amount: 60 }], keepOnAccount: false, interest: null })
  })
})

describe('with part payments switched off', () => {
  const whole = ctx({ parts: false })

  it('takes whole bills oldest first and stops at the first that does not fit', () => {
    const s = typeAmount(EMPTY_PAY_WINDOW, '2100', whole)
    expect(s.boxes).toEqual({ b1: '1240.00', b2: '812.40' })
    const p = plan(s, whole)
    expect(p.left).toBe(47.6)
    expect(p.reason).toBe('$47.60 is not on a bill. Tick the bills this paid, so the amounts match.')
    expect(plan({ ...s, keepOnAccount: true }, whole).reason).not.toBe('')
  })

  it('refuses a box lowered by hand', () => {
    expect(plan(setBillBox(EMPTY_PAY_WINDOW, 'b1', '100'), whole).reason).toBe('A bill is paid whole here. Tick it, or leave it for the next payment.')
  })

  it('leaves the credits out of the summary line', () => {
    expect(payWindowSummaryWords(whole, 'pays on the 20th')).toBe('5 open bills · $5,201.75 · pays on the 20th')
    expect(payWindowSummaryWords(ctx(), '')).toBe('5 open bills · $5,201.75 · 1 open credit')
    expect(payWindowSummaryWords(ctx({ bills: [], credits: [] }), '')).toBe('no open bills')
  })
})

describe('the quick ticks', () => {
  it('ticks everything due by the pay day', () => {
    const s = tickDueBy(typeAmount(EMPTY_PAY_WINDOW, '10', ctx()), ctx(), '2026-11-20')
    expect(Object.keys(s.boxes)).toEqual(['b1', 'b2', 'b3', 'b4'])
    expect(s.amountTyped).toBe(false)
    expect(plan(s).sent).toBe(4812.6)
    expect(dueByCount(ctx(), '2026-11-20')).toBe(4)
  })

  it('fills every bill when no amount is typed, and spreads a typed amount again', () => {
    expect(plan(fillOldestFirst(EMPTY_PAY_WINDOW, ctx())).sent).toBe(5201.75)
    const typed = fillOldestFirst({ ...EMPTY_PAY_WINDOW, amountText: '1300', amountTyped: true }, ctx())
    expect(typed.boxes).toEqual({ b1: '1240.00', b2: '60.00' })
  })

  it('needs the day it was sent', () => {
    const p = planSupplyPayment(tickBill(EMPTY_PAY_WINDOW, bill('b1'), true), ctx(), { chip: 'ach', paidOn: '' })
    expect(p.reason).toBe('Pick the day it was sent.')
  })
})

describe('the order and the pay day', () => {
  it('orders oldest due first, no due day last', () => {
    const mixed = [
      { number: '3', dueYmd: null },
      { number: '10', dueYmd: '2026-11-20' },
      { number: '9', dueYmd: '2026-11-20' },
      { number: '1', dueYmd: '2026-10-01' },
    ]
    expect(orderBillsOldestFirst(mixed).map((b) => b.number)).toEqual(['1', '9', '10', '3'])
  })

  it('finds the next pay day, today counted, and clamps to the month', () => {
    expect(nextPayDay(15, '2026-11-12')).toBe('2026-11-15')
    expect(nextPayDay(15, '2026-11-15')).toBe('2026-11-15')
    expect(nextPayDay(15, '2026-11-16')).toBe('2026-12-15')
    expect(nextPayDay(31, '2026-11-16')).toBe('2026-11-30')
    expect(nextPayDay(20, '2026-12-25')).toBe('2027-01-20')
    expect(nextPayDay(30, '2027-02-01')).toBe('2027-02-28')
    expect(nextPayDay(null, '2026-11-16')).toBeNull()
    expect(nextPayDay(0, '2026-11-16')).toBeNull()
  })
})
