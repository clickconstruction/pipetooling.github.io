import { describe, expect, it } from 'vitest'
import { PLACE_SHARE_WORDS, placePointUrl, placeShareWay, placeShareWords, placeTextHref } from './paintedPlaceShare'

const AT = { lat: 29.5, lng: -98.2 }

describe('the link to one spot', () => {
  it('opens a map app on the point, to six places of a degree', () => {
    expect(placePointUrl(AT)).toBe('https://www.google.com/maps/search/?api=1&query=29.500000,-98.200000')
    expect(placePointUrl({ lat: 29.50000049, lng: -98.19999951 })).toBe('https://www.google.com/maps/search/?api=1&query=29.500000,-98.200000')
  })
  it('is none for a point that is not on the globe', () => {
    expect(placePointUrl({ lat: 95, lng: -98.2 })).toBeNull()
    expect(placePointUrl({ lat: 29.5, lng: 200 })).toBeNull()
    expect(placePointUrl({ lat: Number.NaN, lng: -98.2 })).toBeNull()
  })
  it('is a plain map link and never a link into the app', () => {
    expect(placePointUrl(AT)).not.toMatch(/\/way\//)
    expect(new URL(placePointUrl(AT)!).host).toBe('www.google.com')
  })
})

describe('the words of the text', () => {
  it('says what the place is, the word left for whoever comes next, and the link on a line of its own', () => {
    expect(placeShareWords({ ...AT, name: 'Truck gate', words: 'Close it behind you.' })).toBe('Truck gate. Close it behind you.\nhttps://www.google.com/maps/search/?api=1&query=29.500000,-98.200000')
  })
  it('leads with the kind when the name does not say it, since a text draws no mark', () => {
    expect(placeShareWords({ ...AT, name: 'Open trench', words: 'Keep the truck off it.', kind: 'hazard' })!.split('\n')[0]).toBe('Hazard: Open trench. Keep the truck off it.')
    expect(placeShareWords({ ...AT, name: 'Truck gate', words: '', kind: 'gate' })!.split('\n')[0]).toBe('Truck gate.')
    // A kind this app does not know is not guessed at.
    expect(placeShareWords({ ...AT, name: 'Hydrant', kind: 'fire_hydrant' })!.split('\n')[0]).toBe('Hydrant.')
  })
  it('does not double a full stop the name already ends on', () => {
    expect(placeShareWords({ ...AT, name: 'Park here.', words: 'Not on the grass' })!.split('\n')[0]).toBe('Park here. Not on the grass')
    expect(placeShareWords({ ...AT, name: 'Is this the meter?', words: null })!.split('\n')[0]).toBe('Is this the meter?')
  })
  it('is none for a place with no spot to send', () => {
    expect(placeShareWords({ lat: 0, lng: 400, name: 'Nowhere' })).toBeNull()
    expect(placeTextHref({ lat: 0, lng: 400, name: 'Nowhere' })).toBeNull()
  })
})

describe('the press', () => {
  it('opens the phone\'s own Messages with the words written and nobody picked', () => {
    const href = placeTextHref({ ...AT, name: 'Truck gate', words: 'Close it behind you.' })!
    expect(href.startsWith('sms:?&body=')).toBe(true)
    expect(decodeURIComponent(href.slice('sms:?&body='.length))).toBe(placeShareWords({ ...AT, name: 'Truck gate', words: 'Close it behind you.' }))
  })
  it('is a text on a phone and a copy at a desk', () => {
    expect(placeShareWay({ phone: true })).toBe('text')
    expect(placeShareWay({ phone: false })).toBe('copy')
    expect(PLACE_SHARE_WORDS.text).toBe('Text this place…')
    expect(PLACE_SHARE_WORDS.copy).toBe('Copy this place')
  })
})
