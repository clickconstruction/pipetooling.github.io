// @vitest-environment jsdom
/** Render smoke for the punch list's Shortlist (v2.6618). */
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { PunchListShortlist } from './PunchListShortlist'
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

const items: BoardItem[] = [
  row({ slug: 'queue', number: 46, group: 'ready', size: 'S per PR · XL for the whole queue', name: 'Decomposition queue' }),
  row({ slug: 'recordings', number: 227, group: 'ready', size: 'S', name: 'Robot fixtures: the recordings' }),
  row({ slug: 'checks', number: 76, group: 'close', size: 'XS (two live steps, no code)', name: 'Returned checks' }),
  row({ slug: 'pointer', number: 5, group: 'gated', pointer: true, size: 'a sitting', name: 'Owner decisions pending' }),
]

describe('PunchListShortlist', () => {
  beforeEach(() => window.localStorage.clear())

  it('draws every open row by group, smallest first, with a jump to the row and the size letter', () => {
    render(<PunchListShortlist items={items} visible={() => true} />)
    expect(screen.getByText('3 open · 1 XS · 1 S · 1 XL')).toBeTruthy()
    const ready = within(screen.getByTestId('punch-shortlist-ready'))
    const numbers = ready.getAllByRole('link').map((a) => a.textContent)
    expect(numbers).toEqual(['#227', '#46'])
    expect(ready.getByRole('link', { name: '#46' }).getAttribute('href')).toBe('#n46')
    expect(ready.getByTitle(/^XL — a program of trains/)).toBeTruthy()
    expect(screen.getByTestId('punch-shortlist-close').textContent).toContain('Returned checks')
    expect(screen.queryByText('Owner decisions pending')).toBeNull()
  })

  it('follows the page filter and hides on a press that the device remembers', () => {
    const { unmount } = render(<PunchListShortlist items={items} visible={(it) => it.group === 'close'} />)
    expect(screen.queryByTestId('punch-shortlist-ready')).toBeNull()
    expect(screen.getByTestId('punch-shortlist-close')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide the shortlist' }))
    expect(screen.queryByTestId('punch-shortlist-close')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the shortlist' }).getAttribute('aria-expanded')).toBe('false')
    unmount()
    render(<PunchListShortlist items={items} visible={() => true} />)
    expect(screen.getByRole('button', { name: 'Show the shortlist' })).toBeTruthy()
    expect(screen.queryByTestId('punch-shortlist-ready')).toBeNull()
  })
})
