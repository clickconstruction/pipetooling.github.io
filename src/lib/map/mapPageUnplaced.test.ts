import { describe, expect, it } from 'vitest'
import { NOT_FOUND_DEFAULT, farShortLine, mapPageNotFound, unplacedLine, unplacedName } from './mapPageUnplaced'

const placed = { addressKey: 'a', addressLabel: 'A St', lat: 29.5, lng: -98.4 }
const missing1 = { addressKey: 'b', addressLabel: 'Holub', lat: null, lng: null }
const missing2 = { addressKey: 'b', addressLabel: 'Holub', lat: null, lng: null }
const pending = { addressKey: 'c', addressLabel: '41 Moonbeam Ct', lat: null, lng: null }
const noRow = { addressKey: 'd', addressLabel: 'Robert way remodel', lat: null, lng: null }

describe('mapPageNotFound', () => {
  it('groups the unplaced records by address with the geocoder reason, and counts what is still placing', () => {
    const { notFound, resolving } = mapPageNotFound([placed, missing1, pending, missing2, noRow], [
      { address_normalized: 'b', status: 'error', errorMessage: 'No match for this address' },
      { address_normalized: 'c', status: 'in_progress' },
    ])
    expect(resolving).toBe(1)
    expect(notFound.map((g) => [g.addressLabel, g.items.length, g.error])).toEqual([
      ['Holub', 2, 'No match for this address'],
      ['Robert way remodel', 1, NOT_FOUND_DEFAULT],
    ])
  })
})

describe('the words', () => {
  it('say placing while the geocoder runs, else the count', () => {
    expect(unplacedLine({ noAddress: 2, notFoundRecords: 2, resolving: 3 })).toBe('Placing 3 addresses…')
    expect(unplacedLine({ noAddress: 0, notFoundRecords: 0, resolving: 1 })).toBe('Placing 1 address…')
    expect(unplacedLine({ noAddress: 3, notFoundRecords: 1, resolving: 0 })).toBe('4 records have no map location yet')
    expect(unplacedLine({ noAddress: 1, notFoundRecords: 0, resolving: 0 })).toBe('1 record has no map location yet')
    expect(unplacedLine({ noAddress: 0, notFoundRecords: 0, resolving: 0 })).toBe('')
    expect(farShortLine(3)).toBe('3 addresses far from the office')
    expect(farShortLine(1)).toBe('1 address far from the office')
    expect(farShortLine(0)).toBe('')
    expect(unplacedName({ tableLabel: 'Vasquez pretest', sublabel: 'J1419' })).toBe('J1419 · Vasquez pretest')
    expect(unplacedName({ tableLabel: 'Holub', sublabel: ' ' })).toBe('Holub')
  })
})
