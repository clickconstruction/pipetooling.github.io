// @vitest-environment jsdom
/**
 * Render smoke for punch list #72 PR 2a, Job Parts Tally → Transactions → Team: the day card says
 * the holder's day, the likely chip leads but nothing is selected, a tap picks for the day,
 * Sort the day writes one call per picked charge with the exact rows, a refused charge stays
 * picked with its error, and the line's buttons open their windows. Made-up names and amounts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { TallyTeamQueueReads } from '../../lib/tally/fetchTallyTeamQueue'
import type { StaleStaffRow } from '../../lib/tally/teamPurchaseRows'

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

vi.mock('../../lib/tally/fetchTallyTeamQueue', () => ({
  TALLY_TEAM_SORTED_WINDOW_DAYS: 30,
  fetchTallyTeamQueue: vi.fn(async () => READS),
  fetchRecentlySortedTeamPurchases: vi.fn(async () => []),
  fetchTallyJobLabels: vi.fn(async () => ({ 'job-a': '101 Hill Street', 'job-office': '000 Office' })),
}))

const { TallyTeamQueue } = await import('./TallyTeamQueue')

beforeEach(() => {
  rpc.mockReset()
})

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
})
