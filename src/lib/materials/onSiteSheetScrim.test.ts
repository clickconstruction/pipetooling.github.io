/**
 * The On site sheet's scrim (punch list #398): with the band that shows, it is that band, so the sheet's foot stands
 * on the keyboard's top. With none it keeps the page box. Either way its top pads by the status bar.
 */
import { describe, expect, it } from 'vitest'
import { ON_SITE_SHEET_TIGHT_PX, onSiteSheetFit, onSiteSheetScrim, onSiteSheetTail, onSiteSheetTight } from './onSiteSheetScrim'

describe('onSiteSheetScrim', () => {
  it('with the keyboard up, is the band above the keys and holds its sheet to the foot of it', () => {
    const scrim = onSiteSheetScrim({ top: 0, height: 498 })
    expect(scrim).toMatchObject({ position: 'fixed', top: 0, left: 0, right: 0, height: 498, justifyContent: 'flex-end', paddingTop: 'var(--app-top-chrome, 0px)' })
    expect(scrim).not.toHaveProperty('inset')
    expect(scrim).not.toHaveProperty('bottom')
  })

  it('follows the band when the phone slides the page under the field', () => {
    expect(onSiteSheetScrim({ top: 212, height: 430 })).toMatchObject({ top: 212, height: 430 })
  })

  it('with no band, a desk or a browser that cannot say, keeps the page box', () => {
    const scrim = onSiteSheetScrim(null)
    expect(scrim).toMatchObject({ position: 'fixed', inset: 0, justifyContent: 'flex-end', paddingTop: 'var(--app-top-chrome, 0px)', zIndex: 800 })
    expect(scrim).not.toHaveProperty('height')
  })
})

describe('a short room: the keys are up (finding 310)', () => {
  it('is tight under 480 px of room, which a phone shows only with the keys up', () => {
    expect(ON_SITE_SHEET_TIGHT_PX).toBe(480)
    // A 375 by 667 phone with the number pad up, a 402 by 874 one, and both with the keys away.
    expect(onSiteSheetTight({ top: 0, height: 320 })).toBe(true)
    expect(onSiteSheetTight({ top: 0, height: 375 })).toBe(true)
    expect(onSiteSheetTight({ top: 0, height: 553 })).toBe(false)
    expect(onSiteSheetTight({ top: 0, height: 700 })).toBe(false)
  })

  it('is never tight at a desk or where the browser cannot say', () => {
    expect(onSiteSheetTight(null)).toBe(false)
  })

  it('a tight sheet takes the whole room and gives up its handle, some padding and the field’s own height', () => {
    expect(onSiteSheetFit(true)).toMatchObject({ maxHeight: '100%', handle: false, stepperField: 56 })
    expect(onSiteSheetFit(false)).toMatchObject({ maxHeight: '90%', handle: true, stepperField: null, bodyPad: '0.6rem 1rem 1rem', bodyGap: '0.75rem', footPadTop: '0.6rem', footPadBottom: '0.75rem' })
  })

  it('the quantity step fits the room a small phone leaves: 339 px loose, 297 px tight', () => {
    // Measured in a browser at 375 px wide (the fragment's table): the head, the step through its chips, the foot.
    const rem = 16
    const px = (css: string) => parseFloat(css) * rem
    const pads = (css: string) => css.split(' ').map((p) => parseFloat(p) * rem)
    const through = (tight: boolean) => {
      const f = onSiteSheetFit(tight)
      const head = pads(f.headPad)[0]! + (f.handle ? 4 + 6.4 : 0) + 38 + 6.4 + 20.4 - 3.2
      const body = pads(f.bodyPad)[0]! + 36 + px(f.bodyGap) + (f.stepperField ?? 69.2) + px(f.bodyGap) + 44
      const foot = 1 + px(f.footPadTop) + 52 + px(f.footPadBottom)
      return Math.round(head + body + foot)
    }
    expect(through(false)).toBe(339)
    expect(through(true)).toBeLessThanOrEqual(300)
    // Loose it also kept to 90% of the room, so it wanted 377 px of room. A small phone shows about 320.
    expect(Math.ceil(through(false) / 0.9)).toBe(377)
  })
})

describe('the sheet’s surface under its foot (finding 310)', () => {
  it('fills from the room’s foot down where the sheet follows the room', () => {
    expect(onSiteSheetTail({ top: 0, height: 320 })).toEqual({ position: 'absolute', top: '100%', left: 0, right: 0, height: '100vh', background: 'var(--surface)' })
  })

  it('is not drawn at a desk', () => {
    expect(onSiteSheetTail(null)).toBeNull()
  })
})
