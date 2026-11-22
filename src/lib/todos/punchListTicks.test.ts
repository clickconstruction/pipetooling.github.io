import { describe, expect, it } from 'vitest'
import {
  boardIsNewer,
  canTick,
  readTicks,
  stillOnFailed,
  tickFor,
  tickLabel,
  tickSaveFailed,
  tickVerdict,
  withTick,
  withoutTick,
  type PunchTick,
  type TickCard,
} from './punchListTicks'

const ME = 'user-me'
const me = { id: ME, name: 'ZZ Ana' }
const NOW = '2026-11-21T12:00:00.000Z'
const tick = (over: Partial<PunchTick> = {}): PunchTick => ({ userId: ME, cardNumber: 412, section: 'ready', boardVersion: 'v2.8196', claimerName: 'ZZ Ana', tickedAt: NOW, ...over })
const card = (over: Partial<TickCard> = {}): TickCard => ({ number: 412, group: 'ready', ...over })

describe('tickVerdict', () => {
  it('shows a tick whose card is still in the section it was ticked in', () => {
    expect(tickVerdict(tick(), card(), 'v2.8196')).toBe('show')
    expect(tickVerdict(tick(), card(), 'v2.8300')).toBe('show')
    // An older copy of the page shows it too: the section is the same.
    expect(tickVerdict(tick(), card(), 'v2.8100')).toBe('show')
  })

  it('clears a tick whose card moved to another section, once the build is newer than the tick', () => {
    expect(tickVerdict(tick(), card({ group: 'close' }), 'v2.8197')).toBe('clear')
    expect(tickVerdict(tick({ section: 'gated' }), card({ group: 'waiting' }), 'v2.8300')).toBe('clear')
  })

  it('clears a tick whose card has left the list, once the build is newer than the tick', () => {
    expect(tickVerdict(tick(), undefined, 'v2.8197')).toBe('clear')
  })

  it('hides and keeps a moved or missing tick on a build no newer than the tick: an old copy of the page judges nothing', () => {
    // The same build: a card moved by a PR that shipped no version. Not shown, and left for the next build.
    expect(tickVerdict(tick(), card({ group: 'close' }), 'v2.8196')).toBe('hide')
    // An older copy of the page left open on a phone: the card was filed after its build.
    expect(tickVerdict(tick(), undefined, 'v2.8100')).toBe('hide')
    expect(tickVerdict(tick(), card({ group: 'close' }), 'v2.8100')).toBe('hide')
  })

  it('never clears on a version it cannot read', () => {
    expect(tickVerdict(tick({ boardVersion: '' }), undefined, 'v2.8300')).toBe('hide')
    expect(tickVerdict(tick(), undefined, '')).toBe('hide')
    expect(tickVerdict(tick(), undefined, 'main')).toBe('hide')
  })
})

describe('boardIsNewer', () => {
  it('compares versions as numbers, not as words', () => {
    expect(boardIsNewer('v2.10000', 'v2.9999')).toBe(true)
    expect(boardIsNewer('v2.8196', 'v2.8196')).toBe(false)
    expect(boardIsNewer('v2.8195', 'v2.8196')).toBe(false)
  })
})

describe('readTicks', () => {
  const cards: TickCard[] = [card({ number: 1, group: 'ready' }), card({ number: 2, group: 'close' }), card({ number: 3, group: 'gated' })]

  it('sorts the rows into what shows and what is cleared', () => {
    const rows = [
      tick({ cardNumber: 1, section: 'ready' }), // still in ready
      tick({ cardNumber: 2, section: 'ready' }), // moved from ready to close out
      tick({ cardNumber: 9, section: 'waiting' }), // closed and gone from the list
      tick({ cardNumber: 3, section: 'gated' }), // still gated
    ]
    const read = readTicks(rows, cards, 'v2.8200', ME)
    expect([...read.ticked].sort()).toEqual([1, 3])
    expect(read.stale).toEqual([2, 9])
  })

  it('a made-up card whose section changes between two reads loses its tick on the second', () => {
    const rows = [tick({ cardNumber: 77, section: 'ready', boardVersion: 'v2.8196' })]
    const before = readTicks(rows, [card({ number: 77, group: 'ready' })], 'v2.8196', ME)
    expect(before.ticked.has(77)).toBe(true)
    expect(before.stale).toEqual([])
    const after = readTicks(rows, [card({ number: 77, group: 'close' })], 'v2.8197', ME)
    expect(after.ticked.has(77)).toBe(false)
    expect(after.stale).toEqual([77])
    // With the row cleared, a move back to the first section does not bring the tick back.
    const back = readTicks(withoutTick(rows, ME, ...after.stale), [card({ number: 77, group: 'ready' })], 'v2.8198', ME)
    expect(back.ticked.size).toBe(0)
  })

  it('an old copy of the page shows what matches and clears nothing', () => {
    const rows = [tick({ cardNumber: 1, section: 'ready' }), tick({ cardNumber: 2, section: 'ready' }), tick({ cardNumber: 9, section: 'waiting' })]
    const read = readTicks(rows, cards, 'v2.8100', ME)
    expect([...read.ticked]).toEqual([1])
    expect(read.stale).toEqual([])
  })

  it('flagging is not a move: a flagged card keeps its group and its tick', () => {
    const flagged = { number: 1, group: 'ready', flagged: true } as TickCard
    expect(readTicks([tick({ cardNumber: 1 })], [flagged], 'v2.8300', ME).ticked.has(1)).toBe(true)
  })

  it('reads nothing from no rows', () => {
    const read = readTicks([], cards, 'v2.8200', ME)
    expect(read.ticked.size).toBe(0)
    expect(read.stale).toEqual([])
  })
})

describe('a tick and an untick', () => {
  it('a tick writes the card’s section today and this build’s version, as the person, at this time', () => {
    expect(tickFor(card({ number: 5, group: 'waiting' }), 'v2.8200', me, NOW)).toEqual({
      userId: ME,
      cardNumber: 5,
      section: 'waiting',
      boardVersion: 'v2.8200',
      claimerName: 'ZZ Ana',
      tickedAt: NOW,
    })
  })

  it('a tick on a card with a hidden row replaces that row', () => {
    const rows = [tick({ cardNumber: 5, section: 'ready', boardVersion: 'v2.8196' }), tick({ cardNumber: 6 })]
    const next = withTick(rows, card({ number: 5, group: 'close' }), 'v2.8196', me, NOW)
    expect(next).toHaveLength(2)
    expect(next.find((t) => t.cardNumber === 5)?.section).toBe('close')
    expect(readTicks(next, [card({ number: 5, group: 'close' })], 'v2.8196', ME).ticked.has(5)).toBe(true)
  })

  it('an untick removes the person’s own row and leaves the others', () => {
    const rows = [tick({ cardNumber: 5 }), tick({ cardNumber: 6 })]
    expect(withoutTick(rows, ME, 5)).toEqual([tick({ cardNumber: 6 })])
    expect(withoutTick(rows, ME, 5, 6)).toEqual([])
    expect(withoutTick(rows, ME, 99)).toEqual(rows)
  })
})

describe('rows from more than one person', () => {
  const OTHER = 'user-other'
  const cards: TickCard[] = [card({ number: 1, group: 'ready' }), card({ number: 2, group: 'close' })]

  it('a person’s own ticks are their own rows: another person’s row on a card is not their tick', () => {
    const rows = [tick({ cardNumber: 1, userId: OTHER, claimerName: 'ZZ Ben' })]
    expect(readTicks(rows, cards, 'v2.8300', ME).ticked.size).toBe(0)
    expect(readTicks(rows, cards, 'v2.8300', OTHER).ticked.has(1)).toBe(true)
  })

  it('never asks to delete another person’s stale row: each person clears their own', () => {
    const rows = [tick({ cardNumber: 2, section: 'ready', userId: OTHER }), tick({ cardNumber: 9, section: 'ready', userId: OTHER }), tick({ cardNumber: 2, section: 'ready' })]
    expect(readTicks(rows, cards, 'v2.8300', ME).stale).toEqual([2])
    expect(readTicks(rows, cards, 'v2.8300', OTHER).stale).toEqual([2, 9])
  })

  it('an untick and a tick touch only the person’s own row on the card', () => {
    const theirs = tick({ cardNumber: 1, userId: OTHER, claimerName: 'ZZ Ben' })
    const rows = [theirs, tick({ cardNumber: 1 })]
    expect(withoutTick(rows, ME, 1)).toEqual([theirs])
    expect(withTick([theirs], card({ number: 1 }), 'v2.8300', me, NOW)).toHaveLength(2)
  })

  it('reads nothing as anyone’s own for a viewer with no id', () => {
    expect(readTicks([tick({ cardNumber: 1 })], cards, 'v2.8300', null).ticked.size).toBe(0)
  })
})

describe('words', () => {
  it('names the checkbox with the card’s number', () => {
    expect(tickLabel({ number: 299, name: 'A receipt by text' })).toBe('I am working on #299, A receipt by text')
  })

  it('says which save failed', () => {
    expect(tickSaveFailed({ number: 299 }, true)).toBe('The tick on #299 was not saved')
    expect(tickSaveFailed({ number: 299 }, false)).toBe('The tick on #299 was not taken off')
    expect(stillOnFailed({ number: 299 })).toBe('Your claim on #299 was not renewed')
  })

  it('a card with no number takes no tick', () => {
    expect(canTick({ number: 299 })).toBe(true)
    expect(canTick({ number: 0 })).toBe(false)
    expect(canTick({ number: Number.NaN })).toBe(false)
  })
})
