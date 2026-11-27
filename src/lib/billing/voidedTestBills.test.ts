/**
 * Voided test bills (punch list #443, row 7): who reads the folded line under Bill Customer, and how a record's row
 * and its sends read as lines. Made-up names.
 */
import { describe, expect, it } from 'vitest'
import {
  VOIDED_TEST_BILLS_COLS,
  VOIDED_TEST_BILLS_NOTE,
  VOIDED_TEST_BILL_NO_ADDRESS,
  VOIDED_TEST_BILL_NO_NAME,
  VOIDED_TEST_BILL_NO_SENDS,
  parseVoidedTestBill,
  voidedTestBillSendLines,
  voidedTestBillStripeWords,
  voidedTestBillWhen,
  voidedTestBillsDrawn,
  voidedTestBillsHeading,
} from './voidedTestBills'
import { voidedTestBillSends } from '../../../supabase/functions/_shared/voidedTestBill'
import { plainWordsFailures } from '../plainWords'

const ZZ = { job_name: 'ZZ Test walk job', customer_name: 'ZZ Test Customer' }
const REAL = { job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' }

const email = (over: Record<string, unknown> = {}) => ({ source: 'stripe_email', id: 'e1', sent_at: '2026-11-24T15:00:05Z', stripe_invoice_id: 'in_test_zz1', copy_emails: ['zz.copy@example.test'], ...over })
const copy = (over: Record<string, unknown> = {}) => ({
  source: 'sent_copy',
  id: 'c1',
  kind: 'bill',
  title: 'Invoice #ZZ01-0002 from ZZ Test Plumbing',
  how: 'email',
  recipient_name: 'ZZ Test Payer',
  recipient_emails: ['zz.payer@example.test'],
  subject: 'Your bill',
  sent_at: '2026-11-24T15:00:00Z',
  sent_by_name: 'ZZ Test Sender',
  copy_path: null,
  resend_email_id: null,
  ...over,
})
const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  invoice_id: 'b1',
  job_id: 'j1',
  bill: { id: 'b1', job_id: 'j1', amount: 125.5, status: 'billed' },
  sends: [copy(), email()],
  stripe_invoice_id: 'in_test_zz1',
  stripe_action: 'void',
  voided_by_name: 'ZZ Test Dev',
  voided_at: '2026-11-25T16:30:00Z',
  ...over,
})

describe('who reads the line', () => {
  it('a developer on a ZZ test job', () => {
    expect(voidedTestBillsDrawn('dev', ZZ)).toBe(true)
    expect(voidedTestBillsDrawn('dev', { job_name: 'Larkfield Lot 9', customer_name: 'zz test customer' })).toBe(true)
  })
  it('no other role, on any job', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', '', null, undefined]) {
      expect(voidedTestBillsDrawn(role, ZZ)).toBe(false)
    }
  })
  it('not on a real job, and not before the job is known', () => {
    expect(voidedTestBillsDrawn('dev', REAL)).toBe(false)
    expect(voidedTestBillsDrawn('dev', null)).toBe(false)
    expect(voidedTestBillsDrawn('dev', undefined)).toBe(false)
  })
})

describe('a stored time as the line writes it', () => {
  it('reads the company’s day and the time', () => {
    expect(voidedTestBillWhen('2026-11-25T16:30:00Z')).toEqual({ day: 'Nov 25, 2026', time: '10:30 AM' })
  })
  it('puts a late-evening UTC time on the company’s day, not the next one', () => {
    expect(voidedTestBillWhen('2026-11-27T02:44:00Z').day).toBe('Nov 26, 2026')
  })
  it('answers nothing for a time that does not parse', () => {
    expect(voidedTestBillWhen('')).toEqual({ day: '', time: '' })
    expect(voidedTestBillWhen('soon')).toEqual({ day: '', time: '' })
  })
})

describe('what was done in Stripe, in words', () => {
  it('has words for each word the function answers', () => {
    expect(voidedTestBillStripeWords('void')).toBe('Voided in Stripe')
    expect(voidedTestBillStripeWords('delete_draft')).toBe('Draft deleted in Stripe')
    expect(voidedTestBillStripeWords('noop')).toBe('Already void in Stripe')
    expect(voidedTestBillStripeWords('noop_missing')).toBe('Not found in Stripe')
    expect(voidedTestBillStripeWords('reverse_oob_mark')).toBe('Paid mark reversed in Stripe')
    expect(voidedTestBillStripeWords('db_only_no_stripe_id')).toBe('No invoice in Stripe')
    expect(voidedTestBillStripeWords('db_only_non_stripe_collect_send_back')).toBe('Not a Stripe bill')
  })
  it('passes on a word it does not know, and says when there is none', () => {
    expect(voidedTestBillStripeWords('some_new_word')).toBe('some_new_word')
    expect(voidedTestBillStripeWords(null)).toBe('Not on record')
    expect(voidedTestBillStripeWords('  ')).toBe('Not on record')
  })
})

describe('a record’s sends as lines', () => {
  it('draws a copy and the Stripe email filed with it as one send, the copy’s', () => {
    expect(voidedTestBillSendLines([copy(), email()])).toEqual([{ key: 'copy:c1', how: 'Email', to: 'ZZ Test Payer, zz.payer@example.test', day: 'Nov 24, 2026', time: '9:00 AM' }])
  })
  it('draws a Stripe email with no copy near it as its own line, with the copy addresses it reached', () => {
    const lines = voidedTestBillSendLines([copy(), email({ id: 'e2', sent_at: '2026-11-25T18:00:00Z' })])
    expect(lines.map((l) => l.key)).toEqual(['copy:c1', 'email:e2'])
    expect(lines[1]).toEqual({ key: 'email:e2', how: 'Email from Stripe', to: 'zz.copy@example.test', day: 'Nov 25, 2026', time: '12:00 PM' })
    expect(voidedTestBillSendLines([email({ copy_emails: [] })])[0]?.to).toBe('')
  })
  it('folds one Stripe email into one copy only: a second email in the same minutes stays a line', () => {
    const lines = voidedTestBillSendLines([copy(), email(), email({ id: 'e2', sent_at: '2026-11-24T15:01:00Z' })])
    expect(lines.map((l) => l.key)).toEqual(['copy:c1', 'email:e2'])
  })
  it('a copy to the copy list is a line of its own, and the Stripe email it rode with stays a line', () => {
    // What a test-mode send leaves: the Stripe email's row, and the copy that went to the sender.
    const lines = voidedTestBillSendLines([email({ copy_emails: [] }), copy({ kind: 'bill_copy', recipient_name: '', recipient_emails: ['zz.sender@example.test'], sent_at: '2026-11-24T15:00:06Z' })])
    expect(lines.map((l) => [l.key, l.how, l.to])).toEqual([
      ['email:e1', 'Email from Stripe', ''],
      ['copy:c1', 'Copy by email', 'zz.sender@example.test'],
    ])
  })
  it('says how each copy went, and reads a by-hand record as one', () => {
    const hows = (how: string, kind = 'bill') => voidedTestBillSendLines([copy({ how, kind })])[0]?.how
    expect(hows('print')).toBe('Printed')
    expect(hows('hand')).toBe('Handed over')
    expect(hows('mail')).toBe('Mailed')
    expect(hows('link')).toBe('Link sent')
    expect(hows('download')).toBe('Saved as a file')
    expect(hows('other')).toBe('Sent')
    expect(hows('other', 'bill_by_hand')).toBe('Recorded by hand')
  })
  it('lists the oldest send first, whatever order the record holds', () => {
    const lines = voidedTestBillSendLines([copy({ id: 'late', how: 'print', sent_at: '2026-11-26T15:00:00Z' }), copy({ id: 'early', how: 'print', sent_at: '2026-11-20T15:00:00Z' })])
    expect(lines.map((l) => l.key)).toEqual(['copy:early', 'copy:late'])
  })
  it('reads anything that is not a list of sends as none', () => {
    expect(voidedTestBillSendLines(null)).toEqual([])
    expect(voidedTestBillSendLines({})).toEqual([])
    expect(voidedTestBillSendLines([null, 7, { source: 'sent_copy' }, { source: 'a_new_source', id: 'x' }])).toEqual([])
  })
  it('reads the list the function writes', () => {
    const written = voidedTestBillSends([{ id: 'e9', sent_at: '2026-11-25T18:00:00Z', stripe_invoice_id: 'in_test_zz1', copy_emails: [] }], [{ ...copy(), source: undefined }])
    expect(voidedTestBillSendLines(written).map((l) => l.key)).toEqual(['copy:c1', 'email:e9'])
  })
})

describe('one row of the table as the line draws it', () => {
  it('reads the bill’s number from a send’s title, its amount from the kept row, and the void', () => {
    expect(parseVoidedTestBill(row())).toEqual({
      id: 'r1',
      invoiceId: 'b1',
      number: 'ZZ01-0002',
      amount: 125.5,
      voidedDay: 'Nov 25, 2026',
      voidedTime: '10:30 AM',
      voidedBy: 'ZZ Test Dev',
      stripeWords: 'Voided in Stripe',
      stripeInvoiceId: 'in_test_zz1',
      sends: [{ key: 'copy:c1', how: 'Email', to: 'ZZ Test Payer, zz.payer@example.test', day: 'Nov 24, 2026', time: '9:00 AM' }],
    })
  })
  it('reads an amount the database sent as text, and none as none', () => {
    expect(parseVoidedTestBill(row({ bill: { amount: '80.00' } }))?.amount).toBe(80)
    expect(parseVoidedTestBill(row({ bill: {} }))?.amount).toBeNull()
    expect(parseVoidedTestBill(row({ bill: null }))?.amount).toBeNull()
  })
  it('a bill with no send has no number and no lines', () => {
    const bill = parseVoidedTestBill(row({ sends: [], voided_by_name: null, stripe_invoice_id: null, stripe_action: 'db_only_no_stripe_id' }))
    expect(bill).toMatchObject({ number: '', sends: [], voidedBy: '', stripeInvoiceId: '', stripeWords: 'No invoice in Stripe' })
  })
  it('answers null for a row with no id', () => {
    expect(parseVoidedTestBill(row({ id: '' }))).toBeNull()
    expect(parseVoidedTestBill(null)).toBeNull()
    expect(parseVoidedTestBill('r1')).toBeNull()
  })
  it('asks the table for the columns it reads', () => {
    expect(VOIDED_TEST_BILLS_COLS.split(', ')).toEqual(['id', 'invoice_id', 'job_id', 'bill', 'sends', 'stripe_invoice_id', 'stripe_action', 'voided_by_name', 'voided_at'])
  })
})

describe('the words', () => {
  it('the folded line counts its bills', () => {
    expect(voidedTestBillsHeading(1)).toBe('Voided test bills · 1')
    expect(voidedTestBillsHeading(3)).toBe('Voided test bills · 3')
  })
  it('every sentence a person reads is in plain words', () => {
    for (const words of [VOIDED_TEST_BILLS_NOTE, VOIDED_TEST_BILL_NO_SENDS, VOIDED_TEST_BILL_NO_NAME, VOIDED_TEST_BILL_NO_ADDRESS]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})
