import { describe, expect, it } from 'vitest'
import { compareRows, lookAlikePairs, markName, nameLikeness, siteCountsByName, nameWords, oneLetterApart, searchNames, suggestNames, tiePressWords, type PermitName } from './nameLikeness'

// Every name here is made up.
describe('nameWords', () => {
  it('drops the legal filler and tells the trade words from the telling ones', () => {
    expect(nameWords('Ridgeway Builders of Texas, LLC')).toEqual({ all: ['ridgeway', 'builders', 'texas'], telling: ['ridgeway'] })
    expect(nameWords('The Hartwell Co.')).toEqual({ all: ['hartwell'], telling: ['hartwell'] })
    expect(nameWords(null)).toEqual({ all: [], telling: [] })
  })
})

describe('oneLetterApart', () => {
  it('takes one letter changed, added or swapped, on words long enough to mean it', () => {
    expect(oneLetterApart('ridgeway', 'ridgway')).toBe(true)
    expect(oneLetterApart('hartwell', 'hartwall')).toBe(true)
    expect(oneLetterApart('marlow', 'malrow')).toBe(true)
    expect(oneLetterApart('interior', 'interiors')).toBe(true)
    expect(oneLetterApart('ridgeway', 'ridgeway')).toBe(false)
    expect(oneLetterApart('ridgeway', 'rodgewoy')).toBe(false)
    expect(oneLetterApart('oak', 'oat')).toBe(false)
  })
})

describe('nameLikeness', () => {
  it('knows the same name', () => {
    expect(nameLikeness('Ridgeway Builders', 'RIDGEWAY BUILDERS, LLC')).toMatchObject({ grade: 100, reason: 'same' })
  })

  it('says one name begins the other, word for word', () => {
    expect(nameLikeness('Ridgeway Builders', 'Ridgeway Builders of Texas LLC')).toEqual({ grade: 90, reason: 'begins', words: 'One name begins the other', marked: ['ridgeway', 'builders'] })
    expect(nameLikeness('Ridgeway Builders San Antonio', 'Ridgeway Builders')).toMatchObject({ reason: 'begins' })
  })

  it('says one letter apart', () => {
    expect(nameLikeness('Ridgeway Builders', 'Ridgway Builders Inc')).toEqual({ grade: 75, reason: 'near', words: 'One letter apart', marked: ['ridgway'] })
    expect(nameLikeness('Hartwell Interiors', 'Hartwell Interior Contracting')).toMatchObject({ reason: 'near', marked: ['hartwell', 'interior'] })
  })

  it('says which telling words are shared, and grades a name with more of its own lower', () => {
    expect(nameLikeness('Reliable Commercial Construction', 'Reliable Construction Industries')).toEqual({ grade: 70, reason: 'shared', words: 'Shares the word Reliable', marked: ['reliable'] })
    expect(nameLikeness('Ridgeway Builders', 'Ridgeway Roofing Co')).toEqual({ grade: 60, reason: 'shared', words: 'Shares the word Ridgeway', marked: ['ridgeway'] })
    expect(nameLikeness('Marlow Design Group', 'Marlow Studio Design + Build')).toMatchObject({ reason: 'shared', words: 'Shares the word Marlow' })
    expect(nameLikeness('Pecan Grove Pharmacy', 'Pecan Grove Dental')).toBeNull()
  })

  it('refuses a word that only sits inside a longer, unrelated name', () => {
    expect(nameLikeness('Structura', 'Bandit Structural Concrete Works')).toBeNull()
    expect(nameLikeness('Selwick General Contractors', 'Selwick Ridge Electric and Mechanical Works')).toBeNull()
  })

  it('refuses a shared trade word, a shared number and nothing in common', () => {
    expect(nameLikeness('Ridgeway Builders', 'Hartwell Builders')).toBeNull()
    expect(nameLikeness('Texas Construction Group', 'Central Texas Builders')).toBeNull()
    expect(nameLikeness('360 Builders', '360 Roofing')).toBeNull()
    expect(nameLikeness('Ridgeway Builders', 'Dana Whitlow')).toBeNull()
    expect(nameLikeness('', 'Dana Whitlow')).toBeNull()
  })

  it('reads initials', () => {
    expect(nameLikeness('DSI', 'Diamondback Solutions International')).toMatchObject({ grade: 55, reason: 'initials', words: 'Initials match' })
    expect(nameLikeness('Diamondback Solutions International', 'DSI')).toMatchObject({ reason: 'initials' })
  })
})

describe('markName', () => {
  it('cuts a name into the words to mark and the rest, joining neighbours', () => {
    expect(markName('Ridgeway Builders of Texas LLC', ['ridgeway', 'builders'])).toEqual([{ text: 'Ridgeway Builders ', hit: true }, { text: 'of Texas LLC', hit: false }])
    expect(markName('Ridgway Builders Inc', ['ridgway'])).toEqual([{ text: 'Ridgway ', hit: true }, { text: 'Builders Inc', hit: false }])
    expect(markName('Dana Whitlow', [])).toEqual([{ text: 'Dana Whitlow', hit: false }])
  })
})

describe('suggestNames', () => {
  const names: PermitName[] = [
    { key: 'ridgewaybuilders', name: 'Ridgeway Builders', permits: 2, lastOn: '2026-11-01', kind: null },
    { key: 'ridgewaybuilderstexas', name: 'Ridgeway Builders of Texas LLC', permits: 7, lastOn: '2026-11-03', kind: null },
    { key: 'ridgwaybuilders', name: 'Ridgway Builders Inc', permits: 2, lastOn: '2026-09-14', kind: null },
    { key: 'ridgewayroofing', name: 'Ridgeway Roofing Co', permits: 11, lastOn: '2026-10-30', kind: null },
    { key: 'danawhitlow', name: 'Dana Whitlow', permits: 8, lastOn: '2026-10-01', kind: null },
    { key: 'permitpros', name: 'Permit Pros', permits: 40, lastOn: '2026-11-05', kind: 'files_for_others' },
    { key: 'hartwellinteriors', name: 'Hartwell Interiors', permits: 4, lastOn: '2026-10-21', kind: null },
  ]

  it('puts a permit on an address we bid to them above any likeness, and leaves their own name out', () => {
    const got = suggestNames('Ridgeway Builders', names, new Map([['danawhitlow', 1], ['ridgewaybuilderstexas', 2], ['permitpros', 3]]), new Set())
    expect(got.map((s) => s.key)).toEqual(['ridgewaybuilderstexas', 'ridgwaybuilders', 'ridgewayroofing', 'danawhitlow'])
    expect(got[0]?.reasons).toEqual([
      { words: '2 permits on addresses you bid to them', tone: 'green' },
      { words: 'One name begins the other', tone: 'amber' },
    ])
    expect(got[3]).toMatchObject({ reasons: [{ words: '1 permit on addresses you bid to them', tone: 'green' }], marked: [] })
    expect(got[2]?.reasons).toEqual([{ words: 'Shares the word Ridgeway', tone: 'grey' }])
  })

  it('never offers a name already answered, or one that files for others', () => {
    const got = suggestNames('Ridgeway Builders', names, new Map([['permitpros', 3]]), new Set(['ridgewayroofing', 'ridgwaybuilders']))
    expect(got.map((s) => s.key)).toEqual(['ridgewaybuilderstexas'])
  })
})

describe('searchNames', () => {
  const names: PermitName[] = [
    { key: 'a', name: 'Hartwell Interiors', permits: 4, lastOn: null, kind: null },
    { key: 'b', name: 'Hartwell Interior Contracting', permits: 9, lastOn: null, kind: null },
    { key: 'c', name: 'Marlow Design Group', permits: 3, lastOn: null, kind: null },
  ]
  it('finds names whose words begin with every word typed, the busiest first', () => {
    expect(searchNames('hart int', names).map((n) => n.key)).toEqual(['b', 'a'])
    expect(searchNames('marlow', names).map((n) => n.key)).toEqual(['c'])
    expect(searchNames('well', names)).toEqual([])
    expect(searchNames('  ', names)).toEqual([])
  })
})

describe('tiePressWords', () => {
  it('names the act', () => {
    expect(tiePressWords(true)).toBe('Same company')
    expect(tiePressWords(false)).toBe('Works for them')
  })
})

describe('what two records share', () => {
  const hits = [
    { builderKey: 'ridgewaybuilderstexas', address: '4120 MILL ST', day: '2026-09-11', stage: 'applied' },
    { builderKey: 'ridgewaybuilderstexas', address: '88 HARBOR ST', day: '2026-11-03', stage: 'issued' },
    { builderKey: 'danawhitlow', address: '310 ALDER ROW', day: null, stage: 'issued' },
    { builderKey: null, address: '1 SAMPLE ST', day: null, stage: 'issued' },
  ]

  it('counts each name’s permits on addresses we bid', () => {
    expect(siteCountsByName(hits)).toEqual(new Map([['ridgewaybuilderstexas', 2], ['danawhitlow', 1]]))
  })

  it('puts ours beside the city’s and marks an address and a zip in common', () => {
    const rows = compareRows({
      customerName: 'Ridgeway Builders',
      bidAddresses: ['4120 Mill Street, San Antonio, TX 78215', '88 Harbor St, San Antonio, TX 78215', '3798 Kyle Crossing Kyle, TX 78640', null],
      siteStreets: ['4120 Mill Street', '88 Harbor St'],
      name: 'Ridgeway Builders of Texas LLC',
      permits: [
        { address: '4120 MILL ST', zip: '78215', contact: 'Paula Kemp, Ridgeway Builders of Texas LLC' },
        { address: '88 HARBOR ST', zip: '78215', contact: 'Paula Kemp, Ridgeway Builders of Texas LLC' },
        { address: '9 OTHER RD', zip: '78209', contact: 'Ridgeway Builders of Texas LLC' },
      ],
      onOurSites: hits.slice(0, 2),
    })
    expect(rows).toEqual([
      { ours: { label: 'Name', value: 'Ridgeway Builders' }, theirs: { label: 'Name, as the city lists it', value: 'Ridgeway Builders of Texas LLC · with Paula Kemp (2)' }, hit: false },
      {
        ours: { label: 'Addresses you bid to them', value: '4120 Mill Street · 88 Harbor St' },
        theirs: { label: 'This name’s permits on those addresses', value: '4120 MILL ST, applied Sep 11 · 88 HARBOR ST, issued Nov 3' },
        hit: true,
      },
      { ours: { label: 'Where your bids with them are', value: '78215 (2) · 78640 (1)' }, theirs: { label: 'Where this name’s permits are', value: '78215 (2) · 78209 (1)' }, hit: true },
    ])
  })

  it('says so when nothing is in common', () => {
    const rows = compareRows({ customerName: 'Ridgeway Builders', bidAddresses: ['BLANCO'], siteStreets: [], name: 'Ridgeway Roofing Co', permits: [{ address: '5 FAR RD', zip: '78250', contact: 'Ridgeway Roofing Co' }], onOurSites: [] })
    expect(rows.map((r) => r.hit)).toEqual([false, false, false])
    expect(rows[1]?.ours.value).toBe('None in a city whose permits are read')
    expect(rows[1]?.theirs.value).toBe('None seen')
    expect(rows[2]?.ours.value).toBe('No zip on their bids')
  })

  it('does not say a name is with itself, and says a line that repeats once with its count', () => {
    const rows = compareRows({
      customerName: 'Hartwell & Assoc.',
      bidAddresses: ['12 Canal Row, San Antonio, TX 78215'],
      siteStreets: ['12 Canal Row'],
      name: 'Dana Whitlow',
      permits: [
        { address: '12 CANAL ROW', zip: '78215', contact: 'Dana Whitlow' },
        { address: '12 CANAL ROW', zip: '78215', contact: 'DANA WHITLOW' },
      ],
      onOurSites: [
        { ...hits[0]!, address: '12 CANAL ROW', day: '2026-09-08', stage: 'issued' },
        { ...hits[0]!, address: '12 CANAL ROW', day: '2026-09-08', stage: 'issued' },
      ],
    })
    expect(rows[0]?.theirs.value).toBe('Dana Whitlow')
    expect(rows[1]?.theirs.value).toBe('12 CANAL ROW, issued Sep 8 (2)')
  })
})

describe('lookAlikePairs', () => {
  const names: PermitName[] = [
    { key: 'ridgewaybuilderstexas', name: 'Ridgeway Builders of Texas LLC', permits: 7, lastOn: '2026-11-03', kind: null },
    { key: 'hartwellinteriorcontracting', name: 'Hartwell Interior Contracting', permits: 4, lastOn: '2026-10-21', kind: null },
    { key: 'marlowdesignbuild', name: 'Marlow Design + Build', permits: 3, lastOn: '2026-09-30', kind: null },
    { key: 'ridgewayroofing', name: 'Ridgeway Roofing Co', permits: 11, lastOn: '2026-10-30', kind: null },
    { key: 'danawhitlow', name: 'Dana Whitlow', permits: 8, lastOn: '2026-10-01', kind: null },
    { key: 'pecangrovedental', name: 'Pecan Grove Dental', permits: 2, lastOn: '2026-08-01', kind: null },
    { key: 'hartwellinteriors', name: 'Hartwell Interiors', permits: 1, lastOn: '2026-08-01', kind: null },
  ]
  const customers = [
    { id: 'c1', name: 'Ridgeway Builders' },
    { id: 'c2', name: 'RIDGEWAY BUILDERS' },
    { id: 'c3', name: 'Hartwell Interiors' },
    { id: 'c4', name: 'Marlow Design Group' },
    { id: 'c5', name: 'Larkspur Dental' },
  ]

  it('lists every look-alike pair, the strongest reason first, with one customer per name', () => {
    const pairs = lookAlikePairs(customers, names, new Map([['c2', new Map([['ridgewaybuilderstexas', 2], ['danawhitlow', 1]])]]), new Map())
    expect(pairs.map((p) => `${p.customerName} ~ ${p.suggestion.name}`)).toEqual([
      'Ridgeway Builders ~ Ridgeway Builders of Texas LLC',
      'Hartwell Interiors ~ Hartwell Interior Contracting',
      'Marlow Design Group ~ Marlow Design + Build',
      'Ridgeway Builders ~ Ridgeway Roofing Co',
      'Ridgeway Builders ~ Dana Whitlow',
    ])
    // The site evidence on the second row of one customer counts for the customer.
    expect(pairs[0]?.suggestion.reasons[0]).toEqual({ words: '2 permits on addresses you bid to them', tone: 'green' })
    expect(pairs[0]?.customerId).toBe('c1')
  })

  it('drops a pair once it is answered on any row of the customer, and keeps the same name out', () => {
    const pairs = lookAlikePairs(customers, names, new Map(), new Map([['c2', new Set(['ridgewaybuilderstexas', 'ridgewayroofing'])], ['c3', new Set(['hartwellinteriorcontracting'])]]))
    expect(pairs.map((p) => p.suggestion.key)).toEqual(['marlowdesignbuild'])
  })

  it('stops at the limit', () => {
    expect(lookAlikePairs(customers, names, new Map(), new Map(), 2)).toHaveLength(2)
  })
})
