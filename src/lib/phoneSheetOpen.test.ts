import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPhoneSheetOpen, markPhoneSheetOpen, resetPhoneSheetOpenForTests, subscribePhoneSheetOpen, updatePillPlace, UPDATE_PILL_BOTTOM, UPDATE_PILL_TOP } from './phoneSheetOpen'

afterEach(() => resetPhoneSheetOpenForTests())

describe('phoneSheetOpen', () => {
  it('no sheet is open until one says so, and it is closed again when that one goes', () => {
    expect(isPhoneSheetOpen()).toBe(false)
    const close = markPhoneSheetOpen()
    expect(isPhoneSheetOpen()).toBe(true)
    close()
    expect(isPhoneSheetOpen()).toBe(false)
  })

  it('a sheet opened inside a sheet keeps it open until both have gone, in either order', () => {
    const outer = markPhoneSheetOpen()
    const inner = markPhoneSheetOpen()
    outer()
    expect(isPhoneSheetOpen()).toBe(true)
    inner()
    expect(isPhoneSheetOpen()).toBe(false)
  })

  it('a close called twice counts once, so a second sheet is not closed by the first one’s cleanup', () => {
    const first = markPhoneSheetOpen()
    const second = markPhoneSheetOpen()
    first()
    first()
    expect(isPhoneSheetOpen()).toBe(true)
    second()
    expect(isPhoneSheetOpen()).toBe(false)
  })

  it('tells a reader on every open and close, and stops once the reader leaves', () => {
    const heard = vi.fn()
    const leave = subscribePhoneSheetOpen(heard)
    const close = markPhoneSheetOpen()
    close()
    expect(heard).toHaveBeenCalledTimes(2)
    leave()
    markPhoneSheetOpen()
    expect(heard).toHaveBeenCalledTimes(2)
  })
})

describe('updatePillPlace', () => {
  it('pins the pill to the bottom of the screen, as it always was', () => {
    expect(updatePillPlace(false)).toEqual({ bottom: UPDATE_PILL_BOTTOM })
  })

  it('pins it to the top while a phone sheet is open, and never to both', () => {
    const place = updatePillPlace(true)
    expect(place).toEqual({ top: UPDATE_PILL_TOP })
    expect('bottom' in place).toBe(false)
  })
})
