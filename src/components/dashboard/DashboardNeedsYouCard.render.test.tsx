// @vitest-environment jsdom
/**
 * Render smokes for the Needs You card (v2.2339): empty-state null render,
 * cards mode rows + actions, the Cards/Walk toggle with per-user persistence,
 * and walk mode's Skip rotation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DashboardNeedsYouCard } from './DashboardNeedsYouCard'
import type { NeedsYouItem } from '../../lib/dashboardNeedsYou'

vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))

const ITEMS: NeedsYouItem[] = [
  {
    key: 'ar-deposits',
    severity: 'blue',
    kicker: 'Money received',
    title: 'Allocate 2 bank deposits',
    detail: '2 Mercury transactions still have balance to apply.',
    figure: '2',
    actionLabel: 'Match deposits',
  },
  {
    key: 'tally-self',
    severity: 'amber',
    kicker: 'Your card purchases',
    title: '89 purchases need a job',
    detail: "Purchases over 2 days old aren't on a job yet.",
    figure: '89',
    actionLabel: 'Open tally',
  },
  {
    key: 'lost-bids',
    severity: 'gray',
    kicker: 'Win/loss hygiene',
    title: '61 lost bids have no reason recorded',
    detail: '$8.7M unexplained.',
    figure: '61',
    actionLabel: 'Start call mode',
  },
]

function renderCard(items: NeedsYouItem[] = ITEMS) {
  const onAction = vi.fn()
  const utils = render(<DashboardNeedsYouCard userId="u-1" role="dev" items={items} onAction={onAction} />)
  return { ...utils, onAction }
}

beforeEach(() => localStorage.clear())

describe('DashboardNeedsYouCard', () => {
  it('renders nothing when the list is empty (like the banners it replaces)', () => {
    const { container } = renderCard([])
    expect(container.innerHTML).toBe('')
  })

  it('cards mode: one row per item, count badge, action fires onAction', () => {
    const { onAction } = renderCard()
    expect(screen.getByText('Needs you')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('Allocate 2 bank deposits')).toBeTruthy()
    fireEvent.click(screen.getByText('Match deposits'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'ar-deposits' }))
  })

  it('the toggle switches to walk mode and persists per user', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText('Walk the list view'))
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(screen.getByText('Money received')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_needs_you_mode_u-1')).toBe('walk')
  })

  it('walk mode: Skip rotates through the list and shows what is next', () => {
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'walk')
    renderCard()
    expect(screen.getByText(/Next: 89 purchases need a job/)).toBeTruthy()
    fireEvent.click(screen.getByText('Skip for now'))
    expect(screen.getByText('2 of 3')).toBeTruthy()
    expect(screen.getByText('89 purchases need a job')).toBeTruthy()
    fireEvent.click(screen.getByText('Skip for now'))
    fireEvent.click(screen.getByText('Skip for now'))
    // Wrapped back to the first item.
    expect(screen.getByText('1 of 3')).toBeTruthy()
  })

  it('walk mode with a single item hides Skip', () => {
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'walk')
    renderCard([ITEMS[0] as NeedsYouItem])
    expect(screen.queryByText('Skip for now')).toBeNull()
  })
})
