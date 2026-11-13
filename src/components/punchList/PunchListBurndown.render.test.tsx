// @vitest-environment jsdom
/** Render smoke for the punch list's burndown. */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { PunchListBurndown } from './PunchListBurndown'
import { EMPTY_HISTORY, historyFromStates, type HistoryCard, type PunchListHistory } from '../../lib/todos/punchListHistory'
import type { BoardItem } from '../../lib/todos/todoBoard'

const row = (over: Partial<BoardItem>): BoardItem => ({
  slug: 'a',
  number: 1,
  flagged: false,
  group: 'ready',
  name: 'A row',
  file: 'to-dos/a.md',
  pointer: false,
  summary: 's',
  next: 'n',
  size: 'S',
  blocker: 'none',
  ver: '',
  opinion: '',
  mockups: [],
  artifacts: [],
  mockup: 'waiting',
  mockupNote: '',
  ...over,
})

const HOUR = 3600
/** 2026-11-02 06:00 UTC, midnight on the app calendar. */
const T0 = Date.UTC(2026, 10, 2, 6) / 1000
const NOW = (T0 + 48 * HOUR + 1800) * 1000
const card = (n: number, g: HistoryCard['g'], p: number): HistoryCard => ({ n, g, p })

/** Two days: three cards, a fourth arrives, one closes, one moves on to Close out. */
const history: PunchListHistory = {
  shallow: false,
  events: historyFromStates([
    { t: T0 + 600, cards: [card(1, 'ready', 2), card(2, 'gated', 8), card(3, 'ready', 4)] },
    { t: T0 + 10 * HOUR, cards: [card(1, 'ready', 2), card(2, 'gated', 8), card(3, 'ready', 4), card(4, 'waiting', 4)] },
    { t: T0 + 20 * HOUR, cards: [card(1, 'ready', 2), card(2, 'gated', 8), card(4, 'waiting', 4)] },
    { t: T0 + 30 * HOUR, cards: [card(1, 'close', 2), card(2, 'gated', 8), card(4, 'waiting', 4)] },
  ]),
}

const items: BoardItem[] = [
  row({ slug: 'one', number: 1, group: 'close', size: 'S' }),
  row({ slug: 'two', number: 2, group: 'gated', size: 'L' }),
  row({ slug: 'four', number: 4, group: 'waiting', size: 'M' }),
  row({ slug: 'pointer', number: 5, group: 'gated', pointer: true, size: 'a sitting' }),
]

// The charts size themselves with a ResizeObserver, which jsdom does not have.
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})

describe('PunchListBurndown', () => {
  beforeEach(() => window.localStorage.clear())

  it('says what is open, what the stretch did and when the list clears', () => {
    render(<PunchListBurndown history={history} items={items} now={() => NOW} />)
    expect(screen.getByText('3 open · 14 points')).toBeTruthy()
    const takeaway = screen.getByTestId('burndown-takeaway').textContent ?? ''
    expect(takeaway).toContain('3 cards are open, 14 points of work.')
    expect(takeaway).toContain('In the last 7 days 1 card closed and 1 new ones came in, so the list is holding level.')
    expect(takeaway).toContain('With no new cards it clears by Nov 10.')
    expect(takeaway).toContain('2 cards wait on an owner decision or on time')
    const tiles = within(screen.getByTestId('burndown-tiles'))
    expect(tiles.getByText('Closed a day')).toBeTruthy()
    expect(tiles.getByText('Nov 10')).toBeTruthy()
    expect(tiles.getByText('Not at this pace')).toBeTruthy()
  })

  it('draws each stage with what left it, and follows the stretch and the count', () => {
    render(<PunchListBurndown history={history} items={items} now={() => NOW} />)
    const ready = within(screen.getByTestId('burndown-stage-ready'))
    expect(ready.getByText('Clear')).toBeTruthy()
    expect(screen.getByTestId('burndown-stage-gated').textContent).toContain('No rate yet')
    expect(screen.getByTestId('burndown-slowest').textContent).toContain('No card left')

    fireEvent.change(screen.getByLabelText('Look at'), { target: { value: '24h' } })
    expect(screen.getByTestId('burndown-takeaway').textContent).toContain('In the last 24 hours 0 cards closed and 0 new ones came in')
    expect(screen.getByTestId('burndown-takeaway').textContent).toContain('Nothing closed in the last 24 hours, so there is no pace to read.')

    fireEvent.click(screen.getByRole('button', { name: 'Points by size' }))
    expect(screen.getByRole('button', { name: 'Points by size' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(screen.getByTestId('burndown-tiles')).getAllByText(/0 points in the last 24 hours/)).toHaveLength(2)
  })

  it('hides on a press that the device remembers', () => {
    const { unmount } = render(<PunchListBurndown history={history} items={items} now={() => NOW} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide the burndown' }))
    expect(screen.queryByTestId('burndown-takeaway')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the burndown' }).getAttribute('aria-expanded')).toBe('false')
    unmount()
    render(<PunchListBurndown history={history} items={items} now={() => NOW} />)
    expect(screen.getByRole('button', { name: 'Show the burndown' })).toBeTruthy()
  })

  it('says so when the build had no history to read', () => {
    render(<PunchListBurndown history={EMPTY_HISTORY} items={items} now={() => NOW} />)
    expect(screen.getByText(/could not read the history of the to-dos folder/)).toBeTruthy()
    expect(screen.queryByTestId('burndown-tiles')).toBeNull()
  })
})
