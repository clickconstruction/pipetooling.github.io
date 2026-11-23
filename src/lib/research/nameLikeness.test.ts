import { describe, expect, it } from 'vitest'
import {
  CONTACT_MATCH_GRADE,
  compareContactsOf,
  compareRows,
  contactMatchWords,
  contactMatchesByCustomer,
  foldContactMatches,
  listedLineWords,
  lookAlikePairs,
  markName,
  nameLikeness,
  siteCountsByName,
  nameWords,
  oneLetterApart,
  searchNames,
  suggestNames,
  tiePressWords,
  type ContactMatch,
  type PermitName,
} from './nameLikeness'

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
    expect(nameLikeness('Renshaw Commercial Construction', 'Renshaw Construction Industries')).toEqual({ grade: 70, reason: 'shared', words: 'Shares the word Renshaw', marked: ['renshaw'] })
    expect(nameLikeness('Ridgeway Builders', 'Ridgeway Roofing Co')).toEqual({ grade: 60, reason: 'shared', words: 'Shares the word Ridgeway', marked: ['ridgeway'] })
    expect(nameLikeness('Marlow Design Group', 'Marlow Studio Design + Build')).toMatchObject({ reason: 'shared', words: 'Shares the word Marlow' })
    expect(nameLikeness('Pecan Grove Pharmacy', 'Pecan Grove Dental')).toBeNull()
  })

  it('refuses a word that only sits inside a longer, unrelated name', () => {
    expect(nameLikeness('Sheffield', 'Bandit Structural Concrete Works')).toBeNull()
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
    expect(nameLikeness('DSI', 'Davenport Solutions International')).toMatchObject({ grade: 55, reason: 'initials', words: 'Initials match' })
    expect(nameLikeness('Davenport Solutions International', 'DSI')).toMatchObject({ reason: 'initials' })
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

  it('offers a name on a shared phone alone, graded beside one name beginning the other', () => {
    const shared = new Map<string, ContactMatch[]>([['hartwellinteriors', [{ reason: 'phone', value: '2105550142' }]]])
    const got = suggestNames('Ridgeway Builders', names, new Map(), new Set(), shared)
    const hartwell = got.find((s) => s.key === 'hartwellinteriors')
    expect(hartwell).toMatchObject({ grade: CONTACT_MATCH_GRADE, marked: [], shared: [{ reason: 'phone', value: '2105550142' }] })
    expect(hartwell?.reasons).toEqual([{ words: 'The same phone, (210) 555-0142', tone: 'green' }])
    // The name that begins theirs carries the same grade, so the busier of the two leads.
    expect(nameLikeness('Ridgeway Builders', 'Ridgeway Builders of Texas LLC')?.grade).toBe(CONTACT_MATCH_GRADE)
    expect(got.slice(0, 2).map((s) => s.key)).toEqual(['ridgewaybuilderstexas', 'hartwellinteriors'])
    // Without the phone the name is not offered at all.
    expect(suggestNames('Ridgeway Builders', names, new Map(), new Set()).some((s) => s.key === 'hartwellinteriors')).toBe(false)
  })

  it('puts a shared phone and a shared web domain between the site and the name, and two outrank one', () => {
    const shared = new Map<string, ContactMatch[]>([
      ['ridgewaybuilderstexas', [{ reason: 'phone', value: '2105550142' }, { reason: 'domain', value: 'ridgewaybuilders.example' }]],
      ['ridgwaybuilders', [{ reason: 'domain', value: 'ridgewaybuilders.example' }]],
    ])
    const got = suggestNames('Ridgeway Builders', names, new Map([['ridgewaybuilderstexas', 1]]), new Set(), shared)
    expect(got[0]?.reasons).toEqual([
      { words: '1 permit on addresses you bid to them', tone: 'green' },
      { words: 'The same phone, (210) 555-0142', tone: 'green' },
      { words: 'The same web domain, ridgewaybuilders.example', tone: 'green' },
      { words: 'One name begins the other', tone: 'amber' },
    ])
    expect(got[0]?.grade).toBe(90 + 41 + CONTACT_MATCH_GRADE + 1)
    expect(got[1]).toMatchObject({ key: 'ridgwaybuilders', grade: 75 + CONTACT_MATCH_GRADE })
  })

  it('still leaves out their own name, a name answered and one that files for others, whatever they share', () => {
    const one: ContactMatch[] = [{ reason: 'phone', value: '2105550142' }]
    const shared = new Map<string, ContactMatch[]>([['ridgewaybuilders', one], ['ridgewayroofing', one], ['permitpros', one]])
    const got = suggestNames('Ridgeway Builders', names, new Map(), new Set(['ridgewayroofing']), shared)
    expect(got.map((s) => s.key)).toEqual(['ridgewaybuilderstexas', 'ridgwaybuilders'])
  })
})

describe('a phone or a web domain the two share', () => {
  it('says the match as a person reads it', () => {
    expect(contactMatchWords({ reason: 'phone', value: '5125550101' })).toBe('The same phone, (512) 555-0101')
    expect(contactMatchWords({ reason: 'domain', value: 'example.com' })).toBe('The same web domain, example.com')
  })

  it('reads the rows by customer and name, a phone first, each value once, and drops a reason it does not know', () => {
    const got = contactMatchesByCustomer([
      { customer_id: 'c1', builder_key: 'hartwellinteriors', reason: 'domain', value: 'hartwell.example' },
      { customer_id: 'c1', builder_key: 'hartwellinteriors', reason: 'phone', value: '2105550142' },
      { customer_id: 'c1', builder_key: 'hartwellinteriors', reason: 'phone', value: '2105550142' },
      { customer_id: 'c1', builder_key: 'danawhitlow', reason: 'fax', value: '2105550199' },
      { customer_id: 'c2', builder_key: 'danawhitlow', reason: 'phone', value: '2105550177' },
    ])
    expect([...got.keys()]).toEqual(['c1', 'c2'])
    expect(got.get('c1')).toEqual(new Map([['hartwellinteriors', [{ reason: 'phone', value: '2105550142' }, { reason: 'domain', value: 'hartwell.example' }]]]))
    expect(got.get('c2')?.get('danawhitlow')).toEqual([{ reason: 'phone', value: '2105550177' }])
  })

  it('folds two customer rows of one GC into one, each value once', () => {
    const by = contactMatchesByCustomer([
      { customer_id: 'c1', builder_key: 'hartwellinteriors', reason: 'phone', value: '2105550142' },
      { customer_id: 'c2', builder_key: 'hartwellinteriors', reason: 'phone', value: '2105550142' },
      { customer_id: 'c2', builder_key: 'hartwellinteriors', reason: 'domain', value: 'hartwell.example' },
      { customer_id: 'c3', builder_key: 'danawhitlow', reason: 'phone', value: '2105550177' },
    ])
    expect(foldContactMatches(by, ['c1', 'c2'])).toEqual(new Map([['hartwellinteriors', [{ reason: 'phone', value: '2105550142' }, { reason: 'domain', value: 'hartwell.example' }]]]))
    expect(foldContactMatches(by, ['c9']).size).toBe(0)
  })
})

describe('listedLineWords', () => {
  const base: PermitName = { key: 'k', name: 'Hartwell Interiors', permits: 0, lastOn: '2026-10-21', kind: null }
  it('says what the city lists the name on, in the words that are true of how it was found', () => {
    expect(listedLineWords({ ...base, permits: 4 }, 0)).toBe('Listed on 4 commercial permits we can see · last Oct 21')
    expect(listedLineWords({ ...base, permits: 1, lastOn: null }, 2)).toBe('Listed on 1 commercial permit we can see')
    // A name only a site brought in.
    expect(listedLineWords(base, 1)).toBe('Listed on a permit on an address you bid to them')
    // A name only a shared phone brought in: its permits are of any kind, and no address of ours is claimed.
    expect(listedLineWords({ ...base, allPermits: 3 }, 0)).toBe('Listed on 3 permits we can see · last Oct 21')
    expect(listedLineWords({ ...base, lastOn: null }, 0)).toBe('Listed on a permit we can see')
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
      bidAddresses: ['4120 Mill Street, San Antonio, TX 78215', '88 Harbor St, San Antonio, TX 78215', '8030 Kyle Crossing Kyle, TX 78640', null],
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

  const plain = { customerName: 'Ridgeway Builders', bidAddresses: [], siteStreets: [], name: 'Hartwell Interiors', permits: [], onOurSites: [] }

  it('adds a phones row and a web domains row, each only when one side holds something', () => {
    expect(compareRows(plain)).toHaveLength(3)
    expect(compareRows({ ...plain, contacts: { ourPhones: [], ourDomains: [], theirPhones: [], theirDomains: [], shared: [] } })).toHaveLength(3)
    const rows = compareRows({ ...plain, contacts: { ourPhones: ['2105550100'], ourDomains: [], theirPhones: [], theirDomains: ['hartwell.example'], shared: [] } })
    expect(rows.slice(3)).toEqual([
      { ours: { label: 'Phones we hold for them', value: '(210) 555-0100' }, theirs: { label: 'Phones listed with this name', value: 'None listed' }, hit: false },
      { ours: { label: 'Web domains we hold for them', value: 'None on file' }, theirs: { label: 'Web domains found for this name', value: 'hartwell.example' }, hit: false },
    ])
  })

  it('marks a row the read says the two share, the shared value first on both sides', () => {
    const rows = compareRows({
      ...plain,
      contacts: {
        ourPhones: ['2105550100', '2105550142'],
        ourDomains: ['ridgeway.example'],
        theirPhones: ['5125550188', '2105550142'],
        theirDomains: [],
        shared: [{ reason: 'phone', value: '2105550142' }],
      },
    })
    expect(rows[3]).toEqual({ ours: { label: 'Phones we hold for them', value: '(210) 555-0142 · (210) 555-0100' }, theirs: { label: 'Phones listed with this name', value: '(210) 555-0142 · (512) 555-0188' }, hit: true })
    expect(rows[4]).toMatchObject({ theirs: { value: 'None found' }, hit: false })
  })

  it('shows a value the read ties on both sides even when the lists handed in lack it, and never marks a number the read does not tie', () => {
    // The tie came off the contacts spine and a lookup, which Compare does not read itself.
    const tied = compareRows({ ...plain, contacts: { ourPhones: [], ourDomains: [], theirPhones: [], theirDomains: [], shared: [{ reason: 'domain', value: 'hartwell.example' }] } })
    expect(tied).toHaveLength(4)
    expect(tied[3]).toEqual({ ours: { label: 'Web domains we hold for them', value: 'hartwell.example' }, theirs: { label: 'Web domains found for this name', value: 'hartwell.example' }, hit: true })
    // A permit service's number sits under many names: both sides hold it and the read ties nobody.
    const service = compareRows({ ...plain, contacts: { ourPhones: ['2105550100'], ourDomains: [], theirPhones: ['2105550100'], theirDomains: [], shared: [] } })
    expect(service[3]?.hit).toBe(false)
  })

  it('cuts a long side at four and counts the rest', () => {
    const rows = compareRows({ ...plain, contacts: { ourPhones: ['2105550101', '2105550102', '2105550103', '2105550104', '2105550105', '2105550106'], ourDomains: [], theirPhones: [], theirDomains: [], shared: [] } })
    expect(rows[3]?.ours.value).toBe('(210) 555-0101 · (210) 555-0102 · (210) 555-0103 · (210) 555-0104 and 2 more')
  })

  it('reads what each side holds by the database’s own two rules', () => {
    const got = compareContactsOf(
      {
        customers: [{ contact_info: { phone: '(210) 555-0142', email: 'office@ridgeway.example' }, billing_email: 'ap@gmail.com' }, { contact_info: null, billing_email: 'AP@Ridgeway.example' }],
        persons: [{ phone: '1-210-555-0142 x12', email: null }, { phone: '555', email: 'pm@ridgeway-pm.example' }],
      },
      { permitPhones: ['5125550188', null, undefined, '5125550188', '0000000000'], lookups: [{ phone: '(512) 555-0199', website: 'https://www.hartwell.example/contact' }, { website: 'https://facebook.com/hartwell' }, null] },
      [{ reason: 'phone', value: '2105550142' }],
    )
    expect(got).toEqual({
      ourPhones: ['2105550142'],
      ourDomains: ['ridgeway.example', 'ridgeway-pm.example'],
      theirPhones: ['5125550188', '5125550199'],
      theirDomains: ['hartwell.example'],
      shared: [{ reason: 'phone', value: '2105550142' }],
    })
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

  it('pairs a name with a customer through a shared phone on any of its rows, with no word in common', () => {
    const shared = contactMatchesByCustomer([
      { customer_id: 'c2', builder_key: 'pecangrovedental', reason: 'phone', value: '2105550142' },
      // A name this city's list does not carry is not paired here.
      { customer_id: 'c5', builder_key: 'notonthislist', reason: 'phone', value: '2105550177' },
    ])
    const pairs = lookAlikePairs(customers, names, new Map(), new Map(), undefined, shared)
    const pair = pairs.find((p) => p.suggestion.key === 'pecangrovedental')
    expect(pair).toMatchObject({ customerId: 'c1', customerName: 'Ridgeway Builders' })
    expect(pair?.suggestion.reasons).toEqual([{ words: 'The same phone, (210) 555-0142', tone: 'green' }])
    expect(pairs.some((p) => p.customerId === 'c5')).toBe(false)
    // Without the read the worklist is as it was.
    expect(lookAlikePairs(customers, names, new Map(), new Map()).some((p) => p.suggestion.key === 'pecangrovedental')).toBe(false)
  })

  it('drops a pair a shared phone made once the customer has answered it', () => {
    const shared = contactMatchesByCustomer([{ customer_id: 'c1', builder_key: 'pecangrovedental', reason: 'phone', value: '2105550142' }])
    const pairs = lookAlikePairs(customers, names, new Map(), new Map([['c2', new Set(['pecangrovedental'])]]), undefined, shared)
    expect(pairs.some((p) => p.suggestion.key === 'pecangrovedental')).toBe(false)
  })
})
