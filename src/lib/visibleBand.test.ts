import { describe, expect, it } from 'vitest'
import { visibleBand } from './visibleBand'

describe('visibleBand', () => {
  it('is null where the browser cannot say what shows', () => {
    expect(visibleBand(null)).toBeNull()
    expect(visibleBand({ height: 0, offsetTop: 0 })).toBeNull()
    expect(visibleBand({ height: Number.NaN, offsetTop: 0 })).toBeNull()
  })

  it('is the whole screen while no keyboard is up', () => {
    expect(visibleBand({ height: 740, offsetTop: 0 })).toEqual({ top: 0, height: 740 })
  })

  it('is the room the keyboard leaves', () => {
    expect(visibleBand({ height: 377.4, offsetTop: 0 })).toEqual({ top: 0, height: 377 })
  })

  it('starts where the page has slid to', () => {
    expect(visibleBand({ height: 377, offsetTop: 253.3 })).toEqual({ top: 253, height: 377 })
  })

  it('never starts above the page', () => {
    expect(visibleBand({ height: 377, offsetTop: -12 })?.top).toBe(0)
    expect(visibleBand({ height: 377, offsetTop: Number.NaN })?.top).toBe(0)
  })
})
