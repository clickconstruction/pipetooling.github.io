/**
 * The On site sheet's scrim (punch list #398): with the band that shows, it is that band, so the sheet's foot stands
 * on the keyboard's top. With none it keeps the page box. Either way its top pads by the status bar.
 */
import { describe, expect, it } from 'vitest'
import { onSiteSheetScrim } from './onSiteSheetScrim'

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
