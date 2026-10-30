import { describe, expect, it } from 'vitest'
import {
  EMPTY_MOVE_WINDOW_DECISION,
  moveWindowChoices,
  moveWindowDecisionReady,
  moveWindowFillInRows,
  moveWindowTrailWords,
  moveWindowWrites,
  type MoveWindowSources,
} from './fillInMoveWindow'

// Thursday 2026-10-29 at 10:00 company time.
const TODAY = '2026-10-29'
const NOW = Date.parse('2026-10-29T15:00:00Z')

const sources = (): MoveWindowSources => ({
  invoices: [
    { id: 'inv-a', supply_house_id: 'h-1', invoice_number: 'INV-a', purchase_order_number: '1182', invoice_date: '2026-10-01', amount: 2210, due_date: '2026-11-02', on_job_account: false },
    { id: 'inv-b', supply_house_id: 'h-1', invoice_number: 'INV-b', purchase_order_number: null, invoice_date: '2026-10-02', amount: '1742.65', due_date: TODAY, on_job_account: false },
    { id: 'inv-c', supply_house_id: 'h-2', invoice_number: 'INV-c', purchase_order_number: null, invoice_date: '2026-09-20', amount: 500, due_date: '2026-10-28', on_job_account: false },
    { id: 'inv-d', supply_house_id: 'h-1', invoice_number: 'INV-d', purchase_order_number: null, invoice_date: '2026-10-05', amount: 300, due_date: '2026-11-08', on_job_account: true },
    { id: 'inv-g', supply_house_id: 'h-1', invoice_number: 'INV-g', purchase_order_number: null, invoice_date: '2026-10-05', amount: 800, due_date: '2026-10-31', on_job_account: false },
    { id: 'inv-l', supply_house_id: 'h-2', invoice_number: 'INV-l', purchase_order_number: null, invoice_date: '2026-10-05', amount: 450, due_date: '2026-11-03', on_job_account: false },
    { id: 'inv-m', supply_house_id: 'h-2', invoice_number: 'INV-m', purchase_order_number: null, invoice_date: '2026-10-06', amount: 120, due_date: '2026-11-03', on_job_account: null },
  ],
  allocations: [
    { invoice_id: 'inv-a', job_id: 'j-650' },
    { invoice_id: 'inv-b', job_id: 'j-712' },
    { invoice_id: 'inv-c', job_id: 'j-712' },
    { invoice_id: 'inv-d', job_id: 'j-650' },
    { invoice_id: 'inv-g', job_id: 'j-650' },
    { invoice_id: 'inv-g', job_id: 'j-712' },
    { invoice_id: 'inv-l', job_id: 'j-900' },
    { invoice_id: 'inv-m', job_id: 'j-901' },
  ],
  accounts: [
    { job_id: 'j-650', supply_house_id: 'h-1', status: 'open', account_ref: '44812', opened_at: '2026-10-10T15:00:00Z', requested_at: null },
    { job_id: 'j-900', supply_house_id: 'h-2', status: 'not_needed', account_ref: '', opened_at: null, requested_at: null },
  ],
  asks: [{ id: 'ask-1', invoice_id: 'inv-a', requested_at: '2026-10-27T14:00:00Z', via: 'email', sent_to: 'curly@bluebonnet.com' }],
  reps: [
    { id: 'rep-2', supply_house_id: 'h-1', name: 'Dot', email: null, phone: '210-555-0101' },
    { id: 'rep-1', supply_house_id: 'h-1', name: 'Curly', email: 'curly@bluebonnet.com', phone: '210-555-0100' },
  ],
  houses: [
    { id: 'h-1', name: 'Bluebonnet Supply' },
    { id: 'h-2', name: 'Moore Supply' },
  ],
  jobs: [
    { id: 'j-650', hcp_number: '650', click_number: null, job_name: 'Maple Street remodel', job_address: null },
    { id: 'j-712', hcp_number: '712', click_number: null, job_name: 'Cedar Loop clinic', job_address: null },
    { id: 'j-901', hcp_number: '901', click_number: null, job_name: 'Pine Road duplex', job_address: null },
  ],
  todayYmd: TODAY,
  nowMs: NOW,
})

describe('fillInMoveWindow · the rows (punch list #178, PR 3)', () => {
  it('keeps the strip’s rows, soonest window first, and leaves out what the count leaves out', () => {
    const rows = moveWindowFillInRows(sources())
    // c is past due, d is on the account, g is split, l's job has its account there marked not needed.
    expect(rows.map((r) => r.invoiceId)).toEqual(['inv-b', 'inv-a', 'inv-m'])
    expect(rows[0]!.title).toBe('$1,742.65 at Bluebonnet Supply · #712 Cedar Loop clinic · closes today')
    expect(rows[1]!.title).toBe('$2,210.00 at Bluebonnet Supply · #650 Maple Street remodel · closes in 4 days')
    expect(rows[2]!.title).toBe('$120.00 at Moore Supply · #901 Pine Road duplex · closes in 5 days')
    expect(rows.map((r) => r.severity)).toEqual(['red', 'amber', 'amber'])
    expect(rows[0]!.doorHref).toBe('/materials?tab=supply-houses&list=movable')
    expect(rows[0]!.daysLeft).toBe(0)
    expect(rows[1]!.amount).toBe(2210)
  })

  it('says what the app knows: the invoice, the window, the account, the rep, the ask out', () => {
    const [b, a, m] = moveWindowFillInRows(sources())
    expect(a!.knows).toEqual([
      'Invoice INV-a of Oct 1, PO 1182.',
      'The window closes Mon Nov 2, in 4 days.',
      'The job account there is open, ref 44812.',
      'The rep for job accounts is Curly, 210-555-0100, curly@bluebonnet.com.',
      'Asked by email Oct 27, 2 days ago, to curly@bluebonnet.com. The house has not confirmed.',
    ])
    expect(b!.knows).toEqual(['Invoice INV-b of Oct 2.', 'The window closes today, Thu Oct 29.', 'No job account on record for this job at Bluebonnet Supply.', 'The rep for job accounts is Curly, 210-555-0100, curly@bluebonnet.com.'])
    expect(m!.knows[3]).toBe('No job-accounts rep is on file for the house.')
  })

  it('offers the three answers; the email is dead with no rep address, and reads again with an ask out', () => {
    const [b, a, m] = moveWindowFillInRows(sources())
    expect(moveWindowChoices(b!).map((c) => [c.key, c.label, c.disabled])).toEqual([
      ['moved', 'Moved · I called the house', false],
      ['asked', 'Ask the house by email', false],
      ['not_needed', 'No job account needed', false],
    ])
    expect(moveWindowChoices(a!)[1]).toMatchObject({ label: 'Send the email again', hint: 'to Curly, curly@bluebonnet.com' })
    expect(moveWindowChoices(m!)[1]).toMatchObject({ disabled: true, hint: 'no job-accounts rep with an email on file' })
    expect(moveWindowDecisionReady(b!, EMPTY_MOVE_WINDOW_DECISION)).toBe(false)
    expect(moveWindowDecisionReady(b!, { ...EMPTY_MOVE_WINDOW_DECISION, choice: 'moved' })).toBe(true)
    expect(moveWindowDecisionReady(b!, { ...EMPTY_MOVE_WINDOW_DECISION, choice: 'asked' })).toBe(true)
    expect(moveWindowDecisionReady(m!, { ...EMPTY_MOVE_WINDOW_DECISION, choice: 'asked' })).toBe(false)
    expect(moveWindowDecisionReady(b!, { ...EMPTY_MOVE_WINDOW_DECISION, choice: 'not_needed' })).toBe(false)
    expect(moveWindowDecisionReady(b!, { ...EMPTY_MOVE_WINDOW_DECISION, choice: 'not_needed', note: 'insurer pays direct' })).toBe(true)
  })

  it('writes the move modal’s moves, the emailed ask and the sheet’s not needed, and the trail says where', () => {
    const [b, a] = moveWindowFillInRows(sources())
    expect(moveWindowWrites(b!, EMPTY_MOVE_WINDOW_DECISION)).toBeNull()
    // Moved with the house's reference and no account on record: the account is opened by phone too.
    const movedWithRef = moveWindowWrites(b!, { choice: 'moved', ref: ' 9001 ', note: '' })!
    expect(movedWithRef).toEqual({
      choice: 'moved',
      invoiceId: 'inv-b',
      jobId: 'j-712',
      houseId: 'h-1',
      houseName: 'Bluebonnet Supply',
      account: { jobId: 'j-712', houseId: 'h-1', row: { job_id: 'j-712', supply_house_id: 'h-1', status: 'open', account_ref: '9001', opened_via: 'phone', rep_contact_id: null, note: '' }, flagInvoices: false },
    })
    expect(moveWindowTrailWords(movedWithRef)).toBe('moved onto the job account · the account opened by phone, ref 9001 · Accounts payable has it')
    // Moved on an account already open: the reference is not written again.
    const moved = moveWindowWrites(a!, { choice: 'moved', ref: '44812', note: '' })!
    expect(moved).toMatchObject({ choice: 'moved', account: null })
    expect(moveWindowTrailWords(moved)).toBe('moved onto the job account · Accounts payable has it')
    const asked = moveWindowWrites(a!, { choice: 'asked', ref: '', note: '' })!
    expect(asked).toEqual({ choice: 'asked', invoiceId: 'inv-a', includeAsked: true, sentTo: 'curly@bluebonnet.com' })
    expect(moveWindowTrailWords(asked)).toBe('asked curly@bluebonnet.com by email · follow up with a call until the house confirms')
    expect(moveWindowWrites(b!, { choice: 'asked', ref: '', note: '' })).toMatchObject({ includeAsked: false })
    const no = moveWindowWrites(b!, { choice: 'not_needed', ref: '', note: ' the insurer pays the house direct ' })!
    expect(no).toEqual({
      choice: 'not_needed',
      invoiceId: 'inv-b',
      houseName: 'Bluebonnet Supply',
      account: { jobId: 'j-712', houseId: 'h-1', row: { job_id: 'j-712', supply_house_id: 'h-1', status: 'not_needed', account_ref: '', opened_via: null, rep_contact_id: null, note: 'the insurer pays the house direct' }, flagInvoices: false },
    })
    expect(moveWindowTrailWords(no)).toBe('not needed · the insurer pays the house direct · the house roster has it, and the charge leaves the window')
  })
})
