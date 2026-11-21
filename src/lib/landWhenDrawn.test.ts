// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { landWhenDrawn } from './landWhenDrawn'

/** An element as the page would hold it, drawn or not yet. */
const element = (height: number) => ({ getBoundingClientRect: () => ({ height }) }) as unknown as HTMLElement

describe('landWhenDrawn', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('lands once the thing is drawn with a height, and looks no more', () => {
    let drawn: HTMLElement | null = null
    const find = vi.fn(() => drawn)
    const land = vi.fn()
    landWhenDrawn(find, land)
    vi.advanceTimersByTime(300)
    expect(find).toHaveBeenCalledTimes(3)
    expect(land).not.toHaveBeenCalled()
    drawn = element(0)
    vi.advanceTimersByTime(100)
    expect(land).not.toHaveBeenCalled()
    drawn = element(40)
    vi.advanceTimersByTime(100)
    expect(land).toHaveBeenCalledTimes(1)
    expect(land).toHaveBeenCalledWith(drawn)
    vi.advanceTimersByTime(5000)
    expect(find).toHaveBeenCalledTimes(5)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('gives up after its tries', () => {
    const find = vi.fn(() => null)
    const land = vi.fn()
    landWhenDrawn(find, land, { everyMs: 10, tries: 4 })
    vi.advanceTimersByTime(1000)
    expect(find).toHaveBeenCalledTimes(4)
    expect(land).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops when the screen says so, and a second stop changes nothing', () => {
    const find = vi.fn(() => null)
    const stop = landWhenDrawn(find, vi.fn())
    vi.advanceTimersByTime(200)
    stop()
    stop()
    vi.advanceTimersByTime(5000)
    expect(find).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops by itself, without a throw, when its page is gone', () => {
    // What reddened CI: the look reads the document, and the test's document had been torn down.
    const find = vi.fn(() => document.querySelector<HTMLElement>('.jobMoneyPickedBtn'))
    landWhenDrawn(find, vi.fn())
    vi.advanceTimersByTime(100)
    expect(find).toHaveBeenCalledTimes(1)
    vi.stubGlobal('document', undefined)
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
    expect(find).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
