import { describe, expect, it } from 'vitest'
import {
  bidSiteState,
  bidSiteWords,
  canonOfStreet,
  leadPermit,
  looksLikeThisJob,
  permitsOnSite,
  plumbingTypeOf,
  readBidAddress,
  sameSite,
  seenOutOfWords,
  siteSourceLine,
  type BidSite,
  type BidSitePermit,
} from './bidSite'

// Every address, name and number here is made up.
const READ = ['San Antonio']
const TODAY = '2026-11-10'
const CTX = { todayYmd: TODAY, recordsStartYmd: '2026-08-26', readCities: READ }

function site(address: string): Extract<BidSite, { kind: 'site' }> {
  const s = readBidAddress(address, READ)
  if (s.kind !== 'site') throw new Error(`not a site: ${address} → ${JSON.stringify(s)}`)
  return s
}

function permit(over: Partial<BidSitePermit> = {}): BidSitePermit {
  return { id: 'p1', address: '4120 MILL ST', kind: 'building', stage: 'applied', permit_type: 'Commercial Project Application', project_name: 'MILL STREET LOFTS BLDG C', submitted_on: '2026-09-11', issued_on: null, contact: 'Dana Whitlow', ...over }
}

describe('readBidAddress: a street address in a city we read', () => {
  it('reads the usual shapes of a bid’s line', () => {
    expect(site('4120 Mill Street, San Antonio, TX 78215')).toMatchObject({ city: 'San Antonio', number: '4120', street: '4120 Mill Street' })
    expect(site('4120 MILL ST SAN ANTONIO TX 78215').canon).toEqual({ number: '4120', words: ['mill'], type: 'st' })
    expect(site('4120 Mill St. San Antonio, TX').canon).toEqual({ number: '4120', words: ['mill'], type: 'st' })
    expect(site('4120 Mill Street San Antonio').canon).toEqual({ number: '4120', words: ['mill'], type: 'st' })
  })

  it('leaves the suite, the building and the unit out', () => {
    expect(site('2014 Stone Ridge Parkway Suite 255 San Antonio, TX 78258')).toMatchObject({ number: '2014', street: '2014 Stone Ridge Parkway', canon: { words: ['ridge', 'stone'], type: 'pkwy' } })
    expect(site('88 Harbor St, Bldg. 14, Suite 1410, San Antonio, TX 78205').canon).toEqual({ number: '88', words: ['harbor'], type: 'st' })
    expect(site('310 Alder Row #4, San Antonio TX').canon).toEqual({ number: '310', words: ['alder'], type: 'row' })
  })

  it('takes the city from the end of the line, so a street named for a town is still a street', () => {
    expect(site('123 AUSTIN HWY SAN ANTONIO TX 78209').canon).toEqual({ number: '123', words: ['austin', 'hwy'], type: null })
    expect(site('1515 N New Braunfels Ave, San Antonio, TX 78208').canon).toEqual({ number: '1515', words: ['braunfels', 'n', 'new'], type: 'ave' })
    expect(readBidAddress('123 San Antonio St, Kyle, TX 78640', READ)).toEqual({ kind: 'not_read', town: 'Kyle' })
  })

  it('keeps a letter on the number and the first of a range', () => {
    expect(site('100B Sample St, San Antonio, TX').number).toBe('100b')
    expect(site('100-104 Sample St, San Antonio, TX').number).toBe('100')
  })
})

describe('sameSite: both sides read into one shape', () => {
  const same = (bid: string, feedStreet: string) => sameSite(site(bid).canon, canonOfStreet(feedStreet)!)

  it('meets the feed whether it abbreviates the street type, spells it out or leaves it off', () => {
    expect(same('2031 Escala Parkway, San Antonio, TX', '2031 ESCALA PKWY')).toBe(true)
    expect(same('2031 Escala Pkwy, San Antonio, TX', '2031 ESCALA PARKWAY')).toBe(true)
    expect(same('1143 Vance Jackson Rd, San Antonio, TX', '1143 VANCE JACKSON')).toBe(true)
    expect(same('7959 Broadway, San Antonio, TX', '7959 BROADWAY ST')).toBe(true)
  })

  it('does not join two types on one name, another number or another street', () => {
    expect(same('100 Sample St, San Antonio, TX', '100 SAMPLE AVE')).toBe(false)
    expect(same('100 Sample St, San Antonio, TX', '102 SAMPLE ST')).toBe(false)
    expect(same('100 Sample St, San Antonio, TX', '100 SIMPLE ST')).toBe(false)
    expect(same('100 E Sample St, San Antonio, TX', '100 SAMPLE ST')).toBe(false)
  })

  it('reads a highway by its number, wherever the direction sits', () => {
    expect(same('1515 N Loop 1604 E, Suite 400 San Antonio, TX 78232', '1515 N 1604 E')).toBe(true)
    expect(same('13730 US Hwy 281 N, San Antonio, TX', '13730 N US HWY 281')).toBe(true)
    expect(same('13730 US 281 North, San Antonio, TX', '13730 N US HWY 281')).toBe(true)
    expect(same('8751 State Hwy 151, San Antonio, TX 78245', '8751 STATE HWY 151')).toBe(true)
    expect(same('8751 SH-151, San Antonio, TX 78245', '8751 STATE HWY 151')).toBe(true)
    expect(same('119 SW Loop 410, San Antonio, TX', '119 SW 410')).toBe(true)
    expect(same('6142 FM 78, San Antonio, TX', '6142 FM 78')).toBe(true)
    expect(same('6142 FM 78, San Antonio, TX', '6142 HWY 78')).toBe(false)
    expect(same('6142 FM78 San Antonio, TX 78244', '6142 FM 78')).toBe(true)
    expect(same('1432 Farm to Market 471 W, San Antonio, TX', '1432 FM 471 W')).toBe(true)
    expect(same('923 Texas 211, San Antonio, TX 78253', '923 STATE HWY 211')).toBe(true)
  })

  it('reads an interstate in any of its spellings, with or without the frontage road', () => {
    expect(same('11006 N IH 35, San Antonio, TX', '11006 N IH 35')).toBe(true)
    expect(same('11006 N IH35 Frontage Rd, San Antonio, TX', '11006 N IH 35')).toBe(true)
    expect(same('11006 N I-35, San Antonio, TX', '11006 N IH 35')).toBe(true)
    expect(same('11006 North Interstate 35, San Antonio, TX', '11006 N IH 35')).toBe(true)
    expect(same('10401 IH 10 West, San Antonio, TX', '10401 IH 10 W')).toBe(true)
  })

  it('keeps a street that is named for a direction', () => {
    expect(same('345 North Dr, San Antonio, TX', '345 NORTH DR')).toBe(true)
    expect(canonOfStreet('345 NORTH DR')).toEqual({ number: '345', words: ['n'], type: 'dr' })
  })

  it('has nothing to compare when a line has no number or no street', () => {
    expect(canonOfStreet('MILL ST')).toBeNull()
    expect(canonOfStreet('4120')).toBeNull()
    expect(canonOfStreet(null)).toBeNull()
  })
})

describe('readBidAddress: a town we do not read', () => {
  it('names the town when it can pick it out', () => {
    expect(readBidAddress('3798 Kyle Crossing Kyle, TX 78640', READ)).toEqual({ kind: 'not_read', town: 'Kyle' })
    expect(readBidAddress('709 Laurel St, Bastrop TX 78602', READ)).toEqual({ kind: 'not_read', town: 'Bastrop' })
    expect(readBidAddress('1750 E COMMON ST NEW BRAUNFELS TX 78130', READ)).toEqual({ kind: 'not_read', town: 'NEW BRAUNFELS' })
    expect(readBidAddress('2050 FM 1102 New Braunfels, TX 78130', READ)).toEqual({ kind: 'not_read', town: 'New Braunfels' })
    expect(readBidAddress('1450 N Business IH 35 NEW BRAUNFELS 78130', READ)).toEqual({ kind: 'not_read', town: 'NEW BRAUNFELS' })
    expect(readBidAddress('20285 State Hwy 46 W., Bulverde, Tx 78163', READ)).toEqual({ kind: 'not_read', town: 'Bulverde' })
    expect(readBidAddress('5303 Wurzbach Rd Leon Valley, TX 78238', READ)).toEqual({ kind: 'not_read', town: 'Leon Valley' })
  })

  it('reads another state as not read', () => {
    expect(readBidAddress('231 Sample Trail, Smallton, SC 29107', READ)).toEqual({ kind: 'not_read', town: 'Smallton' })
  })

  it('says so without a name when the town cannot be picked out', () => {
    expect(readBidAddress('9325 N LAMAR AUSTIN TX 78753', READ)).toEqual({ kind: 'not_read', town: null })
  })

  it('reads the same line as a site once that city is read', () => {
    expect(readBidAddress('9325 N LAMAR AUSTIN TX 78753', ['San Antonio', 'Austin'])).toMatchObject({ kind: 'site', city: 'Austin', number: '9325' })
  })
})

describe('readBidAddress: not a street address', () => {
  const why = (address: string | null) => {
    const s = readBidAddress(address, READ)
    return s.kind === 'unreadable' ? s.why : s.kind
  }

  it('gives the reason', () => {
    expect(why(null)).toBe('empty')
    expect(why('   ')).toBe('empty')
    expect(why('BLANCO')).toBe('no_number')
    expect(why('Loop 1604 at Oak Hollow')).toBe('no_number')
    expect(why('Mill Street, San Antonio, TX')).toBe('no_number')
    expect(why('1558 pams')).toBe('no_city')
    expect(why('2401 MISSION HILL PARK RA#2401')).toBe('no_city')
    expect(why('4120 San Antonio, TX')).toBe('no_street')
    expect(why('281 and Gerald Drive, San Antonio, TX')).toBe('crossing')
    expect(why('100 Sample St & Main, San Antonio, TX')).toBe('crossing')
  })

  it('does not take a court or a northeast for a state', () => {
    expect(why('100 Sample Ct')).toBe('no_city')
    expect(why('100 Sample St NE')).toBe('no_city')
  })

  it('keeps the line as typed for the screen', () => {
    expect(readBidAddress('  Loop 1604   at Oak Hollow ', READ)).toEqual({ kind: 'unreadable', why: 'no_number', reads: 'Loop 1604 at Oak Hollow' })
  })
})

describe('permitsOnSite', () => {
  it('keeps the permits on the bid’s own address and drops its neighbours', () => {
    const rows = [permit(), permit({ id: 'p2', address: '4120 MILL STREET' }), permit({ id: 'p3', address: '4122 MILL ST' }), permit({ id: 'p4', address: '4120 MILLER ST' }), permit({ id: 'p5', address: null })]
    expect(permitsOnSite(site('4120 Mill Street, San Antonio, TX 78215'), rows).map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('finds nothing for a bid that is not a site', () => {
    expect(permitsOnSite(readBidAddress('BLANCO', READ), [permit()])).toEqual([])
  })
})

describe('what a permit on the address is', () => {
  it('tells a general plumbing permit from gas, sewer and irrigation', () => {
    expect(plumbingTypeOf('Plumbing General Permit')).toBe('general')
    expect(plumbingTypeOf('Plumbing Gas Permit')).toBe('gas')
    expect(plumbingTypeOf('Plumbing Irrigation Permit')).toBe('irrigation')
    expect(plumbingTypeOf('Plumbing Sewer Permit')).toBe('sewer')
    expect(plumbingTypeOf('LSR Plumbing Permit')).toBe('other')
    expect(plumbingTypeOf('Comm Remodel Permit')).toBeNull()
    expect(plumbingTypeOf(null)).toBeNull()
  })

  it('hints at this job by a telling word the two names share', () => {
    expect(looksLikeThisJob('Mill Street Lofts, Building C', 'MILL STREET LOFTS BLDG C')).toBe(true)
    expect(looksLikeThisJob('Mill Street Lofts, Building C', 'MILL ST COFFEE TI')).toBe(true)
    expect(looksLikeThisJob('Larkspur Dental', 'MILL ST COFFEE TI')).toBe(false)
    // Words every project carries tell nothing.
    expect(looksLikeThisJob('Retail Shell Building', 'SHELL BUILDING RETAIL CENTER')).toBe(false)
    expect(looksLikeThisJob('', 'MILL STREET LOFTS')).toBe(false)
    expect(looksLikeThisJob('Mill Street Lofts', null)).toBe(false)
  })

  it('leads with the newest building permit that looks like this job', () => {
    const lofts = permit()
    const coffee = permit({ id: 'p2', project_name: 'HARTWELL COFFEE TI', stage: 'issued', permit_type: 'Comm Remodel Permit', issued_on: '2026-10-20' })
    const water = permit({ id: 'p3', kind: 'plumbing', permit_type: 'Plumbing Irrigation Permit', project_name: null, stage: 'issued', issued_on: '2026-11-01' })
    expect(leadPermit('Mill Street Lofts, Building C', [water, coffee, lofts])?.id).toBe('p1')
    expect(leadPermit('Larkspur Dental', [water, coffee, lofts])?.id).toBe('p2')
    expect(leadPermit('Larkspur Dental', [water])?.id).toBe('p3')
    expect(leadPermit('Larkspur Dental', [])).toBeNull()
  })
})

describe('the four honest states and their words', () => {
  const mill = site('4120 Mill Street, San Antonio, TX 78215')

  it('names the state', () => {
    expect(bidSiteState(mill, 2)).toBe('found')
    expect(bidSiteState(mill, 0)).toBe('none_seen')
    expect(bidSiteState(readBidAddress('3798 Kyle Crossing Kyle, TX 78640', READ), 0)).toBe('not_read')
    expect(bidSiteState(readBidAddress('BLANCO', READ), 0)).toBe('unreadable')
  })

  it('says what the city has on the address, and that no general plumbing permit is seen', () => {
    const irrigation = permit({ id: 'p3', kind: 'plumbing', permit_type: 'Plumbing Irrigation Permit', project_name: null, stage: 'issued', issued_on: '2026-10-02', contact: 'Greenline Irrigation' })
    expect(bidSiteWords(mill, 'Mill Street Lofts, Building C', [permit(), irrigation], CTX)).toEqual({
      state: 'found',
      main: 'The city has a permit application on this address. Filed 60 days ago, not issued yet. No general plumbing permit seen on it.',
      detail: null,
    })
  })

  it('says an issued permit is issued, and names who the city lists on a general plumbing permit', () => {
    const issued = permit({ stage: 'issued', permit_type: 'Comm New Building Permit', issued_on: '2026-11-03' })
    const plumbing = permit({ id: 'p2', kind: 'plumbing', permit_type: 'Plumbing General Permit', project_name: null, stage: 'issued', issued_on: '2026-11-05', contact: 'Lone Oak Plumbing' })
    expect(bidSiteWords(mill, 'Mill Street Lofts', [issued, plumbing], CTX).main).toBe('The city has a building permit on this address. Issued 7 days ago. A general plumbing permit is on this address. The city lists Lone Oak Plumbing.')
    expect(bidSiteWords(mill, 'Mill Street Lofts', [{ ...plumbing, contact: null }], CTX).main).toBe('The city has 1 permit on this address, and it is not a building permit. A general plumbing permit is on this address.')
  })

  it('says none seen, never none, with the day the records start', () => {
    expect(bidSiteWords(mill, 'Mill Street Lofts', [], CTX)).toEqual({
      state: 'none_seen',
      main: 'No permit seen on 4120 Mill Street since Aug 26.',
      detail: 'The city’s records run 2 to 3 days behind. A site outside the city limits files elsewhere.',
    })
    expect(bidSiteWords(mill, 'Mill Street Lofts', [], { ...CTX, recordsStartYmd: null }).main).toBe('No permit seen on 4120 Mill Street.')
  })

  it('says a town is not read, and which cities are', () => {
    expect(bidSiteWords(readBidAddress('3798 Kyle Crossing Kyle, TX 78640', READ), 'Cedar Bend Clinic', [], CTX)).toEqual({ state: 'not_read', main: 'No permit records for Kyle.', detail: 'Permits are read for San Antonio only.' })
    expect(bidSiteWords(readBidAddress('9325 N LAMAR AUSTIN TX 78753', READ), null, [], { ...CTX, readCities: ['San Antonio', 'Leander'] })).toEqual({ state: 'not_read', main: 'No permit records for this town.', detail: 'Permits are read for San Antonio and Leander only.' })
  })

  it('says why an address cannot be looked up, and shows it as typed', () => {
    expect(bidSiteWords(readBidAddress('Loop 1604 at Oak Hollow', READ), null, [], CTX)).toEqual({ state: 'unreadable', main: 'This bid’s address has no street number, so permits cannot be looked up.', detail: 'It reads: Loop 1604 at Oak Hollow.' })
    expect(bidSiteWords(readBidAddress(null, READ), null, [], CTX)).toEqual({ state: 'unreadable', main: 'This bid has no address, so permits cannot be looked up.', detail: null })
    expect(bidSiteWords(readBidAddress('281 and Gerald Drive, San Antonio, TX', READ), null, [], CTX).main).toBe('This bid’s address is a crossing, not a street number, so permits cannot be looked up.')
    expect(bidSiteWords(readBidAddress('1558 pams', READ), null, [], CTX).main).toBe('This bid’s address names no city, so permits cannot be looked up.')
    expect(bidSiteWords(readBidAddress('4120 San Antonio, TX', READ), null, [], CTX).main).toBe('This bid’s address has no street name, so permits cannot be looked up.')
  })
})

describe('the scope every later screen says', () => {
  it('names the source, the first day of the records and how far behind they run', () => {
    expect(siteSourceLine('San Antonio', '2026-08-26', TODAY)).toBe('Source: City of San Antonio building permits. Records start Aug 26 and run 2 to 3 days behind.')
    expect(siteSourceLine('San Antonio', '2025-01-01', TODAY)).toBe('Source: City of San Antonio building permits. Records start Jan 1, 2025 and run 2 to 3 days behind.')
    expect(siteSourceLine('San Antonio', null, TODAY)).toBe('Source: City of San Antonio building permits. They run 2 to 3 days behind.')
  })

  it('says what a count is out of', () => {
    expect(seenOutOfWords(4, 5)).toBe('Of the 5 sites we can see, 4 have a permit.')
    expect(seenOutOfWords(1, 1)).toBe('Of the 1 site we can see, 1 has a permit.')
    expect(seenOutOfWords(0, 3)).toBe('Of the 3 sites we can see, 0 have a permit.')
    expect(seenOutOfWords(0, 0)).toBe('No sites we can see yet.')
  })
})
