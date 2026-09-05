import { describe, expect, it } from 'vitest'
import { estimateCustomerFetchQuery, isEstimateViewStaffPreview, withEstimatePreviewMarker } from './estimateViewPreview'

describe('isEstimateViewStaffPreview', () => {
  it('a plain customer link is not a preview', () => {
    expect(isEstimateViewStaffPreview('?t=abc', false)).toBe(false)
    expect(isEstimateViewStaffPreview(new URLSearchParams('t=abc'), false)).toBe(false)
    expect(isEstimateViewStaffPreview(null, false)).toBe(false)
  })

  it('?preview=1 marks the office looking', () => {
    expect(isEstimateViewStaffPreview('?t=abc&preview=1', false)).toBe(true)
    expect(isEstimateViewStaffPreview('?t=abc&preview=0', false)).toBe(false)
  })

  it('a signed-in staff session is a preview regardless of the URL', () => {
    expect(isEstimateViewStaffPreview('?t=abc', true)).toBe(true)
  })
})

describe('withEstimatePreviewMarker', () => {
  it('appends preview=1 to the tokened accept URL, once', () => {
    const once = withEstimatePreviewMarker('https://pipetooling.com/estimate/accept?t=tok')
    expect(once).toBe('https://pipetooling.com/estimate/accept?t=tok&preview=1')
    expect(withEstimatePreviewMarker(once)).toBe(once)
  })

  it('tolerates a relative URL', () => {
    expect(withEstimatePreviewMarker('/estimate/accept?t=tok')).toBe('/estimate/accept?t=tok&preview=1')
    expect(withEstimatePreviewMarker('/estimate/accept')).toBe('/estimate/accept?preview=1')
  })
})

describe('estimateCustomerFetchQuery', () => {
  it('carries the token, and the marker only on previews', () => {
    expect(estimateCustomerFetchQuery('a b', false)).toBe('token=a+b')
    expect(estimateCustomerFetchQuery('tok', true)).toBe('token=tok&preview=1')
  })
})
