import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import { swipeSettles } from './people/usersTabPhone'
import { SWIPE_AWAY_SETTLE_AT, SWIPE_AWAY_STRIP_WIDTH, swipeAwayArmed, swipeAwayHint, swipeAwayPressName } from './swipeAway'

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
