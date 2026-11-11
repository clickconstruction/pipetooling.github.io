import { describe, expect, it } from 'vitest'
import {
  canResearchPermits,
  defaultLookAgainYmd,
  leadDeck,
  leadDoor,
  leadFromPermit,
  leadLandsWords,
  leadMadeWords,
  pursuedLeadIds,
  lensCounts,
  newSinceLooked,
  pulledWords,
  rowLens,
  rowsShowing,
  shortDay,
  shortMoney,
  sqFtWords,
  verdictHold,
  windowSinceYmd,
  workWords,
  type ResearchPermitRow,
} from './permitResearch'

function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1',
    city: 'San Antonio',
    source: 'sa-issued',
    permit_number: 'COM-BLG-PMT26-00000001',
    permit_type: 'Comm New Building Permit',
    stage: 'issued',
    residential: false,
    work_type: 'New commercial',
    project_name: 'Building No: N/A; Unit No: N/A',
    address: '100 SAMPLE ST',
    zip: '78245',
    lat: 29.4,
    lng: -98.5,
    submitted_on: '2026-10-02',
    issued_on: '2026-11-06',
    filed_on: '2026-11-06',
    declared_value: 1_400_000,
    area_sf: 6200,
    contact: 'Ridgeway Builders',
    plumber: null,
    plumber_permit_on: null,
    verdict: null,
    verdict_reason: null,
    verdict_look_again_on: null,
    verdict_prospect_id: null,
    verdict_by: null,
    verdict_by_name: null,
    verdict_at: null,
    ...over,
  }
}

describe('canResearchPermits', () => {
  it('opens to the office and every estimator, and to nobody in the field', () => {
    expect(canResearchPermits('dev')).toBe(true)
    expect(canResearchPermits('assistant')).toBe(true)
    expect(canResearchPermits('controller')).toBe(true)
    expect(canResearchPermits('estimator')).toBe(true)
    expect(canResearchPermits('subcontractor')).toBe(false)
    expect(canResearchPermits('primary')).toBe(false)
    expect(canResearchPermits(null)).toBe(false)
  })
})

describe('the lenses', () => {
  it('puts a bare row on waiting, a plumbing permit on taken (named or not), a verdict on its own lens', () => {
    expect(rowLens(row())).toBe('waiting')
    expect(rowLens(row({ plumber: 'Lone Star Plumbing Co.' }))).toBe('taken')
    expect(rowLens(row({ plumber: null, plumber_permit_on: '2026-11-04' }))).toBe('taken')
    expect(rowLens(row({ verdict: 'look' }))).toBe('look')
    expect(rowLens(row({ plumber: 'Someone', verdict: 'approach' }))).toBe('approach')
  })
  it('counts and filters by lens, and everything shows everything', () => {
    const rows = [row(), row({ id: 'p2', plumber: 'X' }), row({ id: 'p3', verdict: 'not_for_us' })]
    expect(lensCounts(rows)).toEqual({ waiting: 1, look: 0, approach: 0, not_for_us: 1, taken: 1 })
    expect(rowsShowing(rows, 'waiting').map((r) => r.id)).toEqual(['p1'])
    expect(rowsShowing(rows, 'all')).toHaveLength(3)
  })
  it('counts rows filed after the day the reader last looked', () => {
    const rows = [row({ filed_on: '2026-11-06' }), row({ id: 'p2', filed_on: '2026-11-03' })]
    expect(newSinceLooked(rows, '2026-11-04')).toBe(1)
    expect(newSinceLooked(rows, null)).toBe(2)
  })
})

describe('the words', () => {
  it('shortens money and area for a cell', () => {
    expect(shortMoney(1_400_000)).toBe('$1.4M')
    expect(shortMoney(12_000_000)).toBe('$12M')
    expect(shortMoney(420_000)).toBe('$420k')
    expect(shortMoney(9_500)).toBe('$9,500')
    expect(shortMoney(null)).toBeNull()
    expect(shortMoney(0)).toBeNull()
    expect(sqFtWords(6200)).toBe('6,200 sq ft')
    expect(sqFtWords(1)).toBeNull()
  })
  it('writes the Work cell from the kind, the size, the money and a real project name', () => {
    expect(workWords(row())).toEqual({ main: 'New commercial · 6,200 sq ft', detail: '$1.4M declared' })
    expect(workWords(row({ declared_value: null, area_sf: null, project_name: 'Site Work - Sample Plaza' }))).toEqual({
      main: 'New commercial',
      detail: 'value not declared · Site Work - Sample Plaza',
    })
  })
  it('names the day short and the window since-day right', () => {
    expect(shortDay('2026-11-06', '2026-11-10')).toBe('Nov 6')
    // A day from another year says its year, so a year of records never reads as this year's.
    expect(shortDay('2025-12-17', '2026-11-10')).toBe('Dec 17, 2025')
    expect(shortDay(null)).toBe('—')
    expect(windowSinceYmd('2026-11-09', 30)).toBe('2026-10-10')
    expect(defaultLookAgainYmd('2026-11-09')).toBe('2026-11-23')
  })
  it('writes the Pulled line with the counts, and says when nothing was pulled', () => {
    const counts = { waiting: 9, look: 2, approach: 3, not_for_us: 22, taken: 31 }
    const line = pulledWords({ ranAt: null, error: null, newCount: 14, lastLookedYmd: '2026-11-05', counts })
    expect(line).toContain('Not pulled yet')
    expect(line).toContain('14 new since you looked')
    expect(line).toContain('9 to skim')
    expect(line).toContain('31 have a plumber')
    const stopped = pulledWords({ ranAt: new Date().toISOString(), error: 'the feed answered 503', newCount: 0, lastLookedYmd: null, counts })
    expect(stopped).toMatch(/^Pulled /)
    expect(stopped).toContain('the last pull stopped: the feed answered 503')
  })
})

describe('the verdict', () => {
  it('refuses an empty reason', () => {
    expect(verdictHold('   ')).toBe('Say why in a line. The next estimator reads it.')
    expect(verdictHold('Our size, we have won with them.')).toBeNull()
  })
  it('puts an owner on Jobs to GC with the permit as a job, source A permit', () => {
    const { prospect, job, companyName, deck } = leadFromPermit(row(), 'owner', { userId: 'u1', masterUserId: 'm1' })
    expect(companyName).toBe('Ridgeway Builders')
    expect(deck).toBe('gc_lead')
    expect(prospect).toMatchObject({ kind: 'gc_lead', source: 'A permit', company_role: 'owner', company_name: 'Ridgeway Builders', created_by: 'u1', master_user_id: 'm1', address: '100 SAMPLE ST, San Antonio, 78245' })
    expect(String(prospect.notes)).toContain('COM-BLG-PMT26-00000001')
    expect(job).toMatchObject({ name: 'New commercial · 6,200 sq ft at 100 SAMPLE ST', sq_ft: 6200, status: 'open' })
    expect(leadFromPermit(row(), 'architect', { userId: 'u1', masterUserId: 'm1' }).prospect).toMatchObject({ kind: 'gc_lead', company_role: 'architect' })
  })
  it('puts a general contractor on the Customers deck, the permit in its notes and no job', () => {
    const { prospect, job, note, deck } = leadFromPermit(row(), 'gc', { userId: 'u1', masterUserId: 'm1' })
    expect(deck).toBe('customer')
    expect(prospect).toMatchObject({ kind: 'customer', source: 'A permit', company_role: null, company_name: 'Ridgeway Builders' })
    expect(job).toBeNull()
    expect(note).toContain('COM-BLG-PMT26-00000001')
    expect(prospect.notes).toBe(note)
  })
  it('says where the lead lands, before the press and after it', () => {
    expect(leadDeck('gc')).toBe('customer')
    expect(leadDeck('owner')).toBe('gc_lead')
    expect(leadDeck('architect')).toBe('gc_lead')
    expect(leadLandsWords('gc')).toBe('A lead goes on the Customers deck with the permit in its notes. A lead of the same name is reused.')
    expect(leadLandsWords('owner')).toBe('A lead goes on the Jobs to GC deck with the permit as a job on it. A lead of the same name is reused.')
    expect(leadMadeWords({ companyName: 'Ridgeway Builders', reused: false, deck: 'customer' })).toBe('Lead made: Ridgeway Builders, on the Customers deck.')
    expect(leadMadeWords({ companyName: 'Ridgeway Builders', reused: true, deck: 'gc_lead' })).toBe('Put the permit on Ridgeway Builders’s lead on the Jobs to GC deck.')
  })
  it('opens a lead on the deck it sits on, Jobs to GC until its deck is read', () => {
    expect(leadDoor('abc')).toBe('/prospects?tab=follow-up&kind=gc-leads&prospect_id=abc')
    expect(leadDoor('abc', 'gc_lead')).toBe('/prospects?tab=follow-up&kind=gc-leads&prospect_id=abc')
    expect(leadDoor('abc', 'customer')).toBe('/prospects?tab=follow-up&kind=customers&prospect_id=abc')
    expect(pursuedLeadIds([{ verdict: 'approach', verdict_prospect_id: 'b' }, { verdict: 'approach', verdict_prospect_id: 'a' }, { verdict: 'approach', verdict_prospect_id: 'b' }, { verdict: 'look', verdict_prospect_id: 'z' }, { verdict: 'approach', verdict_prospect_id: null }])).toEqual(['a', 'b'])
  })
  it('names an unnamed puller so the lead still has a company', () => {
    expect(leadFromPermit(row({ contact: null }), 'owner', { userId: 'u1', masterUserId: 'm1' }).companyName).toBe('Who pulled the permit')
  })
})

describe('the hint', () => {
  it('keys a contact by the whole name and each comma part, suffixes dropped', async () => {
    const { contactKeys, nameKey } = await import('./permitResearch')
    expect(nameKey('Ridgeway Builders, LLC')).toBe('ridgewaybuilders')
    expect(nameKey('D Barnes Construction LLC')).toBe('dbarnesconstruction')
    expect(contactKeys('Milton G. Ramirez, Synergy Construction, LLC')).toEqual(['miltongramirezsynergyconstruction', 'miltongramirez', 'synergyconstruction'])
    expect(contactKeys('')).toEqual([])
  })
  it('reads warm, cold, seen and new name off the history', async () => {
    const { hintFor } = await import('./permitResearch')
    const h = new Map([
      ['ridgewaybuilders', { key: 'ridgewaybuilders', bids: 5, won: 3, last_bid_on: '2026-09-01', on_deck: false }],
      ['northgatebuilders', { key: 'northgatebuilders', bids: 6, won: 0, last_bid_on: '2026-08-01', on_deck: true }],
      ['caldwellsons', { key: 'caldwellsons', bids: 1, won: 0, last_bid_on: null, on_deck: false }],
    ])
    expect(hintFor('Ridgeway Builders', h)).toEqual({ tone: 'warm', word: 'warm', detail: 'we won 3 of 5 bids with this name' })
    expect(hintFor('Northgate Builders LLC', h).word).toBe('cold')
    expect(hintFor('Northgate Builders LLC', h).detail).toContain('on the GCs deck')
    expect(hintFor('Caldwell & Sons', h).word).toBe('seen')
    expect(hintFor('Harlan Development Co.', h)).toEqual({ tone: 'new', word: 'new name', detail: 'no bid to this name in our history' })
  })
  it('tallies the plumbers on the taken rows and places only the rows with a point', async () => {
    const { plumberTally, researchPins } = await import('./permitResearch')
    const rows = [row({ plumber: 'A Plumbing' }), row({ id: 'p2', plumber: 'A Plumbing' }), row({ id: 'p3', plumber: 'B Plumbing' }), row({ id: 'p4', lat: null, lng: null })]
    expect(plumberTally(rows)).toEqual([{ plumber: 'A Plumbing', jobs: 2 }, { plumber: 'B Plumbing', jobs: 1 }])
    const pins = researchPins(rows)
    expect(pins).toHaveLength(3)
    expect(pins[0]).toMatchObject({ id: 'p1', lat: 29.4, lng: -98.5, color: '#9ca3af' })
  })
})

describe('the value floor', () => {
  it('keeps the big permits and the ones with no value, and drops the small', async () => {
    const { rowsAboveFloor, valueFloorWords } = await import('./permitResearch')
    const rows = [row({ declared_value: 1_500 }), row({ id: 'p2', declared_value: null }), row({ id: 'p3', declared_value: 80_000 })]
    expect(rowsAboveFloor(rows, 25_000).map((r) => r.id)).toEqual(['p2', 'p3'])
    expect(rowsAboveFloor(rows, 100_000).map((r) => r.id)).toEqual(['p2'])
    expect(rowsAboveFloor(rows, 0)).toHaveLength(3)
    expect(valueFloorWords(25_000)).toBe('$25k and up, or not declared')
    expect(valueFloorWords(0)).toBe('Any value')
  })
})

describe('plumberWords', () => {
  it('names the plumber, or says the permit is on file under the applicant, or none yet', async () => {
    const { plumberWords } = await import('./permitResearch')
    expect(plumberWords(row({ plumber: 'Lone Star Plumbing Co.', plumber_permit_on: '2026-11-04' }))).toEqual({ kind: 'named', chip: 'Lone Star Plumbing Co.', under: 'plumbing permit Nov 4' })
    expect(plumberWords(row({ plumber: null, plumber_permit_on: '2026-11-04' }))).toEqual({ kind: 'unnamed', chip: 'on file, no plumber named', under: "pulled under the applicant's own name, Nov 4" })
    expect(plumberWords(row())).toEqual({ kind: 'none', chip: 'none yet', under: null })
  })
})

describe('the lead carries the card\'s facts', () => {
  it('takes the phone, the website, the company address and the owner of record when the card found them', async () => {
    const { leadFromPermit } = await import('./permitResearch')
    const { prospect, job } = leadFromPermit(row(), 'owner', { userId: 'u1', masterUserId: 'm1' }, { companyName: 'Ridgeway Builders LLC', contactName: 'Dana Whitfield', phone: '(210) 555-0199', website: 'https://example.com', companyAddress: '1 Office Park, San Antonio, TX 78201', ownerOfRecord: 'SAMPLE HOLDINGS LLC' })
    expect(prospect).toMatchObject({ company_name: 'Ridgeway Builders LLC', contact_name: 'Dana Whitfield', phone_number: '(210) 555-0199', links_to_website: 'https://example.com', address: '1 Office Park, San Antonio, TX 78201' })
    expect(String(prospect.notes)).toContain('owner of record: SAMPLE HOLDINGS LLC')
    expect(job).toMatchObject({ address: '100 SAMPLE ST, San Antonio, 78245' })
  })
})
