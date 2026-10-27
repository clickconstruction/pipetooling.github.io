// @vitest-environment jsdom
/**
 * The go-anywhere box (punch list #181, PR 2): the door groups under today's rows, the lit first row, Tab between
 * groups, the prefix, the role gate and Recent. The data search is the supabase stub, which answers nothing, so every
 * row here is a door.
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
// The guides and the punch list are Vite-only sources the box loads once the role lands (punch list #181, PR 3): two
// guides and one row here, so a smoke never reaches the real registry or the build-time board.
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

describe('HeaderGlobalSearch — go anywhere', () => {
  it('a Settings card by name is a row under Settings, lit first, and Enter lands on its anchor', async () => {
    renderWithProviders(<Box />)
    const box = await openAndType('office hours')
    const group = await screen.findByTestId('go-anywhere-group-settings')
    expect(group.textContent).toContain('Settings')
    const door = screen.getByTestId('go-anywhere-door-dev:settings-phone-texts-hours')
    expect(door.textContent).toContain('Office hours')
    expect(door.textContent).toContain('Settings')
    // Lit without an arrow: the combobox points at the first row.
    expect(box.getAttribute('aria-activedescendant')).toBe('header-search-option-0')
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/settings?tab=settings-phone-texts#settings-phone-texts-hours'))
    // The box closed and the door is remembered on this device.
    expect(screen.queryByRole('combobox', { name: 'Search query' })).toBeNull()
    expect(localStorage.getItem(recentDoorsKey(SMOKE_AUTH_USER_ID))).toContain('dev:settings-phone-texts-hours')
  })

  it('a number alone draws no door, and says what the box looks in', async () => {
    renderWithProviders(<Box />)
    await openAndType('1418')
    await waitFor(() => expect(screen.getByText(/No matches\./).textContent).toContain('The box looks in'))
    expect(screen.queryByTestId(/go-anywhere-group-/)).toBeNull()
  })

  it('the > prefix shows places alone, and Tab jumps to the next group', async () => {
    renderWithProviders(<Box />)
    const box = await openAndType('> bill')
    await screen.findByTestId('go-anywhere-group-page')
    expect(screen.getByTestId('go-anywhere-door-page:/jobs?tab=billing').textContent).toContain('Billing')
    const settings = screen.getByTestId('go-anywhere-group-settings')
    expect(settings).toBeTruthy()
    expect(box.getAttribute('aria-activedescendant')).toBe('header-search-option-0')
    fireEvent.keyDown(box, { key: 'Tab' })
    await settle()
    const lit = box.getAttribute('aria-activedescendant')!
    const litRow = document.getElementById(lit)!
    // The lit row is now the Settings group's first row.
    expect(litRow.querySelector('[data-testid^="go-anywhere-door-settings"]')).toBeTruthy()
    // The keys line says the keys once, on a desk.
    expect(screen.getByText('Tab next group')).toBeTruthy()
  })

  it('an assistant never sees a door the role cannot open, and the phone draws no keys line', async () => {
    auth.overrides = { role: 'assistant', estimatorProspectsAccess: false, teamProspectsAccess: false }
    renderWithProviders(<Box isMobile />)
    await openAndType('punch list')
    await waitFor(() => expect(screen.getByText(/No matches\./)).toBeTruthy())
    expect(screen.queryByTestId('go-anywhere-door-page:/punch-list')).toBeNull()
    expect(screen.queryByText('Tab next group')).toBeNull()
  })

  it('the empty box lists the doors this device remembers, newest first', async () => {
    localStorage.setItem(recentDoorsKey(SMOKE_AUTH_USER_ID), JSON.stringify(['page:/jobs?tab=billing', 'dev:settings-phone-texts-hours', 'gone:door']))
    renderWithProviders(<Box />)
    fireEvent.click(screen.getByRole('button', { name: /search jobs/i }))
    await settle()
    const recent = await screen.findByTestId('go-anywhere-group-recent')
    expect(recent.textContent).toContain('Recent')
    const rows = screen.getAllByTestId(/^go-anywhere-door-/).map((el) => el.getAttribute('data-testid'))
    expect(rows).toEqual(['go-anywhere-door-page:/jobs?tab=billing', 'go-anywhere-door-dev:settings-phone-texts-hours'])
  })
})
