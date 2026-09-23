import { describe, expect, it } from 'vitest'
import { invoiceRowMenuSide } from './invoiceRowMenuSide'

describe('invoiceRowMenuSide', () => {
  // The screenshot that opened v2.3765: modal 640–1300, ⋯ at 790–825, menu 240 wide.
  const modal = { boundsLeft: 640, boundsRight: 1300, menuWidth: 240 }

  it('opens rightward from a button at the left of its row (the modal case)', () => {
    expect(invoiceRowMenuSide({ ...modal, anchorLeft: 790, anchorRight: 825 })).toBe('left')
  })

  it('opens leftward when the button sits near the right edge', () => {
    expect(invoiceRowMenuSide({ ...modal, anchorLeft: 1200, anchorRight: 1235 })).toBe('right')
  })

  it('opens rightward when it fits exactly with the gutter', () => {
    // roomRight = 1300 - 8 - 1052 = 240
    expect(invoiceRowMenuSide({ ...modal, anchorLeft: 1052, anchorRight: 1087 })).toBe('left')
    expect(invoiceRowMenuSide({ ...modal, anchorLeft: 1053, anchorRight: 1088 })).toBe('right')
  })

  it('takes the roomier side when neither fits (a narrow phone)', () => {
    const phone = { boundsLeft: 0, boundsRight: 360, menuWidth: 300 }
    expect(invoiceRowMenuSide({ ...phone, anchorLeft: 100, anchorRight: 135 })).toBe('left')
    expect(invoiceRowMenuSide({ ...phone, anchorLeft: 250, anchorRight: 285 })).toBe('right')
  })

  it('honors a custom gutter', () => {
    expect(invoiceRowMenuSide({ ...modal, anchorLeft: 1052, anchorRight: 1087, gutter: 0 })).toBe('left')
    expect(invoiceRowMenuSide({ ...modal, anchorLeft: 1052, anchorRight: 1087, gutter: 20 })).toBe('right')
  })
})
