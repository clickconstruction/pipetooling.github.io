// @vitest-environment jsdom
/**
 * Render smoke for the Share step's body, moved out of `BidsSubmittalsTab.tsx` (2026-10-04): the
 * seam pinned. It draws what it is handed and reports each press; nothing is written here.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SubmittalRoomPanel, type SubmittalRoomPanelProps } from './SubmittalRoomPanel'
import type { SubmittalEventRow, SubmittalPersonRow, SubmittalRoomRow } from '../../lib/submittals/submittalRoom'

const room = { id: 'room', bid_id: 'b', token: 'a'.repeat(48), status: 'open', shared_at: '2026-09-16T15:00:00Z', closed_at: null } as unknown as SubmittalRoomRow
const dana = { id: 'p1', room_id: 'room', name: 'Dana Whitfield', email: 'dana@arch.test', role: 'architect', may_decide: true, token: 'b'.repeat(48), how: 'named', invited_by: null, first_seen_at: null, last_seen_at: null, open_count: 0, closed_at: null, created_at: '', updated_at: '' } as unknown as SubmittalPersonRow
const view = { id: 'e1', room_id: 'room', person_id: null, submittal_id: null, event_type: 'view', metadata: {}, occurred_at: '2026-09-17T15:00:00Z' } as unknown as SubmittalEventRow

function mount(over: Partial<SubmittalRoomPanelProps> = {}) {
  const on = { onShare: vi.fn(), onCloseRoom: vi.fn(), onReopenRoom: vi.fn(), onSetMayDecide: vi.fn(), onClosePerson: vi.fn() }
  renderWithProviders(
    <SubmittalRoomPanel showShare revisionShared={false} shareGate={{ on: true, why: null }} room={room} roomLine="Room link · shared Sep 16 · opened 1×" people={[dana]} events={[view]} decidedBy={() => 3} busy={false} {...on} {...over} />,
  )
  return on
}

describe('SubmittalRoomPanel', () => {
  it('the Share button with its line, the room line, and a person with their trail and switch', () => {
    const on = mount()
    expect(screen.getByTestId('share-button').textContent).toBe('Share')
    expect(screen.getByTestId('share-caption').textContent).toBe('The same link shows every later version.')
    expect(screen.getByTestId('room-line').textContent).toContain('Room link · shared Sep 16 · opened 1×')
    const people = screen.getByTestId('room-people')
    expect(people.textContent).toContain('Dana Whitfield · architect')
    expect(people.textContent).toContain('decided 3')
    expect(people.textContent).toContain('+ 1 open')
    fireEvent.click(screen.getByTestId('share-button'))
    expect(on.onShare).toHaveBeenCalledTimes(1)
    fireEvent.click(within(people).getByRole('button', { name: 'watching' }))
    expect(on.onSetMayDecide).toHaveBeenCalledWith('p1', false)
    fireEvent.click(screen.getByRole('button', { name: "Close Dana Whitfield's link" }))
    expect(on.onClosePerson).toHaveBeenCalledWith('p1')
    fireEvent.click(screen.getByRole('button', { name: 'Close the room' }))
    expect(on.onCloseRoom).toHaveBeenCalledTimes(1)
  })

  it('a held Share says what turns it on; a shared revision reads share again', () => {
    mount({ shareGate: { on: false, why: 'Share turns on once the package is built.' }, room: null, roomLine: '', people: [], events: [] })
    expect((screen.getByTestId('share-button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('share-caption').textContent).toBe('Share turns on once the package is built.')
    expect(screen.queryByTestId('room-line')).toBeNull()
  })

  it('a closed room holds Share and offers Reopen; with nobody on it, it says so', () => {
    const on = mount({ revisionShared: true, room: { ...room, status: 'closed' } as SubmittalRoomRow, roomLine: 'Room closed · Sep 19', people: [], events: [] })
    expect(screen.getByTestId('share-button').textContent).toBe('Shared · share again')
    expect((screen.getByTestId('share-button') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('room-line').textContent).toContain('Nobody has identified themselves yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(on.onReopenRoom).toHaveBeenCalledTimes(1)
  })

  it('no Share button on an older revision: the room alone', () => {
    mount({ showShare: false })
    expect(screen.queryByTestId('share-button')).toBeNull()
    expect(screen.getByTestId('room-line')).toBeTruthy()
  })
})
