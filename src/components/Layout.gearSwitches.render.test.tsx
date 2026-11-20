// @vitest-environment jsdom
/**
 * Render smoke for the gear menu's sections and its two show-or-hide switches (the owner's asks of 2026-11-20).
 * v2.8043: Fix Mode reads Tell the dev and Pin Mode reads Pin bar, each with its icon. The stored keys kept the
 * old word, so a choice made before still holds. v2.8059: the menu reads in groups under small labels, Modes,
 * Show, Pages, Help and settings, with leaving and reloading last under a band.
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
import { GEAR_PAGE_ORDER } from '../lib/gearMenuSections'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'

/** The one question Layout asks the screen: is it a phone's width? */
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

/** The menu's rows by the label they sit under. `top` is what comes before any label, `last` what follows the band. */
function rowsBySection(menu: HTMLElement): Record<string, string[]> {
  const out: Record<string, string[]> = { top: [] }
  let at = 'top'
  for (const el of Array.from(menu.children) as HTMLElement[]) {
    if (el.dataset.gearSection) at = el.dataset.gearSection
    else if (el.dataset.testid === 'gear-leave-band') at = 'last'
    else (out[at] ??= []).push(el.textContent ?? '')
    out[at] ??= []
  }
  return out
}

const PAGE_NAMES: Record<(typeof GEAR_PAGE_ORDER)[number], string> = {
  checklist: 'Checklist',
  calendar: 'Calendar',
  materials: 'Materials',
  map: 'Map',
  customers: 'Customers',
  people: 'People',
  documents: 'Documents',
  banking: 'Banking',
  roadmap: 'Roadmap',
  partnerships: 'Partnerships',
}

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

describe('Layout: the gear menu’s sections and switches', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('reads in groups on a phone: Modes, Show, Pages, Help and settings, then leaving and reloading', async () => {
    setScreen(true)
    const menu = await openGearMenu()
    const groups = rowsBySection(menu)
    expect(Object.keys(groups)).toEqual(['top', 'Modes', 'Show', 'Pages', 'Help and settings', 'last'])

    // Every mode is under Modes, Task Mode last, and nothing else is.
    expect(groups.Modes!.length).toBeGreaterThan(0)
    expect(groups.Modes!.every((n) => /Mode|PO tab/.test(n))).toBe(true)
    expect(groups.Modes![groups.Modes!.length - 1]).toMatch(/^Task Mode/)
    // The switches, each with its icon. The only row called a mode outside Modes is the phone's own Dark Mode.
    expect(groups.Show).toEqual(['Pin bar', 'Tell the dev✓', 'Dark Mode'])
    const show = menu.querySelector('[data-gear-section="Show"]')!
    expect(show.nextElementSibling!.querySelector('svg')).toBeTruthy()
    expect(show.nextElementSibling!.nextElementSibling!.querySelector('svg')).toBeTruthy()
    // The pages are in the kernel's one order, a crew's first.
    const order = GEAR_PAGE_ORDER.map((k) => PAGE_NAMES[k])
    expect(groups.Pages!.length).toBeGreaterThan(2)
    expect(groups.Pages).toEqual(order.filter((n) => groups.Pages!.includes(n)))
    expect(groups.Pages!.slice(0, 2)).toEqual(['Checklist', 'Calendar'])
    expect(groups['Help and settings']).toEqual(['Help', 'Settings'])
    expect(groups.last).toEqual(['Sign out', 'Hard Reload'])
    expect(menu.textContent).not.toMatch(/Fix Mode|Pin Mode/)
  })

  it('at a desk keeps the same groups, with only the pages the header has no link to', async () => {
    setScreen(false)
    const menu = await openGearMenu()
    const groups = rowsBySection(menu)
    expect(Object.keys(groups)).toEqual(['top', 'Modes', 'Show', 'Pages', 'Help and settings', 'last'])
    expect(groups.top).toEqual([])
    expect(groups.Pages).not.toContain('Checklist')
    expect(groups.Pages).toContain('Calendar')
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
