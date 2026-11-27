import { describe, expect, it } from 'vitest'
import { visibleBand } from '../visibleBand'
import { isPagePinched, THREAD_LINES_FLOOR, THREAD_TIGHT_BAND_PX, threadRoom, threadWindowPlace, replyFootScroll, roomFell } from './threadWindowFrame'

describe('threadWindowPlace', () => {
  it('pins a desk’s window to the page, whatever shows', () => {
    expect(threadWindowPlace(false, null)).toEqual({ inset: 0 })
    expect(threadWindowPlace(false, { top: 180, height: 420 })).toEqual({ inset: 0 })
  })

  it('fills the screen on a phone with the keyboard away', () => {
    expect(threadWindowPlace(true, visibleBand({ height: 812, offsetTop: 0 }))).toEqual({ top: 0, left: 0, right: 0, height: '812px' })
  })

  it('follows the part that shows when the keyboard takes room and slides the page, so the header stays on screen', () => {
    // An iPhone: 812 px of page, the keyboard leaves 476, and the page slid 180 px down to the reply box.
    expect(threadWindowPlace(true, visibleBand({ height: 476, offsetTop: 180 }))).toEqual({ top: 180, left: 0, right: 0, height: '476px' })
  })

  it('keeps the page’s own pin where the browser cannot say what shows', () => {
    expect(threadWindowPlace(true, visibleBand(null))).toEqual({ inset: 0 })
  })
})

describe('threadRoom', () => {
  const whole = { tight: false, rest: true, linesFloor: THREAD_LINES_FLOOR, columnScrolls: false }

  it('gives a desk the whole window at any height', () => {
    expect(threadRoom(false, null)).toEqual(whole)
    expect(threadRoom(false, { top: 0, height: 300 })).toEqual(whole)
  })

  it('gives a phone the whole window where the browser cannot say what shows', () => {
    expect(threadRoom(true, null)).toEqual(whole)
  })

  it('keeps every row and the lines’ floor on a phone with the keyboard away', () => {
    // An iPhone 17 in Safari shows about 700 px, the smallest iPhone about 550.
    for (const height of [700, 550, THREAD_TIGHT_BAND_PX]) {
      expect(threadRoom(true, { top: 0, height })).toEqual({ tight: false, rest: true, linesFloor: THREAD_LINES_FLOOR, columnScrolls: true })
    }
  })

  it('folds the header’s lower rows and drops the lines’ floor in the room a keyboard leaves', () => {
    for (const height of [THREAD_TIGHT_BAND_PX - 1, 375, 290]) {
      expect(threadRoom(true, { top: 180, height })).toEqual({ tight: true, rest: false, linesFloor: 0, columnScrolls: true })
    }
  })

  it('lets the lines and the box scroll as one on every phone that can say what shows, so the box is never cut', () => {
    expect(threadRoom(true, { top: 0, height: 700 }).columnScrolls).toBe(true)
    expect(threadRoom(true, { top: 0, height: 240 }).columnScrolls).toBe(true)
  })
})

describe('isPagePinched', () => {
  it('is a pinch when less of the page’s width shows than it has', () => {
    expect(isPagePinched(201, 402)).toBe(true)
    expect(isPagePinched(390.4, 402)).toBe(true)
  })

  it('is not a pinch when the whole width shows, the keyboard up or not', () => {
    expect(isPagePinched(402, 402)).toBe(false)
    // A rounding px either way is not two fingers.
    expect(isPagePinched(401.5, 402)).toBe(false)
  })

  it('is not a pinch under Safari’s larger text, where the page itself is narrower', () => {
    expect(isPagePinched(322, 322)).toBe(false)
  })

  it('is not a pinch where the browser cannot say', () => {
    expect(isPagePinched(undefined, 402)).toBe(false)
    expect(isPagePinched(402, 0)).toBe(false)
    expect(isPagePinched(null, null)).toBe(false)
  })
})

describe('the reply box’s foot and the keys (finding 319)', () => {
  it('scrolls by the px of the box that stand under the column’s foot, a whole px at least', () => {
    expect(replyFootScroll(300, 380)).toBe(80)
    expect(replyFootScroll(300, 341.2)).toBe(42)
  })

  it('moves nothing when the foot already shows, and never scrolls up', () => {
    expect(replyFootScroll(300, 300)).toBe(0)
    expect(replyFootScroll(300, 300.4)).toBe(0)
    expect(replyFootScroll(300, 220)).toBe(0)
  })

  it('the room fell when the keyboard came up or took more', () => {
    expect(roomFell(553, 259)).toBe(true)
    expect(roomFell(259, 215)).toBe(true)
  })

  it('a first read, a room that grew, a room that held and a browser that cannot say are not a fall', () => {
    expect(roomFell(null, 553)).toBe(false)
    expect(roomFell(259, 553)).toBe(false)
    expect(roomFell(259, 259)).toBe(false)
    expect(roomFell(553, null)).toBe(false)
    expect(roomFell(undefined, undefined)).toBe(false)
  })
})
