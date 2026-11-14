import { describe, expect, it } from 'vitest'
import { scrollTopToReveal, taskWindowPhoneFrame } from './taskWindowFrame'

describe('taskWindowPhoneFrame', () => {
  it('fills the screen from the top where the browser cannot say what shows', () => {
    expect(taskWindowPhoneFrame(null)).toEqual({ top: 0, maxHeight: '100%' })
    expect(taskWindowPhoneFrame({ height: 0, offsetTop: 0 })).toEqual({ top: 0, maxHeight: '100%' })
    expect(taskWindowPhoneFrame({ height: Number.NaN, offsetTop: 0 })).toEqual({ top: 0, maxHeight: '100%' })
  })

  it('is no taller than the room the keyboard leaves', () => {
    // An iPhone 17 Pro in Safari with the keyboard up, as the simulator read it.
    expect(taskWindowPhoneFrame({ height: 377.4, offsetTop: 0 })).toEqual({
      top: 0,
      maxHeight: 'min(100%, calc(377px - env(safe-area-inset-top, 0px)))',
    })
  })

  it('starts where the part that shows starts, once the keyboard has slid the page', () => {
    // Done when… sits where the keyboard will be, so Safari slides the page 253 px.
    expect(taskWindowPhoneFrame({ height: 377, offsetTop: 253.3 }).top).toBe(253)
  })

  it('follows the slide under Safari page zoom too, where the numbers are smaller', () => {
    // The aA menu at 125%: 302 px of room and a slide of 117, both in the page's own px.
    expect(taskWindowPhoneFrame({ height: 302, offsetTop: 117 })).toEqual({
      top: 117,
      maxHeight: 'min(100%, calc(302px - env(safe-area-inset-top, 0px)))',
    })
  })

  it('never starts above the page', () => {
    expect(taskWindowPhoneFrame({ height: 377, offsetTop: -12 }).top).toBe(0)
    expect(taskWindowPhoneFrame({ height: 377, offsetTop: Number.NaN }).top).toBe(0)
  })
})

describe('scrollTopToReveal', () => {
  const box = { boxTop: 100, boxBottom: 300 }

  it('leaves a field that already shows where it is', () => {
    expect(scrollTopToReveal({ ...box, scrollTop: 40, fieldTop: 150, fieldBottom: 230 })).toBe(40)
  })

  it('brings a field under the bar up until its bottom shows', () => {
    // 80 px tall, its bottom 60 px below the box: 60 and the margin.
    expect(scrollTopToReveal({ ...box, scrollTop: 40, fieldTop: 280, fieldBottom: 360 })).toBe(108)
  })

  it('brings a field above the head down until its top shows', () => {
    expect(scrollTopToReveal({ ...box, scrollTop: 90, fieldTop: 60, fieldBottom: 140 })).toBe(42)
  })

  it('never scrolls above the start', () => {
    expect(scrollTopToReveal({ ...box, scrollTop: 10, fieldTop: 60, fieldBottom: 140 })).toBe(0)
  })

  it('shows a field taller than the room from its top', () => {
    expect(scrollTopToReveal({ ...box, scrollTop: 0, fieldTop: 320, fieldBottom: 620 })).toBe(212)
  })

  it('puts a search box at the top of the room, so what it finds shows under it (punch list #348)', () => {
    // Moved no further than it must, the box at 280 to 324 would stop just above the bar, at 248 to 292.
    expect(scrollTopToReveal({ ...box, scrollTop: 40, fieldTop: 280, fieldBottom: 324 })).toBe(72)
    expect(scrollTopToReveal({ ...box, scrollTop: 40, fieldTop: 280, fieldBottom: 324, align: 'top' })).toBe(212)
    // Already in view lower down: it still goes to the top.
    expect(scrollTopToReveal({ ...box, scrollTop: 40, fieldTop: 200, fieldBottom: 244, align: 'top' })).toBe(132)
    expect(scrollTopToReveal({ ...box, scrollTop: 0, fieldTop: 104, fieldBottom: 148, align: 'top' })).toBe(0)
  })

  it('takes the margin it is given', () => {
    expect(scrollTopToReveal({ ...box, scrollTop: 0, fieldTop: 280, fieldBottom: 360, margin: 0 })).toBe(60)
  })
})
