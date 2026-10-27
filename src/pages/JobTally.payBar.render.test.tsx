// @vitest-environment jsdom
/**
 * Punch list #72, the pay bar's gate as JobTally wires it (v2.5118). The Team queue gets
 * `canMarkPayroll` from the value My card's Mark payroll uses (`canMarkTallyPayroll` over
 * `usePeopleAccess`): an assistant gets false, so no bar; a pay-approved master, a controller and a
 * dev get true. The queue is a probe here; its own smoke covers the bar.
 *
 * Punch list #184, sweep C: My card's three empty states name their press. The unlinked scope's
 * Show all, the card filter's Show all cards and the search's Clear the search each bring the rows back.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'

let mockRole = 'assistant'
let mockCanAccessPay = false
let mockTxRows: unknown[] = []
let mockCards: unknown[] = []

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({})
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return {
    supabase: {
      ...stub,
      // JobTally reads its own role from `users`; everything else reads empty.
      from: (table: string) =>
        table === 'users'
          ? { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: mockRole }, error: null }) }) }) }
          : stub.from(),
      // My card's chips read the linked cards; every other RPC reads as the stub does.
      rpc: (fn: string, ...rest: unknown[]) =>
        fn === 'list_my_linked_mercury_debit_cards_for_tally'
          ? Promise.resolve({ data: mockCards, error: null })
          : (stub.rpc as (...args: unknown[]) => unknown)(fn, ...rest),
    },
  }
})
vi.mock('../lib/tally/fetchTallyLinkedMercuryRows', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/tally/fetchTallyLinkedMercuryRows')>()),
  fetchTallyLinkedMercuryRows: () => Promise.resolve(mockTxRows),
}))
vi.mock('../hooks/usePeopleAccess', () => ({ usePeopleAccess: () => ({ canAccessPay: mockCanAccessPay }) }))
vi.mock('../components/tally/TallyTeamQueue', () => ({
  TallyTeamQueue: (p: { canMarkPayroll?: boolean }) => (
    <div data-testid="team-queue-probe" data-can-mark-payroll={String(p.canMarkPayroll === true)} />
  ),
}))

const { default: JobTally } = await import('./JobTally')

async function probeFor(role: string, canAccessPay: boolean): Promise<string | null> {
  mockRole = role
  mockCanAccessPay = canAccessPay
  const view = renderWithProviders(<JobTally />)
  const probe = await screen.findByTestId('team-queue-probe')
  const value = probe.getAttribute('data-can-mark-payroll')
  view.unmount()
  return value
}

describe('JobTally → the Team queue’s pay bar gate', () => {
  it('an assistant’s queue may not mark payroll, so it draws no bar', async () => {
    expect(await probeFor('assistant', false)).toBe('false')
  })

  it('a pay-approved master’s and a dev’s queue may', async () => {
    expect(await probeFor('master_technician', true)).toBe('true')
    expect(await probeFor('dev', false)).toBe('true')
  })

  it('a master who is not pay-approved may not', async () => {
    expect(await probeFor('master_technician', false)).toBe('false')
  })
})

/** A charge on a linked card that already went to a job, as `list_my_linked_mercury_transactions_for_tally` returns it. */
function linkedCharge(id: string, cardId: string) {
  return {
    amount: -42.5,
    counterparty_name: 'Hartline Supply',
    currency: 'USD',
    invoices_summary: '',
    job_splits: [{ job_id: 'j1', hcp_number: 'J101', job_name: 'Ridgeway' }],
    jobs_summary: 'J101 · Ridgeway',
    mercury_account_id: 'a1',
    mercury_account_nickname: '',
    mercury_debit_card_id: cardId,
    mercury_id: `m-${id}`,
    mercury_transaction_id: id,
    note: '',
    person_label: 'Smoke Dev',
    posted_at: '2026-10-20T15:00:00Z',
    raw: {},
    tally_user_note: '',
  }
}

describe('JobTally → My card’s empty states name their press', () => {
  it('Show all, Show all cards and Clear the search each bring the rows back', async () => {
    mockRole = 'estimator'
    mockCanAccessPay = false
    mockCards = [
      { mercury_debit_card_id: 'c1', nickname: 'Visa 1111' },
      { mercury_debit_card_id: 'c2', nickname: 'Visa 2222' },
    ]
    mockTxRows = [linkedCharge('t1', 'c1')]
    const view = renderWithProviders(<JobTally />)
    const empty = () => document.querySelector('[data-empty-state]') as HTMLElement | null
    // Every charge has a job, so the unlinked scope (the default) is empty.
    await waitFor(() => expect(empty()?.textContent).toBe('No unlinked transactions. Show all'), { timeout: 20000 })
    fireEvent.click(within(empty()!).getByRole('button', { name: 'Show all' }))
    expect(empty()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show only transactions for Visa 2222' }))
    expect(empty()?.textContent).toBe('No transactions for this card. Show all cards')
    fireEvent.click(within(empty()!).getByRole('button', { name: 'Show all cards' }))
    expect(empty()).toBeNull()
    fireEvent.change(screen.getByLabelText('Search transactions'), { target: { value: 'zzz' } })
    expect(empty()?.textContent).toBe('No transactions match ‘zzz’. Clear the search')
    fireEvent.click(within(empty()!).getByRole('button', { name: 'Clear the search' }))
    expect((screen.getByLabelText('Search transactions') as HTMLInputElement).value).toBe('')
    expect(empty()).toBeNull()
    view.unmount()
    mockTxRows = []
    mockCards = []
  })
})
