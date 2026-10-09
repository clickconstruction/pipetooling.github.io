import { describe, expect, it } from 'vitest'
import {
  aiaApplicationLabel,
  aiaApplicationsToTie,
  aiaBillOptions,
  aiaPaidLine,
  canTiePayApplication,
  suggestAiaApplication,
  suggestAiaBill,
  type AiaBillsOnJob,
  type AiaJobBill,
} from './aiaPayApplicationBill'
import type { SavedPayApplication } from './aiaPayApplications'

const bill = (o: Partial<AiaJobBill> & Pick<AiaJobBill, 'id'>): AiaJobBill => ({ amount: 13588.2, status: 'billed', sequence_order: 1, billed_at: '2026-08-02T15:00:00Z', sent_to_customer_at: null, ...o })
const app = (o: Partial<SavedPayApplication> & Pick<SavedPayApplication, 'id'>): SavedPayApplication =>
  ({ jobId: 'j1', applicationNumber: 3, periodTo: '2026-07-31', applicationDate: '2026-08-01', currentPaymentDue: 13588.2, deletedAt: null, invoiceId: null, ...o }) as SavedPayApplication

describe('canTiePayApplication: the roles the table lets write', () => {
  it('the office set, not primary or an estimator', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller'].every(canTiePayApplication)).toBe(true)
    expect(canTiePayApplication('primary')).toBe(false)
    expect(canTiePayApplication('estimator')).toBe(false)
    expect(canTiePayApplication(null)).toBe(false)
  })
})

describe('aiaBillOptions', () => {
  const onJob: AiaBillsOnJob = { bills: [bill({ id: 'b2', sequence_order: 2, amount: 9000, billed_at: null }), bill({ id: 'b1' })], payments: [], hcp: '1023' }
  it('every bill on the job, oldest first, labelled by number, amount and the day it went', () => {
    expect(aiaBillOptions(onJob, [], 'a3').map((o) => o.label)).toEqual(['#1 · $13,588.20 · sent Aug 2', '#2 · $9,000.00 · not sent yet'])
  })
  it('leaves out a bill another live application holds, but keeps the one this application holds', () => {
    const apps = [app({ id: 'a2', invoiceId: 'b1' }), app({ id: 'a3', invoiceId: 'b2' }), app({ id: 'a1', invoiceId: 'b2', deletedAt: '2026-08-05T00:00:00Z' })]
    expect(aiaBillOptions(onJob, apps, 'a3').map((o) => o.id)).toEqual(['b2'])
    expect(aiaBillOptions(onJob, apps, 'a2').map((o) => o.id)).toEqual(['b1'])
  })
})

describe('suggestAiaBill: the match only pre-fills the pick', () => {
  const opts = (bills: AiaJobBill[]) => aiaBillOptions({ bills, payments: [] }, [], 'a3')
  it('the bill whose amount is the payment due, to the cent', () => {
    expect(suggestAiaBill(app({ id: 'a3' }), opts([bill({ id: 'b1', amount: 9000 }), bill({ id: 'b2', sequence_order: 2 })]))).toBe('b2')
    expect(suggestAiaBill(app({ id: 'a3', currentPaymentDue: 13588.21 }), opts([bill({ id: 'b1' })]))).toBeNull()
  })
  it('several at that amount: the one sent nearest the application date, else its period', () => {
    const two = opts([bill({ id: 'b1', billed_at: '2026-06-02T15:00:00Z' }), bill({ id: 'b2', sequence_order: 2, billed_at: '2026-08-03T15:00:00Z' })])
    expect(suggestAiaBill(app({ id: 'a3' }), two)).toBe('b2')
    expect(suggestAiaBill(app({ id: 'a3', applicationDate: null, periodTo: '2026-06-01' }), two)).toBe('b1')
  })
  it('none when two are as near, or no day can be compared', () => {
    const tie = opts([bill({ id: 'b1', billed_at: '2026-07-30T15:00:00Z' }), bill({ id: 'b2', sequence_order: 2, billed_at: '2026-08-03T15:00:00Z' })])
    expect(suggestAiaBill(app({ id: 'a3' }), tie)).toBeNull()
    expect(suggestAiaBill(app({ id: 'a3', applicationDate: null, periodTo: null }), opts([bill({ id: 'b1' }), bill({ id: 'b2', sequence_order: 2 })]))).toBeNull()
  })
})

describe('suggestAiaApplication: Bill Customer pre-picks the application', () => {
  it('a live, untied application whose payment due is the bill, nearest today when several', () => {
    const apps = [app({ id: 'a1', applicationNumber: 1, applicationDate: '2026-06-01' }), app({ id: 'a2', applicationNumber: 2, applicationDate: '2026-09-01' }), app({ id: 'a3', currentPaymentDue: 500 })]
    expect(suggestAiaApplication(apps, 13588.2, '2026-09-04')).toBe('a2')
    expect(suggestAiaApplication(apps, 500, '2026-09-04')).toBe('a3')
    expect(suggestAiaApplication(apps, 777, '2026-09-04')).toBeNull()
  })
  it('never a tied or a deleted application', () => {
    expect(suggestAiaApplication([app({ id: 'a1', invoiceId: 'b1' }), app({ id: 'a2', deletedAt: '2026-08-05T00:00:00Z' })], 13588.2, '2026-08-04')).toBeNull()
  })
  it('lists the untied live applications newest first, each as Bill Customer reads it', () => {
    const apps = [app({ id: 'a1', applicationNumber: 1 }), app({ id: 'a2', applicationNumber: 2, invoiceId: 'b1' }), app({ id: 'a4', applicationNumber: 4 })]
    expect(aiaApplicationsToTie(apps).map((a) => a.id)).toEqual(['a4', 'a1'])
    expect(aiaApplicationLabel(app({ id: 'a3', periodTo: '2026-08-31' }))).toBe('No. 3 · $13,588.20 due · period to Aug 31')
    expect(aiaApplicationLabel(app({ id: 'a3', periodTo: null }))).toBe('No. 3 · $13,588.20 due')
  })
})

describe('aiaPaidLine: the bill read the way the job window reads it', () => {
  const pay = (amount: number, paid_on: string, invoice_id: string | null = 'b1', sequence_order = 1) => ({ invoice_id, amount, paid_on, sequence_order })
  it('untied, and a tie whose bill is no longer on the job', () => {
    expect(aiaPaidLine(app({ id: 'a3' }), { bills: [], payments: [] })).toEqual({ kind: 'untied', words: 'Bill not yet tied' })
    expect(aiaPaidLine(app({ id: 'a3', invoiceId: 'gone' }), { bills: [bill({ id: 'b1' })], payments: [] }).words).toBe('The tied bill is not on this job')
  })
  it('paid in full, with the newest payment’s day', () => {
    const line = aiaPaidLine(app({ id: 'a3', invoiceId: 'b1' }), { bills: [bill({ id: 'b1' })], payments: [pay(10000, '2026-08-15'), pay(3588.2, '2026-08-22', 'b1', 2)] })
    expect(line).toEqual({ kind: 'paid', words: 'Paid $13,588.20 · Aug 22' })
  })
  it('money paid with no bill picked counts oldest bill first, as on the job window', () => {
    const line = aiaPaidLine(app({ id: 'a3', invoiceId: 'b1' }), { bills: [bill({ id: 'b1' })], payments: [pay(13588.2, '2026-08-22', null)] })
    expect(line.words).toBe('Paid $13,588.20 · Aug 22')
  })
  it('part paid, nothing paid, marked paid with no payment, and a draft', () => {
    expect(aiaPaidLine(app({ id: 'a3', invoiceId: 'b1' }), { bills: [bill({ id: 'b1' })], payments: [pay(5000, '2026-08-10')] }).words).toBe('Paid $5,000.00 of $13,588.20 · Aug 10')
    expect(aiaPaidLine(app({ id: 'a3', invoiceId: 'b1' }), { bills: [bill({ id: 'b1' })], payments: [] }).words).toBe('Billed $13,588.20 · nothing paid yet')
    expect(aiaPaidLine(app({ id: 'a3', invoiceId: 'b1' }), { bills: [bill({ id: 'b1', status: 'paid' })], payments: [] }).words).toBe('$13,588.20 marked paid · no payment on record')
    expect(aiaPaidLine(app({ id: 'a3', invoiceId: 'b1' }), { bills: [bill({ id: 'b1', status: 'ready_to_bill', billed_at: null })], payments: [] }).words).toBe('Bill $13,588.20 not sent yet')
  })
})
