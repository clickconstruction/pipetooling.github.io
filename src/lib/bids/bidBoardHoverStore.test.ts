import { describe, expect, it, vi } from 'vitest'
import { createBidBoardHoverStore } from './bidBoardHoverStore'

describe('createBidBoardHoverStore', () => {
  it('starts empty, notifies subscribers on change, and is silent on a repeat of the same id', () => {
    const s = createBidBoardHoverStore()
    const l = vi.fn()
    const off = s.subscribe(l)
    expect(s.get()).toBeNull()
    s.set('b385')
    expect(s.get()).toBe('b385')
    expect(l).toHaveBeenCalledTimes(1)
    s.set('b385')
    expect(l).toHaveBeenCalledTimes(1)
    s.set(null)
    expect(s.get()).toBeNull()
    expect(l).toHaveBeenCalledTimes(2)
    off()
    s.set('b396')
    expect(l).toHaveBeenCalledTimes(2)
  })
})
