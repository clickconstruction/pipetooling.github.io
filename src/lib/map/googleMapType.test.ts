import { describe, expect, it } from 'vitest'
import { googleMapTypeForLayer, googleMapTypeIsImagery } from './googleMapType'

describe('googleMapTypeForLayer', () => {
  it('Satellite is the photograph with street names, Streets is the road map', () => {
    expect(googleMapTypeForLayer('satellite')).toBe('hybrid')
    expect(googleMapTypeForLayer('streets')).toBe('roadmap')
  })
})

describe('googleMapTypeIsImagery', () => {
  it('only the photograph is imagery', () => {
    expect(googleMapTypeIsImagery('hybrid')).toBe(true)
    expect(googleMapTypeIsImagery('roadmap')).toBe(false)
  })

  it('a canvas that was given no map type draws the road map', () => {
    expect(googleMapTypeIsImagery(undefined)).toBe(false)
    expect(googleMapTypeIsImagery(null)).toBe(false)
  })
})
