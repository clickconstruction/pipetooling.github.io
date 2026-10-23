import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { countyAt } from './countyAt'
import type { CountyFeatureCollection } from './txCountyMap'

const TX = JSON.parse(readFileSync('public/geo/tx-counties.json', 'utf8')) as CountyFeatureCollection

describe('countyAt', () => {
  it('places the desk’s addresses in their venue county from the real county file', () => {
    // The mock-up's live read, 2026-10-22: the venue follows the job, not the customer.
    expect(countyAt(TX, -97.9786288, 30.3169326)).toBe('Travis') // The Learning Experience, Bee Cave
    expect(countyAt(TX, -97.8876244, 30.6582865)).toBe('Williamson') // Burd & Assoc.'s job at Liberty Hill, though the office is in Amarillo
    expect(countyAt(TX, -98.4453591, 29.4710785)).toBe('Bexar') // Terrell Rd, San Antonio
    expect(countyAt(TX, -98.0372988, 29.5920647)).toBe('Guadalupe') // McQueeney
    expect(countyAt(TX, -97.6968916, 30.2168276)).toBe('Travis') // Austin
  })
  it('is null off the map or for a bad point', () => {
    expect(countyAt(TX, -118.24, 34.05)).toBeNull() // Los Angeles
    expect(countyAt(TX, Number.NaN, 30)).toBeNull()
  })
})
