// @vitest-environment jsdom
/**
 * v2.2815: the Users status column renders the same needs two ways — a three-cell rail on
 * wide screens, an hours counter + "Needs you" pill with a fold-out on narrow ones — and
 * every cell or verb opens the Desk at the section that answers it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { UsersNeedsFoldOut, UsersNeedsPill, UsersRailCells, UsersRailHeader } from './UsersTabStatusColumn'
import type { RowNeeds } from '../../lib/people/rowNeeds'

const taunya: RowNeeds = {
  hoursWaiting: 26,
  hoursTotal: 136.6,
  hoursLine: '26 sessions (136.6 h) waiting for approval',
  needs: [{ key: 'paperwork', subject: 'paperwork', tone: 'amber', count: 1, short: '1 unsent', long: '1 contract never sent. Some contracts signed.', verb: 'Send', door: 'paperwork' }],
  needCount: 1,
  attention: 'amber',
  reasons: ['1 contract never sent. Some contracts signed.'],
}
const behar: RowNeeds = {
  hoursWaiting: 0,
  hoursTotal: 0,
  hoursLine: null,
  needs: [{ key: 'no_push', subject: 'account', tone: 'fact', count: 0, short: 'no push', long: 'Push notifications are not enabled on their phone.', verb: 'How to enable', door: 'push' }],
  needCount: 0,
  attention: 'green',
  reasons: [],
}

afterEach(() => cleanup())

describe('UsersRailCells (wide)', () => {
  it('three cells in rail order; hours and paperwork are doors, an empty account cell is quiet', () => {
    const openDesk = vi.fn()
    render(<UsersRailCells rowNeeds={taunya} name="Taunya" openDesk={openDesk} />)
    const hours = screen.getByRole('button', { name: /Taunya: 26 sessions/ })
    fireEvent.click(hours)
    expect(openDesk).toHaveBeenLastCalledWith('hours')
    fireEvent.click(screen.getByRole('button', { name: /Taunya: 1 contract never sent/ }))
    expect(openDesk).toHaveBeenLastCalledWith('paperwork')
    expect(screen.getByLabelText('Taunya: account in order').tagName).toBe('SPAN')
    expect(screen.getByTestId('users-rail').textContent).toContain('26')
  })
  it('the header names the three columns once', () => {
    render(<UsersRailHeader />)
    expect(screen.getByTitle('Hours to approve').textContent).toBe('Hours')
  })
})

describe('UsersNeedsPill (narrow)', () => {
  it('counts only real needs, the pill toggles, and the fold-out verb opens the section', () => {
    const openDesk = vi.fn()
    const onToggle = vi.fn()
    render(<UsersNeedsPill rowNeeds={taunya} name="Taunya" openDesk={openDesk} open={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: /Needs you · 1/ }))
    expect(onToggle).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /Taunya: 26 sessions/ }))
    expect(openDesk).toHaveBeenLastCalledWith('hours')
    render(<UsersNeedsFoldOut rowNeeds={taunya} name="Taunya" openDesk={openDesk} />)
    fireEvent.click(screen.getByText('Send ›'))
    expect(openDesk).toHaveBeenLastCalledWith('paperwork')
  })
  it('a row with only facts reads Clear but still lists them; no needs at all is a plain Clear', () => {
    const openDesk = vi.fn()
    render(<UsersNeedsPill rowNeeds={behar} name="Behar" openDesk={openDesk} open={true} onToggle={() => undefined} />)
    expect(screen.getByRole('button', { name: /Clear/ }).getAttribute('aria-expanded')).toBe('true')
    render(<UsersNeedsFoldOut rowNeeds={behar} name="Behar" openDesk={openDesk} />)
    fireEvent.click(screen.getByText('How to enable ›'))
    expect(openDesk).toHaveBeenLastCalledWith('push')
    cleanup()
    render(<UsersNeedsPill rowNeeds={{ ...behar, needs: [] }} name="Grace" open={false} onToggle={() => undefined} />)
    expect(screen.getByText('Clear').tagName).toBe('SPAN')
  })
})
