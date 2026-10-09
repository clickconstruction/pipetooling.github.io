import { describe, expect, it } from 'vitest'
import type { CardChargeWindowRow } from '../banking/cardChargesWindow'
import type { SortedTeamPurchaseRow } from '../teamPurchasesSorted'
import { tallyUndoLineFromSortedRow, tallyUndoLineFromWindowRow, tallyUndoRpcArgs, tallyUndoToast } from './tallyUndoLine'

// Made-up holders, stores and jobs.
const windowRow = (p: { jobs?: number; invoices?: number; payroll?: boolean; holder?: string | null; canSort?: boolean }): CardChargeWindowRow =>
  ({
    id: 't-1',
    postedAt: '2026-09-30T12:00:00-05:00',
    purchasedAt: '2026-09-30T09:15:00-05:00',
    amount: -88.2,
    counterpartyName: 'Ridge Supply',
    kind: 'debitCardTransaction',
    status: 'sent',
    bankCategory: null,
    debitCardId: 'card',
    cardNickname: null,
    cardRole: null,
    holderUserId: p.holder === undefined ? 'u-ann' : p.holder,
    holderName: 'Ann',
    attributedUserId: null,
    attributedPersonId: null,
    labelId: null,
    labelDefaultKey: null,
    payrollMarked: p.payroll ?? false,
    splits: Array.from({ length: p.jobs ?? 0 }, (_, i) => ({
      jobId: `job-${i}`,
      amount: -88.2 / (p.jobs ?? 1),
      hcpNumber: null,
      clickNumber: null,
      jobName: null,
      serviceTypeId: null,
    })),
    invoiceLinks: Array.from({ length: p.invoices ?? 0 }, (_, i) => ({ invoiceId: `inv-${i}`, invoiceNumber: `${i}`, supplyHouseName: 'Ridge Supply', amount: 1 })),
    sortedAt: '2026-09-30T18:00:00-05:00',
    sortedByName: 'Bea',
    viewerCanSort: p.canSort ?? true,
  }) as CardChargeWindowRow

const sortedRow = (p: { jobs?: unknown; invoices?: unknown; holder?: string }): SortedTeamPurchaseRow => ({
  target_user_id: p.holder ?? 'u-ann',
  target_name: 'Ann',
  mercury_transaction_id: 't-2',
  posted_at: '2026-09-30T12:00:00-05:00',
  amount: -31.47,
  counterparty_name: 'Corner Fuel',
  note: null,
  mercury_account_id: 'acct',
  currency: 'USD',
  mercury_id: 'm-t-2',
  raw: null,
  job_splits: (p.jobs ?? null) as SortedTeamPurchaseRow['job_splits'],
  invoice_links: (p.invoices ?? null) as SortedTeamPurchaseRow['invoice_links'],
  sorted_at: '2026-09-30T18:00:00-05:00',
  sorted_by_name: 'Bea',
})

describe('tallyUndoLineFromWindowRow', () => {
  it('undoes a line that went to one job or to two', () => {
    expect(tallyUndoLineFromWindowRow(windowRow({ jobs: 1 }))).toEqual({ chargeId: 't-1', holderId: 'u-ann' })
    expect(tallyUndoLineFromWindowRow(windowRow({ jobs: 2 }))).toEqual({ chargeId: 't-1', holderId: 'u-ann' })
  })

  it('leaves a line matched to invoices, marked payroll, or with no jobs', () => {
    expect(tallyUndoLineFromWindowRow(windowRow({ jobs: 1, invoices: 1 }))).toBeNull()
    expect(tallyUndoLineFromWindowRow(windowRow({ invoices: 2 }))).toBeNull()
    expect(tallyUndoLineFromWindowRow(windowRow({ payroll: true }))).toBeNull()
    expect(tallyUndoLineFromWindowRow(windowRow({}))).toBeNull()
  })

  it('leaves a line the viewer may not write, or one with no holder', () => {
    expect(tallyUndoLineFromWindowRow(windowRow({ jobs: 1, canSort: false }))).toBeNull()
    expect(tallyUndoLineFromWindowRow(windowRow({ jobs: 1, holder: null }))).toBeNull()
  })
})

describe('tallyUndoLineFromSortedRow', () => {
  it('undoes a Sorted row that went to jobs', () => {
    expect(tallyUndoLineFromSortedRow(sortedRow({ jobs: [{ job_id: 'job-a', amount: -31.47 }] }))).toEqual({
      chargeId: 't-2',
      holderId: 'u-ann',
    })
  })

  it('leaves a Sorted row matched to invoices, with or without jobs', () => {
    const invoices = [{ invoice_id: 'inv-1', amount: -31.47 }]
    expect(tallyUndoLineFromSortedRow(sortedRow({ invoices }))).toBeNull()
    expect(tallyUndoLineFromSortedRow(sortedRow({ jobs: [{ job_id: 'job-a', amount: -31.47 }], invoices }))).toBeNull()
  })

  it('leaves a row whose splits do not read as jobs, or with no holder', () => {
    expect(tallyUndoLineFromSortedRow(sortedRow({ jobs: [] }))).toBeNull()
    expect(tallyUndoLineFromSortedRow(sortedRow({ jobs: [{ amount: -31.47 }] }))).toBeNull()
    expect(tallyUndoLineFromSortedRow(sortedRow({ jobs: [{ job_id: 'job-a', amount: -31.47 }], holder: '' }))).toBeNull()
  })
})

describe('tallyUndoRpcArgs', () => {
  it('calls the staff split write for the holder with no rows', () => {
    expect(tallyUndoRpcArgs({ chargeId: 't-1', holderId: 'u-ann' })).toEqual({
      p_for_user_id: 'u-ann',
      p_mercury_transaction_id: 't-1',
      p_rows: [],
    })
  })
})

describe('tallyUndoToast', () => {
  it('counts what is back to sort', () => {
    expect(tallyUndoToast(1, 0)).toEqual({ message: '1 charge is back to sort.', type: 'success' })
    expect(tallyUndoToast(3, 0)).toEqual({ message: '3 charges are back to sort.', type: 'success' })
  })

  it('says when some or none could be undone', () => {
    expect(tallyUndoToast(2, 1)).toEqual({ message: '2 of 3 are back to sort. The rest could not be undone.', type: 'error' })
    expect(tallyUndoToast(0, 2)).toEqual({ message: 'Nothing was undone. Try again.', type: 'error' })
  })
})
