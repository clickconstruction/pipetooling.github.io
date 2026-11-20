// @vitest-environment jsdom
/**
 * Render smoke for the gear menu's two show-or-hide switches (v2.8043, the owner's ask of 2026-11-20).
 * Fix Mode reads Tell the dev and Pin Mode reads Pin bar, each with its icon, under a band that sets
 * them apart from the page modes. The stored keys kept the old word, so a choice made before still holds.
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
  return useAuthModuleMock({ role: 'master_technician', profileName: 'Sample leader' })
})

import Layout from './Layout'
import { ThemeProvider } from '../contexts/ThemeContext'
import { DailyGoalsGateProvider } from '../contexts/DailyGoalsGateContext'
import { PersonDeskProvider } from '../contexts/PersonDeskContext'
import { switchRowAriaLabel } from '../lib/gearSwitchWords'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'

async function openGearMenu() {
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
  return container.querySelector('[data-navtrack="gear-menu"]') as HTMLElement
}

const storedUnder = (prefix: string) =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith(prefix))
    .map((k) => localStorage.getItem(k))

describe('Layout: the gear menu’s show-or-hide switches', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('names them Pin bar and Tell the dev, with an icon each, under a band below the modes', async () => {
    const menu = await openGearMenu()
    const rows = Array.from(menu.children) as HTMLElement[]
    const band = rows.findIndex((r) => r.dataset.testid === 'gear-switches-band')
    expect(band).toBeGreaterThan(0)
    // The last mode sits just above the band, and the two switches then Dark Mode just under it.
    expect(rows[band - 1]!.textContent).toBe('Task Mode')
    expect(rows.slice(band + 1, band + 4).map((r) => r.textContent)).toEqual(['Pin bar', 'Tell the dev✓', 'Dark Mode'])
    expect(rows[band + 1]!.querySelector('svg')).toBeTruthy()
    expect(rows[band + 2]!.querySelector('svg')).toBeTruthy()
    // Every mode is above the band, and no row under it is called a mode but the phone's own Dark Mode.
    const names = rows.map((r) => r.textContent ?? '')
    expect(names.slice(0, band).filter((n) => /Mode/.test(n)).length).toBeGreaterThan(0)
    expect(names.slice(band + 1).filter((n) => /Mode/.test(n))).toEqual(['Dark Mode'])
    expect(menu.textContent).not.toMatch(/Fix Mode|Pin Mode/)
  })

  it('reads each switch’s state and next press aloud, and keeps the stored keys', async () => {
    const menu = await openGearMenu()
    const wrench = menu.querySelector(`[aria-label="${switchRowAriaLabel('fix')}"]`) as HTMLElement
    const pin = menu.querySelector(`[aria-label="${switchRowAriaLabel('pin')}"]`) as HTMLElement
    // The wrench starts on, the pin bar off.
    expect(wrench.getAttribute('aria-pressed')).toBe('true')
    expect(wrench.title).toBe('Hide the wrench that sends a note to the dev')
    expect(pin.getAttribute('aria-pressed')).toBe('false')
    expect(pin.title).toBe('Show the pin bar at the bottom of pages')

    fireEvent.click(wrench)
    expect(storedUnder('pt_fix_mode_')).toEqual(['off'])
  })

  it('honours a wrench hidden before the rename: the row comes up unticked', async () => {
    const first = await openGearMenu()
    fireEvent.click(first.querySelector(`[aria-label="${switchRowAriaLabel('fix')}"]`) as HTMLElement)
    cleanup()

    const menu = await openGearMenu()
    const wrench = menu.querySelector(`[aria-label="${switchRowAriaLabel('fix')}"]`) as HTMLElement
    expect(wrench.getAttribute('aria-pressed')).toBe('false')
    expect(wrench.textContent).toBe('Tell the dev')
    expect(wrench.title).toBe('Show the wrench that sends a note to the dev')
  })
})
