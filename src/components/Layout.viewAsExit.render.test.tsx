// @vitest-environment jsdom
/**
 * Render smoke for where the way back from View as is drawn (v2.7782, the owner's ask of 2026-11-18).
 * On a phone it is on its own line above the header, outside the header's icon row, with its whole
 * name, and the line itself is the press. At a desk it stays in the row. One press still returns to
 * the page the dev left.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
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
import { IMPERSONATION_ORIGINAL_STORAGE_KEY, isImpersonationSessionActive } from '../lib/impersonationSession'
import { supabase } from '../lib/supabase'
import { IMPERSONATION_EXIT_ARIA_LABEL } from '../lib/impersonationUiLabels'
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

const exitButtons = () => screen.queryAllByRole('button', { name: IMPERSONATION_EXIT_ARIA_LABEL })

describe('Layout: the way back from View as', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('on a phone sits on its own line above the header, outside the icon row, with its whole name', async () => {
    setScreen(true)
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ returnTo: '/#left' }))
    const { container } = await renderShell()

    const buttons = exitButtons()
    expect(buttons).toHaveLength(1)
    const button = buttons[0]!
    expect(button.textContent).toBe('Exit (Sample leader)')

    // Outside the header: no nav holds it, and the header's own row has no such press.
    const nav = container.querySelector('nav.appNav')!
    expect(nav).toBeTruthy()
    expect(button.closest('nav')).toBeNull()
    expect(nav.querySelector(`[aria-label="${IMPERSONATION_EXIT_ARIA_LABEL}"]`)).toBeNull()

    // Inside the strip, and the strip is the line just above the header's chrome.
    const strip = container.querySelector('.appViewAsStrip')!
    expect(strip).toBeTruthy()
    expect(strip.contains(button)).toBe(true)
    expect(strip.nextElementSibling?.classList.contains('appNavChrome')).toBe(true)
    expect(strip.nextElementSibling?.contains(nav)).toBe(true)

    // Never shortened: the strip's button carries no width cap and no ellipsis of its own.
    expect(button.style.maxWidth).toBe('')
    expect(button.style.textOverflow).toBe('')
    expect(button.style.whiteSpace).toBe('')

    // The line is the press: a real button that is the strip's only child, with no inline box of its
    // own. Its padding, border and radius once came from an inline style and made it a tall outlined
    // button inside the line; the thin band is `.appViewAsStripExit` alone.
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.classList.contains('appViewAsStripExit')).toBe(true)
    expect(button.getAttribute('style')).toBeNull()
    expect(strip.children).toHaveLength(1)
    expect(strip.firstElementChild).toBe(button)
  })

  it('at a desk stays in the header row, and there is no strip', async () => {
    setScreen(false)
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ returnTo: '/#left' }))
    const { container } = await renderShell()

    const buttons = exitButtons()
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.closest('nav')?.classList.contains('appNav')).toBe(true)
    expect(container.querySelector('.appViewAsStrip')).toBeNull()
  })

  it('draws neither while nobody is being viewed as', async () => {
    setScreen(true)
    const { container } = await renderShell()

    expect(exitButtons()).toHaveLength(0)
    expect(container.querySelector('.appViewAsStrip')).toBeNull()
  })

  it('one press on the strip clears the stash and returns to the page left', async () => {
    setScreen(true)
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ returnTo: '/#left' }))
    const { container } = await renderShell()

    fireEvent.click(exitButtons()[0]!)
    await waitFor(() => expect(window.location.hash).toBe('#left'))
    expect(localStorage.getItem(IMPERSONATION_ORIGINAL_STORAGE_KEY)).toBeNull()
    expect(container.querySelector('.appViewAsStrip')).toBeNull()
    expect(exitButtons()).toHaveLength(0)
  })

  it('keeps View as flagged until the session is the dev’s own again', async () => {
    setScreen(true)
    localStorage.setItem(IMPERSONATION_ORIGINAL_STORAGE_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r', returnTo: '/#back' }))
    // The session swap is a network call: hold it open and read the flag while it is.
    let swapped: () => void = () => {}
    const auth = supabase.auth as unknown as { setSession?: (tokens: { access_token: string; refresh_token: string }) => Promise<unknown> }
    const setSession = vi.fn(() => new Promise<unknown>((resolve) => (swapped = () => resolve({ data: { session: null }, error: null }))))
    auth.setSession = setSession
    try {
      await renderShell()

      fireEvent.click(exitButtons()[0]!)
      await waitFor(() => expect(setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' }), { timeout: 15_000 })
      // Still signed in as the person: the background saves held while View as is on stay held.
      expect(isImpersonationSessionActive()).toBe(true)

      swapped()
      await waitFor(() => expect(window.location.hash).toBe('#back'), { timeout: 15_000 })
      expect(isImpersonationSessionActive()).toBe(false)
    } finally {
      delete auth.setSession
    }
  })
})
