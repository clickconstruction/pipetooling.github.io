// @vitest-environment jsdom
/**
 * Render smoke for punch list #72 PR 2a, Job Parts Tally → Transactions → Team: the day card says
 * the holder's day, the likely chip leads but nothing is selected, a tap picks for the day,
 * Sort the day writes one call per picked charge with the exact rows, a refused charge stays
 * picked with its error, and the line's buttons open their windows. PR 3's undo: the message after
 * Sort the day, a card's sorted line and a Sorted row each clear a charge's splits through the same
 * write with no rows, and only for a charge that went to jobs. Made-up names and amounts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { TallyTeamQueueReads } from '../../lib/tally/fetchTallyTeamQueue'
import type { StaleStaffRow } from '../../lib/tally/teamPurchaseRows'
import type { CardChargeWindowRow } from '../../lib/banking/cardChargesWindow'
import type { SortedTeamPurchaseRow } from '../../lib/teamPurchasesSorted'

const rpc = vi.fn()

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }))
vi.mock('../../hooks/useOverheadOfficeJobId', () => ({ useOverheadOfficeJobId: () => 'job-office' }))
vi.mock('../../hooks/useMercuryLedgerNicknames', () => ({
  useMercuryLedgerNicknames: () => ({ nicknameByAccount: {}, nicknameByDebitCard: {} }),
}))
vi.mock('../../hooks/useStaleTallyStaffFollowUp', () => ({
  useStaleTallyStaffFollowUp: () => ({ peopleCount: 1, transactionCount: 1, refetch: vi.fn(async () => {}) }),
}))
vi.mock('../MercuryTransactionAllocationsModal', () => ({
  MercuryTransactionAllocationsModal: (p: { open: boolean }) => (p.open ? <div data-testid="assign-window" /> : null),
}))
vi.mock('../MercuryTransactionInvoiceLinkModal', () => ({
  default: (p: { open: boolean }) => (p.open ? <div data-testid="invoices-window" /> : null),
}))
vi.mock('../pay/PersonOffsetFormModal', () => ({ PersonOffsetFormModal: () => null }))

const at = (hm: string) => `2026-09-30T${hm}:00-05:00`
const staffRow = (id: string, hm: string, amount: number, store: string, cat: string): StaleStaffRow =>
  ({
    target_user_id: 'u-ann',
    target_name: 'Ann',
    target_email: '',
    target_phone: '',
    mercury_transaction_id: id,
    posted_at: at(hm),
    amount,
    counterparty_name: store,
    note: '',
    mercury_account_id: 'acct',
    currency: 'USD',
    mercury_id: `m-${id}`,
    raw: { mercuryCategory: cat, createdAt: new Date(at(hm)).toISOString() },
    job_splits: [],
  }) as StaleStaffRow

const READS: TallyTeamQueueReads = {
  queue: [staffRow('t-fuel', '06:03', -31.47, 'Corner Fuel', 'FuelAndGas'), staffRow('t-parts', '09:15', -88.2, 'Ridge Supply', 'Retail')],
  history: [],
  sessions: [{ user_id: 'u-ann', work_date: '2026-09-30', job_ledger_id: 'job-a', clocked_in_at: at('07:10'), clocked_out_at: at('16:40') }],
  schedule: [],
}

/** A charge on Ann's same day, already sorted: to a job, or marked payroll. */
const sortedLine = (id: string, store: string, amount: number, to: 'job' | 'payroll'): CardChargeWindowRow =>
  ({
    id,
    postedAt: at('12:00'),
    purchasedAt: at('11:30'),
    amount,
    counterpartyName: store,
    kind: 'debitCardTransaction',
    status: 'sent',
    bankCategory: null,
    debitCardId: 'card',
    cardNickname: null,
    cardRole: null,
    holderUserId: 'u-ann',
    holderName: 'Ann',
    attributedUserId: null,
    attributedPersonId: null,
    labelId: null,
    labelDefaultKey: null,
    payrollMarked: to === 'payroll',
    splits: to === 'job' ? [{ jobId: 'job-a', amount, hcpNumber: null, clickNumber: null, jobName: null, serviceTypeId: null }] : [],
    invoiceLinks: [],
    sortedAt: at('18:00'),
    sortedByName: 'Bea',
    viewerCanSort: true,
  }) as CardChargeWindowRow

const sortedRow = (id: string, store: string, jobs: boolean): SortedTeamPurchaseRow => ({
  target_user_id: 'u-ann',
  target_name: 'Ann',
  mercury_transaction_id: id,
  posted_at: at('12:00'),
  amount: -42.1,
  counterparty_name: store,
  note: null,
  mercury_account_id: 'acct',
  currency: 'USD',
  mercury_id: `m-${id}`,
  raw: null,
  job_splits: jobs ? [{ job_id: 'job-a', amount: -42.1 }] : [],
  invoice_links: jobs ? [] : [{ invoice_id: 'inv-1', invoice_number: '88231', supply_house_name: 'Ridge Supply', amount: -42.1 }],
  sorted_at: at('18:00'),
  sorted_by_name: 'Bea',
})

let reads: TallyTeamQueueReads = READS
let sortedRows: SortedTeamPurchaseRow[] = []

vi.mock('../../lib/tally/fetchTallyTeamQueue', () => ({
  TALLY_TEAM_SORTED_WINDOW_DAYS: 30,
  fetchTallyTeamQueue: vi.fn(async () => reads),
  fetchRecentlySortedTeamPurchases: vi.fn(async () => sortedRows),
  fetchTallyJobLabels: vi.fn(async () => ({ 'job-a': '101 Hill Street', 'job-office': '000 Office' })),
}))

const { TallyTeamQueue } = await import('./TallyTeamQueue')

beforeEach(() => {
  rpc.mockReset()
  reads = READS
  sortedRows = []
})

const undoWrites = () =>
  rpc.mock.calls
    .filter(([name, a]) => name === 'replace_mercury_job_splits_for_linked_card_as_staff' && (a as { p_rows: unknown[] }).p_rows.length === 0)
    .map(([, a]) => a)

describe('TallyTeamQueue', () => {
  it('says the day, leads with the likely chip, and selects nothing until tapped', async () => {
    renderWithProviders(<TallyTeamQueue />)
    const card = await screen.findByTestId('tally-team-day-card')
    await settle()
    expect(within(card).getByTestId('tally-team-evidence').textContent?.replace(/\s/g, ' ')).toBe(
      'Clocked on 101 Hill Street from 7:10 AM to 4:40 PM. Nothing else that day.',
    )
    const chips = within(card).getAllByTestId('tally-team-chip')
    expect(chips[0]!.getAttribute('data-rule')).toBe('clock-one-job')
    expect(chips[0]!.textContent).toContain('likely')
    expect(chips[0]!.textContent).toContain('only job clocked that day')
    for (const c of chips) expect(c.getAttribute('aria-pressed')).toBe('false')
    const sort = within(card).getByTestId('tally-team-sort-day') as HTMLButtonElement
    expect(sort.textContent).toBe('Sort the day')
    expect(sort.disabled).toBe(true)
    expect(screen.getByTestId('tally-team-through').textContent).toContain('Everything is sorted through Tue, Sep 29.')
  })

  it('a tap picks the day, and Sort the day writes one call per charge; a refused charge stays picked', async () => {
    rpc.mockImplementation(async (_name: string, args: { p_mercury_transaction_id: string }) =>
      args.p_mercury_transaction_id === 't-parts'
        ? { data: null, error: { message: 'not authorized for this user', code: 'P0001' } }
        : { data: null, error: null },
    )
    renderWithProviders(<TallyTeamQueue />)
    const card = await screen.findByTestId('tally-team-day-card')
    await settle()
    fireEvent.click(within(card).getAllByTestId('tally-team-chip')[0]!)
    expect(within(card).getAllByTestId('tally-team-chip')[0]!.getAttribute('aria-pressed')).toBe('true')
    const sort = within(card).getByTestId('tally-team-sort-day')
    expect(sort.textContent).toBe('Sort 2 charges')
    fireEvent.click(sort)
    await waitFor(() => expect(within(card).getByRole('alert')).toBeTruthy())
    const writes = rpc.mock.calls.filter(([name]) => name === 'replace_mercury_job_splits_for_linked_card_as_staff')
    expect(writes.map(([, a]) => a)).toEqual([
      { p_for_user_id: 'u-ann', p_mercury_transaction_id: 't-fuel', p_rows: [{ job_id: 'job-a', amount: -31.47 }] },
      { p_for_user_id: 'u-ann', p_mercury_transaction_id: 't-parts', p_rows: [{ job_id: 'job-a', amount: -88.2 }] },
    ])
    expect(within(card).getByTestId('tally-team-sort-day').textContent).toBe('Sort 1 charge')
  })

  it('opens the Assign and Link invoices windows from a line', async () => {
    renderWithProviders(<TallyTeamQueue />)
    const card = await screen.findByTestId('tally-team-day-card')
    await settle()
    fireEvent.click(within(card).getAllByRole('button', { name: 'Another job…' })[0]!)
    expect(screen.getByTestId('assign-window')).toBeTruthy()
    fireEvent.click(within(card).getAllByRole('button', { name: 'Invoices' })[0]!)
    expect(screen.getByTestId('invoices-window')).toBeTruthy()
  })

  it('the message after Sort the day offers Undo, which puts the day back with no rows', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    renderWithProviders(<TallyTeamQueue />)
    const card = await screen.findByTestId('tally-team-day-card')
    await settle()
    fireEvent.click(within(card).getAllByTestId('tally-team-chip')[0]!)
    fireEvent.click(within(card).getByTestId('tally-team-sort-day'))
    expect(await screen.findByText('Sorted 2 charges.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(undoWrites()).toHaveLength(2))
    expect(undoWrites()).toEqual([
      { p_for_user_id: 'u-ann', p_mercury_transaction_id: 't-fuel', p_rows: [] },
      { p_for_user_id: 'u-ann', p_mercury_transaction_id: 't-parts', p_rows: [] },
    ])
    expect(await screen.findByText('2 charges are back to sort.')).toBeTruthy()
  })

  it('a sorted line that went to a job offers Undo; one marked payroll does not', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    reads = { ...READS, history: [sortedLine('t-pipe', 'Pipe Barn', -42.1, 'job'), sortedLine('t-pay', 'Cash App', -500, 'payroll')] }
    renderWithProviders(<TallyTeamQueue />)
    const card = await screen.findByTestId('tally-team-day-card')
    await settle()
    const lines = within(card).getAllByTestId('tally-team-sorted-line')
    expect(lines).toHaveLength(2)
    const undos = within(card).getAllByTestId('tally-team-undo')
    expect(undos).toHaveLength(1)
    expect(undos[0]!.getAttribute('aria-label')).toBe('Undo Pipe Barn $42.10')
    fireEvent.click(undos[0]!)
    await waitFor(() => expect(undoWrites()).toEqual([{ p_for_user_id: 'u-ann', p_mercury_transaction_id: 't-pipe', p_rows: [] }]))
    expect(await screen.findByText('1 charge is back to sort.')).toBeTruthy()
  })

  it('Sorted offers Undo on a charge that went to a job, not on one matched to invoices', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    sortedRows = [sortedRow('t-job', 'Pipe Barn', true), sortedRow('t-inv', 'Ridge Supply', false)]
    renderWithProviders(<TallyTeamQueue />)
    await screen.findByTestId('tally-team-day-card')
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Sorted (2)' }))
    const undos = screen.getAllByTestId('team-purchases-sorted-undo')
    expect(undos).toHaveLength(1)
    fireEvent.click(undos[0]!)
    await waitFor(() => expect(undoWrites()).toEqual([{ p_for_user_id: 'u-ann', p_mercury_transaction_id: 't-job', p_rows: [] }]))
  })
})
