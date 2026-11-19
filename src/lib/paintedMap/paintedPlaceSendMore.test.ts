import { describe, expect, it } from 'vitest'
import { smsHref } from '../gc/followUpSheet'
import { placeShareWords } from './paintedPlaceShare'
import { SEND_MORE_WORDS, allPlacesName, allPlacesSub, noPhotoWords, placePhotoFileName, placesShareWords, placesTextHref, sendMoreWays, sendablePlaces, wholeMapWords } from './paintedPlaceSendMore'

const GATE = { lat: 29.5, lng: -98.2, name: 'Truck gate', words: 'Close it behind you.', kind: 'gate' }
const TRENCH = { lat: 29.5004, lng: -98.2003, name: 'Open trench', words: '', kind: 'hazard' }
const NOWHERE = { lat: Number.NaN, lng: -98.2, name: 'Lost' }

const NONE = { hasPhoto: false, canShareFiles: false, setCount: 1, mayShareMap: false }

describe('the ways a sheet offers', () => {
  it('offers nothing for one place with no photo on a map the person cannot share, so the press is not drawn', () => {
    expect(sendMoreWays(NONE)).toEqual([])
  })
  it('offers the photo only where the place has one and the share sheet takes a file', () => {
    expect(sendMoreWays({ ...NONE, hasPhoto: true, canShareFiles: true })).toEqual(['photo'])
    // A desk: the photo is there and nothing can carry it.
    expect(sendMoreWays({ ...NONE, hasPhoto: true, canShareFiles: false })).toEqual([])
    expect(sendMoreWays({ ...NONE, hasPhoto: false, canShareFiles: true })).toEqual([])
  })
  it('offers every place from two places up', () => {
    expect(sendMoreWays({ ...NONE, setCount: 1 })).toEqual([])
    expect(sendMoreWays({ ...NONE, setCount: 2 })).toEqual(['all'])
  })
  it('offers the whole map to whoever may share it, and draws the three in one order', () => {
    expect(sendMoreWays({ ...NONE, mayShareMap: true })).toEqual(['map'])
    expect(sendMoreWays({ hasPhoto: true, canShareFiles: true, setCount: 3, mayShareMap: true })).toEqual(['photo', 'all', 'map'])
  })
})

describe('the words of the ways', () => {
  it('names every place by how many and where they are kept', () => {
    expect(allPlacesName(2, 'job')).toBe('Both places on this job')
    expect(allPlacesName(3, 'job')).toBe('All 3 places on this job')
    expect(allPlacesName(12, 'map')).toBe('All 12 places on this map')
  })
  it('says what the press does on the device in hand', () => {
    expect(allPlacesSub(3, { phone: true })).toBe('3 map pins in one text')
    expect(allPlacesSub(3, { phone: false })).toBe('Copies 3 map pins')
  })
  it('names a job’s list as a list and says a reader gives their name', () => {
    expect(wholeMapWords(false)).toEqual({ name: 'The whole map', sub: 'With its lines and photos. They give their name first.' })
    expect(wholeMapWords(true)).toEqual({ name: 'The whole list', sub: 'With its photos. They give their name first.' })
  })
  it('says the photo stays behind, by the press the device gets', () => {
    expect(noPhotoWords('text')).toBe('A text carries the spot, not the photo.')
    expect(noPhotoWords('copy')).toBe('A copy carries the spot, not the photo.')
    expect(SEND_MORE_WORDS.press).toBe('Send more…')
  })
})

describe('a text that carries several places', () => {
  it('is each place as one place sends it, a blank line between, in the order given', () => {
    expect(placesShareWords([GATE, TRENCH])).toBe(`${placeShareWords(GATE)}\n\n${placeShareWords(TRENCH)}`)
    expect(placesShareWords([GATE, TRENCH])).toBe(
      'Truck gate. Close it behind you.\nhttps://www.google.com/maps/search/?api=1&query=29.500000,-98.200000\n\nHazard: Open trench.\nhttps://www.google.com/maps/search/?api=1&query=29.500400,-98.200300',
    )
  })
  it('leaves out a place with no spot, and is none when no place has one', () => {
    expect(sendablePlaces([GATE, NOWHERE, TRENCH])).toEqual([GATE, TRENCH])
    expect(placesShareWords([GATE, NOWHERE])).toBe(placeShareWords(GATE))
    expect(placesShareWords([NOWHERE])).toBeNull()
    expect(placesTextHref([NOWHERE])).toBeNull()
  })
  it('opens Messages with nobody picked, and never links into the app', () => {
    expect(placesTextHref([GATE, TRENCH])).toBe(smsHref('', placesShareWords([GATE, TRENCH])!))
    expect(placesShareWords([GATE, TRENCH])).not.toMatch(/\/way\//)
  })
})

describe('the name a photo goes out under', () => {
  it('is the place in words, safe for a file', () => {
    expect(placePhotoFileName('Hazard: Open trench')).toBe('Hazard-Open-trench.jpg')
    expect(placePhotoFileName('  Truck   gate  ')).toBe('Truck-gate.jpg')
    expect(placePhotoFileName('///')).toBe('place.jpg')
  })
})
