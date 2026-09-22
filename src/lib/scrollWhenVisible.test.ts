import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollWhenVisible } from './scrollWhenVisible'

describe('scrollWhenVisible (v2.3697)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits until the element is on screen, scrolls once, and can be cancelled', () => {
    const scrolled: string[] = []
    let visible = false
    const el = { scrollIntoView: (o: unknown) => scrolled.push(JSON.stringify(o)) } as unknown as HTMLElement
    Object.defineProperty(el, 'offsetParent', { get: () => (visible ? {} : null) })
    scrollWhenVisible(() => el)
    vi.advanceTimersByTime(600)
    expect(scrolled).toEqual([])
    visible = true
    vi.advanceTimersByTime(200)
    expect(scrolled).toEqual([expect.stringContaining('"block":"center"')])
    vi.advanceTimersByTime(2000)
    expect(scrolled).toHaveLength(1)
    const cancel = scrollWhenVisible(() => null, { timeoutMs: 1000 })
    cancel()
    vi.advanceTimersByTime(2000)
    expect(scrolled).toHaveLength(1)
  })
})
