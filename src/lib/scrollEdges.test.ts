import { describe, expect, it } from 'vitest'
import { scrollEdgeMask, scrollEdges } from './scrollEdges'

describe('scrollEdges', () => {
  it('a row that fits has nothing cut off', () => {
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 326, clientWidth: 326 })).toEqual({ left: false, right: false })
  })
  it('a row wider than its box is cut on the right until it is scrolled to the end', () => {
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 440, clientWidth: 326 })).toEqual({ left: false, right: true })
    expect(scrollEdges({ scrollLeft: 60, scrollWidth: 440, clientWidth: 326 })).toEqual({ left: true, right: true })
    expect(scrollEdges({ scrollLeft: 114, scrollWidth: 440, clientWidth: 326 })).toEqual({ left: true, right: false })
  })
  it('a few pixels of rounding are not a cut end', () => {
    expect(scrollEdges({ scrollLeft: 3, scrollWidth: 329.5, clientWidth: 326 })).toEqual({ left: false, right: false })
  })
})

describe('scrollEdgeMask', () => {
  it('no mask when both ends are in view', () => {
    expect(scrollEdgeMask({ left: false, right: false })).toBeNull()
  })
  it('fades only the cut end', () => {
    expect(scrollEdgeMask({ left: false, right: true })).toBe('linear-gradient(to right, #000, #000 calc(100% - 28px), transparent)')
    expect(scrollEdgeMask({ left: true, right: false })).toBe('linear-gradient(to right, transparent, #000 28px, #000)')
    expect(scrollEdgeMask({ left: true, right: true }, 20)).toBe('linear-gradient(to right, transparent, #000 20px, #000 calc(100% - 20px), transparent)')
  })
})
