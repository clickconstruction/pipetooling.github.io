import { describe, expect, it } from 'vitest'
import { portalShapeMode, withSideBySide } from './portalShape'

const params = (q: string) => new URLSearchParams(q)

describe('portalShapeMode', () => {
  it('reads as today with no flag', () => {
    expect(portalShapeMode(params(''), { sample: true, dev: true })).toBe('today')
    expect(portalShapeMode(params('t=abc'), { sample: false, dev: false })).toBe('today')
  })
  it('draws the shape on ?shape=1 for anyone', () => {
    expect(portalShapeMode(params('shape=1'), { sample: false, dev: false })).toBe('shape')
  })
  it('draws both on ?sbs=1 for the sample token or a signed-in dev, and the shape or today for anyone else', () => {
    expect(portalShapeMode(params('sbs=1'), { sample: true, dev: false })).toBe('sideBySide')
    expect(portalShapeMode(params('sbs=1'), { sample: false, dev: true })).toBe('sideBySide')
    expect(portalShapeMode(params('sbs=1'), { sample: false, dev: false })).toBe('today')
    expect(portalShapeMode(params('sbs=1&shape=1'), { sample: false, dev: false })).toBe('shape')
  })
  it('ignores other values', () => {
    expect(portalShapeMode(params('sbs=yes&shape=true'), { sample: true, dev: true })).toBe('today')
  })
})

describe('withSideBySide', () => {
  it('adds the flag after a query or starts one', () => {
    expect(withSideBySide('/portal?t=sample')).toBe('/portal?t=sample&sbs=1')
    expect(withSideBySide('/t/sample')).toBe('/t/sample?sbs=1')
  })
})
