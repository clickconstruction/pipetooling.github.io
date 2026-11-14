import { describe, expect, it } from 'vitest'
import {
  NO_NUMBER,
  ORDER_LABEL,
  byNumber,
  flipOrder,
  groupCounts,
  hasNumber,
  hasShippedVersion,
  mockupDoor,
  numberLabel,
  orderFrom,
  orderTitle,
  rowAnchor,
  searchFor,
  shownLine,
  viewFrom,
} from './punchListByNumber'
import type { BoardItem } from './todoBoard'

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

const slugs = (items: readonly BoardItem[]) => items.map((i) => i.slug)

describe('byNumber', () => {
  // The board hands the rows over by group then name, so the numbers arrive shuffled.
  const queue = row({ slug: 'queue', number: 46 })
  const receipt = row({ slug: 'receipt', number: 299 })
  const bill = row({ slug: 'bill', number: 343, group: 'gated' })
  const board = [queue, receipt, row({ slug: 'pointer', number: 5, pointer: true }), bill, row({ slug: 'lien', number: 235, group: 'close' })]

  it('puts the highest number on top by default order, newest first', () => {
    expect(byNumber(board, 'newest').map((i) => i.number)).toEqual([343, 299, 235, 46, 5])
  })

  it('puts the lowest number on top for oldest first', () => {
    expect(byNumber(board, 'oldest').map((i) => i.number)).toEqual([5, 46, 235, 299, 343])
  })

  it('leaves the board it was handed alone', () => {
    const before = slugs(board)
    byNumber(board, 'newest')
    expect(slugs(board)).toEqual(before)
  })

  it('sorts a card with no number last in both directions, and names it', () => {
    const loose = row({ slug: 'loose', number: Number.NaN })
    const zero = row({ slug: 'zero', number: 0 })
    const withLoose = [loose, queue, receipt, zero]
    expect(slugs(byNumber(withLoose, 'newest'))).toEqual(['receipt', 'queue', 'loose', 'zero'])
    expect(slugs(byNumber(withLoose, 'oldest'))).toEqual(['queue', 'receipt', 'loose', 'zero'])
    expect(hasNumber(loose)).toBe(false)
    expect(numberLabel(loose)).toBe(NO_NUMBER)
    expect(numberLabel(bill)).toBe('#343')
    expect(rowAnchor(loose)).toBe('card-loose')
    expect(rowAnchor(bill)).toBe('n343')
  })

  it('keeps two cards on one number in the board’s order, whichever way the list runs', () => {
    const first = row({ slug: 'first-on-the-board', number: 120 })
    const second = row({ slug: 'second-on-the-board', number: 120 })
    const collided = [row({ slug: 'low', number: 7 }), first, row({ slug: 'high', number: 300 }), second]
    expect(slugs(byNumber(collided, 'newest'))).toEqual(['high', 'first-on-the-board', 'second-on-the-board', 'low'])
    expect(slugs(byNumber(collided, 'oldest'))).toEqual(['low', 'first-on-the-board', 'second-on-the-board', 'high'])
  })
})

describe('the sort press', () => {
  it('flips, says which way the list runs, and says what the next press does', () => {
    expect(flipOrder('newest')).toBe('oldest')
    expect(flipOrder('oldest')).toBe('newest')
    expect(ORDER_LABEL.newest).toContain('Newest first')
    expect(ORDER_LABEL.oldest).toContain('Oldest first')
    expect(orderTitle('newest')).toContain('oldest first')
    expect(orderTitle('oldest')).toContain('newest first')
  })
})

describe('the view and the order, from the address and the device', () => {
  it('opens on the groups, newest first, when neither says anything', () => {
    expect(viewFrom(null, null)).toBe('group')
    expect(orderFrom(null, null)).toBe('newest')
  })

  it('reads the device when the address is bare', () => {
    expect(viewFrom(null, 'number')).toBe('number')
    expect(orderFrom(null, 'oldest')).toBe('oldest')
  })

  it('lets the address win over the device, so a link opens what it names', () => {
    expect(viewFrom('number', 'group')).toBe('number')
    expect(viewFrom('group', 'number')).toBe('group')
    expect(orderFrom('newest', 'oldest')).toBe('newest')
  })

  it('reads a word it does not know as absent', () => {
    expect(viewFrom('sideways', 'number')).toBe('number')
    expect(viewFrom('sideways', 'also-not')).toBe('group')
    expect(orderFrom('random', '')).toBe('newest')
  })

  it('writes the choice into the address and keeps every other parameter', () => {
    expect(searchFor('', 'number', 'newest')).toBe('?view=number')
    expect(searchFor('', 'number', 'oldest')).toBe('?view=number&order=oldest')
    expect(searchFor('?from=bridge', 'number', 'oldest')).toBe('?from=bridge&view=number&order=oldest')
    expect(searchFor('?view=number&order=oldest&from=bridge', 'number', 'newest')).toBe('?from=bridge&view=number')
  })

  it('writes nothing for the groups, so a bare address stays bare', () => {
    expect(searchFor('?view=number&order=oldest', 'group', 'oldest')).toBe('')
    expect(searchFor('?view=number&from=bridge', 'group', 'newest')).toBe('?from=bridge')
  })
})

describe('the header and the row’s doors', () => {
  it('says how many cards are shown, and of how many when the filters hide some', () => {
    expect(shownLine(106, 106)).toBe('106 cards')
    expect(shownLine(12, 106)).toBe('12 of 106 cards')
    expect(shownLine(0, 106)).toBe('0 of 106 cards')
    expect(shownLine(1, 1)).toBe('1 card')
  })

  it('counts the cards per group in the board’s order, a group with none left out', () => {
    const items = [row({ group: 'gated' }), row({ group: 'ready' }), row({ group: 'gated' })]
    expect(groupCounts(items)).toEqual([
      { group: 'ready', label: 'Ready to build', count: 1 },
      { group: 'gated', label: 'Needs an owner decision', count: 2 },
    ])
  })

  it('opens the first mock-up and says how many more the card lists', () => {
    expect(mockupDoor(row({}))).toBeNull()
    expect(mockupDoor(row({ mockups: ['to-dos/a/mockup.html'] }))).toEqual({
      href: '/to-dos/a/mockup.html',
      label: 'mock-up',
      title: 'to-dos/a/mockup.html',
    })
    const three = mockupDoor(row({ mockups: ['to-dos/a/one.html', 'to-dos/a/two.html', 'to-dos/a/three.html'] }))
    expect(three?.href).toBe('/to-dos/a/one.html')
    expect(three?.label).toBe('mock-up · 1 of 3')
    expect(three?.title).toContain('the other 2')
  })

  it('draws the version chip only for a card that shipped something', () => {
    expect(hasShippedVersion('v2.7042 · 7043')).toBe(true)
    expect(hasShippedVersion('—')).toBe(false)
    expect(hasShippedVersion('')).toBe(false)
  })
})
