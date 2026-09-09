// @vitest-environment jsdom
/**
 * Render smokes for UsersTabPhoneRow (v2.3185) — the phone directory row with
 * the swipe strip (Desk · Imitate · More).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { RailRow } from '../../lib/people/deskRailAttention'
import type { RowNeeds } from '../../lib/people/rowNeeds'
import { UsersTabPhoneRow } from './UsersTabPhoneRow'

const rail = (over: Partial<RailRow> = {}): RailRow =>
  ({
    userId: 'u1',
    personId: null,
    name: 'Malachi',
    kind: 'master_technician',
    archived: false,
    attention: 'red',
    badge: '',
    reasons: ['1 expiring license'],
    signals: [],
    rowNeeds: { hoursWaiting: 4, hoursLine: '4 sessions waiting', attention: 'red', reasons: ['1 expiring license'], needs: [{ subject: 'paperwork', tone: 'red', count: 1 }] } as unknown as RowNeeds,
    ...over,
  }) as RailRow

const item = { source: 'user' as const, id: 'u1', name: 'Malachi', email: 'malachi@clickplumbing.com', phone: null, notes: 'Master Plumber (#RMP41130)' }

describe('UsersTabPhoneRow', () => {
  it('shows the initial, name, note, hours count and Needs you pill; a tap opens the desk', () => {
    const openDesk = vi.fn()
    render(<UsersTabPhoneRow item={item} rail={rail()} openDesk={openDesk} imitating={false} more={[]} swipeOpen={false} onSwipeChange={vi.fn()} />)
    const row = screen.getByRole('button', { name: /Malachi — swipe left for actions/ })
    expect(row.textContent).toContain('M')
    expect(row.textContent).toContain('Master Plumber (#RMP41130)')
    expect(row.textContent).toContain('⏱ 4')
    expect(row.textContent).toContain('Needs you 1')
    fireEvent.click(row)
    expect(openDesk).toHaveBeenCalledTimes(1)
  })

  it('reveals Desk · Imitate · More when open; Imitate fires once, closes the strip, and never asks', () => {
    const imitate = vi.fn()
    const onSwipeChange = vi.fn()
    render(
      <UsersTabPhoneRow
        item={item}
        rail={rail()}
        openDesk={vi.fn()}
        imitate={imitate}
        imitating={false}
        more={[{ key: 'note', label: 'Edit name, title & phone', onClick: vi.fn() }]}
        swipeOpen
        onSwipeChange={onSwipeChange}
      />,
    )
    expect(screen.getByRole('button', { name: 'Desk — Malachi' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'More — Malachi' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Imitate — Malachi' }))
    expect(imitate).toHaveBeenCalledTimes(1)
    expect(onSwipeChange).toHaveBeenLastCalledWith(false)
  })

  it('More lists the row\'s other actions under the row and a pick closes everything', () => {
    const edit = vi.fn()
    const onSwipeChange = vi.fn()
    render(<UsersTabPhoneRow item={item} rail={rail()} imitating={false} more={[{ key: 'note', label: 'Edit name, title & phone', onClick: edit }]} swipeOpen onSwipeChange={onSwipeChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'More — Malachi' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit name, title & phone' }))
    expect(edit).toHaveBeenCalledTimes(1)
    expect(onSwipeChange).toHaveBeenLastCalledWith(false)
  })

  it('a roster-only row reads "no login", gets no Imitate, and a twin shows the robot', () => {
    const { rerender } = render(
      <UsersTabPhoneRow item={{ ...item, source: 'people', id: 'p1', name: 'Paige', notes: null }} rail={rail({ userId: null, personId: 'p1', name: 'Paige', attention: 'green', reasons: [], rowNeeds: undefined })} imitating={false} more={[]} swipeOpen={false} onSwipeChange={vi.fn()} />,
    )
    expect(screen.getByTestId('users-tab-phone-row').textContent).toContain('no login')
    expect(screen.queryByRole('button', { name: /Imitate/ })).toBeNull()
    rerender(<UsersTabPhoneRow item={{ ...item, name: 'Twin Estimator 2', email: 'twin-estimator-2@twins.pipetooling.local', notes: null }} rail={rail({ name: 'Twin Estimator 2' })} imitating={false} more={[]} swipeOpen={false} onSwipeChange={vi.fn()} />)
    expect(screen.getByTestId('users-tab-phone-row').textContent).toContain('🤖')
  })

  it('keyboard: ArrowLeft opens the strip, ArrowRight closes it', () => {
    const onSwipeChange = vi.fn()
    render(<UsersTabPhoneRow item={item} rail={rail()} openDesk={vi.fn()} imitating={false} more={[]} swipeOpen={false} onSwipeChange={onSwipeChange} />)
    const row = screen.getByRole('button', { name: /Malachi/ })
    fireEvent.keyDown(row, { key: 'ArrowLeft' })
    expect(onSwipeChange).toHaveBeenLastCalledWith(true)
    fireEvent.keyDown(row, { key: 'ArrowRight' })
    expect(onSwipeChange).toHaveBeenLastCalledWith(false)
  })
})
