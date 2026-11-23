import { describe, expect, it } from 'vitest'
import { WHO_MENU_MARGIN, WHO_MENU_WIDTH, whoMenuPlace, whoMenuWidth } from './whoMenuPlace'

/** Where the menu's edges land on the screen, from the pill's place and the menu's. */
function edges(pill: { left: number; right: number }, screenWidth: number): { left: number; right: number } {
  const width = whoMenuWidth(screenWidth)
  const place = whoMenuPlace(pill, screenWidth)
  if ('right' in place) return { left: pill.right - width, right: pill.right }
  return { left: pill.left + place.left, right: pill.left + place.left + width }
}

describe('how wide the who-has-it menu draws', () => {
  it('is 280 px wherever 85% of the screen is at least that', () => {
    expect(whoMenuWidth(1400)).toBe(WHO_MENU_WIDTH)
    expect(whoMenuWidth(402)).toBe(WHO_MENU_WIDTH)
    expect(whoMenuWidth(375)).toBe(WHO_MENU_WIDTH)
  })

  it('is 85% of a screen narrower than that', () => {
    expect(whoMenuWidth(320)).toBe(272)
  })

  it('is 280 px when the screen cannot be read', () => {
    expect(whoMenuWidth(0)).toBe(WHO_MENU_WIDTH)
    expect(whoMenuWidth(Number.NaN)).toBe(WHO_MENU_WIDTH)
  })
})

describe('where the who-has-it menu hangs (punch list #348)', () => {
  it('hangs from the pill’s right edge where that fits: a desk’s row, and the face on an iPhone 17', () => {
    expect(whoMenuPlace({ left: 1100, right: 1271 }, 1400)).toEqual({ right: 0 })
    // The face in a folded header at 402 px: 265 to 293, as measured.
    expect(whoMenuPlace({ left: 265, right: 293 }, 402)).toEqual({ right: 0 })
    expect(edges({ left: 265, right: 293 }, 402)).toEqual({ left: 13, right: 293 })
  })

  it('hangs from the pill’s left edge when the right would run off the left of the screen', () => {
    // A Follow up row on a phone: the pill wraps to the row's left.
    expect(whoMenuPlace({ left: 16, right: 187 }, 402)).toEqual({ left: 0 })
    expect(edges({ left: 16, right: 187 }, 402)).toEqual({ left: 16, right: 296 })
  })

  it('slides onto the screen when it fits from neither edge: the face at 375 px', () => {
    // The face at 375 px: 238 to 266. From the right the menu would start at -14; from the left it would end at 518.
    expect(whoMenuPlace({ left: 238, right: 266 }, 375)).toEqual({ left: -151 })
    expect(edges({ left: 238, right: 266 }, 375)).toEqual({ left: 87, right: 367 })
  })

  it('slides onto a 320 px screen, where the menu is 272 px wide', () => {
    expect(edges({ left: 183, right: 211 }, 320)).toEqual({ left: 40, right: 312 })
  })

  it('keeps every menu a margin inside the screen, at every phone width and wherever a pill inside the margins sits', () => {
    for (const screenWidth of [320, 360, 375, 390, 393, 402, 430, 600]) {
      for (let left = WHO_MENU_MARGIN; left + 28 <= screenWidth - WHO_MENU_MARGIN; left += 7) {
        const at = edges({ left, right: left + 28 }, screenWidth)
        expect(at.left, `${screenWidth} px, pill at ${left}`).toBeGreaterThanOrEqual(WHO_MENU_MARGIN)
        expect(at.right, `${screenWidth} px, pill at ${left}`).toBeLessThanOrEqual(screenWidth - WHO_MENU_MARGIN)
      }
    }
  })

  it('fits a screen far narrower than a phone, since the menu takes 85% of it', () => {
    expect(edges({ left: 100, right: 128 }, 200)).toEqual({ left: 22, right: 192 })
  })

  it('hangs from the left when the screen cannot be read', () => {
    expect(whoMenuPlace({ left: 0, right: 0 }, 0)).toEqual({ left: 0 })
    expect(whoMenuPlace({ left: 40, right: 68 }, Number.NaN)).toEqual({ left: 0 })
  })

  it('a pill inside the margin itself gets its menu at the margin: a test’s empty layout reads so', () => {
    expect(whoMenuPlace({ left: 0, right: 0 }, 1024)).toEqual({ left: 8 })
  })
})
