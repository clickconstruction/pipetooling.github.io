import { describe, expect, it } from 'vitest'
import {
  cityMatchesQuery,
  filterPortalsByQuery,
  formatCitiesInput,
  matchPortalForInspectionAddress,
  parseCitiesInput,
} from './inspectionPortalSearch'

const PORTALS = [
  { label: 'MGO Connect', url: 'https://www.mgoconnect.org/auth/login', cities: ['Alamo Heights', 'Buda', 'Cibolo', 'Shavano Park'] },
  { label: 'SA Permits (Accela)', url: 'http://aca-prod.accela.com', cities: ['San Antonio'] },
  { label: 'City of New Braunfels', url: 'https://nbtexas.org', cities: [] },
]

describe('filterPortalsByQuery', () => {
  it('returns all portals for an empty or whitespace query', () => {
    expect(filterPortalsByQuery(PORTALS, '')).toHaveLength(3)
    expect(filterPortalsByQuery(PORTALS, '   ')).toHaveLength(3)
  })

  it('matches by city, case-insensitively', () => {
    const hits = filterPortalsByQuery(PORTALS, 'buda')
    expect(hits.map((p) => p.label)).toEqual(['MGO Connect'])
  })

  it('matches by partial city', () => {
    expect(filterPortalsByQuery(PORTALS, 'shav').map((p) => p.label)).toEqual(['MGO Connect'])
  })

  it('matches by label and by URL', () => {
    expect(filterPortalsByQuery(PORTALS, 'braunfels').map((p) => p.label)).toEqual(['City of New Braunfels'])
    expect(filterPortalsByQuery(PORTALS, 'accela').map((p) => p.label)).toEqual(['SA Permits (Accela)'])
  })

  it('returns empty when nothing matches', () => {
    expect(filterPortalsByQuery(PORTALS, 'houston')).toHaveLength(0)
  })
})

describe('cityMatchesQuery', () => {
  it('is false for an empty query (no resting-state highlights)', () => {
    expect(cityMatchesQuery('Buda', '')).toBe(false)
  })

  it('is a case-insensitive substring match', () => {
    expect(cityMatchesQuery('Alamo Heights', 'alamo')).toBe(true)
    expect(cityMatchesQuery('Buda', 'cibolo')).toBe(false)
  })
})

describe('parseCitiesInput', () => {
  it('splits on commas and newlines, trims, and drops empties', () => {
    expect(parseCitiesInput(' Buda, Cibolo ,\nSan Marcos,, ')).toEqual(['Buda', 'Cibolo', 'San Marcos'])
  })

  it('dedupes case-insensitively keeping first spelling', () => {
    expect(parseCitiesInput('Buda, buda, BUDA, Cibolo')).toEqual(['Buda', 'Cibolo'])
  })

  it('round-trips with formatCitiesInput', () => {
    expect(parseCitiesInput(formatCitiesInput(['Buda', 'Cibolo']))).toEqual(['Buda', 'Cibolo'])
  })
})

describe('matchPortalForInspectionAddress', () => {
  it('finds the portal whose city appears in the address, case-insensitively', () => {
    expect(matchPortalForInspectionAddress(PORTALS, '123 Main St, BUDA, TX 78610')?.label).toBe('MGO Connect')
    expect(matchPortalForInspectionAddress(PORTALS, '500 Alamo Plaza, San Antonio TX')?.label).toBe('SA Permits (Accela)')
  })

  it('prefers the longest matching city when several match', () => {
    const portals = [
      { label: 'Oak portal', url: 'https://a', cities: ['Oak'] },
      { label: 'Live Oak portal', url: 'https://b', cities: ['Live Oak'] },
    ]
    expect(matchPortalForInspectionAddress(portals, '9 Elm, Live Oak, TX')?.label).toBe('Live Oak portal')
  })

  it('returns null for no match, empty address, or null address', () => {
    expect(matchPortalForInspectionAddress(PORTALS, '77 Nowhere Rd, Houston TX')).toBeNull()
    expect(matchPortalForInspectionAddress(PORTALS, '')).toBeNull()
    expect(matchPortalForInspectionAddress(PORTALS, null)).toBeNull()
  })
})
