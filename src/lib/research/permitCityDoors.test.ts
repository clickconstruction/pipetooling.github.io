import { describe, expect, it } from 'vitest'
import { appraisalDoor, askingCountyWords, cityDeedsDoor, cityReadsParcels, countyGivesBuildingFacts, countyWords, lotWords, noParcelWords, parcelPointWords, permitSearchDoor, scoresMiles } from './permitCityDoors'

describe('what a card says for the city it is in (punch list #292, revision 4)', () => {
  it('names the county that keeps the land records', () => {
    expect(countyWords('San Antonio')).toBe('Bexar County')
    expect(countyWords('austin')).toBe('Travis County')
    expect(countyWords('Nowhere')).toBe('the county')
    expect(askingCountyWords('San Antonio')).toBe('Asking Bexar County…')
  })

  it("reads every city's county parcels, and says so plainly for a city the list does not hold", () => {
    for (const city of ['San Antonio', 'Austin', 'New Braunfels', 'San Marcos', 'Seguin']) expect(cityReadsParcels(city)).toBe(true)
    expect(cityReadsParcels('Nowhere')).toBe(false)
    expect(noParcelWords('San Antonio')).toBe('The county’s parcel layer has no row for this street address.')
    expect(noParcelWords('Austin', true)).toBe('The county has no parcel under this street address.')
    expect(noParcelWords(null)).toBe('The county’s record is not read here yet.')
  })

  it('says what stands on the lot from what the county gives', () => {
    const none = { building_sf: null, year_built: null, improvement_value: null, acres: null }
    expect(lotWords({ ...none, building_sf: 6200, year_built: '2001', acres: 0.9 })).toBe('6,200 sq ft built in 2001, 0.9 acres')
    expect(lotWords(none)).toBe('nothing built on the roll')
    // Outside Bexar the layer has no built area: the buildings' value says whether anything stands there.
    expect(lotWords({ ...none, improvement_value: 14_308_838, acres: 0.92 })).toBe('buildings on the roll at $14M, 0.92 acres')
    expect(lotWords({ ...none, improvement_value: 1_604_850, year_built: '2004' })).toBe('buildings on the roll at $1.6M, built 2004')
    expect(lotWords({ ...none, improvement_value: 167_290, matched_by: 'point' })).toBe('buildings on the roll at $167k, read at the permit’s point')
    expect(lotWords({ ...none, improvement_value: 167_290, matched_by: 'point', county: 'Guadalupe' })).toBe('buildings on the roll at $167k, read at the permit’s point in Guadalupe County')
    expect(lotWords({ ...none, improvement_value: 167_290, matched_by: 'id', county: 'Williamson' })).toBe('buildings on the roll at $167k, in Williamson County')
    // Read by the id the permit carries is the exact lot: nothing to add.
    expect(lotWords({ ...none, improvement_value: 167_290, matched_by: 'id' })).toBe('buildings on the roll at $167k')
    expect(countyGivesBuildingFacts('San Antonio')).toBe(true)
    expect(countyGivesBuildingFacts('Austin')).toBe(false)
  })

  it('says when the parcel was read at the permit’s point', () => {
    expect(parcelPointWords({ situs: '210 W COURT ST', matched_by: 'point' })).toBe('The county has no parcel under this street address, so this is the parcel at the permit’s point. The county calls it 210 W COURT ST.')
    expect(parcelPointWords({ situs: null, matched_by: 'point' })).toBe('The county has no parcel under this street address, so this is the parcel at the permit’s point.')
    expect(parcelPointWords({ situs: '210 W COURT ST' })).toBeNull()
    expect(parcelPointWords({ situs: '210 W COURT ST', matched_by: 'id' })).toBeNull()
    // Over the county line: the card names the county whose parcel it is.
    expect(parcelPointWords({ situs: '1500 N SAMPLE BLVD', matched_by: 'id', county: 'Williamson' })).toBe('This lot is in Williamson County.')
    expect(parcelPointWords({ situs: '1500 N SAMPLE BLVD', county: 'Williamson' })).toBe('This lot is in Williamson County.')
    expect(parcelPointWords({ situs: '210 W COURT ST', matched_by: 'point', county: 'Guadalupe' })).toBe('The permit’s point is in Guadalupe County, so this is that county’s parcel there. The county calls it 210 W COURT ST.')
    expect(parcelPointWords({ situs: null, matched_by: 'point', county: 'Guadalupe' })).toBe('The permit’s point is in Guadalupe County, so this is that county’s parcel there.')
  })

  it("points at each city's own doors", () => {
    expect(permitSearchDoor('San Antonio')).toContain('accela.com/COSA')
    expect(permitSearchDoor('Austin')).toBe('https://abc.austintexas.gov/web/permit/public-search-other')
    expect(permitSearchDoor('Nowhere')).toBeNull()
    expect(cityDeedsDoor('San Antonio')).toBe('https://bexar.tx.publicsearch.us/')
    expect(cityDeedsDoor('Austin')).toBe('https://www.tccsearch.org/')
    expect(cityDeedsDoor('New Braunfels')).toBe('https://comal.landrecordsonline.com/')
    expect(cityDeedsDoor('San Marcos')).toBe('https://erss.co.hays.tx.us/web/')
    expect(cityDeedsDoor('Seguin')).toBe('https://roam.guadalupetx.gov/')
    expect(cityDeedsDoor('Nowhere')).toBeNull()
    expect(appraisalDoor('Austin')).toMatch(/^https:\/\//)
    for (const city of ['New Braunfels', 'San Marcos', 'Seguin']) {
      expect(appraisalDoor(city)).toMatch(/^https:\/\//)
      expect(permitSearchDoor(city)).toMatch(/^https:\/\//)
    }
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
