/**
 * Where **Which site is it for?** sits on a phone and what gives way while the keyboard is up (finding 337, punch
 * list #439, piece 3).
 */
import { describe, expect, it } from 'vitest'
import { PICKER_TIGHT_BAND_PX, pickerRoom } from './paperSitePickerFrame'

describe('pickerRoom', () => {
  it('at a desk the window is as it was, whatever shows', () => {
    expect(pickerRoom(false, { top: 0, height: 900 }, '')).toEqual({ place: { inset: 0 }, tight: false, lead: true, none: true })
    expect(pickerRoom(false, { top: 120, height: 280 }, 'oak')).toEqual({ place: { inset: 0 }, tight: false, lead: true, none: true })
  })

  it('where the browser cannot say what shows, a phone keeps the whole page too', () => {
    expect(pickerRoom(true, null, 'oak')).toEqual({ place: { inset: 0 }, tight: false, lead: true, none: true })
  })

  it('on a phone the backdrop follows the part of the page that shows', () => {
    expect(pickerRoom(true, { top: 0, height: 553 }, '').place).toEqual({ top: 0, left: 0, right: 0, height: '553px' })
    // The keyboard is up and the iPhone slid the page to the address box.
    expect(pickerRoom(true, { top: 187, height: 281 }, '').place).toEqual({ top: 187, left: 0, right: 0, height: '281px' })
  })

  it('with room to spare nothing gives way', () => {
    const room = pickerRoom(true, { top: 0, height: PICKER_TIGHT_BAND_PX }, 'oak')
    expect([room.tight, room.lead, room.none]).toEqual([false, true, true])
  })

  it('in a tight room the lead gives way, and the first choice stays while the box is empty', () => {
    const room = pickerRoom(true, { top: 187, height: 281 }, '   ')
    expect([room.tight, room.lead, room.none]).toEqual([true, false, true])
  })

  it('in a tight room the first choice gives way once something is typed, and an empty box brings it back', () => {
    expect(pickerRoom(true, { top: 187, height: 281 }, 'o').none).toBe(false)
    expect(pickerRoom(true, { top: 187, height: 281 }, '').none).toBe(true)
  })
})
