// @vitest-environment jsdom
/**
 * The Jobs page hands its row of tabs the new phone layout's switch (`useNewPhoneLayout`) and what Layout
 * says of the top bar (`PhoneBarPageNameContext`). The row itself is held by
 * `JobsPageTabStrip.render.test.tsx`. This is the wiring: the page reads the one switch, at a phone's width
 * only, and never hides its title by itself.
 */
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { PhoneBarPageNameContext } from '../contexts/PhoneBarPageNameContext'
import { JobsListCacheProvider } from '../contexts/JobsListCacheContext'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../lib/phoneLayout/newPhoneLayout'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import Jobs from './Jobs'
import { renderWithProviders, settle } from '../test/renderSmokeMocks'
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

async function drawJobs(opts: { phone: boolean; switchOn: boolean; barNamesPage: boolean; route?: string }) {
  setScreen(opts.phone)
  localStorage.clear()
  if (opts.switchOn) localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
  const result = renderWithProviders(
    (
      <JobsListCacheProvider>
        <PhoneBarPageNameContext.Provider value={opts.barNamesPage}>
          <Jobs />
        </PhoneBarPageNameContext.Provider>
      </JobsListCacheProvider>
    ) as ReactElement,
    { route: opts.route ?? '/jobs?tab=reports' },
  )
  await settle()
  const strip = result.container.querySelector('[data-jobs-page-tabs]') as HTMLElement
  expect(strip).not.toBeNull()
  return { container: result.container, strip }
}

const words = (strip: HTMLElement) => Array.from(strip.querySelectorAll('button')).map((b) => b.textContent)
const titleDrawn = () => screen.getByRole('heading', { level: 1, name: 'Jobs' }).style.width !== '1px'
const WHOLE_ROW = ['Crew P&L', 'Reports', 'Pipeline', 'Billing', 'Team', 'Subs', 'Parts', 'Materials', 'Job Summary', 'Inspections']

afterEach(() => {
  cleanup()
  localStorage.clear()
  resetRoleGateAnnouncements()
})

describe('Jobs: the row of tabs under the new phone layout', () => {
  it('a phone with the switch on: the row is one scrolling line with a dev’s ten tabs, and the bar has the title', async () => {
    const { strip } = await drawJobs({ phone: true, switchOn: true, barNamesPage: true })
    expect(strip.hasAttribute('data-phone-tab-row')).toBe(true)
    expect(strip.querySelector('.tab-strip-scroll')).not.toBeNull()
    expect(words(strip)).toEqual(WHOLE_ROW)
    expect(titleDrawn()).toBe(false)
  })

  it('a phone with the switch on and a bar that names no page: one line, and the title stays', async () => {
    const { strip } = await drawJobs({ phone: true, switchOn: true, barNamesPage: false })
    expect(strip.querySelector('.tab-strip-scroll')).not.toBeNull()
    expect(titleDrawn()).toBe(true)
  })

  it('a phone with the switch off: the row is the row it was', async () => {
    const { strip } = await drawJobs({ phone: true, switchOn: false, barNamesPage: false })
    expect(strip.hasAttribute('data-phone-tab-row')).toBe(false)
    expect(strip.querySelector('.tab-strip-scroll')).toBeNull()
    expect(strip.querySelector('[data-tabkey]')).toBeNull()
    expect(words(strip)).toEqual(WHOLE_ROW)
    expect(titleDrawn()).toBe(true)
  })

  it('a desk with the tick stored on this device: the row is the row it was', async () => {
    const { strip } = await drawJobs({ phone: false, switchOn: true, barNamesPage: false })
    expect(strip.hasAttribute('data-phone-tab-row')).toBe(false)
    expect(strip.querySelector('.tab-strip-scroll')).toBeNull()
    expect(words(strip)).toEqual(WHOLE_ROW)
    expect(titleDrawn()).toBe(true)
  })

  it('the open tab is the one the address names, and it is the lit one in the row', async () => {
    const { strip } = await drawJobs({ phone: true, switchOn: true, barNamesPage: true, route: '/jobs?tab=inspections' })
    const lit = Array.from(strip.querySelectorAll('button')).filter((b) => b.style.fontWeight === '700')
    expect(lit.map((b) => b.textContent)).toEqual(['Inspections'])
    expect(lit[0]!.dataset.tabkey).toBe('inspections')
  })
})
