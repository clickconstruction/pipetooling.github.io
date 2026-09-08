import { afterEach, describe, expect, it } from 'vitest'
import {
  formatExtraTxCountyMappingsText,
  getExtraTxCountyMappings,
  parseExtraTxCountyMappingsText,
  setExtraTxCountyMappings,
  suggestTxCountyForCity,
  txCountyCadPropertyUrl,
  txCountyCadSearchUrl,
} from './txCountyLookup'

afterEach(() => setExtraTxCountyMappings({})) // module state: the org extras

describe('suggestTxCountyForCity', () => {
  it('knows the service area, tolerant of case and whitespace, and says nothing for the unknown', () => {
    expect(suggestTxCountyForCity('San Antonio')).toBe('Bexar')
    expect(suggestTxCountyForCity('  new   BRAUNFELS ')).toBe('Comal')
    expect(suggestTxCountyForCity('Kyle')).toBe('Hays')
    expect(suggestTxCountyForCity('Round Rock')).toBe('Williamson')
    expect(suggestTxCountyForCity('Kingsbury')).toBe('') // not in the curated list — the person confirms
    expect(suggestTxCountyForCity('')).toBe('')
    expect(suggestTxCountyForCity('   ')).toBe('')
    expect(suggestTxCountyForCity(null as unknown as string)).toBe('')
  })
  it('a city that straddles counties maps to its dominant county', () => {
    expect(suggestTxCountyForCity('Schertz')).toBe('Guadalupe')
    expect(suggestTxCountyForCity('Cibolo')).toBe('Guadalupe')
  })
})

describe('org extras', () => {
  it('override built-ins and add new cities, and can be read back and cleared', () => {
    setExtraTxCountyMappings({ schertz: 'Bexar', devine: 'Medina' })
    expect(getExtraTxCountyMappings()).toEqual({ schertz: 'Bexar', devine: 'Medina' })
    expect(suggestTxCountyForCity('Schertz')).toBe('Bexar') // a wrong built-in guess corrected without a deploy
    expect(suggestTxCountyForCity('Devine')).toBe('Medina')
    expect(suggestTxCountyForCity('Kyle')).toBe('Hays') // untouched built-ins still work
    setExtraTxCountyMappings({})
    expect(suggestTxCountyForCity('Devine')).toBe('')
    expect(suggestTxCountyForCity('Schertz')).toBe('Guadalupe')
  })
})

describe('the dev-entered extras text', () => {
  it('parses one "City = County" per line, trimmed and city-normalised; blank and malformed lines are skipped; later lines win', () => {
    expect(
      parseExtraTxCountyMappingsText(`
        Devine = Medina
          Natalia=  Medina

        no equals sign here
        = Orphan
        Orphan =
        Poteet   =   Atascosa
        DEVINE = Frio
      `),
    ).toEqual({ devine: 'Frio', natalia: 'Medina', poteet: 'Atascosa' })
    expect(parseExtraTxCountyMappingsText('')).toEqual({})
    expect(parseExtraTxCountyMappingsText(null as unknown as string)).toEqual({})
  })
  it('keeps only the first "=" as the separator and collapses inner whitespace in the city', () => {
    expect(parseExtraTxCountyMappingsText('Von   Ormy = Bexar')).toEqual({ 'von ormy': 'Bexar' })
    expect(parseExtraTxCountyMappingsText('Odd = County = Name')).toEqual({ odd: 'County = Name' })
  })
  it('formats the map back to title-cased "City = County" lines, and round-trips through the parser', () => {
    const map = { devine: 'Medina', 'von ormy': 'Bexar' }
    expect(formatExtraTxCountyMappingsText(map)).toBe('Devine = Medina\nVon Ormy = Bexar')
    expect(parseExtraTxCountyMappingsText(formatExtraTxCountyMappingsText(map))).toEqual(map)
    expect(formatExtraTxCountyMappingsText({})).toBe('')
  })
})

describe('txCountyCadSearchUrl', () => {
  it('returns the appraisal-district search page for a county, case-insensitively, or nothing', () => {
    expect(txCountyCadSearchUrl('Bexar')).toBe('https://bexar.trueautomation.com/clientdb/?cid=110')
    expect(txCountyCadSearchUrl(' hays ')).toBe('https://esearch.hayscad.com/')
    expect(txCountyCadSearchUrl('WILLIAMSON')).toBe('https://search.wcad.org/')
    expect(txCountyCadSearchUrl('Nowhere')).toBe('')
    expect(txCountyCadSearchUrl('')).toBe('')
  })
  it('every county the city table can suggest has an https search page', () => {
    // Every city in the curated list resolves to a county with a CAD page — a new city
    // whose county has no page would send the person to a blank legal-description lookup.
    const cities = ['san antonio', 'new braunfels', 'seguin', 'san marcos', 'boerne', 'austin', 'round rock', 'blanco', 'fredericksburg', 'kerrville', 'bandera', 'hondo', 'pleasanton', 'floresville', 'lockhart', 'houston', 'dallas', 'fort worth']
    for (const city of cities) {
      const county = suggestTxCountyForCity(city)
      expect(county, city).not.toBe('')
      expect(txCountyCadSearchUrl(county), county).toMatch(/^https:\/\//)
    }
  })
})

describe('txCountyCadPropertyUrl', () => {
  it('deep-links the parcel page on BIS esearch sites and Bexar TrueAutomation', () => {
    expect(txCountyCadPropertyUrl('Comal', '178402')).toBe('https://esearch.comalad.org/Property/View/178402')
    expect(txCountyCadPropertyUrl('hays', '41630')).toBe('https://esearch.hayscad.com/Property/View/41630')
    expect(txCountyCadPropertyUrl('Bexar', '109765')).toBe('https://bexar.trueautomation.com/clientdb/Property.aspx?cid=110&prop_id=109765')
  })
  it("is '' for counties without a known pattern, unknown counties, or a bad id", () => {
    expect(txCountyCadPropertyUrl('Travis', '123')).toBe('')
    expect(txCountyCadPropertyUrl('Nowhere', '123')).toBe('')
    expect(txCountyCadPropertyUrl('Comal', '')).toBe('')
    expect(txCountyCadPropertyUrl('Comal', '../x')).toBe('')
  })
})
