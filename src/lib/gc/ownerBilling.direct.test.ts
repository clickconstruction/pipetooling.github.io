/**
 * Main's own tests for the Owner Billing kernels O2a moved that the moved tests do not call. Each runs a
 * kernel directly on the test data, the prototype's made-up jobs on Fri Oct 2, and pins the prototype's
 * own answer: every expected value below came from the same call on branch spike/gc-mode. On the spike
 * these ran inside the reducer's tests, which stay there.
 */
import { describe, expect, it } from 'vitest'
import { proposalTotals } from './bids'
import {
  appCertified,
  appClaimed,
  appOpen,
  appPaid,
  CHANGE_ORDER_REASON_WORDS,
  changeOrderPrice,
  changeOrderScheduleWords,
  changeOrderWho,
  daysWords,
  isChangeOrderLineId,
  markupOnTop,
  OUR_COST_LINE_IDS,
  ourOwnerWaivers,
  ownerCarriedForward,
  ownerContractPrice,
  ownerContractWorthNow,
  ownerContractWorthOf,
  ownerExpectPaidOn,
  ownerLateBills,
  ownerPayAppHasWork,
  ownerPayAppsSent,
  ownerPayAppToSend,
  ownerPayDue,
  ownerReleasedRetainage,
  spreadMarkup,
  type OwnerPayApp,
} from './ownerBilling'
import { OWNER_INTEREST_DEFAULT_PCT, ownerInterestFrom, ownerInterestOnBill } from './ownerBillingInterest'
import { customerGreeting, latePayApps, PAY_REMINDER_DAYS, payReminderEmail, payReminderSentWords, payReminderStep } from './ownerBillingRemind'
import { initialGcState } from './schedule/testState'
import type { ChangeOrder, GcState } from './types'
import { money } from './words'

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!
const cents = (n: number) => Math.round(n * 100) / 100
/** A change order to ask about, owned by no trade until a case says so. */
const co: ChangeOrder = { id: 'co-9', number: 9, description: 'A test change', reason: 'owner', schedule: 'none', packageId: null, status: 'signed', sentOn: '2026-09-28', answeredOn: '2026-10-01' }
/** A draft pay application, written out: two trades and the fee, half of one trade new this month. */
const draft: OwnerPayApp = {
  number: 4,
  billOn: '2026-10-25',
  expectPaidOn: '2026-12-02',
  lines: [
    { id: 'a', label: 'Sitework', kind: 'trade', worth: 1000, doneToDate: 600, doneBefore: 400, thisMonth: 200, source: '', detail: [] },
    { id: 'b', label: 'Concrete', kind: 'trade', worth: 2000, doneToDate: 500, doneBefore: 500, thisMonth: 0, source: '', detail: [], stored: 150 },
    { id: 'fee', label: 'Fee 10%', kind: 'fee', worth: 300, doneToDate: 110, doneBefore: 90, thisMonth: 20, source: '', detail: [] },
  ],
  contract: 3300,
  originalContract: 3300,
  changeOrdersTotal: 0,
  doneToDate: 1210,
  stored: 150,
  storedBefore: 0,
  tradeShare: 0.3667,
  retainagePct: 10,
  retainage: 136,
  retainageBefore: 99,
  askedBefore: 891,
  due: 333,
  leftToBill: 2076,
  started: true,
}

describe('Billing the customer on the made-up jobs, Fri Oct 2', () => {
  it('carries every trade at its number, then our costs and fee on top', () => {
    const s = initialGcState()
    const t = proposalTotals(job(s, 'boerne'))
    expect({ trades: cents(t.trades), holes: t.holes.map((p) => p.id), plugged: t.plugged.map((p) => p.id), generalConditions: cents(t.generalConditions), contingency: cents(t.contingency), fee: cents(t.fee), price: cents(t.price) }).toEqual({
      trades: 603400,
      holes: ['steel', 'hvac', 'elec', 'fire'],
      plugged: [],
      generalConditions: 138000,
      contingency: 22242,
      fee: 61091.36,
      price: 824733.36,
    })
  })

  it('prices the customer by line as we carry it until they sign', () => {
    const s = initialGcState()
    expect(Object.fromEntries(Object.entries(ownerContractWorthNow(job(s, 'boerne'))).map(([k, v]) => [k, cents(v)]))).toEqual({
      site: 184900,
      conc: 219800,
      steel: 0,
      roof: 112300,
      plumb: 86400,
      hvac: 0,
      elec: 0,
      fire: 0,
      gc: 138000,
      contingency: 22242,
      fee: 61091.36,
    })
  })

  it('keeps the price as the customer signed it once it is kept', () => {
    const s = initialGcState()
    expect([ownerContractWorthOf(job(s, 'helotes')) === job(s, 'helotes').ownerContractWorth, cents(ownerContractPrice(job(s, 'helotes'))), cents(ownerContractPrice(job(s, 'fairoaksd')))]).toEqual([true, 338767, 1488762])
  })

  it('reads what each bill counts for, what was paid and what is open', () => {
    const s = initialGcState()
    expect(ownerPayAppsSent(job(s, 'fairoaksd')).map((a) => [a.number, appCertified(a), cents(appClaimed(a)), cents(appPaid(a)), cents(appOpen(a))])).toEqual([
      [1, 183931.78, 183931.78, 183931.78, 0],
      [2, 387884.83, 387884.83, 387884.83, 0],
      [3, 288878.51, 288878.51, 0, 288878.51],
    ])
  })

  it('finds the third bill two days past the day Cibolo gave', () => {
    const s = initialGcState()
    const p = job(s, 'fairoaksd')
    const app = ownerPayAppsSent(p)[2]!
    expect([ownerPayDue(s, p, app), ownerLateBills(s, p).map((b) => [b.app.number, b.due.daysLate, cents(b.open)])]).toEqual([{ on: '2026-09-30', promised: true, daysLate: 2, missed: 0 }, [[3, 2, 288878.51]]])
  })

  it('expects the money the customer\'s usual days after the bill', () => {
    const s = initialGcState()
    expect([ownerExpectPaidOn(s, job(s, 'fairoaksd'), ownerPayAppsSent(job(s, 'fairoaksd'))[2]!), ownerExpectPaidOn(s, job(s, 'stoneoak'), ownerPayAppsSent(job(s, 'stoneoak'))[0]!)]).toEqual(['2026-11-02', '2026-08-12'])
  })

  it('gives a conditional waiver with each bill and an unconditional one when it is paid', () => {
    const s = initialGcState()
    expect(ourOwnerWaivers(job(s, 'fairoaksd')).map((w) => [w.payApp, w.kind, w.final, cents(w.amount), w.signedOn])).toEqual([
      [3, 'conditional', false, 288878.51, '2026-09-25'],
      [2, 'unconditional', false, 387884.83, '2026-10-01'],
      [2, 'conditional', false, 387884.83, '2026-08-25'],
      [1, 'unconditional', false, 183931.78, '2026-09-01'],
      [1, 'conditional', false, 183931.78, '2026-07-25'],
    ])
  })

  it('holds the trades\' retainage until the customer pays ours', () => {
    const s = initialGcState()
    expect([ownerReleasedRetainage(job(s, 'fairoaksd')), ownerReleasedRetainage(job(s, 'stoneoak'))]).toEqual([false, false])
  })

  it('spreads our costs and fee into the trades so every total stays the same', () => {
    const lines = [{ id: 'a', worth: 100, doneBefore: 0, thisMonth: 50, doneToDate: 50 }, { id: 'b', worth: 300, doneBefore: 100, thisMonth: 50, doneToDate: 150 }, { id: 'gc', worth: 40, doneBefore: 10, thisMonth: 10, doneToDate: 20 }, { id: 'fee', worth: 20, doneBefore: 5, thisMonth: 5, doneToDate: 10 }, { id: 'co-1', worth: 30, doneBefore: 0, thisMonth: 15, doneToDate: 15 }]
    expect([spreadMarkup(lines).map((l) => [l.id, cents(l.worth), cents(l.doneBefore), cents(l.doneToDate), cents(l.thisMonth), cents(l.tradeWorth), cents(l.ourShare)]), markupOnTop(lines), OUR_COST_LINE_IDS]).toEqual([
      [
        ['a', 115, 0, 57.5, 57.5, 100, 15],
        ['b', 345, 115, 172.5, 57.5, 300, 45],
        ['co-1', 30, 0, 15, 15, 30, 0],
      ],
      0.15,
      ['gc', 'contingency', 'fee'],
    ])
  })

  it('says a change order\'s reason, its days and its starting price', () => {
    const s = initialGcState()
    expect([CHANGE_ORDER_REASON_WORDS, daysWords(1), daysWords(5), changeOrderScheduleWords({ ...co, days: 5 }), changeOrderScheduleWords({ ...co, days: 0, schedule: 'none' }), changeOrderScheduleWords({ ...co, days: 0, schedule: '+2 working days' }), changeOrderPrice(job(s, 'fairoaksd'), 10000), isChangeOrderLineId('co-1'), isChangeOrderLineId('gc')]).toEqual([
      { owner: 'Customer directive', field: 'Field condition', plans: 'Plan revision' },
      '1 day',
      '5 days',
      'adds 5 days to the job',
      'no days added',
      'schedule: +2 working days',
      11000,
      true,
      false,
    ])
  })

  it('names whose work a change order is', () => {
    const s = initialGcState()
    expect([...job(s, 'fairoaksd').packages.map((p) => changeOrderWho(s, job(s, 'fairoaksd'), { ...co, packageId: p.id })), changeOrderWho(s, job(s, 'fairoaksd'), { ...co, packageId: null })]).toEqual([
      'Tri-County Site on Sitework',
      'Guadalupe Flatwork on Concrete',
      'Iron Horse Fabrication on Structural steel',
      'Pecan Valley Electric on Electrical',
      'Summit Roofing on Roofing',
      'our own crew on Plumbing',
      'Cool Breeze Mechanical on HVAC',
      'our own work',
    ])
  })

  it('keeps a draft as it goes, and says what the architect left out before', () => {
    expect([ownerPayAppToSend(draft, '2026-10-25'), ownerPayAppHasWork(draft), ownerPayAppHasWork({ ...draft, due: 0.4 }), cents(ownerCarriedForward(draft)), cents(ownerCarriedForward({ ...draft, due: draft.due + 1200 }))]).toEqual([
      {
        number: 4,
        periodTo: '2026-10-25',
        sentOn: '2026-10-25',
        doneToDate: { a: 600, b: 500, fee: 110 },
        worthByLine: { a: 1000, b: 2000, fee: 300 },
        workToDate: 1360,
        storedByLine: { b: 150 },
        retainagePct: 10,
        retainage: 136,
        due: 333,
        paidOn: null,
        certified: null,
        certifiedOn: null,
      },
      true,
      false,
      0,
      1200,
    ])
  })

  it('runs interest on the late bill from the day after it was due', () => {
    const s = initialGcState()
    const p = { ...job(s, 'fairoaksd'), ownerLateInterest: { pctPerMonth: 1.5 } }
    const app = ownerPayAppsSent(p)[2]!
    const bill = ownerInterestOnBill(s, p, app, 1.5)
    expect([ownerInterestFrom(s, p, app), bill && [bill.from, bill.days, cents(bill.amount)], OWNER_INTEREST_DEFAULT_PCT]).toEqual(['2026-09-30', ['2026-09-30', 2, 284.92], 1.5])
  })

  it('offers a reminder on the late bill only', () => {
    const s = initialGcState()
    expect([payReminderStep(s, job(s, 'fairoaksd'), 3), payReminderStep(s, job(s, 'fairoaksd'), 2), PAY_REMINDER_DAYS]).toEqual([
      {
        docKey: 'payapp-fairoaksd-3',
        projectId: 'fairoaksd',
        number: 3,
        title: 'Remind them to pay pay application 3',
        history: 'Due Sep 30, 2 days late. This is the first reminder.',
        sendLabel: 'Send the reminder',
        dayWord: 'Pay by',
        dayNote: 'This is our ask, not their promise. The day the bill was due stays.',
        by: '2026-10-07',
      },
      null,
      5,
    ])
  })

  it('greets a contact by first name, a titled one by title and last name', () => {
    const s = initialGcState()
    expect([customerGreeting(s.customers.find((c) => c.id === 'raman'), 'x'), customerGreeting(s.customers.find((c) => c.id === 'cibolo'), 'x'), customerGreeting(undefined, 'Cibolo Creek Partners')]).toEqual(['Dr. Raman', 'Elena', 'Cibolo'])
  })

  it('writes the reminder the customer reads', () => {
    const s = initialGcState()
    expect(payReminderEmail(s, s.customers.find((c) => c.id === 'cibolo'), job(s, 'fairoaksd'), 3, '2026-10-07', 'Thank you for your help.')).toEqual({
      subject: 'Reminder: pay application 3 for Fair Oaks Shops, Building D, $288,879',
      lines: [
               'Hello Elena,',
               'Pay application 3 for Fair Oaks Shops, Building D has $288,879 still open. It was due Wed Sep 30, the day you gave.',
               'Please pay it by Wed Oct 7.',
               'Thank you for your help.',
               'Pay it in your portal, by card or bank transfer.',
               'Our unconditional lien waiver for it comes to you the day it is paid.',
             ],
    })
  })

  it('lists the bills that can be reminded, and the line once one went', () => {
    const s = initialGcState()
    const p = job(s, 'fairoaksd')
    const reminded = { ...p, ownerBilling: { ...p.ownerBilling!, payApps: p.ownerBilling!.payApps!.map((a) => (a.number === 3 ? { ...a, reminders: [{ on: '2026-10-02', by: '2026-10-07', note: '' }] } : a)) } }
    expect([latePayApps(s, p).map((l) => ({ ...l, open: cents(l.open) })), payReminderSentWords(s, p, 3), payReminderSentWords(s, reminded, 3)]).toEqual([
      [{ number: 3, due: '2026-09-30', daysLate: 2, open: 288878.51 }],
      null,
      'Reminded today · pay by Wed Oct 7.',
    ])
  })

  it('writes money in whole dollars', () => {
    expect([money(1234.5), money(0), money(288878.51)]).toEqual(['$1,235', '$0', '$288,879'])
  })
})
