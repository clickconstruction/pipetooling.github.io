// @vitest-environment jsdom
/**
 * Render smoke for the new phone layout's bars (`lib/phoneLayout`): one tick per device, off until someone
 * ticks it, and only ever on at a phone's width.
 *
 * What it holds, role by role:
 * - With the switch off, or at a desk, the shell is the shell it was: nothing of the new layout is drawn, and
 *   at a desk the page is the same markup whether the device has the tick or not.
 * - With it on, every press of the old phone row is still on the screen: in the one-row top bar, as a named
 *   row at the top of the gear menu in the row's own order, or as the Dashboard tab.
 * - The moved rows open what their presses opened, the tick is a phone's and this device's, and the Home
 *   Screen offer is one quiet row of the Dashboard with the same Add and the same remembered Dismiss.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

const auth = vi.hoisted(() => ({ role: 'dev' as string }))
const doors = vi.hoisted(() => {
  const dispatch = vi.fn()
  const estimating = vi.fn()
  const task = vi.fn()
  return {
    dispatch,
    estimating,
    task,
    // One object each, for good: Layout keeps effects on them.
    dispatchValue: { openDispatchModal: dispatch, closeDispatchModal: () => {}, isDispatchModalOpen: false, dispatchPreset: null },
    estimatingValue: { openEstimatorModal: estimating, closeEstimatorModal: () => {}, isEstimatorModalOpen: false, estimatorPreset: null },
    taskValue: { openAddModal: task, closeModal: () => {}, isOpen: false, initialAssigneeUserId: null, initialPreset: null, onSaved: null },
  }
})
const offer = vi.hoisted(() => ({ show: false, dismissed: vi.fn() }))

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
// The server's Dispatch Mode choice is this device's stored one, so a test picks the mode by storing it. The
// stub's empty answer reads as "never chose", which turns the mode on for a leader and an assistant.
vi.mock('../lib/dispatchModeToggle', async (original) => {
  const real = await original<typeof import('../lib/dispatchModeToggle')>()
  return { ...real, fetchDispatchModeEnabledFromServer: async (userId: string) => ({ value: real.readDispatchModeEnabled(userId) }) }
})
vi.mock('../contexts/DispatchTaskModalContext', async (original) => ({ ...(await original<object>()), useDispatchTaskModal: () => doors.dispatchValue }))
vi.mock('../contexts/EstimatorTaskModalContext', async (original) => ({ ...(await original<object>()), useEstimatorTaskModal: () => doors.estimatingValue }))
vi.mock('../contexts/ChecklistAddModalContext', async (original) => ({ ...(await original<object>()), useChecklistAddModal: () => doors.taskValue }))
vi.mock('../lib/iosPwa', async (original) => ({
  ...(await original<object>()),
  shouldShowAddTaskBanner: () => offer.show,
  markAddTaskBannerDismissed: () => {
    offer.dismissed()
    offer.show = false
  },
}))

import Layout from './Layout'
import { ThemeProvider } from '../contexts/ThemeContext'
import { DailyGoalsGateProvider } from '../contexts/DailyGoalsGateContext'
import { PersonDeskProvider } from '../contexts/PersonDeskContext'
import { dispatchModeStorageKey } from '../lib/dispatchModeToggle'
import { jobModeStorageKey } from '../lib/jobModeToggle'
import { NEW_PHONE_LAYOUT_STORAGE_KEY, NEW_PHONE_LAYOUT_SWITCH_ARIA } from '../lib/phoneLayout/newPhoneLayout'
import { PHONE_BAR_PAD_Y_PX, PHONE_BAR_PRESS_PX } from '../lib/phoneLayout/phoneBar'
import { GO_ANYWHERE_WORDS } from '../lib/search/doors'
import { TELL_THE_DEV_OPEN_EVENT } from '../lib/tellTheDev/openBox'
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

function setUp(opts: { role: string; phone: boolean; switchOn: boolean; mode?: Mode }) {
  auth.role = opts.role
  setScreen(opts.phone)
  localStorage.clear()
  const mode = opts.mode ?? 'none'
  localStorage.setItem(jobModeStorageKey(SMOKE_AUTH_USER_ID), mode === 'job' ? '1' : '0')
  localStorage.setItem(dispatchModeStorageKey(SMOKE_AUTH_USER_ID), mode === 'dispatch' ? '1' : '0')
  if (opts.switchOn) localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
}

async function renderShell(route = '/dashboard') {
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
    { route },
  )
  await settle()
  await screen.findByTestId('page')
  return result
}

/** A press's name, as a person or a screen reader meets it. */
const nameOf = (el: Element) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim()

/** The presses drawn in the top row, with both menus closed. */
function rowPresses(container: HTMLElement): string[] {
  const nav = container.querySelector('nav.appNav') as HTMLElement
  return Array.from(nav.querySelectorAll('button, a')).map(nameOf)
}

/** The gear menu's rows before its first label: where a press that left the row is drawn. */
function gearTopRows(container: HTMLElement): string[] {
  fireEvent.click(screen.getByTitle('Settings'))
  const menu = container.querySelector('[data-navtrack="gear-menu"]') as HTMLElement
  const out: string[] = []
  for (const el of Array.from(menu.children) as HTMLElement[]) {
    if (el.dataset.gearSection) break
    out.push(nameOf(el))
  }
  fireEvent.click(screen.getByTitle('Settings'))
  return out
}

const tabNames = (container: HTMLElement) => Array.from(container.querySelectorAll('nav[data-app-bottom-chrome] button')).map(nameOf)

/** React's generated ids differ from one render to the next and are not the page. */
const markup = (container: HTMLElement) => container.innerHTML.replace(/:r[0-9a-z]+:/g, ':id:')

const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'superintendent', 'helpers', 'subcontractor', 'estimator', 'primary'] as const
const MODES: Mode[] = ['job', 'none']

describe('Layout: the new phone layout', () => {
  // Dark Mode's tick follows the clock (`themeSchedule.ts`). Noon holds the day; only `Date` is faked.
  beforeEach(() => {
    localStorage.clear()
    offer.show = false
    for (const fn of [doors.dispatch, doors.estimating, doors.task, offer.dismissed]) fn.mockClear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 12, 0, 0))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    localStorage.clear()
  })

  describe('with the switch off, or at a desk, the shell is the shell it was', () => {
    it.each(ROLES)('%s on a phone, switch off: nothing of the new layout is drawn', async (role) => {
      setUp({ role, phone: true, switchOn: false, mode: 'job' })
      const { container } = await renderShell()
      expect(container.querySelector('[data-phone-bar-page]')).toBeNull()
      expect(container.querySelector('[data-add-task-offer]')).toBeNull()
      expect(container.querySelector('[data-compact]')).toBeNull()
      // The header row keeps the padding the stylesheet gives it.
      expect(container.innerHTML).not.toContain('--app-nav-pad-y')
      fireEvent.click(screen.getByTitle('Settings'))
      expect(container.querySelector('[data-phone-bar-row]')).toBeNull()
      const menu = container.querySelector('[data-navtrack="gear-menu"]') as HTMLElement
      // Only the roles in the trial are offered the tick.
      expect(menu.querySelector(`[aria-label="${NEW_PHONE_LAYOUT_SWITCH_ARIA}"]`) != null).toBe(role === 'dev' || role === 'master_technician')
    })

    it.each(ROLES)('%s at a desk: the same markup whether or not this device has the tick, menu open or shut', async (role) => {
      const draw = async (switchOn: boolean) => {
        setUp({ role, phone: false, switchOn, mode: 'job' })
        const { container } = await renderShell()
        const shut = markup(container)
        fireEvent.click(screen.getByTitle('Settings'))
        const open = markup(container)
        cleanup()
        return { shut, open }
      }
      const off = await draw(false)
      const on = await draw(true)
      expect(on.shut).toBe(off.shut)
      expect(on.open).toBe(off.open)
      expect(off.open).not.toContain('New phone layout')
    })
  })

  describe('with the switch on, every press of the old row is still on the screen', () => {
    const cases = ROLES.flatMap((role) => MODES.map((mode) => [role, mode] as const))

    it.each(cases)('%s, mode %s', async (role, mode) => {
      setUp({ role, phone: true, switchOn: false, mode })
      const before = await renderShell()
      const old = rowPresses(before.container)
      expect(old.length).toBeGreaterThan(1)
      cleanup()

      setUp({ role, phone: true, switchOn: true, mode })
      const { container } = await renderShell()
      const bar = rowPresses(container)
      const rows = gearTopRows(container)
      const tabs = tabNames(container)

      for (const press of old) {
        const where = bar.includes(press) ? 'bar' : rows.includes(press) ? 'gear' : press === 'Dashboard' && tabs.includes('Dashboard') ? 'tab' : null
        expect(where, `${role}/${mode}: "${press}" is gone`).not.toBeNull()
      }
      // The rows keep the old row's order.
      const order = old.filter((p) => rows.includes(p))
      expect(rows.filter((p) => order.includes(p))).toEqual(order)
      // The bar is one row: the menu, home, Search, the green phone and the gear, and nothing else.
      const search = Object.values(GO_ANYWHERE_WORDS.modes).map((m) => m.button)
      for (const press of bar) {
        const allowed = ['Open menu', 'Dashboard', 'Settings', ...search].includes(press) || press.startsWith('Call the office at ')
        expect(allowed, `${role}/${mode}: "${press}" is in the bar`).toBe(true)
      }
      // The page's name is in the bar, in words. (An assistant is taken to the schedule on arrival.)
      expect(container.querySelector('[data-phone-bar-page]')!.textContent).toMatch(/^(Dashboard|Schedule)$/)
    })

    it('a helper in Job Mode: the page’s name, Search, the green phone and the gear, and four named rows', async () => {
      setUp({ role: 'helpers', phone: true, switchOn: true, mode: 'job' })
      const { container } = await renderShell()
      const nav = container.querySelector('nav.appNav') as HTMLElement
      expect(nav.querySelector('[data-phone-bar-page]')!.textContent).toBe('Dashboard')
      // No menu for a helper, and home is the Dashboard tab under the thumb.
      expect(within(nav).queryByLabelText('Open menu')).toBeNull()
      expect(within(nav).queryByLabelText('Dashboard')).toBeNull()
      expect(tabNames(container)).toEqual(['Dashboard', 'Schedule', 'Inbox', 'Customers'])
      expect(nav.querySelector('a[href^="tel:"]')).toBeTruthy()
      expect(gearTopRows(container)).toEqual(['Tell the dev', 'Task Dispatch', 'Ask estimating', 'Task'])
    })

    it('a helper with Job Mode off has no tabs, so home stays in the bar', async () => {
      setUp({ role: 'helpers', phone: true, switchOn: true, mode: 'none' })
      const { container } = await renderShell()
      const nav = container.querySelector('nav.appNav') as HTMLElement
      expect(tabNames(container)).toEqual([])
      expect(within(nav).getByLabelText('Dashboard')).toBeTruthy()
    })

    it('a leader out of Job Mode: the menu and home at the left, People among the rows', async () => {
      setUp({ role: 'master_technician', phone: true, switchOn: true, mode: 'none' })
      const { container } = await renderShell('/jobs')
      const nav = container.querySelector('nav.appNav') as HTMLElement
      expect(within(nav).getByLabelText('Open menu')).toBeTruthy()
      expect(within(nav).getByLabelText('Dashboard')).toBeTruthy()
      expect(nav.querySelector('[data-phone-bar-page]')!.textContent).toBe('Jobs')
      expect(gearTopRows(container)).toEqual(['Tell the dev', 'Task Dispatch', 'Ask estimating', 'Task', 'People'])
    })

    it('a leader in Dispatch Mode keeps home: that mode’s first tab opens the Dispatch home, not the Dashboard', async () => {
      setUp({ role: 'master_technician', phone: true, switchOn: true, mode: 'dispatch' })
      const { container } = await renderShell()
      const nav = container.querySelector('nav.appNav') as HTMLElement
      expect(within(nav).getByLabelText('Dashboard')).toBeTruthy()
      expect(container.querySelector('nav[aria-label="Dispatch Mode tabs"]')!.getAttribute('data-compact')).toBe('true')
    })

    it('an assistant on the role dock keeps every press: the dock has no gear to move one to', async () => {
      setUp({ role: 'assistant', phone: true, switchOn: false, mode: 'dispatch' })
      const before = await renderShell()
      const old = rowPresses(before.container)
      expect(old).not.toContain('Settings')
      cleanup()
      setUp({ role: 'assistant', phone: true, switchOn: true, mode: 'dispatch' })
      const { container } = await renderShell()
      expect(rowPresses(container)).toEqual(old)
      expect(container.querySelector('[data-phone-bar-page]')).toBeNull()
    })

    it('the Bids page keeps its Bid press in the bar', async () => {
      setUp({ role: 'dev', phone: true, switchOn: true, mode: 'none' })
      const { container } = await renderShell('/bids')
      const nav = container.querySelector('nav.appNav') as HTMLElement
      expect(within(nav).getByLabelText('New Bid')).toBeTruthy()
      expect(nav.querySelector('[data-phone-bar-page]')!.textContent).toBe('Bids')
    })

    it('draws the bar at its small size and the tabs compact', async () => {
      setUp({ role: 'helpers', phone: true, switchOn: true, mode: 'job' })
      const { container } = await renderShell()
      expect(container.innerHTML).toContain(`--app-nav-pad-y: ${PHONE_BAR_PAD_Y_PX}px`)
      const gear = screen.getByTitle('Settings')
      expect(gear.style.minWidth).toBe(`${PHONE_BAR_PRESS_PX}px`)
      expect(gear.style.minHeight).toBe(`${PHONE_BAR_PRESS_PX}px`)
      const tabs = container.querySelector('nav[aria-label="Job Mode tabs"]') as HTMLElement
      expect(tabs.getAttribute('data-compact')).toBe('true')
      for (const tab of Array.from(tabs.querySelectorAll('button'))) {
        expect((tab as HTMLElement).style.minHeight).toBe('52px')
        expect(tab.textContent).toBeTruthy()
      }
    })
  })

  describe('the moved rows open what their presses opened', () => {
    it('Task Dispatch, Ask estimating and Task open the same windows, and Tell the dev asks for the same box', async () => {
      setUp({ role: 'helpers', phone: true, switchOn: true, mode: 'job' })
      const { container } = await renderShell()
      const asked: unknown[] = []
      const onAsk = (e: Event) => asked.push((e as CustomEvent).detail)
      window.addEventListener(TELL_THE_DEV_OPEN_EVENT, onAsk)
      const press = (name: string) => {
        fireEvent.click(screen.getByTitle('Settings'))
        const menu = container.querySelector('[data-navtrack="gear-menu"]') as HTMLElement
        fireEvent.click(within(menu).getByRole('button', { name }))
        // Every row closes the menu, as a row of the menu does.
        expect(container.querySelector('[data-navtrack="gear-menu"]')).toBeNull()
      }
      press('Task Dispatch')
      expect(doors.dispatch).toHaveBeenCalledTimes(1)
      press('Ask estimating')
      expect(doors.estimating).toHaveBeenCalledTimes(1)
      press('Task')
      expect(doors.task).toHaveBeenCalledTimes(1)
      press('Tell the dev')
      window.removeEventListener(TELL_THE_DEV_OPEN_EVENT, onAsk)
      expect(asked).toEqual([{ door: 'header' }])
    })

    it('People and Customers are links to the same pages', async () => {
      setUp({ role: 'assistant', phone: true, switchOn: true, mode: 'none' })
      const { container } = await renderShell()
      fireEvent.click(screen.getByTitle('Settings'))
      const menu = container.querySelector('[data-navtrack="gear-menu"]') as HTMLElement
      expect(menu.querySelector('[data-phone-bar-row="customers"]')!.getAttribute('href')).toBe('/customers')
      expect(menu.querySelector('[data-phone-bar-row="people"]')!.getAttribute('href')).toBe('/people')
      // Each is in the menu once: not in the Pages group as well.
      expect(within(menu).getAllByLabelText('People')).toHaveLength(1)
      expect(within(menu).getAllByLabelText('Customers')).toHaveLength(1)
    })
  })

  describe('the tick', () => {
    it('a leader on a phone ticks it, and the shell turns at once; the choice is the device’s', async () => {
      setUp({ role: 'master_technician', phone: true, switchOn: false })
      const { container } = await renderShell()
      fireEvent.click(screen.getByTitle('Settings'))
      const tick = container.querySelector(`[aria-label="${NEW_PHONE_LAYOUT_SWITCH_ARIA}"]`) as HTMLElement
      expect(tick.getAttribute('aria-pressed')).toBe('false')
      expect(tick.textContent).toBe('New phone layout')
      fireEvent.click(tick)
      await settle()
      expect(localStorage.getItem(NEW_PHONE_LAYOUT_STORAGE_KEY)).toBe('1')
      // No user id in the key: the next person on this phone, or a dev looking as another role, keeps it.
      expect(Object.keys(localStorage).filter((k) => k.includes('new_phone_layout'))).toEqual([NEW_PHONE_LAYOUT_STORAGE_KEY])
      expect(container.querySelector('[data-phone-bar-page]')).toBeTruthy()
    })

    it('a helper on a device that has it on is drawn the tick, and can switch it off', async () => {
      setUp({ role: 'helpers', phone: true, switchOn: true, mode: 'job' })
      const { container } = await renderShell()
      fireEvent.click(screen.getByTitle('Settings'))
      const tick = container.querySelector(`[aria-label="${NEW_PHONE_LAYOUT_SWITCH_ARIA}"]`) as HTMLElement
      expect(tick.getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(tick)
      await settle()
      expect(localStorage.getItem(NEW_PHONE_LAYOUT_STORAGE_KEY)).toBeNull()
      expect(container.querySelector('[data-phone-bar-page]')).toBeNull()
      // Off again, a helper is not offered it.
      fireEvent.click(screen.getByTitle('Settings'))
      expect(container.querySelector(`[aria-label="${NEW_PHONE_LAYOUT_SWITCH_ARIA}"]`)).toBeNull()
    })
  })

  describe('the Home Screen offer', () => {
    it('switch off, on a phone: the line above the header, on the Dashboard alone (punch list #428)', async () => {
      offer.show = true
      setUp({ role: 'helpers', phone: true, switchOn: false, mode: 'job' })
      const { container } = await renderShell('/dashboard')
      const line = container.querySelector('.appTopBanner[aria-label="Add Task home screen shortcut"]')
      expect(line).toBeTruthy()
      expect(container.querySelector('main')!.contains(line)).toBe(false)
    })

    it('switch off, on a phone: not drawn on any other page', async () => {
      offer.show = true
      setUp({ role: 'helpers', phone: true, switchOn: false, mode: 'job' })
      const { container } = await renderShell('/job-mode/schedule')
      expect(container.querySelector('[aria-label="Add Task home screen shortcut"]')).toBeNull()
    })

    it('at a desk: the line above the header, on every page, as it was', async () => {
      offer.show = true
      setUp({ role: 'helpers', phone: false, switchOn: false, mode: 'job' })
      const { container } = await renderShell('/job-mode/schedule')
      const line = container.querySelector('.appTopBanner[aria-label="Add Task home screen shortcut"]')
      expect(line).toBeTruthy()
      expect(container.querySelector('main')!.contains(line)).toBe(false)
    })

    it('switch on: one quiet row inside the Dashboard, with the same Add and the same remembered Dismiss', async () => {
      offer.show = true
      setUp({ role: 'helpers', phone: true, switchOn: true, mode: 'job' })
      const { container } = await renderShell('/dashboard')
      expect(container.querySelector('.appTopBanner[aria-label="Add Task home screen shortcut"]')).toBeNull()
      const rows = container.querySelectorAll('[aria-label="Add Task home screen shortcut"]')
      expect(rows).toHaveLength(1)
      const row = rows[0] as HTMLElement
      expect(row.getAttribute('data-add-task-offer')).toBe('quiet')
      expect(container.querySelector('main')!.contains(row)).toBe(true)
      expect(row.textContent).toContain('Add Task')
      expect(within(row).getByRole('button', { name: 'Add' })).toBeTruthy()
      fireEvent.click(within(row).getByRole('button', { name: 'Dismiss' }))
      expect(offer.dismissed).toHaveBeenCalledTimes(1)
      expect(container.querySelector('[aria-label="Add Task home screen shortcut"]')).toBeNull()
    })

    it('switch on: not drawn on any other page', async () => {
      offer.show = true
      setUp({ role: 'helpers', phone: true, switchOn: true, mode: 'job' })
      const { container } = await renderShell('/job-mode/schedule')
      expect(container.querySelector('[aria-label="Add Task home screen shortcut"]')).toBeNull()
    })
  })
})
