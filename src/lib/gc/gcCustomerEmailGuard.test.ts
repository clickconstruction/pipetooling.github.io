/**
 * gc-customer-email's double-send guard (`gcCustomerEmailLoggedAlready`, `_shared/gcCustomerEmails.ts`; gc 4's note 3 on
 * the schedule's PR 15): a reminder, a weekly report or the customer's schedule that went through Resend but whose
 * write-back failed is found in `email_send_log` by its live type, the address, its own subject and a log made no
 * earlier than the row, so a second press writes the log back and never emails them twice.
 */
import { describe, expect, it } from 'vitest'
import { GC_CUSTOMER_EMAIL_TEST_TYPE, GC_CUSTOMER_EMAIL_TYPE, gcCustomerEmailLoggedAlready, type GcCustomerEmailLogRow } from '../../../supabase/functions/_shared/gcCustomerEmails'

const SUBJECT = 'Reminder: pay application 3 for Oak Ridge Clinic, $288,879'
const sending = { address: 'ap@oakridge.test', subject: SUBJECT, since: '2026-10-10T14:00:00Z' }
const log = (over: Partial<GcCustomerEmailLogRow> = {}): GcCustomerEmailLogRow => ({
  id: 'log-1',
  email_type: GC_CUSTOMER_EMAIL_TYPE,
  to_emails: ['ap@oakridge.test', 'arch@hart.test'],
  subject: SUBJECT,
  created_at: '2026-10-10T14:00:05Z',
  ...over,
})

describe('the double-send guard', () => {
  it('finds the send the log kept: the live type, the address, the row’s subject, since the row was made', () => {
    expect(gcCustomerEmailLoggedAlready([log()], sending)).toBe('log-1')
    expect(gcCustomerEmailLoggedAlready([log({ to_emails: [' AP@OakRidge.test '] })], sending)).toBe('log-1')
    expect(gcCustomerEmailLoggedAlready([log({ subject: ` ${SUBJECT} ` })], { ...sending, subject: `${SUBJECT} ` })).toBe('log-1')
    expect(gcCustomerEmailLoggedAlready([log({ created_at: sending.since })], sending)).toBe('log-1')
  })

  it('never takes a test copy, another address, another subject, or a send from before the row', () => {
    expect(gcCustomerEmailLoggedAlready([log({ email_type: GC_CUSTOMER_EMAIL_TEST_TYPE, subject: `[TEST] ${SUBJECT}` })], sending)).toBeNull()
    expect(gcCustomerEmailLoggedAlready([log({ email_type: GC_CUSTOMER_EMAIL_TEST_TYPE })], sending)).toBeNull()
    expect(gcCustomerEmailLoggedAlready([log({ to_emails: ['someone@else.test'] })], sending)).toBeNull()
    expect(gcCustomerEmailLoggedAlready([log({ to_emails: null })], sending)).toBeNull()
    expect(gcCustomerEmailLoggedAlready([log({ subject: 'Reminder: pay application 2 for Oak Ridge Clinic, $100' })], sending)).toBeNull()
    expect(gcCustomerEmailLoggedAlready([log({ created_at: '2026-10-10T13:59:59Z' })], sending)).toBeNull()
  })

  it('reads nothing with no address, no subject or no day, and nothing in an empty log', () => {
    expect(gcCustomerEmailLoggedAlready([], sending)).toBeNull()
    expect(gcCustomerEmailLoggedAlready([log()], { ...sending, address: ' ' })).toBeNull()
    expect(gcCustomerEmailLoggedAlready([log()], { ...sending, subject: '' })).toBeNull()
    expect(gcCustomerEmailLoggedAlready([log()], { ...sending, since: 'not a day' })).toBeNull()
  })

  it('takes the first match the newest-first read gives', () => {
    expect(gcCustomerEmailLoggedAlready([log({ id: 'log-new', created_at: '2026-10-10T15:00:00Z' }), log()], sending)).toBe('log-new')
  })
})
