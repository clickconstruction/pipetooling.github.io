import { describe, expect, it } from 'vitest'
import { FRAME_ROOM_MIN_PX, frameHeightCss, framePlace, frameScrollsIntoView } from './frame'

describe('where the flow frame ends', () => {
  it('ends at the bottom of the screen on a computer, where there is room under the tab row', () => {
    const place = framePlace({ top: 220, inset: 46, screen: 768 })
    expect(place).toEqual({ from: 'page', offset: 220 })
    expect(frameScrollsIntoView(place)).toBe(false)
    expect(frameHeightCss(place)).toBe('max(420px, min(680px, calc(100dvh - 220px - var(--app-bottom-chrome, 0px) - 12px)))')
  })

  it('is sized from the builder’s own top on a phone, where the tab row leaves too little room, and scrolls into view', () => {
    const place = framePlace({ top: 501, inset: 83, screen: 812 })
    expect(place).toEqual({ from: 'builder', offset: 83 })
    expect(frameScrollsIntoView(place)).toBe(true)
    expect(frameHeightCss(place)).toBe('max(420px, min(680px, calc(100dvh - 83px - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px) - 20px)))')
  })

  it('switches exactly at the least room a frame is given', () => {
    const top = 200
    expect(framePlace({ top, inset: 40, screen: top + 12 + FRAME_ROOM_MIN_PX }).from).toBe('page')
    expect(framePlace({ top, inset: 40, screen: top + 12 + FRAME_ROOM_MIN_PX - 1 }).from).toBe('builder')
  })

  it('is the tallest frame before the first measure, and scrolls nowhere', () => {
    expect(frameHeightCss(null)).toBe('680px')
    expect(frameScrollsIntoView(null)).toBe(false)
  })
})
