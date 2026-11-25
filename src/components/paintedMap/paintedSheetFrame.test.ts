/**
 * The frame of the painted map's two question sheets (punch list #392). On a phone the scrim fills the part of the
 * page that shows, so the sheet ends above Safari's bar and above the keyboard and scrolls inside that band. The
 * simulator's walk of 2026-11-25 found the sheet pinned to the whole page box, its foot behind Safari's bar.
 */
import { describe, expect, it } from 'vitest'
import { paintedSheetFrame } from './paintedSheetFrame'

describe('paintedSheetFrame', () => {
  it('on a phone that says what shows, the scrim is that band and the sheet scrolls inside it', () => {
    const { scrim, sheet } = paintedSheetFrame(false, { top: 0, height: 706 })
    expect(scrim).toMatchObject({ position: 'fixed', top: 0, left: 0, right: 0, height: 706, alignItems: 'flex-end' })
    // Not the page box: nothing pins the scrim's foot to the bottom of the page.
    expect(scrim).not.toHaveProperty('inset')
    expect(scrim).not.toHaveProperty('bottom')
    expect(sheet).toMatchObject({ maxHeight: '100%', overflowY: 'auto' })
  })

  it('follows the band when the keyboard slides the page down', () => {
    expect(paintedSheetFrame(false, { top: 180, height: 420 }).scrim).toMatchObject({ top: 180, height: 420 })
  })

  it('on a phone that cannot say what shows, keeps the page box', () => {
    const { scrim } = paintedSheetFrame(false, null)
    expect(scrim).toMatchObject({ position: 'fixed', inset: 0, alignItems: 'flex-end' })
    expect(scrim).not.toHaveProperty('height')
    expect(paintedSheetFrame(false).scrim).toEqual(scrim)
  })

  it('at a desk the window hangs in the page box, whatever shows', () => {
    const { scrim, sheet } = paintedSheetFrame(true, { top: 0, height: 706 })
    expect(scrim).toMatchObject({ position: 'fixed', inset: 0, alignItems: 'flex-start', padding: '56px 16px 24px' })
    expect(scrim).not.toHaveProperty('height')
    expect(sheet).toMatchObject({ borderRadius: 14 })
    expect(paintedSheetFrame(true).scrim).toEqual(scrim)
  })
})
