// @vitest-environment jsdom
/**
 * The Person Desk's head row (v2.7813). Imitate and the menu drew in the desk's quiet grey beside two
 * dark neighbours and read as switched off, though both were live. The smoke pins the row's look: every
 * press that is drawn wears the desk's plain press and none is disabled, the menu sits at the row's right
 * edge and opens under it, and a press that cannot work is left off (Imitate where no login is attached).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { PersonDeskHeader } from './PersonDeskHeader'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { PersonDeskViewer } from '../../lib/people/personDeskGates'
import type { PersonKey } from '../../lib/people/personKey'
import type { PersonDeskUserRow } from '../../hooks/usePersonDesk'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => (await import('../../test/renderSmokeMocks')).useAuthModuleMock())
vi.mock('../../lib/people/fetchAllPendingClockSessions', () => ({ fetchAllPendingClockSessions: async () => [] }))
vi.mock('../../lib/people/awayNoteIo', () => ({ loadAwayNote: async () => ({ row: null }) }))
vi.mock('../../lib/loginAsUser', () => ({ loginAsUser: vi.fn() }))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const dev: PersonDeskViewer = { role: 'dev', isDev: true, canAccessPay: true, canAccessHours: true, canAccessVehicles: true, canAccessLicenses: true, canAccessContracts: true, readOnly: false }

const key: PersonKey = {
  userId: 'u-kai',
  personId: 'p-kai',
  payName: 'Kai Moss',
  displayName: 'Kai Moss',
  email: 'kai.moss@example.com',
  role: 'helpers',
  personKind: 'helper',
  archived: false,
  isSub: false,
  gaps: [],
  emailMatchedPersonId: null,
  emailMatchedPersonName: null,
  rosterName: 'Kai Moss',
}

const account = {
  id: 'u-kai',
  name: 'Kai Moss',
  email: 'kai.moss@example.com',
  role: 'helpers',
  archived_at: null,
  read_only: false,
  last_sign_in_at: null,
  estimator_service_type_ids: null,
  primary_service_type_ids: null,
  superintendent_service_type_ids: null,
  subcontractor_service_type_ids: null,
  helpers_service_type_ids: null,
  needs_supervision: null,
  team_prospects_access: null,
  estimator_prospects_access: null,
  counttooling_user_id: null,
  login_attached_at: '2026-09-01T12:00:00Z',
} as unknown as PersonDeskUserRow

async function draw(p: { viewer?: PersonDeskViewer; user?: PersonDeskUserRow | null; personKey?: PersonKey } = {}) {
  renderWithProviders(
    <PersonDeskHeader
      personKey={p.personKey ?? key}
      user={p.user === undefined ? account : p.user}
      person={null}
      viewer={p.viewer ?? dev}
      serviceTypeNames={new Map()}
      changeKey={0}
      onChanged={() => {}}
      onClose={() => {}}
      placeholderName={null}
      onOpenFlow={() => {}}
    />,
  )
  await settle()
  const row = document.querySelector<HTMLElement>('[data-desk-head-presses]')
  const presses = row ? [...row.querySelectorAll<HTMLElement>(':scope > button, :scope > a, :scope > span > button')] : []
  return { row, presses, words: presses.map((el) => (el.textContent ?? '').trim()) }
}

/** The desk's plain press, as the style attribute writes it: dark words, the strong border, the heavy weight. */
function expectLivePress(el: HTMLElement) {
  const style = el.getAttribute('style') ?? ''
  expect(style).toContain('color: var(--text-700)')
  expect(style).toContain('var(--border-strong)')
  expect(style).toContain('font-weight: 600')
  // never the hint grey, never dimmed, never off
  expect(style).not.toContain('var(--text-muted)')
  expect(style).not.toContain('opacity')
  expect(el).not.toHaveProperty('disabled', true)
}

describe('PersonDeskHeader, the row of presses', () => {
  it('draws all four in one weight for a dev on a person who can sign in', async () => {
    const { presses, words } = await draw()
    expect(words).toEqual(['Day · week · month', 'Email', 'Imitate', '⋯'])
    for (const el of presses) expectLivePress(el)
  })

  it('puts the menu at the right edge of the row and opens it under itself', async () => {
    const { row } = await draw()
    const menuPress = within(row!).getByTitle('Start or end employment')
    expect(menuPress.parentElement!.style.marginLeft).toBe('auto')
    fireEvent.click(menuPress)
    const menu = screen.getByRole('menu')
    expect(menu.style.right).toBe('0px')
    expect(menu.style.left).toBe('')
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Start employment…', 'End employment…'])
  })

  it('leaves Imitate off a person with no login attached, and the rest keep their look', async () => {
    const { presses, words } = await draw({ user: { ...account, login_attached_at: null } })
    expect(words).toEqual(['Day · week · month', 'Email', '⋯'])
    for (const el of presses) expectLivePress(el)
  })

  it('leaves Imitate off for a viewer who is not a dev', async () => {
    const { words } = await draw({ viewer: { ...dev, role: 'controller', isDev: false } })
    expect(words).toEqual(['Day · week · month', 'Email', '⋯'])
  })

  it('draws the menu alone for a roster row with no account, and no row for a viewer with no press', async () => {
    const rosterOnly = { ...key, userId: null, email: null }
    const first = await draw({ user: null, personKey: rosterOnly })
    expect(first.words).toEqual(['⋯'])
    expectLivePress(first.presses[0]!)
    cleanup()
    const second = await draw({ user: null, personKey: rosterOnly, viewer: { ...dev, isDev: false, canAccessPay: false } })
    expect(second.row).toBeNull()
  })
})
