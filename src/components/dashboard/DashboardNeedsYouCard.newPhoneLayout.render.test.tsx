// @vitest-environment jsdom
/**
 * The Needs you card under the new phone layout: with no saved choice it opens on Walk the list for every
 * role, with the Cards chip beside it as before. A saved choice still wins, and with the switch off, or at a
 * desk, the card opens as it opened before the switch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DashboardNeedsYouCard } from './DashboardNeedsYouCard'
import type { NeedsYouItem } from '../../lib/dashboardNeedsYou'
import type { UserRole } from '../../hooks/useAuth'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
const scenario = { phone: true, stored: false }
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => scenario.phone }))
// The hook's own rule: the tick AND a phone's width.
vi.mock('../../hooks/useNewPhoneLayout', () => ({ useNewPhoneLayout: () => ({ on: scenario.stored && scenario.phone, stored: scenario.stored, setStored: () => {} }) }))

const ITEMS: NeedsYouItem[] = [
  { key: 'tally-self', severity: 'amber', kicker: 'Your card purchases', title: '89 purchases need a job', detail: 'Purchases over 2 days old.', figure: '89', actionLabel: 'Open tally' },
  { key: 'ar-deposits', severity: 'blue', kicker: 'Money received', title: 'Allocate 2 bank deposits', detail: '2 Mercury transactions.', figure: '2', actionLabel: 'Match deposits' },
  { key: 'lost-bids', severity: 'gray', kicker: 'Win/loss hygiene', title: '61 lost bids have no reason recorded', detail: '$8.7M unexplained.', figure: '61', actionLabel: 'Start call mode' },
]
const ROLES: UserRole[] = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']
const KEY = 'pipetooling_needs_you_mode_u-1'

const draw = (role: UserRole) => render(<DashboardNeedsYouCard userId="u-1" role={role} items={ITEMS} onAction={() => {}} />)
const chip = (name: string) => screen.getByRole('button', { name: `${name} view` })
const onWalk = () => chip('Walk the list').getAttribute('aria-pressed') === 'true'

beforeEach(() => {
  cleanup()
  localStorage.clear()
  scenario.phone = true
  scenario.stored = false
})

describe('DashboardNeedsYouCard · the new phone layout', () => {
  it('switch on: every role opens on Walk the list, with Cards one chip away, and nothing is stored', () => {
    scenario.stored = true
    for (const role of ROLES) {
      const { unmount } = draw(role)
      expect(onWalk(), role).toBe(true)
      expect(chip('Cards').getAttribute('aria-pressed'), role).toBe('false')
      expect(screen.getByText('1 of 3'), role).toBeTruthy()
      expect(screen.getByText('Skip for now'), role).toBeTruthy()
      // A default, not a choice: the device keeps nothing until the person presses a chip.
      expect(localStorage.getItem(KEY), role).toBeNull()
      unmount()
    }
  })

  it('switch on: the Cards chip draws the whole stack and the choice is kept, as it always was', () => {
    scenario.stored = true
    const first = draw('master_technician')
    fireEvent.click(chip('Cards'))
    expect(onWalk()).toBe(false)
    expect(screen.queryByText('1 of 3')).toBeNull()
    // The viewer's own line is drawn, and the office's two sit folded under their name.
    expect(screen.getByText('89 purchases need a job')).toBeTruthy()
    expect(screen.getByText('The office is on these')).toBeTruthy()
    expect(localStorage.getItem(KEY)).toBe('cards')
    first.unmount()
    // The next visit opens on what the person chose.
    draw('master_technician')
    expect(onWalk()).toBe(false)
  })

  it('switch on or off, a phone\'s Cards rows are two columns: the words, then the press on the right (v2.8329)', () => {
    for (const stored of [true, false]) {
      scenario.stored = stored
      localStorage.setItem(KEY, 'cards')
      const { unmount } = draw('assistant')
      const rows = Array.from(document.querySelectorAll('[data-needs-you-row]')) as HTMLElement[]
      expect(rows.length, String(stored)).toBe(ITEMS.length)
      for (const row of rows) {
        expect(row.getAttribute('data-needs-you-layout'), String(stored)).toBe('phone')
        const [words, pressColumn] = Array.from(row.children) as [HTMLElement, HTMLElement]
        expect(words.hasAttribute('data-needs-you-words'), String(stored)).toBe(true)
        expect(pressColumn.hasAttribute('data-needs-you-press-column'), String(stored)).toBe(true)
        const press = pressColumn.querySelector('button') as HTMLElement
        expect(press.style.width, String(stored)).toBe('100%')
        expect(press.style.minHeight, String(stored)).toBe('44px')
        // Each fixture's title says its own count, so no row draws it a second time.
        expect(pressColumn.querySelector('[data-needs-you-figure]'), String(stored)).toBeNull()
      }
      expect(new Set(rows.map((r) => r.style.gridTemplateColumns)).size, String(stored)).toBe(1)
      unmount()
      localStorage.clear()
    }
  })

  it('switch on: a choice saved before the switch still wins', () => {
    scenario.stored = true
    localStorage.setItem(KEY, 'cards')
    for (const role of ROLES) {
      const { unmount } = draw(role)
      expect(onWalk(), role).toBe(false)
      unmount()
    }
  })

  it('switch off: the card opens as it did, Walk for the office roles on a phone and Cards for everyone else', () => {
    const walk: UserRole[] = ['assistant', 'controller', 'estimator', 'primary']
    for (const role of ROLES) {
      const { unmount } = draw(role)
      expect(onWalk(), role).toBe(walk.includes(role))
      unmount()
    }
  })

  it('at a desk the tick changes nothing: every role opens on Cards', () => {
    scenario.phone = false
    scenario.stored = true
    for (const role of ROLES) {
      const { unmount } = draw(role)
      expect(onWalk(), role).toBe(false)
      unmount()
    }
  })
})
