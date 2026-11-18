// @vitest-environment jsdom
/**
 * Render smoke for the size of the header's coloured presses in Job Mode (v2.7812, the owner's ask of
 * 2026-11-18): the green phone, Task Dispatch, Ask estimating and Task are one size on a phone.
 *
 * Their height and their icons are in em, so a press's size follows its type size. The phone is a link
 * and the other three are buttons, and a link takes the page's type size where a button takes the
 * stylesheet's smaller one: 36 px against 33.5 px on a phone. jsdom lays nothing out, so this pins the
 * cause: every one of the four names the same type size, height, padding and icon size on itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev', profileName: 'Sample dev' })
})
vi.mock('../hooks/useFirstAssistantDispatchPhone', () => {
  const phone = { telHref: '+15555550100', display: '(555) 555-0100' }
  return { useFirstAssistantDispatchPhone: (enabled: boolean) => (enabled ? phone : null) }
})

import Layout from './Layout'
import { ThemeProvider } from '../contexts/ThemeContext'
import { DailyGoalsGateProvider } from '../contexts/DailyGoalsGateContext'
import { PersonDeskProvider } from '../contexts/PersonDeskContext'
import { dispatchModeStorageKey } from '../lib/dispatchModeToggle'
import { HEADER_ASK_ESTIMATING_LABEL } from '../lib/headerTaskDispatchEstimatorEligible'
import { jobModeStorageKey } from '../lib/jobModeToggle'
import { SMOKE_AUTH_USER_ID, renderWithProviders, settle } from '../test/renderSmokeMocks'

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

async function renderShell() {
  const result = renderWithProviders(
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
  return result
}

/** What decides a press's drawn size, read off the element itself. */
function sizeSource(el: HTMLElement) {
  const icon = el.querySelector('svg')
  return {
    fontSize: el.style.fontSize,
    height: el.style.height,
    padding: el.style.padding,
    boxSizing: el.style.boxSizing,
    border: el.style.borderStyle,
    icon: icon ? `${icon.getAttribute('width')} x ${icon.getAttribute('height')}` : null,
  }
}

describe('Layout: the header\'s coloured presses in Job Mode', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(jobModeStorageKey(SMOKE_AUTH_USER_ID), '1')
    localStorage.setItem(dispatchModeStorageKey(SMOKE_AUTH_USER_ID), '0')
  })
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('on a phone draws the phone press from the same size source as its three neighbours', async () => {
    setScreen(true)
    const { container } = await renderShell()

    const row = container.querySelector<HTMLElement>('[data-nav-row-right]')!
    expect(row).toBeTruthy()
    const phone = row.querySelector<HTMLElement>('a[href^="tel:"]')!
    expect(phone).toBeTruthy()
    const neighbours = ['Task Dispatch', HEADER_ASK_ESTIMATING_LABEL, 'Task'].map((name) => screen.getByRole('button', { name }))

    // The four are one run in the row: the phone, then its three neighbours, with nothing between.
    const run = Array.from(row.children).filter((el) => el === phone || neighbours.includes(el as HTMLElement))
    expect(run).toEqual([phone, ...neighbours])

    const want = sizeSource(neighbours[0]!)
    // A size in em is only a size once the type size is named: none of the four may leave it to its tag.
    expect(want.fontSize).not.toBe('')
    expect(want.height).not.toBe('')
    expect(want.icon).toBe('1.25em x 1.25em')
    for (const press of [phone, ...neighbours]) expect(sizeSource(press)).toEqual(want)
  })

  it('at a desk keeps the phone press as tall as the worded presses beside it', async () => {
    setScreen(false)
    const { container } = await renderShell()

    const phone = container.querySelector<HTMLElement>('[data-nav-row-right] a[href^="tel:"]')!
    expect(phone).toBeTruthy()
    const dispatch = screen.getByRole('button', { name: 'Task Dispatch' })
    expect(dispatch.textContent).toBe('dispatch')

    expect(phone.style.fontSize).not.toBe('')
    expect(phone.style.fontSize).toBe(dispatch.style.fontSize)
    expect(phone.style.height).toBe(dispatch.style.height)
  })
})
