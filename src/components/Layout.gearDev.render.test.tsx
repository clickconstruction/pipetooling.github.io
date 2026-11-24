// @vitest-environment jsdom
/**
 * A dev's gear menu ends on Sign out and Hard Reload (v2.8527). Global Reload, which made every open copy of the app
 * reload at once, sat one row under Hard Reload. It lives in Settings → Advanced now.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev', profileName: 'Sample dev' })
})

import Layout from './Layout'
import { ThemeProvider } from '../contexts/ThemeContext'
import { DailyGoalsGateProvider } from '../contexts/DailyGoalsGateContext'
import { PersonDeskProvider } from '../contexts/PersonDeskContext'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'

describe('Layout: a dev’s gear menu', () => {
  beforeEach(() => {
    localStorage.clear()
    // Noon: the gear menu's Dark Mode row follows the clock (see Layout.gearSwitches.render.test.tsx).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('has no Global Reload: the reloads end on Hard Reload', async () => {
    const { container } = renderWithProviders(
      <ThemeProvider>
        <DailyGoalsGateProvider>
          <PersonDeskProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="*" element={<div data-testid="page" />} />
              </Route>
            </Routes>
          </PersonDeskProvider>
        </DailyGoalsGateProvider>
      </ThemeProvider>,
      { route: '/dashboard' },
    )
    await settle()
    await screen.findByTestId('page')
    fireEvent.click(screen.getByTitle('Settings'))
    const menu = container.querySelector('[data-navtrack="gear-menu"]') as HTMLElement
    const rows = Array.from(menu.querySelectorAll('button')).map((b) => b.textContent)
    expect(rows.at(-1)).toBe('Hard Reload')
    expect(rows).toContain('Sign out')
    expect(menu.textContent).not.toMatch(/Global Reload/)
  })
})
