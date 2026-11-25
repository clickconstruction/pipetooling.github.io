import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import { swipeSettles } from './people/usersTabPhone'
import {
  SWIPE_AWAY_SETTLE_AT,
  SWIPE_AWAY_STRIP_WIDTH,
  SWIPE_BACK_EDGE_GUARD,
  SWIPE_SHOW_MS,
  SWIPE_WRONG_WAY_AT,
  swipeAwayArmed,
  swipeAwayHint,
  swipeAwayPressName,
  swipeBackHint,
  swipeMayStart,
  swipeShowReach,
  swipeWrongWay,
} from './swipeAway'

describe('the swipe that puts a row away (punch list #426)', () => {
  it('the mark is inside the strip and well past the People rows\' third', () => {
    expect(SWIPE_AWAY_SETTLE_AT).toBeLessThan(SWIPE_AWAY_STRIP_WIDTH)
    expect(SWIPE_AWAY_SETTLE_AT).toBeGreaterThan(SWIPE_AWAY_STRIP_WIDTH / 3)
  })

  it('is armed only while dragged past the mark', () => {
    expect(swipeAwayArmed(true, -SWIPE_AWAY_SETTLE_AT)).toBe(true)
    expect(swipeAwayArmed(true, -SWIPE_AWAY_SETTLE_AT + 1)).toBe(false)
    expect(swipeAwayArmed(false, -SWIPE_AWAY_STRIP_WIDTH)).toBe(false)
  })

  it('the shared kernel settles at the mark it is given: a short swipe springs back, a long one puts away', () => {
    expect(swipeSettles(-(SWIPE_AWAY_SETTLE_AT - 1), SWIPE_AWAY_STRIP_WIDTH, false, SWIPE_AWAY_SETTLE_AT)).toBe(false)
    expect(swipeSettles(-SWIPE_AWAY_SETTLE_AT, SWIPE_AWAY_STRIP_WIDTH, false, SWIPE_AWAY_SETTLE_AT)).toBe(true)
    // With no mark given it is still a third of the strip, so People's rows behave as they did.
    expect(swipeSettles(-60, SWIPE_AWAY_STRIP_WIDTH, false)).toBe(true)
  })

  it('names the press and says the gesture in plain words', () => {
    expect(swipeAwayPressName('Hide', '88 Quarry Rd Ste 100')).toBe('Hide, 88 Quarry Rd Ste 100')
    expect(swipeAwayHint('bid', 'hide it')).toBe('Swipe a bid left to hide it.')
    expect(swipeAwayHint('report', 'mark it opened')).toBe('Swipe a report left to mark it opened.')
    expect(swipeAwayHint('invoice', 'hide it')).toBe('Swipe an invoice left to hide it.')
    for (const words of [swipeAwayHint('bid', 'hide it'), swipeAwayHint('report', 'mark it opened')]) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('the swipe that brings a row back (punch list #426, v2.8603)', () => {
  it('a row that goes right is armed past the same mark, on the other side', () => {
    expect(swipeAwayArmed(true, SWIPE_AWAY_SETTLE_AT, 'right')).toBe(true)
    expect(swipeAwayArmed(true, SWIPE_AWAY_SETTLE_AT - 1, 'right')).toBe(false)
    expect(swipeAwayArmed(true, -SWIPE_AWAY_SETTLE_AT, 'right')).toBe(false)
    expect(swipeAwayArmed(false, SWIPE_AWAY_STRIP_WIDTH, 'right')).toBe(false)
    // The way out is as it was.
    expect(swipeAwayArmed(true, SWIPE_AWAY_SETTLE_AT)).toBe(false)
  })

  it('a right swipe may not start in the screen\'s left edge, where the phone\'s own Back starts', () => {
    expect(swipeMayStart('right', 0)).toBe(false)
    expect(swipeMayStart('right', SWIPE_BACK_EDGE_GUARD - 1)).toBe(false)
    expect(swipeMayStart('right', SWIPE_BACK_EDGE_GUARD)).toBe(true)
    // A left swipe never starts Back, so it may start anywhere.
    expect(swipeMayStart('left', 0)).toBe(true)
    // A card's row begins about 24 px in: the rule leaves most of the row to the thumb.
    expect(SWIPE_BACK_EDGE_GUARD).toBeLessThanOrEqual(40)
  })

  it('a swipe the wrong way is answered past a scroll\'s drift, and never from the screen\'s edge', () => {
    expect(swipeWrongWay('left', SWIPE_WRONG_WAY_AT, 200)).toBe(true)
    expect(swipeWrongWay('left', SWIPE_WRONG_WAY_AT - 1, 200)).toBe(false)
    expect(swipeWrongWay('left', -200, 200)).toBe(false)
    expect(swipeWrongWay('right', -SWIPE_WRONG_WAY_AT, 200)).toBe(true)
    expect(swipeWrongWay('right', -(SWIPE_WRONG_WAY_AT - 1), 200)).toBe(false)
    expect(swipeWrongWay('right', 200, 200)).toBe(false)
    // A right drag on a shown row that began at the edge is the phone's Back, not a mistake to answer.
    expect(swipeWrongWay('left', 200, SWIPE_BACK_EDGE_GUARD - 1)).toBe(false)
  })

  it('a row shows its strip far enough to read the word, and always short of the mark', () => {
    expect(swipeShowReach('Hide')).toBe(64)
    expect(swipeShowReach('Mark opened')).toBe(108)
    for (const label of ['Hide', 'Show again', 'Mark opened', 'Mark unread', 'A label far longer than any strip could hold']) {
      expect(swipeShowReach(label)).toBeLessThan(SWIPE_AWAY_SETTLE_AT)
      expect(swipeShowReach(label)).toBeGreaterThan(SWIPE_WRONG_WAY_AT)
    }
    expect(SWIPE_SHOW_MS.out + SWIPE_SHOW_MS.hold + SWIPE_SHOW_MS.back).toBe(1420)
  })

  it('says the way back in plain words', () => {
    expect(swipeBackHint('show it again')).toBe('Swipe one right to show it again.')
    expect(swipeBackHint('mark it unread')).toBe('Swipe one right to mark it unread.')
    for (const words of [swipeBackHint('show it again'), swipeBackHint('mark it unread')]) expect(plainWordsFailures(words), words).toEqual([])
  })
})
