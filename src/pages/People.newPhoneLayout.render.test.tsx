// @vitest-environment jsdom
/**
 * The People page hands its two rows of tabs the new phone layout's switch (`useNewPhoneLayout`) and what
 * Layout says of the top bar (`PhoneBarPageNameContext`). The rows themselves are held by
 * `PeoplePageTabRows.render.test.tsx`. This is the wiring: the page reads the one switch, at a phone's width
 * only, and never hides its title by itself.
 */
import type { ReactElement, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from '../contexts/ToastContext'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import { ThemeProvider } from '../contexts/ThemeContext'
import { PhoneBarPageNameContext } from '../contexts/PhoneBarPageNameContext'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../lib/phoneLayout/newPhoneLayout'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import People from './People'
import { installDomShims } from '../test/renderSmokeMocks'
import { resetRoleGateAnnouncements } from '../hooks/useRoleGate'

/** The one question the page asks the screen: is it a phone's width? */
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

async function drawPeople(opts: { phone: boolean; switchOn: boolean; barNamesPage: boolean }) {
  installDomShims()
  setScreen(opts.phone)
  localStorage.clear()
  if (opts.switchOn) localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
  const result = render((<People />) as ReactElement, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ThemeProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <MemoryRouter initialEntries={['/people?tab=users']} future={{ v7_startTransition: false, v7_relativeSplatPath: true }}>
              <PhoneBarPageNameContext.Provider value={opts.barNamesPage}>{children}</PhoneBarPageNameContext.Provider>
            </MemoryRouter>
          </ConfirmDialogProvider>
        </ToastProvider>
      </ThemeProvider>
    ),
  })
  // The page draws "Loading..." until its people are read.
  const sections = await screen.findByRole('tablist', { name: 'People sections' })
  return { container: result.container, sections }
}

const titleDrawn = () => screen.getByRole('heading', { level: 1, name: 'People' }).style.width !== '1px'

afterEach(() => {
  cleanup()
  localStorage.clear()
  resetRoleGateAnnouncements()
})

describe('People: the rows of tabs under the new phone layout', () => {
  it('a phone with the switch on: both rows are one scrolling line, and the bar has the title', async () => {
    const { container, sections } = await drawPeople({ phone: true, switchOn: true, barNamesPage: true })
    expect(sections.classList.contains('tab-strip-scroll')).toBe(true)
    expect(container.querySelectorAll('[data-phone-tab-row]').length).toBeGreaterThanOrEqual(1)
    expect(titleDrawn()).toBe(false)
  })

  it('a phone with the switch on and a bar that names no page: one line, and the title stays', async () => {
    const { sections } = await drawPeople({ phone: true, switchOn: true, barNamesPage: false })
    expect(sections.classList.contains('tab-strip-scroll')).toBe(true)
    expect(titleDrawn()).toBe(true)
  })

  it('a phone with the switch off: the rows are the rows they were', async () => {
    const { container, sections } = await drawPeople({ phone: true, switchOn: false, barNamesPage: false })
    expect(sections.classList.contains('tab-strip-scroll')).toBe(false)
    expect(container.querySelector('[data-phone-tab-row]')).toBeNull()
    expect(container.querySelector('[data-tabkey]')).toBeNull()
    expect(titleDrawn()).toBe(true)
  })

  it('a desk with the tick stored on this device: the rows are the rows they were', async () => {
    const { container, sections } = await drawPeople({ phone: false, switchOn: true, barNamesPage: false })
    expect(sections.classList.contains('tab-strip-scroll')).toBe(false)
    expect(container.querySelector('[data-phone-tab-row]')).toBeNull()
    expect(titleDrawn()).toBe(true)
  })
})
