// @vitest-environment jsdom
/**
 * Render smoke for punch list #217's dev side-by-side on the Team queue: a dev who opens
 * `/tally?tab=transactions&sbs=1` sees each day card twice, today's look over the card with the
 * strip, on the same live day, and a pick on one shows on both. An assistant with the same URL,
 * and a dev without it, see the page as it is. Made-up names.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ToastProvider } from '../../contexts/ToastContext'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { installDomShims, makeUseAuthValue, settle } from '../../test/renderSmokeMocks'
import type { TallyTeamQueueReads } from '../../lib/tally/fetchTallyTeamQueue'
import type { StaleStaffRow } from '../../lib/tally/teamPurchaseRows'

let role: 'dev' | 'assistant' = 'dev'
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => makeUseAuthValue({ role }),
  useOptionalAuth: () => makeUseAuthValue({ role }),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: () => ({}) } }))
vi.mock('../../hooks/useOverheadOfficeJobId', () => ({ useOverheadOfficeJobId: () => 'job-office' }))
vi.mock('../../hooks/useMercuryLedgerNicknames', () => ({
  useMercuryLedgerNicknames: () => ({ nicknameByAccount: {}, nicknameByDebitCard: {} }),
}))
vi.mock('../../hooks/useStaleTallyStaffFollowUp', () => ({
  useStaleTallyStaffFollowUp: () => ({ peopleCount: 1, transactionCount: 1, refetch: vi.fn(async () => {}) }),
}))
vi.mock('../MercuryTransactionAllocationsModal', () => ({ MercuryTransactionAllocationsModal: () => null }))
vi.mock('../MercuryTransactionInvoiceLinkModal', () => ({ default: () => null }))
vi.mock('../pay/PersonOffsetFormModal', () => ({ PersonOffsetFormModal: () => null }))

const at = (hm: string) => `2026-09-30T${hm}:00-05:00`
const staffRow = (id: string, hm: string, amount: number, store: string): StaleStaffRow =>
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
    raw: { mercuryCategory: 'Retail', createdAt: new Date(at(hm)).toISOString() },
    job_splits: [],
  }) as StaleStaffRow

const READS: TallyTeamQueueReads = {
  queue: [staffRow('t-parts', '09:15', -88.2, 'Ridge Supply'), staffRow('t-fuel', '19:40', -31.47, 'Corner Fuel')],
  history: [],
  sessions: [{ user_id: 'u-ann', work_date: '2026-09-30', job_ledger_id: 'job-a', clocked_in_at: at('07:10'), clocked_out_at: at('16:40') }],
  schedule: [],
}

vi.mock('../../lib/tally/fetchTallyTeamQueue', () => ({
  TALLY_TEAM_SORTED_WINDOW_DAYS: 30,
  fetchTallyTeamQueue: vi.fn(async () => READS),
  fetchRecentlySortedTeamPurchases: vi.fn(async () => []),
  fetchTallyJobLabels: vi.fn(async () => ({ 'job-a': 'JP101 · Hill Street', 'job-office': '000 · Office' })),
}))

const { TallyTeamQueue } = await import('./TallyTeamQueue')

/** `renderWithProviders`, with the page's URL. */
function renderAt(url: string, ui: ReactElement) {
  installDomShims()
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ToastProvider>
        <ConfirmDialogProvider>
          <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {children}
          </MemoryRouter>
        </ConfirmDialogProvider>
      </ToastProvider>
    ),
  })
}

const open = async (url: string) => {
  renderAt(url, <TallyTeamQueue />)
  await screen.findAllByTestId('tally-team-day-card')
  await settle()
  await screen.findAllByText(/JP101 · Hill Street/)
}

beforeEach(() => {
  role = 'dev'
  localStorage.clear()
})

describe('TallyTeamQueue, the dev side-by-side', () => {
  it('with ?sbs=1, a dev sees today’s card over the card with the strip, and a pick shows on both', async () => {
    await open('/tally?tab=transactions&sbs=1')
    const frame = screen.getByTestId('prototype-side-by-side')
    expect(frame.textContent?.startsWith('Today')).toBe(true)
    expect(frame.textContent).toContain('With the strip')
    const [todayCard, stripCard] = within(frame).getAllByTestId('tally-team-day-card')
    expect(within(todayCard!).queryByTestId('tally-day-strip')).toBeNull()
    expect(within(todayCard!).queryAllByTestId('tally-team-place')).toHaveLength(0)
    expect(within(stripCard!).getByTestId('tally-day-strip')).toBeTruthy()
    expect(within(stripCard!).getAllByTestId('tally-team-place').map((p) => p.getAttribute('data-place'))).toEqual(['inside', 'after'])
    // The switch itself stays off: the comparison is the URL's, not the person's.
    expect(screen.getByTestId('tally-team-day-strip-toggle').getAttribute('aria-pressed')).toBe('false')
    // One day, one set of picks: the strip card's chip picks for the line on both drawings.
    fireEvent.click(within(stripCard!).getAllByTestId('tally-team-place')[0]!)
    expect(within(todayCard!).getByTestId('tally-team-sort-day').textContent).toBe('Sort 1 charge')
    expect(within(stripCard!).getByTestId('tally-team-sort-day').textContent).toBe('Sort 1 charge')
    // Two drawings, two sets of line ids, so a tick's press finds its own line.
    const ids = [...document.querySelectorAll('[data-testid="tally-team-line"]')].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('tally-team-line-t-parts-strip')
  })

  it('without ?sbs, a dev sees the page as it is; with it, an assistant does too', async () => {
    await open('/tally?tab=transactions')
    expect(screen.queryByTestId('prototype-side-by-side')).toBeNull()
    expect(screen.getAllByTestId('tally-team-day-card')).toHaveLength(1)
  })

  it('an assistant with ?sbs=1 sees one card and no strip', async () => {
    role = 'assistant'
    await open('/tally?tab=transactions&sbs=1')
    expect(screen.queryByTestId('prototype-side-by-side')).toBeNull()
    expect(screen.getAllByTestId('tally-team-day-card')).toHaveLength(1)
    expect(screen.queryByTestId('tally-day-strip')).toBeNull()
  })
})
