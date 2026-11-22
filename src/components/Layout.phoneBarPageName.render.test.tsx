// @vitest-environment jsdom
/**
 * Layout tells the page under it whether the top bar is naming the page (`PhoneBarPageNameContext`), so the
 * Jobs and People pages can leave their own title undrawn while the bar says the same word (v2.8288).
 *
 * The one thing held here: the answer handed down is true exactly when the bar draws the page's name. A page
 * that hid its title on a wrong yes would leave the screen with no name on it. That is the role dock's row,
 * which keeps its icons and names no page, and every bar with the switch off or at a desk.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

const auth = vi.hoisted(() => ({ role: 'dev' as string }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  // One value per role, for good: a new object every call would re-run every effect that reads the user.
  const byRole = new Map<string, ReturnType<typeof makeUseAuthValue>>()
  const value = () => {
    let v = byRole.get(auth.role)
    if (!v) {
      v = makeUseAuthValue({ role: auth.role, profileName: `Sample ${auth.role}` })
      byRole.set(auth.role, v)
    }
    return v
  }
  return { useAuth: value, useOptionalAuth: value, AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }
})
vi.mock('../hooks/useFirstAssistantDispatchPhone', () => {
  const phone = { telHref: '+15555550100', display: '(555) 555-0100' }
  return { useFirstAssistantDispatchPhone: (enabled: boolean) => (enabled ? phone : null) }
})
// The server's Dispatch Mode choice is this device's stored one, so a test picks the mode by storing it.
vi.mock('../lib/dispatchModeToggle', async (original) => {
  const real = await original<typeof import('../lib/dispatchModeToggle')>()
  return { ...real, fetchDispatchModeEnabledFromServer: async (userId: string) => ({ value: real.readDispatchModeEnabled(userId) }) }
})

import Layout from './Layout'
import { ThemeProvider } from '../contexts/ThemeContext'
import { DailyGoalsGateProvider } from '../contexts/DailyGoalsGateContext'
import { PersonDeskProvider } from '../contexts/PersonDeskContext'
import { usePhoneBarNamesPage } from '../contexts/PhoneBarPageNameContext'
import { dispatchModeStorageKey } from '../lib/dispatchModeToggle'
import { jobModeStorageKey } from '../lib/jobModeToggle'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../lib/phoneLayout/newPhoneLayout'
import { SMOKE_AUTH_USER_ID, renderWithProviders, settle } from '../test/renderSmokeMocks'

/** The one question the shell asks the screen: is it a phone's width? */
function setScreen(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width: 640px'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

type Mode = 'job' | 'dispatch' | 'none'

/** A page that says what it was told. */
function Page() {
  return <div data-testid="page" data-names-page={String(usePhoneBarNamesPage())} />
}

async function drawShell(opts: { role: string; phone: boolean; switchOn: boolean; mode: Mode }) {
  auth.role = opts.role
  setScreen(opts.phone)
  localStorage.clear()
  localStorage.setItem(jobModeStorageKey(SMOKE_AUTH_USER_ID), opts.mode === 'job' ? '1' : '0')
  localStorage.setItem(dispatchModeStorageKey(SMOKE_AUTH_USER_ID), opts.mode === 'dispatch' ? '1' : '0')
  if (opts.switchOn) localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
  const result = renderWithProviders(
    <ThemeProvider>
      <DailyGoalsGateProvider>
        <PersonDeskProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="*" element={<Page />} />
            </Route>
          </Routes>
        </PersonDeskProvider>
      </DailyGoalsGateProvider>
    </ThemeProvider>,
    { route: '/jobs' },
  )
  await settle()
  const page = await screen.findByTestId('page')
  return { container: result.container, told: page.dataset.namesPage, barName: result.container.querySelector('[data-phone-bar-page]')?.textContent ?? null }
}

const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'helpers', 'subcontractor', 'estimator', 'primary'] as const
const MODES: Mode[] = ['job', 'dispatch', 'none']

describe('Layout tells the page whether the bar names it', () => {
  // Dark Mode's tick follows the clock (`themeSchedule.ts`). Noon holds the day; only `Date` is faked.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    localStorage.clear()
  })

  const cases = ROLES.flatMap((role) => MODES.map((mode) => [role, mode] as const))

  it.each(cases)('%s, mode %s: the page is told yes exactly when the bar draws its name', async (role, mode) => {
    for (const phone of [true, false]) {
      for (const switchOn of [true, false]) {
        const { told, barName } = await drawShell({ role, phone, switchOn, mode })
        expect(told, `${role}/${mode} phone ${phone} switch ${switchOn}`).toBe(String(barName != null))
        // The switch off, or a desk: never.
        if (!phone || !switchOn) expect(told).toBe('false')
        cleanup()
      }
    }
  })

  it('a dev on a phone with the switch on: the bar says Jobs, and the page is told', async () => {
    const { told, barName } = await drawShell({ role: 'dev', phone: true, switchOn: true, mode: 'none' })
    expect(barName).toBe('Jobs')
    expect(told).toBe('true')
  })

  it('an assistant on the role dock: the row keeps its icons, names no page, and the page is told no', async () => {
    const { container, told, barName } = await drawShell({ role: 'assistant', phone: true, switchOn: true, mode: 'dispatch' })
    expect(barName).toBeNull()
    expect(told).toBe('false')
    // The dock is up: its More press is at the foot.
    expect(container.querySelector('nav[data-app-bottom-chrome]')).not.toBeNull()
  })
})
