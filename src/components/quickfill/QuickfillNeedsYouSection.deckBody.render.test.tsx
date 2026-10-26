// @vitest-environment jsdom
/**
 * The Fill them in deck as Today's lines' body (v2.5907, punch list #178, D's PR 1): with rows
 * the station opens on the deck's first row and draws the viewer's other lines under it, the
 * station's Next line is that row, Cards is one chip away and stays once chosen; while the rows
 * are still being read the deck says so; and a read that ends with nothing to fill opens the
 * card as before.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { lostBidFillInRows, type LostBidSource } from '../../lib/needsYou/fillInLostBids'
import type { FillInRow } from '../../hooks/useFillInRows'
import { JobsListCacheProvider } from '../../contexts/JobsListCacheContext'
import { QuickfillNeedsYouSection } from './QuickfillNeedsYouSection'

const navigate = vi.fn()
const nextLines: Array<string | null> = []
const fill: { rows: FillInRow[]; loading: boolean } = { rows: [], loading: false }

const bid = (id: string, value: number, project: string): LostBidSource => ({
  id,
  bid_number: id.replace('bid-', ''),
  project_name: project,
  customer_id: 'gc-1',
  bid_value: value,
  outcome: 'lost',
  outcome_at: '2026-09-30T15:00:00Z',
  bid_date_sent: '2026-08-14T15:00:00Z',
  last_contact: null,
  loss_category: null,
  loss_reason: null,
  adopted_into_bid_id: null,
  customers: { name: 'Ridgeway Builders' },
  bids_gc_builders: null,
})

const section = () => (
  <JobsListCacheProvider>
    <QuickfillNeedsYouSection onNextLine={(l) => nextLines.push(l)} />
  </JobsListCacheProvider>
)

vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => navigate }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: 'assistant' }), AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn(), recordNavClickFromEvent: vi.fn() }))
// A line the deck cannot fill, so it sits under the deck: the bank deposits.
vi.mock('../../hooks/useArBankUnallocatedCount', async (orig) => ({
  ...(await orig<typeof import('../../hooks/useArBankUnallocatedCount')>()),
  useArBankUnallocatedCount: () => ({ count: 2, refetch: async () => {} }),
}))
vi.mock('../../hooks/useFillInRows', () => ({
  useFillInRows: () => ({ rows: fill.rows, loading: fill.loading, reload: vi.fn(), drop: vi.fn(), restore: vi.fn() }),
}))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  nextLines.length = 0
  navigate.mockClear()
})

describe('QuickfillNeedsYouSection · the deck as the body (v2.5907, punch list #178)', () => {
  it('with rows the station opens on the first row, the other lines sit under it, and the Next line is the row', async () => {
    fill.rows = lostBidFillInRows([bid('bid-412', 84_300, 'Oak Street clinic'), bid('bid-398', 41_000, 'Pinecrest warehouse')])
    fill.loading = false
    renderWithProviders(section())
    await settle()
    expect(screen.getByRole('button', { name: 'Save and next' })).toBeTruthy()
    expect(screen.getByText(/Oak Street clinic/)).toBeTruthy()
    // The viewer's line the deck cannot fill, under the deck with its own button.
    expect(screen.getByText('Your other line')).toBeTruthy()
    expect(screen.getByText('Allocate 2 bank deposits')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Match deposits' })).toBeTruthy()
    expect(nextLines[nextLines.length - 1]).toBe(fill.rows[0]!.title)
  })

  it('Cards is one chip away and stays for the visit once chosen', async () => {
    fill.rows = lostBidFillInRows([bid('bid-412', 84_300, 'Oak Street clinic')])
    fill.loading = false
    const { rerender } = renderWithProviders(section())
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Cards view' }))
    expect(screen.queryByRole('button', { name: 'Save and next' })).toBeNull()
    expect(screen.getByText('Allocate 2 bank deposits')).toBeTruthy()
    expect(screen.queryByText('Your other line')).toBeNull()
    rerender(section())
    await settle()
    expect(screen.queryByRole('button', { name: 'Save and next' })).toBeNull()
    // The deck is still one chip away.
    expect(screen.getByRole('button', { name: 'Fill them in · 1 row view' })).toBeTruthy()
  })

  it('while the rows are being read the deck says so; a read that ends empty opens the card', async () => {
    fill.rows = []
    fill.loading = true
    const { rerender } = renderWithProviders(section())
    await settle()
    expect(screen.getByText('Reading the rows…')).toBeTruthy()
    fill.loading = false
    rerender(section())
    await settle()
    expect(screen.queryByText('Reading the rows…')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save and next' })).toBeNull()
    expect(screen.getByText('Allocate 2 bank deposits')).toBeTruthy()
    expect(nextLines[nextLines.length - 1]).toBe('Allocate 2 bank deposits')
  })
})
