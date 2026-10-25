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
const phone = { on: false }
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => phone.on }))

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

// The fixtures are the office's lines, so the mechanics render as the assistant, whose lines they are (v2.5843: a dev reads them folded).
function renderCard(items: NeedsYouItem[] = ITEMS, role: 'dev' | 'assistant' | 'master_technician' = 'assistant') {
  const onAction = vi.fn()
  const utils = render(<DashboardNeedsYouCard userId="u-1" role={role} items={items} onAction={onAction} />)
  return { ...utils, onAction }
}

beforeEach(() => {
  localStorage.clear()
  phone.on = false
})

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

  it('on a phone an office role opens on Walk with nothing saved; a saved Cards choice and a dev keep Cards (v2.3881)', () => {
    phone.on = true
    const a = renderCard(ITEMS, 'assistant')
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(localStorage.getItem('pipetooling_needs_you_mode_u-1')).toBeNull() // a default, not a choice
    a.unmount()
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'cards')
    const b = renderCard(ITEMS, 'assistant')
    expect(screen.queryByText('1 of 3')).toBeNull()
    b.unmount()
    localStorage.clear()
    renderCard(ITEMS, 'dev')
    expect(screen.queryByText('1 of 3')).toBeNull()
  })

  it('the trail: a skipped card goes to the back and onto the trail, a tap brings it back, and an acted one is listed (v2.3881)', () => {
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'walk')
    const { onAction, container } = renderCard()
    expect(container.querySelector('[data-needs-you-trail]')).toBeNull()
    fireEvent.click(screen.getByText('Skip for now'))
    // The skipped card is last in the round, not next.
    expect(screen.getByText(/Next: 61 lost bids/)).toBeTruthy()
    expect(screen.getByText(/Then: Allocate 2 bank deposits/)).toBeTruthy()
    const trail = container.querySelector('[data-needs-you-trail]') as HTMLElement
    expect(trail.textContent).toContain('Handled this visit:')
    fireEvent.click(screen.getByRole('button', { name: /Allocate 2 bank deposits/ }))
    expect(screen.getByText('1 of 3')).toBeTruthy()
    expect(screen.getByText('Money received')).toBeTruthy()
    fireEvent.click(screen.getByText('Match deposits'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'ar-deposits' }))
    expect(trail.querySelectorAll('button').length).toBe(1) // one entry per item
  })

  it('an item the work cleared stays on the trail as done, without a door', () => {
    localStorage.setItem('pipetooling_needs_you_mode_u-1', 'walk')
    const onAction = vi.fn()
    const { rerender, container } = render(<DashboardNeedsYouCard userId="u-1" role="assistant" items={ITEMS} onAction={onAction} />)
    fireEvent.click(screen.getByText('Match deposits'))
    rerender(<DashboardNeedsYouCard userId="u-1" role="assistant" items={ITEMS.slice(1)} onAction={onAction} />)
    const trail = container.querySelector('[data-needs-you-trail]') as HTMLElement
    expect(trail.textContent).toContain('✓ Allocate 2 bank deposits')
    expect(trail.querySelector('button')).toBeNull()
    expect(screen.getByText('1 of 2')).toBeTruthy()
  })
})

describe('DashboardNeedsYouCard · whose line it is (punch list #176, change 3)', () => {
  it('the owner reads the office lines folded, with a summary, and opens them with Show; the walk still reaches them', () => {
    const { onAction } = renderCard(ITEMS, 'master_technician')
    // tally-self is the viewer's own; the deposits and the lost bids are the office's.
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2 for others')).toBeTruthy()
    expect(screen.getByText('The office is on these')).toBeTruthy()
    expect(screen.queryByText('Match deposits')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show the office is on these' }))
    fireEvent.click(screen.getByText('Match deposits'))
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ key: 'ar-deposits' }))
    fireEvent.click(screen.getByLabelText('Walk the list view'))
    expect(screen.getByText('1 of 3')).toBeTruthy()
  })

  it('the assistant sees what waits on the owner, folded', () => {
    const owners: NeedsYouItem = { key: 'bulk-delete', severity: 'red', kicker: 'Data safety', title: 'Bulk deletions detected', detail: '', figure: '5', actionLabel: 'Review deletions' }
    renderCard([...ITEMS, owners], 'assistant')
    expect(screen.getByText('Waiting on the owner')).toBeTruthy()
    expect(screen.queryByText('Review deletions')).toBeNull()
    expect(screen.getByText('Allocate 2 bank deposits')).toBeTruthy()
  })
})
