// @vitest-environment jsdom
/**
 * A failed read is not "no matches" (v2.6434, the header's side of v2.6410's Pipeline fix). The header box reads
 * jobs, bids, estimates and customers from the server; when one of those reads failed, by a lost signal or a
 * refusal, the box read `data ?? []` and said *No matches. The box looks in jobs, bids, …*. Now it keeps whatever
 * came back, says which kinds were not searched and why, offers Retry for a lost signal, and says *No matches*
 * only when every read answered. Its own file, so this PR never edits the smokes the go-anywhere PRs added.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const auth = vi.hoisted(() => ({ overrides: {} as Record<string, unknown> }))

type Answer = { data: unknown; error: unknown }
/** What each server read answers, by the RPC's name or `customers`: each call takes the next answer, the last repeats. */
const reads = vi.hoisted(() => ({ answers: {} as Record<string, Answer[]>, calls: [] as string[] }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const base = makeSupabaseStub()
  const answer = (name: string) => {
    reads.calls.push(name)
    const list = reads.answers[name]
    const a: Answer = list ? (list.length > 1 ? list.shift()! : (list[0] ?? { data: [], error: null })) : { data: [], error: null }
    const p = Promise.resolve({ ...a, count: 0 })
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'ilike', 'order', 'limit', 'eq', 'in']) builder[m] = () => builder
    builder.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => p.then(f, r)
    builder.catch = (r?: (e: unknown) => unknown) => p.catch(r)
    builder.finally = (f?: () => void) => p.finally(f)
    return builder
  }
  return {
    supabase: {
      ...base,
      rpc: (name: string) => answer(name),
      from: (table: string) => (table === 'customers' ? answer('customers') : base.from()),
    },
  }
})
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue(auth.overrides),
    useOptionalAuth: () => makeUseAuthValue(auth.overrides),
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})
// The two Vite-only sources the box loads once the role lands: one guide, no punch-list rows.
vi.mock('../lib/helpGuideRegistry', () => ({
  HELP_GUIDES: [
    { slug: 'bill-a-customer-and-get-paid', title: 'bill a customer and get paid', category: 'Billing & Money', roles: 'all', keywords: ['bill', 'invoice'], order: 1, where: '/jobs?tab=billing', body: 'x' },
  ],
}))
vi.mock('virtual:punch-list', () => ({
  default: { validated: { date: '2026-10-26', version: 'v2.5900' }, openItems: 0, items: [] },
}))

import { HeaderGlobalSearchNavLayer, HeaderGlobalSearchOpenButton, HeaderGlobalSearchProvider } from './HeaderGlobalSearch'
import { renderWithProviders, settle, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'

/** The error a Supabase result carries when the fetch layer never reached the server. */
const LOST_SIGNAL: Answer = { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' } }
/** The error a Supabase result carries when RLS refuses the read. */
const REFUSED: Answer = { data: null, error: { message: 'permission denied for function search_jobs_ledger', details: null, hint: null, code: '42501' } }
const NONE: Answer = { data: [], error: null }
// Plain names: a dev's box hides ZZ test jobs by name, so a ZZ job would never be a row here.
const ONE_JOB: Answer = { data: [{ id: 'job-1', hcp_number: '1004', click_number: null, job_name: 'Oakmont Ridge', job_address: '1 Oakmont Dr' }], error: null }
const ONE_BID: Answer = { data: [{ id: 'bid-1', bid_number: 'B352', project_name: 'Oakmont Ridge', address: '1 Oakmont Dr', customer_name: 'Acme' }], error: null }

const OLD_NO_MATCHES = /^No matches\./

function Box({ fieldLookup = false }: { fieldLookup?: boolean }) {
  return (
    <HeaderGlobalSearchProvider enabled fieldLookup={fieldLookup} authUserId={SMOKE_AUTH_USER_ID} navOverlayBackground="var(--chrome-bg)" isMobile={false}>
      <div style={{ position: 'relative' }}>
        <HeaderGlobalSearchOpenButton placement="toolbar" isMobile={false} />
        <HeaderGlobalSearchNavLayer />
      </div>
    </HeaderGlobalSearchProvider>
  )
}

async function openAndType(buttonName: RegExp, words: string) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }))
  await settle()
  const box = screen.getByRole('combobox', { name: 'Search query' })
  fireEvent.change(box, { target: { value: words } })
  await settle()
  return box
}

/** The box debounces 300 ms before it reads; a `findBy*` outlasts that. */
const failedPanel = () => screen.findByTestId('header-search-failed-reads')

beforeEach(() => {
  auth.overrides = { role: 'dev', estimatorProspectsAccess: false, teamProspectsAccess: false }
  reads.answers = {}
  reads.calls = []
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('HeaderGlobalSearch — a failed read says why', () => {
  it('a jobs read lost to the signal: jobs were not searched, Retry, and never No matches', async () => {
    reads.answers = { search_jobs_ledger: [LOST_SIGNAL] }
    renderWithProviders(<Box />)
    await openAndType(/search jobs/i, 'oakmont')
    const panel = await failedPanel()
    expect(panel.textContent).toContain('Jobs were not searched.')
    expect(panel.textContent).toContain('No connection, so they were not searched. The search runs again when the signal is back.')
    expect(panel.textContent).toContain('Nothing matched in bids, estimates, customers, pages, settings and guides.')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByText(OLD_NO_MATCHES)).toBeNull()
  })

  it('the reads that answered still draw their rows, and the failed line sits under them', async () => {
    reads.answers = { search_jobs_ledger: [LOST_SIGNAL], search_bids_for_clock: [ONE_BID] }
    renderWithProviders(<Box />)
    await openAndType(/search jobs/i, 'oakmont')
    const panel = await failedPanel()
    expect(screen.getByRole('listbox', { name: 'Search results' }).textContent).toContain('B352')
    expect(panel.textContent).toContain('Jobs were not searched.')
    // A row is on the screen, so the panel never says nothing matched.
    expect(panel.textContent).not.toContain('Nothing matched')
    expect(screen.queryByText(OLD_NO_MATCHES)).toBeNull()
  })

  it('a refusal shows its reason with no Retry', async () => {
    reads.answers = { search_jobs_ledger: [REFUSED] }
    renderWithProviders(<Box />)
    await openAndType(/search jobs/i, 'oakmont')
    const panel = await failedPanel()
    expect(panel.textContent).toContain('Jobs were not searched.')
    expect(panel.textContent).toContain("Could not search jobs. You don't have access to this record.")
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByText(OLD_NO_MATCHES)).toBeNull()
  })

  it('four reads lost to one signal are one line with one Retry', async () => {
    reads.answers = { search_jobs_ledger: [LOST_SIGNAL], search_bids_for_clock: [LOST_SIGNAL], search_estimates_for_nav: [LOST_SIGNAL], customers: [LOST_SIGNAL] }
    renderWithProviders(<Box />)
    await openAndType(/search jobs/i, 'oakmont')
    const panel = await failedPanel()
    expect(panel.textContent).toContain('Jobs, bids, estimates and customers were not searched.')
    expect(panel.textContent).toContain('Nothing matched in pages, settings and guides.')
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1)
  })

  it('Retry runs the search again, and a read that answers takes its line away', async () => {
    reads.answers = { search_jobs_ledger: [LOST_SIGNAL, ONE_JOB] }
    renderWithProviders(<Box />)
    await openAndType(/search jobs/i, 'oakmont')
    await failedPanel()
    const before = reads.calls.filter((c) => c === 'search_jobs_ledger').length
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Search results' }).textContent).toContain('Oakmont Ridge'))
    expect(reads.calls.filter((c) => c === 'search_jobs_ledger').length).toBe(before + 1)
    expect(screen.queryByTestId('header-search-failed-reads')).toBeNull()
  })

  it('a field role’s lookup says your jobs were not searched, and what it did look in', async () => {
    auth.overrides = { role: 'helpers', estimatorProspectsAccess: false, teamProspectsAccess: false }
    reads.answers = { search_jobs_ledger: [LOST_SIGNAL] }
    renderWithProviders(<Box fieldLookup />)
    await openAndType(/find a job/i, 'oakmont')
    const panel = await failedPanel()
    expect(panel.textContent).toContain('Your jobs were not searched.')
    expect(panel.textContent).toContain('Nothing matched in the guides for your role.')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByText(OLD_NO_MATCHES)).toBeNull()
  })

  it('when every read answers and nothing matched, the box still says No matches', async () => {
    reads.answers = { search_jobs_ledger: [NONE], search_bids_for_clock: [NONE], search_estimates_for_nav: [NONE], customers: [NONE] }
    renderWithProviders(<Box />)
    await openAndType(/search jobs/i, 'oakmont')
    await waitFor(() => expect(screen.getByText(OLD_NO_MATCHES).textContent).toContain('The box looks in'))
    expect(screen.queryByTestId('header-search-failed-reads')).toBeNull()
  })
})
