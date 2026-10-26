// @vitest-environment jsdom
/**
 * The go-anywhere box's guides and punch list (punch list #181, PR 3): a question finds the guide, Go there lands on
 * its page, and # finds a to-do for the owner and the developers alone. Its own file, so this PR never edits the
 * box's first smoke, which PR 2 added.
 */
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
// The guides and the punch list are Vite-only modules the box loads on its first open (PR 3): two guides and one row.
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
import { recentDoorsKey } from '../lib/search/recentDoors'

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{`${loc.pathname}${loc.search}${loc.hash}`}</div>
}

function Box({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <HeaderGlobalSearchProvider enabled authUserId={SMOKE_AUTH_USER_ID} navOverlayBackground="var(--chrome-bg)" isMobile={isMobile}>
      <div style={{ position: 'relative' }}>
        <HeaderGlobalSearchOpenButton placement={isMobile ? 'strip' : 'toolbar'} isMobile={isMobile} />
        <HeaderGlobalSearchNavLayer />
      </div>
      <Where />
    </HeaderGlobalSearchProvider>
  )
}

async function openAndType(words: string) {
  fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))
  await settle()
  const box = screen.getByRole('combobox', { name: 'Search query' })
  fireEvent.change(box, { target: { value: words } })
  await settle()
  return box
}

beforeEach(() => {
  auth.overrides = { role: 'dev', estimatorProspectsAccess: false, teamProspectsAccess: false }
  localStorage.clear()
})

describe('HeaderGlobalSearch — guides and the punch list', () => {
  it('a question finds the guide, and Go there lands on the page the guide is about', async () => {
    renderWithProviders(<Box />)
    await openAndType('how do I bill a customer')
    const guides = await screen.findByTestId('go-anywhere-group-guide')
    expect(guides.textContent).toContain('Guides')
    const row = screen.getByTestId('go-anywhere-door-guide:bill-a-customer-and-get-paid')
    expect(row.textContent).toContain('bill a customer and get paid')
    // The Pages group comes first, lit; the guide's row carries its second press.
    expect(screen.getByTestId('go-anywhere-door-page:/jobs?tab=billing')).toBeTruthy()
    fireEvent.click(screen.getByTestId('go-anywhere-there-guide:bill-a-customer-and-get-paid'))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/jobs?tab=billing'))
  })

  it('# finds a to-do for the owner and the developers, and nothing for an assistant', async () => {
    renderWithProviders(<Box />)
    await openAndType('# quick')
    const todos = await screen.findByTestId('go-anywhere-group-todo')
    expect(todos.textContent).toContain('Punch list')
    const row = screen.getByTestId('go-anywhere-door-todo:126')
    expect(row.textContent).toContain('#126 Quick replies by keyboard')
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/punch-list#n126'))
  })

  it('an assistant typing # gets no to-do, since the board is not a door for that role', async () => {
    auth.overrides = { role: 'assistant', estimatorProspectsAccess: false, teamProspectsAccess: false }
    renderWithProviders(<Box />)
    await openAndType('# quick')
    await waitFor(() => expect(screen.getByText(/No matches\./)).toBeTruthy())
    expect(screen.queryByTestId('go-anywhere-group-todo')).toBeNull()
  })

})
