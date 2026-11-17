import { describe, expect, it } from 'vitest'
import { lienPropertyStreet, lienRunStreetBeside } from './lienRunStreet'

describe('the property’s street beside a job’s name (v2.7489)', () => {
  it('reads the street as the first line of the property record’s address', () => {
    expect(lienPropertyStreet('212 Kettle Dr, Sampleton, TX 78000')).toBe('212 Kettle Dr')
    expect(lienPropertyStreet('212  Kettle Dr\nSampleton, TX')).toBe('212 Kettle Dr')
    expect(lienPropertyStreet('')).toBe('')
    expect(lienPropertyStreet(null)).toBe('')
  })

  it('shows the street when the job’s name does not say it', () => {
    expect(lienRunStreetBeside('ZZ Test Lot 7', '212 Kettle Dr, Sampleton, TX 78000')).toBe('212 Kettle Dr')
    // The street's word without its number is not the address: two houses share a street.
    expect(lienRunStreetBeside('ZZ Test Kettle remodel', '212 Kettle Dr, Sampleton, TX')).toBe('212 Kettle Dr')
    // A number alone is not either: a lot number can match a house number.
    expect(lienRunStreetBeside('ZZ Test Lot 212', '212 Kettle Dr')).toBe('212 Kettle Dr')
  })

  it('shows nothing when the name already says it, however it is typed', () => {
    expect(lienRunStreetBeside('ZZ Test Shop — 212 Kettle Dr', '212 Kettle Drive, Sampleton, TX')).toBe('')
    expect(lienRunStreetBeside('zz test 212 KETTLE', '212 N. Kettle Dr.')).toBe('')
    // A street with no number goes by its word.
    expect(lienRunStreetBeside('ZZ Test Kettle remodel', 'Kettle Dr')).toBe('')
  })

  it('shows nothing when the job points at no property record, or the record has no address', () => {
    expect(lienRunStreetBeside('ZZ Test Lot 7', null)).toBe('')
    expect(lienRunStreetBeside('ZZ Test Lot 7', '  ')).toBe('')
  })
})
