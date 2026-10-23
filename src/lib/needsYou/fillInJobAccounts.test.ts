import { describe, expect, it } from 'vitest'
import { EMPTY_JOB_ACCOUNT_DECISION, jobAccountDecisionReady, jobAccountFillInRows, jobAccountKnows, jobAccountTrailWords, jobAccountWrites, type JobAccountGapSource } from './fillInJobAccounts'

const gap = (p: Partial<JobAccountGapSource> = {}): JobAccountGapSource => ({
  job_id: 'j-1',
  supply_house_id: 'h-1',
  house_name: 'Ferguson',
  allocated_total: 1860,
  unpaid_total: 420,
  invoice_count: 3,
  po_count: 2,
  last_at: '2026-10-02T15:00:00Z',
  rep_name: 'Curly',
  rep_phone: '210-555-0100',
  ...p,
})
const JOBS = [{ id: 'j-1', hcp_number: '650', click_number: null, job_name: 'Maple Street remodel', job_address: '12 Maple St' }]

describe('fillInJobAccounts · the rows (punch list #146)', () => {
  it('one row per job and house, biggest unpaid first, titled by the ledger number and the house', () => {
    const rows = jobAccountFillInRows([gap(), gap({ job_id: 'j-2', house_name: 'Moore Supply', supply_house_id: 'h-2', unpaid_total: 900, allocated_total: 900, invoice_count: 1 })], JOBS)
    expect(rows.map((r) => r.key)).toEqual(['job-account:j-2:h-2', 'job-account:j-1:h-1'])
    expect(rows[1]!.title).toBe('#650 Maple Street remodel · Ferguson · $1,860 on 3 invoices')
    expect(rows[0]!.title).toBe('job j-2 · Moore Supply · $900 on one invoice')
    expect(rows[1]!.doorHref).toBe('/materials?tab=job-accounts&filter=no_account')
    const [po] = jobAccountFillInRows([gap({ allocated_total: 0, invoice_count: 0, po_count: 1 })], JOBS)
    expect(po!.title).toBe('#650 Maple Street remodel · Ferguson · PO codes only')
  })

  it('says what the app knows', () => {
    expect(jobAccountKnows(gap())).toEqual(['The rep for job accounts is Curly, 210-555-0100.', 'Last bought there Oct 2.', '$420 of it is still unpaid.', '2 PO codes were minted there.'])
    expect(jobAccountKnows(gap({ rep_name: null, rep_phone: null, last_at: null, unpaid_total: 0, po_count: 1 }))).toEqual(['No job-accounts rep is on file for the house.', 'One PO code was minted there.'])
  })

  it('is ready with a choice, and a reason when not needed', () => {
    expect(jobAccountDecisionReady(EMPTY_JOB_ACCOUNT_DECISION)).toBe(false)
    expect(jobAccountDecisionReady({ ...EMPTY_JOB_ACCOUNT_DECISION, choice: 'open' })).toBe(true)
    expect(jobAccountDecisionReady({ ...EMPTY_JOB_ACCOUNT_DECISION, choice: 'requested' })).toBe(true)
    expect(jobAccountDecisionReady({ ...EMPTY_JOB_ACCOUNT_DECISION, choice: 'not_needed' })).toBe(false)
    expect(jobAccountDecisionReady({ ...EMPTY_JOB_ACCOUNT_DECISION, choice: 'not_needed', note: 'insurer pays direct' })).toBe(true)
  })

  it('writes the Mark opened sheet’s row, flagging the invoices only when opened', () => {
    const [row] = jobAccountFillInRows([gap()], JOBS)
    expect(jobAccountWrites(row!, EMPTY_JOB_ACCOUNT_DECISION)).toBeNull()
    const opened = jobAccountWrites(row!, { choice: 'open', via: 'phone', ref: ' 44812 ', note: '' })!
    expect(opened).toEqual({ jobId: 'j-1', houseId: 'h-1', row: { job_id: 'j-1', supply_house_id: 'h-1', status: 'open', account_ref: '44812', opened_via: 'phone', rep_contact_id: null, note: '' }, flagInvoices: true })
    expect(jobAccountTrailWords(opened, 3)).toBe('opened by phone · ref 44812 · 3 invoices flagged on it · the house roster has it')
    const asked = jobAccountWrites(row!, { choice: 'requested', via: 'phone', ref: '44812', note: '' })!
    expect(asked.row).toMatchObject({ status: 'requested', account_ref: '', opened_via: null })
    expect(asked.flagInvoices).toBe(false)
    expect(jobAccountTrailWords(asked, 0)).toBe('asked the house · the roster shows it as requested')
    const no = jobAccountWrites(row!, { choice: 'not_needed', via: 'phone', ref: '', note: 'insurer pays direct' })!
    expect(jobAccountTrailWords(no, 0)).toBe('not needed · insurer pays direct · the house roster has it')
  })
})
