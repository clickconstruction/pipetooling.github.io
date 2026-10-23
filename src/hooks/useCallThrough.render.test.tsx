// @vitest-environment jsdom
/**
 * To-do #152 (v2.5803): the hook behind every Call button. The seat is read from the Company phone seats row, own or
 * shared by the office; the company number from the boxes row, the team's when the box named has none; the kept pick
 * from this browser, and a pick in one button turns every other on the page at once; a failed read answers no seat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

const auth = vi.hoisted(() => ({ value: { user: { id: 'u-rosa' } } as { user: { id: string } | null } | null }))
vi.mock('./useAuth', () => ({ useOptionalAuth: () => auth.value }))
const io = vi.hoisted(() => ({
  load: vi.fn<() => Promise<{ seats: { quoUserId: string; userId: string }[]; boxes: unknown }>>(),
}))
vi.mock('../lib/quo/dialIo', () => ({ loadDialSettings: io.load, NO_DIAL_SETTINGS: { seats: [], boxes: null } }))

import { CALL_THROUGH_KEY } from '../lib/quo/dial'
import { useCallThrough } from './useCallThrough'

const BOXES = {
  team: { address: 'team@example.test', phone: '(512) 555-0144', numberId: 'PNteam' },
  bids: { address: 'bids@example.test', phone: '', numberId: '' },
}

function Probe({ id }: { id: string }) {
  const s = useCallThrough()
  return (
    <div>
      <output data-testid={`${id}-seat`}>{String(s.seat)}</output>
      <output data-testid={`${id}-kept`}>{String(s.kept)}</output>
      <output data-testid={`${id}-from`}>{`${s.fromFor('bids')}|${s.fromFor('team')}`}</output>
      <button type="button" onClick={() => s.keep('quo')}>keep quo</button>
      <button type="button" onClick={() => s.keep(null)}>forget</button>
    </div>
  )
}

beforeEach(() => {
  auth.value = { user: { id: 'u-rosa' } }
  io.load.mockReset()
  localStorage.clear()
})

describe('useCallThrough', () => {
  it('reads the seat, own or shared, and the box’s number with the team’s as the fallback', async () => {
    io.load.mockResolvedValue({ seats: [{ quoUserId: 'USrosa', userId: 'u-rosa' }], boxes: BOXES })
    render(<Probe id="a" />)
    expect(screen.getByTestId('a-seat').textContent).toBe('false')
    expect(screen.getByTestId('a-from').textContent).toBe('null|null')
    await waitFor(() => expect(screen.getByTestId('a-seat').textContent).toBe('true'))
    expect(screen.getByTestId('a-from').textContent).toBe('(512) 555-0144|(512) 555-0144')
  })

  it('is no seat for a person the card does not name, unless the office shares one', async () => {
    io.load.mockResolvedValue({ seats: [{ quoUserId: 'USdale', userId: 'u-dale' }], boxes: BOXES })
    render(<Probe id="b" />)
    await waitFor(() => expect(io.load).toHaveBeenCalled())
    await act(async () => undefined)
    expect(screen.getByTestId('b-seat').textContent).toBe('false')
    io.load.mockResolvedValue({ seats: [{ quoUserId: 'USdesk', userId: 'office' }], boxes: BOXES })
    document.body.innerHTML = ''
    render(<Probe id="c" />)
    await waitFor(() => expect(screen.getByTestId('c-seat').textContent).toBe('true'))
  })

  it('keeps the pick for every button on the page at once, and forgets it', async () => {
    io.load.mockResolvedValue({ seats: [], boxes: null })
    localStorage.setItem(CALL_THROUGH_KEY, 'phone')
    render(
      <>
        <Probe id="x" />
        <Probe id="y" />
      </>,
    )
    expect(screen.getByTestId('x-kept').textContent).toBe('phone')
    expect(screen.getByTestId('y-kept').textContent).toBe('phone')
    act(() => screen.getAllByRole('button', { name: 'keep quo' })[0].click())
    expect(screen.getByTestId('x-kept').textContent).toBe('quo')
    expect(screen.getByTestId('y-kept').textContent).toBe('quo')
    expect(localStorage.getItem(CALL_THROUGH_KEY)).toBe('quo')
    act(() => screen.getAllByRole('button', { name: 'forget' })[1].click())
    expect(screen.getByTestId('x-kept').textContent).toBe('null')
    expect(localStorage.getItem(CALL_THROUGH_KEY)).toBeNull()
  })

  it('is no seat with no sign-in', async () => {
    auth.value = null
    io.load.mockResolvedValue({ seats: [{ quoUserId: 'USdesk', userId: 'office' }], boxes: BOXES })
    render(<Probe id="n" />)
    await waitFor(() => expect(io.load).toHaveBeenCalled())
    await act(async () => undefined)
    expect(screen.getByTestId('n-seat').textContent).toBe('false')
  })
})
