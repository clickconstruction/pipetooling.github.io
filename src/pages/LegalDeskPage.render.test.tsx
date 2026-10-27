// @vitest-environment jsdom
/**
 * `/legal-desk` (punch list #182, PR 1): the collections roles see the desk drawn as a page on the account and the tab
 * the address names, a tab press writes the address, and a role outside the set lands on the Dashboard. The desk's
 * own behavior is held by `legal/LegalDesk*.render.test.tsx`; this is the page's wiring.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { makeInvoice, makeJob, renderWithProviders, settle } from '../test/renderSmokeMocks'
import LegalDeskPage from './LegalDeskPage'

const auth = vi.hoisted(() => ({ role: 'dev' as string | null }))
const screenSize = vi.hoisted(() => ({ phone: false }))
const cache = vi.hoisted(() => ({ jobs: [] as unknown[], dataKey: null as string | null, fetchScopeIfNeeded: vi.fn(async () => {}), runFetchScopes: vi.fn(async () => {}), refreshMergedScopes: vi.fn(async () => {}) }))

vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role: auth.role }),
    useOptionalAuth: () => makeUseAuthValue({ role: auth.role }),
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => screenSize.phone }))
vi.mock('../lib/people/fetchActiveUsers', () => ({ fetchActiveUsers: async () => ({ data: [], error: null }) }))
vi.mock('../contexts/JobsListCacheContext', () => ({
  buildJobsListCacheKey: (userId: string, customerFilter: string | null) => `${userId}:${customerFilter || 'all'}`,
  useJobsListCache: () => ({ jobs: cache.jobs, jobsListLoading: false, jobsListDataKey: cache.dataKey, fetchScopeIfNeeded: cache.fetchScopeIfNeeded, runFetchScopes: cache.runFetchScopes, refreshMergedScopes: cache.refreshMergedScopes, mergedScopes: new Set(['billed_all']) }),
  JobsListCacheProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('../hooks/useLegalMatters', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useLegalMatters')>()),
  useLegalMatters: () => ({
    available: false,
    readState: 'ok',
    loading: false,
    firm: null,
    firms: [],
    activeFirms: [],
    countiesByFirm: new Map(),
    matters: [],
    byPayerKey: new Map(),
    byJobId: new Map(),
    jobIdsByMatter: new Map(),
    entriesByMatter: new Map(),
    documentsByMatter: new Map(),
    recipients: [],
    firmPaused: false,
    reload: async () => {},
  }),
}))

function collectionsJob(id: string, hcp: string, amount: number) {
  return makeJob({
    id,
    hcp_number: hcp,
    status: 'billed',
    collections_at: '2026-08-20T15:00:00Z',
    customer_id: 'ridgeway',
    customer_name: 'Ridgeway Builders',
    customer_email: 'ap@ridgeway.test',
    invoices: [makeInvoice({ id: `inv-${id}`, job_id: id, amount, status: 'billed', billed_at: '2026-04-17T12:00:00Z', stripe_invoice_status: 'open' })],
  })
}

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname}{l.search}</output>
}

/** The MemoryRouter starts at `/`; the index route takes us to the address under test, as a pasted link would. */
function Harness({ start }: { start: string }) {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to={start} replace />} />
        <Route path="/legal-desk" element={<LegalDeskPage />} />
        <Route path="/dashboard" element={<p>the Dashboard</p>} />
        <Route path="/jobs" element={<p>the Pipeline</p>} />
      </Routes>
      <Where />
    </>
  )
}

beforeEach(() => {
  auth.role = 'dev'
  screenSize.phone = false
  cache.jobs = [collectionsJob('job-a', '1312', 9000), collectionsJob('job-b', '1287', 5260)]
  // A warm cache: the Pipeline loaded this user's unfiltered board already.
  cache.dataKey = 'smoke-auth-user-1:all'
  cache.fetchScopeIfNeeded.mockClear()
  cache.runFetchScopes.mockClear()
})
afterEach(cleanup)

describe('LegalDeskPage (/legal-desk)', () => {
  it('a dev lands on the account and the tab the address names, drawn as a page with a door back and no window chrome', async () => {
    const { container } = renderWithProviders(<Harness start="/legal-desk?account=c%3Aridgeway&tab=timeline" />)
    await settle()
    await waitFor(() => expect(container.querySelector('[data-legal-desk-panel="page"]')).not.toBeNull())
    expect(screen.getByRole('tab', { name: 'Timeline' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByText('Ridgeway Builders').length).toBeGreaterThan(0)
    expect(container.querySelector('[data-legal-desk-back]')).not.toBeNull()
    expect(screen.queryByRole('dialog', { name: /Legal Desk/ })).toBeNull()
    expect(screen.queryByLabelText('Close')).toBeNull()
    expect(screen.queryByLabelText('Full screen')).toBeNull()
    // The page asked the warm cache for the billed scope, nothing more.
    expect(cache.fetchScopeIfNeeded).toHaveBeenCalledWith('billed_all', null)
    expect(cache.runFetchScopes).not.toHaveBeenCalled()
    // The address it opened on is left as it was.
    expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway&tab=timeline')
  })

  it('a tab press writes the address, and the default tab leaves the address', async () => {
    renderWithProviders(<Harness start="/legal-desk" />)
    await settle()
    // The rail's first account is written once it resolves.
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway'))
    fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway&tab=paper'))
    fireEvent.click(screen.getByRole('tab', { name: 'Account' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway'))
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway&view=map'))
  })

  it('an account under Given up on opens and stays open: the address that comes back names it (punch list #182, PR 2)', async () => {
    // Given up on is a Collections job the office marked uncollectible (punch list #94); the board files it apart.
    cache.jobs = [
      collectionsJob('job-a', '1312', 9000),
      { ...collectionsJob('job-g', '1266', 3300), customer_id: 'hollis', customer_name: 'Hollis Mechanical', uncollectible_at: '2026-10-07T03:30:00Z', uncollectible_reason: 'No way to reach them.' },
    ]
    renderWithProviders(<Harness start="/legal-desk" />)
    await settle()
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway'))
    fireEvent.click(screen.getByRole('button', { name: /Hollis Mechanical/ }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Ahollis'))
    await settle()
    // Before the fix the address came back, the lookup missed it, and the desk went back to the first open account.
    expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Ahollis')
    expect(screen.getByText('Given up on — not for the firm')).toBeTruthy()
  })

  it('on a phone (PR 3): the bare address is the list; an account opens as a new entry, and ← Accounts goes back to the list', async () => {
    screenSize.phone = true
    const { container } = renderWithProviders(<Harness start="/legal-desk" />)
    await settle()
    await waitFor(() => expect(container.querySelector('[data-legal-desk-rail]')).not.toBeNull())
    // The list writes nothing: no account is picked for it.
    expect(screen.getByTestId('where').textContent).toBe('/legal-desk')
    expect(screen.queryByRole('tab', { name: 'Account' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Ridgeway Builders/ }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back to the accounts' })).toBeTruthy())
    expect(container.querySelector('[data-legal-desk-rail]')).toBeNull()
    // A tab press rewrites the entry and keeps its place in the history.
    fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway&tab=paper'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to the accounts' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk'))
    await waitFor(() => expect(container.querySelector('[data-legal-desk-rail]')).not.toBeNull())
  })

  it('on a phone, Map on the list is an address with no tab in it, and the map takes the screen in one column (v2.5984)', async () => {
    screenSize.phone = true
    const { container } = renderWithProviders(<Harness start="/legal-desk" />)
    await settle()
    await waitFor(() => expect(container.querySelector('[data-legal-desk-rail]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Ridgeway Builders/ }))
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Paper' })).toBeTruthy())
    fireEvent.click(screen.getByRole('tab', { name: 'Paper' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?account=c%3Aridgeway&tab=paper'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to the accounts' }))
    await waitFor(() => expect(container.querySelector('[data-legal-desk-rail]')).not.toBeNull())
    // Live on 2026-10-27 the list wrote nothing, so a phone's Map had no address, and its legend left the map 27 px.
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk?view=map'))
    expect((container.querySelector('[data-legal-map-grid]') as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr)')
    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk'))
    await waitFor(() => expect(container.querySelector('[data-legal-desk-rail]')).not.toBeNull())
  })

  it('on a phone, an account reached by a link goes to the list in its own place', async () => {
    screenSize.phone = true
    const { container } = renderWithProviders(<Harness start="/legal-desk?account=c%3Aridgeway" />)
    await settle()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back to the accounts' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Back to the accounts' }))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/legal-desk'))
    await waitFor(() => expect(container.querySelector('[data-legal-desk-rail]')).not.toBeNull())
  })

  it('a role outside the collections set lands on the Dashboard', async () => {
    auth.role = 'estimator'
    renderWithProviders(<Harness start="/legal-desk?account=c%3Aridgeway" />)
    await settle()
    await waitFor(() => expect(screen.getByText('the Dashboard')).toBeTruthy())
    expect(cache.fetchScopeIfNeeded).not.toHaveBeenCalled()
    expect(cache.runFetchScopes).not.toHaveBeenCalled()
  })

  it('on a cold cache, or one holding another customer filter, the page takes the scoped first load for the billed scope alone', async () => {
    cache.dataKey = null
    renderWithProviders(<Harness start="/legal-desk" />)
    await settle()
    await waitFor(() => expect(cache.runFetchScopes).toHaveBeenCalledWith(['billed_all'], null))
    expect(cache.fetchScopeIfNeeded).not.toHaveBeenCalled()
    cleanup()
    cache.dataKey = 'smoke-auth-user-1:cust-9'
    cache.runFetchScopes.mockClear()
    renderWithProviders(<Harness start="/legal-desk" />)
    await settle()
    await waitFor(() => expect(cache.runFetchScopes).toHaveBeenCalledWith(['billed_all'], null))
  })
})
