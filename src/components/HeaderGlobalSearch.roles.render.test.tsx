// @vitest-environment jsdom
/**
 * The go-anywhere box for every role (punch list #181, PR 4): the estimator, the primary and the superintendent get the
 * doors alone, with no job, bid, estimate or customer read; a helper keeps the job lookup and gains the guides for the
 * role, and nothing else. Its own file, so this PR never edits the smokes PR 2 and PR 3 added.
 */
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'

const auth = vi.hoisted(() => ({ overrides: {} as Record<string, unknown> }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue(auth.overrides),
    useOptionalAuth: () => makeUseAuthValue(auth.overrides),
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }
})
// The two Vite-only sources the box loads once the role lands: two guides and one row.
vi.mock('../lib/helpGuideRegistry', () => ({
  HELP_GUIDES: [
    { slug: 'bill-a-customer-and-get-paid', title: 'bill a customer and get paid', category: 'Billing & Money', roles: 'all', keywords: ['bill', 'invoice'], order: 1, where: '/jobs?tab=billing', body: 'x' },
    { slug: 'send-lien-notices-from-the-lien-desk', title: 'send lien notices from the Lien desk', category: 'Billing & Money', roles: ['dev', 'master_technician', 'assistant', 'controller'], keywords: ['lien desk'], order: 2, body: 'x' },
  ],
}))
vi.mock('virtual:punch-list', () => ({
  default: { validated: { date: '2026-10-26', version: 'v2.5900' }, openItems: 1, items: [{ slug: 'quick-replies-by-keyboard', number: 126, group: 'gated', name: 'Quick replies by keyboard, and a starter set for the office', file: 'to-dos/quick-replies-by-keyboard/README.md', pointer: false, flagged: false, summary: '', next: '', size: '', blocker: '', ver: '', opinion: '', mockups: [], artifacts: [], mockup: 'has', mockupNote: '' }] },
}))

import { HeaderGlobalSearchNavLayer, HeaderGlobalSearchOpenButton, HeaderGlobalSearchProvider } from './HeaderGlobalSearch'
import { renderWithProviders, settle, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'
import { supabase } from '../lib/supabase'

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{`${loc.pathname}${loc.search}${loc.hash}`}</div>
}

function Box({ fieldLookup = false, doorsOnly = false }: { fieldLookup?: boolean; doorsOnly?: boolean }) {
  return (
    <HeaderGlobalSearchProvider enabled fieldLookup={fieldLookup} doorsOnly={doorsOnly} authUserId={SMOKE_AUTH_USER_ID} navOverlayBackground="var(--chrome-bg)" isMobile={false}>
      <div style={{ position: 'relative' }}>
        <HeaderGlobalSearchOpenButton placement="toolbar" isMobile={false} />
        <HeaderGlobalSearchNavLayer />
      </div>
      <Where />
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

/** Longer than the box's 300 ms debounce, so a data search that was going to run has run. */
const pastTheDebounce = () => new Promise((r) => setTimeout(r, 450))

const as = (role: string) => {
  auth.overrides = { role, estimatorProspectsAccess: false, teamProspectsAccess: false }
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('HeaderGlobalSearch — the box for every role', () => {
  it('an estimator gets the doors alone: the Pricing tab by name, and no job, bid or customer read', async () => {
    as('estimator')
    const rpc = vi.spyOn(supabase, 'rpc')
    renderWithProviders(<Box doorsOnly />)
    const box = await openAndType(/find a page, a setting or a guide/i, 'pricing')
    expect(box.getAttribute('placeholder')).toBe('Pages, settings, guides…')
    await screen.findByTestId('go-anywhere-group-page')
    expect(screen.getByTestId('go-anywhere-door-page:/bids?tab=pricing').textContent).toContain('Pricing')
    fireEvent.change(box, { target: { value: '1418' } })
    await pastTheDebounce()
    await waitFor(() => expect(screen.getByText(/No matches\./).textContent).toBe('No matches. The box looks in pages, settings and guides.'))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('an estimator sees a guide for everyone without its Go there, since the Billing tab is not a door for the role', async () => {
    as('estimator')
    renderWithProviders(<Box doorsOnly />)
    await openAndType(/find a page, a setting or a guide/i, 'bill')
    const row = await screen.findByTestId('go-anywhere-door-guide:bill-a-customer-and-get-paid')
    expect(row.textContent).toContain('bill a customer and get paid')
    expect(screen.queryByTestId('go-anywhere-there-guide:bill-a-customer-and-get-paid')).toBeNull()
    expect(screen.queryByTestId('go-anywhere-door-page:/jobs?tab=billing')).toBeNull()
    // The lien guide is the office's: not drawn.
    expect(screen.queryByTestId('go-anywhere-door-guide:send-lien-notices-from-the-lien-desk')).toBeNull()
  })

  it('a helper keeps the job lookup and gains the guides for the role, and no page', async () => {
    as('helpers')
    const rpc = vi.spyOn(supabase, 'rpc')
    renderWithProviders(<Box fieldLookup />)
    const box = await openAndType(/^find a job$/i, 'bill')
    expect(box.getAttribute('placeholder')).toBe('Job number, name, address or a guide…')
    await screen.findByTestId('go-anywhere-group-guide')
    expect(screen.getByTestId('go-anywhere-door-guide:bill-a-customer-and-get-paid')).toBeTruthy()
    expect(screen.queryByTestId('go-anywhere-group-page')).toBeNull()
    await pastTheDebounce()
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('search_jobs_ledger', { search_text: 'bill' }))
    fireEvent.change(box, { target: { value: 'dashboard' } })
    await waitFor(() => expect(screen.getByText(/No matches\./).textContent).toBe('No matches. The box looks in your jobs and the guides for your role.'))
  })

  it('a superintendent and a primary each see the tabs their own gates open', async () => {
    as('superintendent')
    const { unmount } = renderWithProviders(<Box doorsOnly />)
    await openAndType(/find a page, a setting or a guide/i, 'reports')
    expect(await screen.findByTestId('go-anywhere-door-page:/jobs?tab=reports')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Search query' }), { target: { value: 'billing' } })
    await settle()
    expect(screen.queryByTestId('go-anywhere-door-page:/jobs?tab=billing')).toBeNull()
    unmount()

    as('primary')
    renderWithProviders(<Box doorsOnly />)
    await openAndType(/find a page, a setting or a guide/i, 'rfi')
    const rfi = await screen.findByTestId('go-anywhere-door-page:/bids?tab=rfi')
    fireEvent.change(screen.getByRole('combobox', { name: 'Search query' }), { target: { value: 'pricing' } })
    await settle()
    expect(screen.queryByTestId('go-anywhere-door-page:/bids?tab=pricing')).toBeNull()
    expect(rfi).toBeTruthy()
  })
})
