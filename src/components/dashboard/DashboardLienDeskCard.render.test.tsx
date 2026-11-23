// @vitest-environment jsdom
/**
 * The Lien desk's card on the Dashboard (punch list #423): the label and its door on one line, three values,
 * a red line only while a paper is late or at risk, and one press that opens the Board. A phone draws the
 * values side by side under the label's line. A desk draws the same pieces as one line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { LienDeskCard } from '../../lib/dashboard/lienDeskCard'
import DashboardLienDeskCard from './DashboardLienDeskCard'

const phone = { on: true }
const recordNavClick = vi.fn()
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => phone.on }))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: (...args: unknown[]) => recordNavClick(...args) }))

// Made-up counts.
const CARD: LienDeskCard = {
  values: [
    { key: 'by_day', figure: '14', words: 'by Dec 15', tone: 'red' },
    { key: 'waiting', figure: '6', words: 'wait on you', tone: null },
    { key: 'in_mail', figure: '5', words: 'to print and mail', tone: null },
  ],
  line: '3 are past their day.',
}
const CALM: LienDeskCard = { values: CARD.values.map((v) => ({ ...v, tone: null })), line: null }

const values = (root: HTMLElement) => Array.from(root.querySelectorAll('[data-lien-desk-card-value]')).map((el) => `${el.getAttribute('data-lien-desk-card-value')}:${el.getAttribute('data-tone') ?? ''}:${el.textContent}`)

beforeEach(() => {
  phone.on = true
  recordNavClick.mockClear()
})
afterEach(cleanup)

describe('DashboardLienDeskCard', () => {
  it('on a phone: the label and The Board on one line, then three values, then the red line', () => {
    render(<DashboardLienDeskCard card={CARD} userId="u1" role="master_technician" />)
    const card = screen.getByRole('button', { name: /Lien desk.*The Board/ })
    expect(card.getAttribute('data-layout')).toBe('card')
    // The door shares the label's line: it is the second piece of the first row, never a row of its own.
    const head = card.firstElementChild as HTMLElement
    expect(head.textContent).toBe('Lien deskThe Board ›')
    expect(values(card)).toEqual(['by_day:red:14by Dec 15', 'waiting::6wait on you', 'in_mail::5to print and mail'])
    expect(card.querySelector('[data-lien-desk-card-line]')!.textContent).toBe('3 are past their day.')
    expect(card.textContent).not.toContain('$')
  })

  it('draws each count as a worked-out value, and only the day’s in red', () => {
    render(<DashboardLienDeskCard card={CARD} userId="u1" role="master_technician" />)
    const worked = Array.from(document.querySelectorAll('[data-value="worked-out"]'))
    expect(worked.map((el) => `${el.textContent}:${el.getAttribute('data-tone') ?? ''}`)).toEqual(['14:red', '6:', '5:'])
  })

  it('for the office the middle count names the leader, and only the day’s count keeps its width on a phone (v2.8372)', () => {
    const named: LienDeskCard = { values: CARD.values.map((v) => (v.key === 'waiting' ? { ...v, words: 'waiting on Sam' } : v)), line: null }
    render(<DashboardLienDeskCard card={named} userId="u1" role="assistant" />)
    const card = screen.getByRole('button', { name: /Lien desk.*The Board/ })
    expect(values(card)).toEqual(['by_day:red:14by Dec 15', 'waiting::6waiting on Sam', 'in_mail::5to print and mail'])
    // A long name wraps inside its column rather than push the card past the screen's edge.
    const shrink = Array.from(card.querySelectorAll<HTMLElement>('[data-lien-desk-card-value]')).map((el) => el.style.flexShrink)
    expect(shrink).toEqual(['0', '1', '1'])
  })

  it('with nothing late or at risk there is no red line and no red count', () => {
    render(<DashboardLienDeskCard card={CALM} userId="u1" role="assistant" />)
    expect(document.querySelector('[data-lien-desk-card-line]')).toBeNull()
    expect(document.querySelector('[data-tone="red"]')).toBeNull()
  })

  it('at a desk the same pieces are one line, the door at its end', () => {
    phone.on = false
    render(<DashboardLienDeskCard card={CARD} userId="u1" role="controller" />)
    const card = screen.getByRole('button', { name: /Lien desk.*The Board/ })
    expect(card.getAttribute('data-layout')).toBe('line')
    expect(card.textContent).toBe('Lien desk14by Dec 156wait on you5to print and mail3 are past their day.The Board ›')
    expect(values(card)).toHaveLength(3)
  })

  it('is one press: it opens the Board and counts the click as the strip’s was', () => {
    const onOpenBoard = vi.fn()
    render(<DashboardLienDeskCard card={CARD} userId="u1" role="master_technician" onOpenBoard={onOpenBoard} />)
    expect(document.querySelectorAll('button')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpenBoard).toHaveBeenCalledTimes(1)
    expect(recordNavClick).toHaveBeenCalledWith('u1', 'master_technician', 'needs-you', '#lien-board')
  })

  it('draws nothing with no card', () => {
    const { container } = render(<DashboardLienDeskCard card={null} userId="u1" role="assistant" />)
    expect(container.firstChild).toBeNull()
    cleanup()
    const empty = render(<DashboardLienDeskCard card={{ values: [], line: null }} userId="u1" role="assistant" />)
    expect(empty.container.firstChild).toBeNull()
  })
})
