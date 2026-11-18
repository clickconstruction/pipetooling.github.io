// @vitest-environment jsdom
/**
 * The bar's Dashboard tab for a person on Short (punch list #365, PR 4): it opens the short page with the state
 * that leaves Everything else, and that page lights it. For everyone else it still opens the Dispatch home.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { isShortDashboardHomePress } from '../../lib/dashboard/shortDashboard'
import { DispatchModeFooter } from './DispatchModeFooter'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'master_technician' }) }))
vi.mock('../../hooks/useOnScreenKeyboardOpen', () => ({ useOnScreenKeyboardOpen: () => false }))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

afterEach(cleanup)

function Where() {
  const l = useLocation()
  return <output data-where data-home={String(isShortDashboardHomePress(l.state))}>{l.pathname}</output>
}

function draw(at: string, shortHome: boolean) {
  render(
    <MemoryRouter initialEntries={[at]}>
      <Where />
      <DispatchModeFooter shortHome={shortHome} />
    </MemoryRouter>,
  )
  return { tab: screen.getByRole('button', { name: 'Dashboard' }), where: () => document.querySelector('[data-where]') as HTMLElement }
}

describe('the bar\'s Dashboard tab', () => {
  it('on Short it opens the short page, and says it is the way home', () => {
    const { tab, where } = draw('/dispatch-mode/schedule', true)
    fireEvent.click(tab)
    expect(where().textContent).toBe('/dashboard')
    expect(where().getAttribute('data-home')).toBe('true')
  })

  it('on Short the short page lights the tab', () => {
    expect(draw('/dashboard', true).tab.getAttribute('aria-current')).toBe('page')
  })

  it('on Full it opens the Dispatch home, as before', () => {
    const { tab, where } = draw('/dispatch-mode/schedule', false)
    fireEvent.click(tab)
    expect(where().textContent).toBe('/dispatch-mode')
    expect(where().getAttribute('data-home')).toBe('false')
  })

  it('on Full the Dashboard page does not light the tab', () => {
    expect(draw('/dashboard', false).tab.getAttribute('aria-current')).toBeNull()
  })

  it('the other tabs are untouched on Short', () => {
    const { where } = draw('/dashboard', true)
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(where().textContent).toBe('/dispatch-mode/schedule')
    expect(where().getAttribute('data-home')).toBe('false')
  })
})

describe('Job Mode\'s Dashboard tab (punch list #384)', () => {
  function drawJob(at: string, shortHome: boolean) {
    render(
      <MemoryRouter initialEntries={[at]}>
        <Where />
        <DispatchModeFooter variant="job" shortHome={shortHome} />
      </MemoryRouter>,
    )
    return { tab: screen.getByRole('button', { name: 'Dashboard' }), where: () => document.querySelector('[data-where]') as HTMLElement }
  }

  it('on the short Job Mode page the tab is the way home: the same page, with the mark that leaves Everything else', () => {
    const { tab, where } = drawJob('/dashboard', true)
    expect(tab.getAttribute('aria-current')).toBe('page')
    fireEvent.click(tab)
    expect(where().textContent).toBe('/dashboard')
    expect(where().getAttribute('data-home')).toBe('true')
  })

  it('for everyone else in Job Mode the tab opens the Dashboard with no mark, as before', () => {
    const { tab, where } = drawJob('/job-mode/schedule', false)
    fireEvent.click(tab)
    expect(where().textContent).toBe('/dashboard')
    expect(where().getAttribute('data-home')).toBe('false')
  })

  it('the short page\'s other tabs are Job Mode\'s own', () => {
    const { where } = drawJob('/dashboard', true)
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(where().textContent).toBe('/job-mode/schedule')
    expect(where().getAttribute('data-home')).toBe('false')
  })
})
