import { describe, expect, it } from 'vitest'
import { publicShapeView, withSideBySide } from './publicShapeView'

describe('publicShapeView · a prototype on a public page', () => {
  it('draws nothing new for a real visitor, the shape on ?shape=1, and the side-by-side on ?sbs=1 only for a sample or a dev', () => {
    const real = { key: 'outside-2', token: 'a-real-token', dev: false }
    expect(publicShapeView({ ...real, search: '' })).toEqual({ shape: false, sideBySide: false })
    expect(publicShapeView({ ...real, search: '?t=a-real-token&sbs=1' })).toEqual({ shape: false, sideBySide: false })
    expect(publicShapeView({ ...real, search: '?t=a-real-token&shape=1' })).toEqual({ shape: true, sideBySide: false })
    expect(publicShapeView({ ...real, search: '?t=a-real-token&shape=outside-1' })).toEqual({ shape: false, sideBySide: false })
    expect(publicShapeView({ key: 'outside-2', token: 'sample-owner', dev: false, search: '?t=sample-owner&sbs=1' })).toEqual({ shape: false, sideBySide: true })
    expect(publicShapeView({ key: 'outside-2', token: 'a-real-token', dev: true, search: '?t=a-real-token&sbs=outside-2' })).toEqual({ shape: false, sideBySide: true })
    // The token is read off the URL when the page does not pass it; both asked, the side-by-side wins.
    expect(publicShapeView({ key: 'outside-1', dev: false, search: '?t=sample&sbs=1&shape=1' })).toEqual({ shape: false, sideBySide: true })
  })

  it('adds ?sbs=1 to a page address once', () => {
    expect(withSideBySide('https://x.test/portal?t=sample-owner')).toBe('https://x.test/portal?t=sample-owner&sbs=1')
    expect(withSideBySide('/pay/sample')).toBe('/pay/sample?sbs=1')
    expect(withSideBySide('/portal?t=sample&sbs=1')).toBe('/portal?t=sample&sbs=1')
  })
})
