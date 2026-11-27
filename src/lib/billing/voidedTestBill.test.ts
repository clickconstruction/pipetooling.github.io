/**
 * A voided test bill's record, the pure part the edge function reads (punch list #443, row 7):
 * `supabase/functions/_shared/voidedTestBill.ts`. Which void keeps a record, and what goes into it. Made-up names.
 */
import { describe, expect, it } from 'vitest'
import {
  VOIDED_TEST_BILLS_TABLE,
  VOIDED_TEST_BILL_SENT_COPY_COLS,
  voidedTestBillKept,
  voidedTestBillRecord,
  voidedTestBillSends,
} from '../../../supabase/functions/_shared/voidedTestBill'

const BILL = 'bbbbbbbb-2222-4222-8222-222222222222'
const JOB = 'cccccccc-3333-4333-8333-333333333333'
const DEV = 'dddddddd-4444-4444-8444-444444444444'
const bill = (over: Record<string, unknown> = {}) => ({ id: BILL, job_id: JOB, amount: 125.5, status: 'billed', stripe_invoice_id: 'in_test_zz1', stripe_mode: 'test', pay_code: 'abcdefghjk', external_send_channel: 'stripe', sent_to_customer_at: '2026-11-24T15:00:00Z', ...over })
const email = (over: Record<string, unknown> = {}) => ({ id: 'e1', sent_at: '2026-11-24T15:00:05Z', stripe_invoice_id: 'in_test_zz1', copy_emails: ['zz.copy@example.test'], ...over })
const copy = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  kind: 'bill',
  title: 'Invoice #ZZ01-0002 from ZZ Test Plumbing',
  how: 'email',
  recipient_name: 'ZZ Test Payer',
  recipient_emails: ['zz.payer@example.test'],
  subject: 'Your bill',
  sent_at: '2026-11-24T15:00:00Z',
  sent_by_name: 'ZZ Test Sender',
  copy_path: 'bill/c1.html',
  resend_email_id: 're_zz1',
  ...over,
})

describe('which void keeps a record', () => {
  it('a job named ZZ, or a job whose stored customer is named ZZ, and no other', () => {
    expect(voidedTestBillKept({ job_name: 'ZZ Test walk job', customer_name: 'Larkfield Homes' })).toBe(true)
    expect(voidedTestBillKept({ job_name: 'Larkfield Lot 9', customer_name: '  zz test customer' })).toBe(true)
    expect(voidedTestBillKept({ job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes' })).toBe(false)
    expect(voidedTestBillKept({ job_name: 'Pizza Yard', customer_name: null })).toBe(false)
  })
  it('a job that could not be read keeps none', () => {
    expect(voidedTestBillKept(null)).toBe(false)
    expect(voidedTestBillKept(undefined)).toBe(false)
    expect(voidedTestBillKept({})).toBe(false)
  })
})

describe('the sends a record holds', () => {
  it('copies a Stripe email and a sent copy, each with its source, oldest first', () => {
    const sends = voidedTestBillSends([email()], [copy({ id: 'c2', how: 'print', sent_at: '2026-11-25T10:00:00Z' }), copy()])
    expect(sends.map((s) => `${s.source}:${s.id}`)).toEqual(['sent_copy:c1', 'stripe_email:e1', 'sent_copy:c2'])
    expect(sends[0]).toEqual({ source: 'sent_copy', ...copy() })
    expect(sends[1]).toEqual({ source: 'stripe_email', id: 'e1', sent_at: '2026-11-24T15:00:05Z', stripe_invoice_id: 'in_test_zz1', copy_emails: ['zz.copy@example.test'] })
  })
  it('keeps no column the function did not ask for, and none of the copy’s body', () => {
    const [send] = voidedTestBillSends([], [{ ...copy(), attachments: [{ name: 'a.pdf' }], source_snapshot: { x: 1 }, job_ids: [JOB] }])
    expect(Object.keys(send ?? {}).sort()).toEqual(['source', ...VOIDED_TEST_BILL_SENT_COPY_COLS.split(', ')].sort())
  })
  it('leaves out a row with no id or no time, and reads a missing list as none', () => {
    expect(voidedTestBillSends([email({ id: '' }), email({ sent_at: null }), null, 'x', []], [copy({ sent_at: '' }), 7])).toEqual([])
    expect(voidedTestBillSends([email({ copy_emails: null, stripe_invoice_id: '  ' })], [])).toEqual([{ source: 'stripe_email', id: 'e1', sent_at: '2026-11-24T15:00:05Z', stripe_invoice_id: null, copy_emails: [] }])
  })
})

describe('the record of one void', () => {
  it('holds the bill’s whole row, its sends, the Stripe side and who voided it', () => {
    const row = bill()
    const record = voidedTestBillRecord({ bill: row, emailSends: [email()], sentCopies: [copy()], stripeAction: 'void', voidedBy: DEV, actor: { name: 'ZZ Test Dev', email: 'zz.dev@example.test' } })
    expect(record).toEqual({
      invoice_id: BILL,
      job_id: JOB,
      bill: row,
      sends: voidedTestBillSends([email()], [copy()]),
      stripe_invoice_id: 'in_test_zz1',
      stripe_action: 'void',
      voided_by: DEV,
      voided_by_name: 'ZZ Test Dev',
    })
    // The database stamps the time, so the record sends none.
    expect(record).not.toHaveProperty('voided_at')
  })
  it('names the account by its email when it has no name, and by nothing when neither was read', () => {
    const base = { bill: bill(), emailSends: [], sentCopies: [], stripeAction: 'noop', voidedBy: DEV }
    expect(voidedTestBillRecord({ ...base, actor: { name: '  ', email: 'zz.dev@example.test' } })?.voided_by_name).toBe('zz.dev@example.test')
    expect(voidedTestBillRecord({ ...base, actor: null })?.voided_by_name).toBeNull()
  })
  it('a bill with no Stripe invoice says so with a null, and keeps the function’s own word', () => {
    const record = voidedTestBillRecord({ bill: bill({ stripe_invoice_id: null }), emailSends: [], sentCopies: [], stripeAction: 'db_only_no_stripe_id', voidedBy: DEV, actor: null })
    expect(record?.stripe_invoice_id).toBeNull()
    expect(record?.stripe_action).toBe('db_only_no_stripe_id')
    expect(record?.sends).toEqual([])
  })
  it('answers null for a row with no id or no job, and for anything that is not a row', () => {
    const rest = { emailSends: [], sentCopies: [], stripeAction: 'void', voidedBy: DEV, actor: null }
    expect(voidedTestBillRecord({ bill: bill({ id: '' }), ...rest })).toBeNull()
    expect(voidedTestBillRecord({ bill: bill({ job_id: null }), ...rest })).toBeNull()
    expect(voidedTestBillRecord({ bill: null, ...rest })).toBeNull()
    expect(voidedTestBillRecord({ bill: [bill()], ...rest })).toBeNull()
  })
  it('is written to the table the migration makes', () => {
    expect(VOIDED_TEST_BILLS_TABLE).toBe('voided_test_bills')
  })
})
