import { describe, expect, it } from 'vitest'
import {
  builderKey,
  builderPermitLines,
  builderSearchWord,
  builderWords,
  deedsDoor,
  permitOwnPage,
  feedRowFields,
  googleAskForAddress,
  googleAskForCompany,
  googleAskForPerson,
  googleAsksForContact,
  googleSearchUrl,
  sitePermitLines,
  siteWords,
  type SitePermit,
} from './permitPublic'

// Every name, street and number here is made up.
function permit(over: Partial<SitePermit> = {}): SitePermit {
  return {
    id: 'p1',
    permit_number: 'COM-BLG-PMT26-00000001',
    permit_type: 'Comm New Building Permit',
    kind: 'building',
    stage: 'issued',
    work_type: 'New commercial',
    submitted_on: '2026-10-02',
    issued_on: '2026-11-06',
    contact: 'Ridgeway Builders',
    address: '100 SAMPLE ST',
    declared_value: 1_400_000,
    ...over,
  }
}

describe('the Google search a name or an address asks for (punch list #302)', () => {
  it('searches a company by its name and its city', () => {
    const a = googleAskForCompany('Ridgeway Builders, LLC', 'San Antonio')
    expect(a?.query).toBe('"Ridgeway Builders, LLC" San Antonio TX')
    expect(a?.label).toBe('Search Google for Ridgeway Builders, LLC')
    expect(a?.url).toBe('https://www.google.com/search?q=%22Ridgeway%20Builders%2C%20LLC%22%20San%20Antonio%20TX')
  })

  it('searches a person with their company, so a common name finds the right one', () => {
    expect(googleAskForPerson('Dana Whitlock', 'Ridgeway Builders', 'San Antonio')?.query).toBe('"Dana Whitlock" "Ridgeway Builders"')
    expect(googleAskForPerson('Dana Whitlock', null, 'San Antonio')?.query).toBe('"Dana Whitlock" San Antonio TX')
    expect(googleAskForPerson('Dana Whitlock', null, null)?.query).toBe('"Dana Whitlock"')
  })

  it('searches an address with its city and zip', () => {
    expect(googleAskForAddress('100  SAMPLE ST', 'San Antonio', '78245')?.query).toBe('"100 SAMPLE ST" San Antonio TX 78245')
  })

  it('asks nothing of an empty name, and drops a quote inside one', () => {
    expect(googleAskForCompany('  ', 'San Antonio')).toBeNull()
    expect(googleAskForPerson(null, 'Ridgeway Builders', 'San Antonio')).toBeNull()
    expect(googleAskForAddress(null, 'San Antonio', null)).toBeNull()
    expect(googleAskForCompany('The "Best" Builders', null)?.query).toBe('"The Best Builders"')
  })

  it("splits a permit's contact line into its two searches", () => {
    const both = googleAsksForContact('Dana Whitlock, Ridgeway Builders', 'San Antonio')
    expect(both.company?.query).toBe('"Ridgeway Builders" San Antonio TX')
    expect(both.person?.query).toBe('"Dana Whitlock" "Ridgeway Builders"')
    const alone = googleAsksForContact('Dana Whitlock', 'San Antonio')
    expect(alone.company).toBeNull()
    expect(alone.person?.query).toBe('"Dana Whitlock" San Antonio TX')
    expect(googleAsksForContact(null, 'San Antonio')).toEqual({ company: null, person: null })
  })

  it('encodes what is asked', () => {
    expect(googleSearchUrl('a & b')).toBe('https://www.google.com/search?q=a%20%26%20b')
  })
})

describe("the feed's own row as lines", () => {
  const raw = {
    _id: 41,
    Y_COORD: '29.4',
    'PRIMARY CONTACT': 'Ridgeway Builders',
    'AREA (SF)': '6200.0',
    'DECLARED VALUATION': '1400000.0',
    'DATE ISSUED': null,
    'DATE SUBMITTED': '2026-11-06T00:00:00',
    'PROJECT NAME': 'Sample Retail, shell',
    'PERMIT #': 'COM-PRJ-APP26-00000001',
    'PERMIT TYPE': 'Commercial Project Application',
    'CD': 7,
    'NCD NAME': '',
  }

  it("orders the known columns the way a reader wants, then the rest by name, and leaves out what is empty", () => {
    expect(feedRowFields(raw)).toEqual([
      { label: 'Permit type', value: 'Commercial Project Application' },
      { label: 'Permit number', value: 'COM-PRJ-APP26-00000001' },
      { label: 'Project name', value: 'Sample Retail, shell' },
      { label: 'Submitted', value: 'Nov 6, 2026' },
      { label: 'Declared value', value: '$1,400,000' },
      { label: 'Area, sq ft', value: '6,200' },
      { label: 'Primary contact', value: 'Ridgeway Builders' },
      { label: 'Cd', value: '7' },
      { label: 'Map point, y', value: '29.4' },
    ])
  })

  it('reads nothing from a row that is not an object', () => {
    expect(feedRowFields(null)).toEqual([])
    expect(feedRowFields('x')).toEqual([])
    expect(feedRowFields([1, 2])).toEqual([])
  })
})

describe('every permit on one address', () => {
  it('lists each permit once, newest first, and marks the one the sheet opened on', () => {
    const lines = sitePermitLines(
      [
        permit(),
        permit({ id: 'p2', kind: 'other', work_type: 'Commercial site work', issued_on: '2026-10-21', permit_type: 'Site Work Permit' }),
        permit(),
        permit({ id: 'p3', stage: 'applied', issued_on: null, submitted_on: '2026-11-08', work_type: null, permit_type: 'Commercial Project Application' }),
      ],
      'p1',
    )
    expect(lines.map((l) => [l.id, l.day, l.what, l.self])).toEqual([
      ['p3', '2026-11-08', 'Commercial Project Application, applied', false],
      ['p1', '2026-11-06', 'New commercial', true],
      ['p2', '2026-10-21', 'Commercial site work', false],
    ])
  })

  it('says how many the feed holds and whether a plumbing permit is among them', () => {
    expect(siteWords(sitePermitLines([permit()], 'p1'))).toBe('This is the one permit the feed holds on this address. A plumbing permit is not among them yet.')
    expect(siteWords(sitePermitLines([permit(), permit({ id: 'p2', kind: 'plumbing', work_type: 'Plumbing' })], 'p1'))).toBe('The feed holds 2 permits on this address. A plumbing permit is among them.')
    expect(siteWords([])).toBe('The feed holds this permit alone on this address.')
  })
})

describe("a name's other permits", () => {
  it('keys a line on its company, or on the person when it names no company', () => {
    expect(builderKey('Dana Whitlock, Ridgeway Builders, LLC')).toBe('ridgewaybuilders')
    expect(builderKey('RIDGEWAY BUILDERS LLC')).toBe('ridgewaybuilders')
    expect(builderKey('Dana Whitlock')).toBe('danawhitlock')
    expect(builderKey('')).toBeNull()
  })

  it('asks the table for one plain word of the name', () => {
    expect(builderSearchWord('Dana Whitlock, Ridgeway Builders, LLC')).toBe('ridgeway')
    expect(builderSearchWord('The Co. of Tall Pine')).toBe('tall')
    expect(builderSearchWord("O'Brien & Sons Building")).toBe('brien')
    expect(builderSearchWord('100% Builders')).toBe('100')
    expect(builderSearchWord(null)).toBeNull()
  })

  it('holds the candidates to the whole name, drops the permit itself, newest first', () => {
    const lines = builderPermitLines(
      [
        permit(),
        permit({ id: 'p2', contact: 'Sam Reyes, RIDGEWAY BUILDERS LLC', address: '77 KILN ST', issued_on: '2026-10-02' }),
        permit({ id: 'p3', contact: 'Ridgeway Roofing', address: '5 ASTER RDG' }),
        permit({ id: 'p4', contact: 'Ridgeway Builders', address: '120 SAMPLE ST', issued_on: '2026-03-20' }),
      ],
      'Dana Whitlock, Ridgeway Builders',
      'p1',
    )
    expect(lines.map((l) => [l.id, l.where])).toEqual([
      ['p2', '77 KILN ST'],
      ['p4', '120 SAMPLE ST'],
    ])
    expect(builderWords(lines, 'since Aug 26')).toBe('This name is on 2 other permits we can see since Aug 26.')
    expect(builderWords(lines.slice(0, 1), 'in the last year')).toBe('This name is on 1 other permit we can see in the last year.')
    expect(builderWords([], 'since Aug 26')).toBe('This is the one permit we can see under this name since Aug 26.')
    // The start of the records not known: the line still claims only what is seen.
    expect(builderWords(lines, null)).toBe('This name is on 2 other permits we can see.')
    expect(builderWords([], null)).toBe('This is the one permit we can see under this name.')
    expect(builderPermitLines([permit()], null, null)).toEqual([])
  })
})

describe('the public doors', () => {
  it("finds the city's own page for one permit when the feed's row carries it", () => {
    expect(permitOwnPage({ USER_URL: 'https://city.example/permit/1' })).toBe('https://city.example/permit/1')
    expect(permitOwnPage({ link: { url: 'https://city.example/folder?id=2' } })).toBe('https://city.example/folder?id=2')
    expect(permitOwnPage({ link: 'https://city.example/3' })).toBe('https://city.example/3')
    expect(permitOwnPage({ USER_URL: 'javascript:alert(1)' })).toBeNull()
    expect(permitOwnPage({ USER_URL: 'http://city.example/plain' })).toBeNull()
    expect(permitOwnPage({ 'PERMIT #': 'X' })).toBeNull()
    expect(permitOwnPage(null)).toBeNull()
  })

  it("knows the county clerk's deed search for the cities the pull reads, and no other", () => {
    expect(deedsDoor('San Antonio')).toBe('https://bexar.tx.publicsearch.us/')
    expect(deedsDoor('Austin')).toBe('https://www.tccsearch.org/')
    expect(deedsDoor('Laredo')).toBeNull()
    expect(deedsDoor(null)).toBeNull()
  })
})
