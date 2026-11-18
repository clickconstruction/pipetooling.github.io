import { describe, expect, it } from 'vitest'
import { paintedWayWasSaved, placeWayName, placeWayNothingWords, placeWayNotSetWords, placeWaySavedWords, placeWaySentence, placeWayTakenOffWords } from './placeWay'

describe('placeWay', () => {
  it('names a new way for its place, inside a painted map’s name length', () => {
    expect(placeWayName('Level 2')).toBe('The way to Level 2')
    expect(placeWayName('  Laydown   yard ')).toBe('The way to Laydown yard')
    expect(placeWayName('A'.repeat(80)).length).toBe(60)
  })
  it('says what became of a painting', () => {
    expect(placeWaySentence('Laydown yard')).toBe('The way to Laydown yard is painted.')
    expect(placeWaySavedWords('Laydown yard')).toBe('The way to Laydown yard is saved. A person who looks for a box there can open it.')
    expect(placeWayNothingWords('Laydown yard')).toBe('Nothing was painted, so Laydown yard has no way yet.')
    expect(placeWayNotSetWords('Laydown yard', 'no signal')).toBe('The map is saved, but it did not go onto Laydown yard: no signal')
    expect(placeWayTakenOffWords('Laydown yard')).toBe('Laydown yard has no way now. The map itself is kept.')
  })
  it('a way is saved once it holds a line or a place', () => {
    expect(paintedWayWasSaved(null)).toBe(false)
    expect(paintedWayWasSaved({ lines: [], places: [] })).toBe(false)
    expect(paintedWayWasSaved({ lines: [{}], places: [] })).toBe(true)
    expect(paintedWayWasSaved({ lines: [], places: [{}] })).toBe(true)
  })
})
