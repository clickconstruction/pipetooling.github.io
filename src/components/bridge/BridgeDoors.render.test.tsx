// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeDoors } from './BridgeDoors'
import { BridgeSoftNumbers } from './BridgeSoftNumbers'
import type { SoftNumber } from '../../lib/bridge/softNumbers'

describe('BridgeDoors', () => {
  it('draws the three doors and the soft count, marks the open one, and hands back the door pressed', () => {
    const onDoor = vi.fn()
    renderWithProviders(<BridgeDoors door="money" softCount={7} onDoor={onDoor} />)
    expect(screen.getByTestId('bridge-door-flow').getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByTestId('bridge-door-money').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('bridge-door-people').textContent).toContain('People')
    expect(screen.getByTestId('bridge-door-soft').textContent).toContain('7 soft numbers')
    fireEvent.click(screen.getByTestId('bridge-door-flow'))
    expect(onDoor).toHaveBeenCalledWith('flow')
    // Pressing the open door is the page's cue to close it.
    fireEvent.click(screen.getByTestId('bridge-door-money'))
    expect(onDoor).toHaveBeenLastCalledWith('money')
  })

  it('has no Soft numbers door when nothing is soft', () => {
    renderWithProviders(<BridgeDoors door={null} softCount={0} onDoor={() => {}} />)
    expect(screen.queryByTestId('bridge-door-soft')).toBeNull()
    expect(screen.getAllByRole('button').length).toBe(3)
  })
})

describe('BridgeSoftNumbers', () => {
  it('lists each soft number with what it moves and its door', () => {
    // Made-up numbers.
    const rows: SoftNumber[] = [
      { key: 'unapproved', name: '93 hours wait on approval', moves: 'This week reads $2.1k until they are approved. With them it is about $9.8k.', door: { to: '/people?tab=hours&approvals=1', label: 'Approve' } },
      { key: 'cash_typed', name: 'Cash was typed Sep 3', moves: 'The bank could not be read, so the typed figure stands.', door: null },
    ]
    renderWithProviders(<BridgeSoftNumbers rows={rows} />)
    expect(screen.getByTestId('bridge-soft-unapproved').textContent).toContain('93 hours wait on approval')
    expect(screen.getByTestId('bridge-soft-unapproved').textContent).toContain('With them it is about $9.8k.')
    expect(screen.getByRole('link', { name: 'Approve ›' }).getAttribute('href')).toBe('/people?tab=hours&approvals=1')
    // A row with no door is words alone.
    expect(screen.getByTestId('bridge-soft-cash_typed').querySelector('a')).toBeNull()
  })
})
