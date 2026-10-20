import { describe, expect, it } from 'vitest'
import { isMapsUrl, mapsKey, parseMapsShare } from './mapsShareText'

describe('parseMapsShare', () => {
  it('reads the name, the address and the link from what Share copies', () => {
    expect(parseMapsShare('Bexar Fire Protection\n1800 Cibolo Trail, Boerne, TX 78006\nhttps://maps.app.goo.gl/x7QzAbc')).toEqual({ name: 'Bexar Fire Protection', address: '1800 Cibolo Trail, Boerne, TX 78006', url: 'https://maps.app.goo.gl/x7QzAbc' })
  })
  it('joins a two-line address, and takes a bare link alone', () => {
    expect(parseMapsShare('Comal Concrete Works\n210 Lantana Dr\nNew Braunfels, TX\nmaps.app.goo.gl/q9')?.address).toBe('210 Lantana Dr, New Braunfels, TX')
    expect(parseMapsShare('maps.app.goo.gl/q9')).toEqual({ name: '', address: '', url: 'https://maps.app.goo.gl/q9' })
    expect(parseMapsShare('https://www.google.com/maps/place/Bexar+Fire/@29.8,-98.7,17z')).toEqual({ name: '', address: '', url: 'https://www.google.com/maps/place/Bexar+Fire/@29.8,-98.7,17z' })
  })
  it('is null without a Maps link', () => {
    expect(parseMapsShare('Bexar Fire Protection\n1800 Cibolo Trail')).toBeNull()
    expect(parseMapsShare('https://bexarfire.example')).toBeNull()
    expect(isMapsUrl('https://bexarfire.example/maps')).toBe(false)
  })
})

describe('mapsKey', () => {
  it('reads the same place the same way', () => {
    expect(mapsKey('https://maps.app.goo.gl/x7QzAbc?g_st=ic')).toBe('maps.app.goo.gl/x7qzabc')
    expect(mapsKey('MAPS.app.goo.gl/x7QzAbc/')).toBe('maps.app.goo.gl/x7qzabc')
    expect(mapsKey('')).toBeNull()
    expect(mapsKey(null)).toBeNull()
  })
})
