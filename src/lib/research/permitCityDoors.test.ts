import { describe, expect, it } from 'vitest'
import { appraisalDoor, askingCountyWords, cityDeedsDoor, cityReadsParcels, countyWords, noParcelWords, permitSearchDoor, scoresMiles } from './permitCityDoors'

describe('what a card says for the city it is in (punch list #292, revision 4)', () => {
  it('names the county that keeps the land records', () => {
    expect(countyWords('San Antonio')).toBe('Bexar County')
    expect(countyWords('austin')).toBe('Travis County')
    expect(countyWords('Nowhere')).toBe('the county')
    expect(askingCountyWords('San Antonio')).toBe('Asking Bexar County…')
  })

  it("reads Bexar County's parcels, and says so plainly where a county's record is not read yet", () => {
    expect(cityReadsParcels('San Antonio')).toBe(true)
    expect(cityReadsParcels('Austin')).toBe(false)
    expect(noParcelWords('San Antonio')).toBe('The county’s parcel layer has no row for this street address.')
    expect(noParcelWords('San Antonio', true)).toBe('The county has no parcel under this street address.')
    expect(noParcelWords('Austin')).toBe('Travis County’s record is not read here yet. Its appraisal district has it.')
    expect(noParcelWords(null)).toBe('The county’s record is not read here yet.')
  })

  it("points at each city's own doors", () => {
    expect(permitSearchDoor('San Antonio')).toContain('accela.com/COSA')
    expect(permitSearchDoor('Austin')).toBe('https://abc.austintexas.gov/web/permit/public-search-other')
    expect(permitSearchDoor('Nowhere')).toBeNull()
    expect(cityDeedsDoor('San Antonio')).toBe('https://bexar.tx.publicsearch.us/')
    expect(cityDeedsDoor('Austin')).toBe('https://www.tccsearch.org/')
    expect(appraisalDoor('Austin')).toMatch(/^https:\/\//)
    expect(appraisalDoor('Nowhere')).toBeNull()
  })

  it('counts the drive in the score only for a city the office is in', () => {
    const office = { lat: 29.42, lng: -98.49 }
    expect(scoresMiles('San Antonio', office)).toBe(true)
    expect(scoresMiles('Austin', office)).toBe(false)
    // With no office point, or a city the list does not hold, the score stands as it was.
    expect(scoresMiles('Austin', null)).toBe(true)
    expect(scoresMiles('Nowhere', office)).toBe(true)
  })
})
