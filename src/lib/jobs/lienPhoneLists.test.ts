import { describe, expect, it } from 'vitest'
import { LIEN_PHONE_TAB, lienPileHeadHeight, lienPileHeadPlace, lienPileReached, lienPileScrollTop } from './lienPhoneLists'

describe('the Notices list’s pile titles', () => {
  it('a computer stacks every title: i bars from the top, n-1-i from the bottom, 30 px each', () => {
    expect([0, 1, 4].map((i) => lienPileHeadPlace(i, 5, false))).toEqual([
      { top: 0, bottom: 120, height: 30 },
      { top: 30, bottom: 90, height: 30 },
      { top: 120, bottom: 0, height: 30 },
    ])
  })

  it('a phone pins one title at the top, a thumb tall, and none at the bottom', () => {
    for (const i of [0, 2, 4]) expect(lienPileHeadPlace(i, 5, true)).toEqual({ top: 0, bottom: 'auto', height: 40 })
    expect(lienPileHeadHeight(true)).toBe(40)
    expect(lienPileHeadHeight(false)).toBe(30)
    // Five titles pinned on a computer are 150 px; a phone's pinned title is 40 whatever the count.
    expect(5 * lienPileHeadPlace(0, 5, false).height).toBe(150)
  })

  it('a press scrolls the pile’s first row right under the titles that sit over it', () => {
    expect(lienPileScrollTop(600, 2, false)).toBe(600 - 3 * 30)
    expect(lienPileScrollTop(600, 2, true)).toBe(600 - 40)
    expect(lienPileScrollTop(20, 0, true)).toBe(0)
  })

  it('a pile is reached once its rows are within a bar of where they pin', () => {
    expect(lienPileReached(600, 500, 2, false)).toBe(true)
    expect(lienPileReached(600, 470, 2, false)).toBe(false)
    expect(lienPileReached(600, 520, 2, true)).toBe(true)
    expect(lienPileReached(600, 500, 2, true)).toBe(false)
  })
})

describe('a phone’s tab', () => {
  it('is a thumb tall, may shrink and wraps its words, so a row of tabs never slides', () => {
    expect(LIEN_PHONE_TAB).toMatchObject({ flex: '1 1 auto', minWidth: 0, minHeight: 44, whiteSpace: 'normal' })
  })
})
