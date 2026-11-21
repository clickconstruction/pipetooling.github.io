import { describe, expect, it } from 'vitest'
import { answerBook } from './builderAnswers'
import type { NameAnswerRow } from './nameAnswers'
import type { BuilderRow } from './permitBuilders'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import {
  BID_COMPANY_PERMITS_HEAD,
  BID_COMPANY_SHOWING_WORDS,
  aboutWeeksWords,
  applicationClockDays,
  bidCompanies,
  bidCompaniesShowing,
  bidCompanyChipCounts,
  builtTile,
  clockAt,
  clockMiddleNearStart,
  clockDaysWords,
  clockNote,
  clockScaleDays,
  clockSpread,
  clockTile,
  clockTitle,
  isBidPlatformBucket,
  marketBidsSince,
  marketClocks,
  marketPermitsSince,
  companyCountsWords,
  permitsWhereWords,
  plumberClockDays,
  readsWords,
  type CityBuilders,
  type MarketBid,
} from './permitMarket'

/** Every company, person and number here is made up. */
const TODAY = '2026-11-19'

function builder(key: string, contact: string, permits: number, over: Partial<BuilderRow> = {}): BuilderRow {
  return { key, name: null, sample_contact: contact, kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits, open: 0, last_permit_on: '2026-11-03', plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null, ...over }
}

let nextBid = 0
function bid(customerName: string | null, over: Partial<MarketBid> = {}): MarketBid {
  nextBid += 1
  return { id: `b${nextBid}`, customerId: customerName ? `c:${customerName}` : null, customerName, gcName: null, outcome: null, bidOn: '2026-06-01', projectName: 'Mill Street Lofts', ...over }
}

const tie = (builderKey: string, customerId: string, over: Partial<NameAnswerRow> = {}): NameAnswerRow => ({ id: `a:${builderKey}:${customerId}`, builder_key: builderKey, customer_id: customerId, answer: 'works_for', scope: 'all', permit_id: null, name: builderKey, answered_by: 'u1', answered_at: '2026-11-09T18:00:00Z', ...over })

const SAN_ANTONIO: CityBuilders = {
  city: 'San Antonio',
  rows: [builder('juniperhospitalitygroup', 'Juniper Hospitality Group, LLC', 11), builder('harborfitouts', 'Harbor Fitouts', 6), builder('limebuild', 'Lime Build Inc.', 5), builder('danawhitlock', 'Dana Whitlock', 4), builder('asterridgecontractingoftexas', 'Aster Ridge Contracting of Texas', 3)],
}
const AUSTIN: CityBuilders = { city: 'Austin', rows: [builder('harborfitouts', 'Harbor Fitouts', 2), builder('quillpermits', 'Quill Permits', 9, { kind: 'files_for_others' })] }

describe('the windows', () => {
  it('reads bids two years back and permits one', () => {
    expect(marketBidsSince(TODAY)).toBe('2024-11-19')
    expect(marketPermitsSince(TODAY)).toBe('2025-11-19')
  })
})

describe('isBidPlatformBucket', () => {
  it('knows a customer named for a bid platform, whatever follows the name', () => {
    expect(isBidPlatformBucket('PlanHub - Subcontractor Prime Opportunity')).toBe(true)
    expect(isBidPlatformBucket('BuildingConnected bids')).toBe(true)
    expect(isBidPlatformBucket('Ridgeway Builders')).toBe(false)
    expect(isBidPlatformBucket('The Plan Hubbard Group')).toBe(false)
    expect(isBidPlatformBucket(null)).toBe(false)
  })
})

describe('bidCompanies', () => {
  it('lists one row a company, with its bids, its wins and the permits its name pulled in every city', () => {
    const bids = [bid('Harbor Fitouts', { outcome: 'won' }), bid('Harbor Fitouts', { outcome: 'started_or_complete' }), bid('Harbor Fitouts', { outcome: 'lost' }), bid('Harbor Fitouts, LLC', { bidOn: '2026-10-14' }), bid('Larkspur Commercial', { outcome: 'lost' })]
    const rows = bidCompanies({ bids, builders: [SAN_ANTONIO, AUSTIN], book: null, todayYmd: TODAY })
    const harbor = rows.find((c) => c.key === 'harborfitouts')
    // Two spellings of one keyed name are one company, under the spelling used most.
    expect(harbor).toMatchObject({ name: 'Harbor Fitouts', bids: 4, won: 2, lastBidOn: '2026-10-14', permits: 8, reads: 'wins' })
    expect(harbor?.customerIds.sort()).toEqual(['c:Harbor Fitouts', 'c:Harbor Fitouts, LLC'])
    expect(permitsWhereWords(harbor as never)).toBe('San Antonio 6 · Austin 2')
    expect(rows.find((c) => c.key === 'larkspurcommercial')).toMatchObject({ bids: 1, won: 0, permits: 0, reads: 'no_permit', sources: [] })
    // The most permits first, then the most bids.
    expect(rows.map((c) => c.key)).toEqual(['harborfitouts', 'larkspurcommercial'])
  })

  it('reads a company with permits and no win as never winning only from three bids on', () => {
    const three = [bid('Juniper Hospitality Group'), bid('Juniper Hospitality Group', { outcome: 'lost' }), bid('Juniper Hospitality Group', { outcome: 'lost' })]
    const rows = bidCompanies({ bids: [...three, bid('Lime Build'), bid('Lime Build', { outcome: 'lost' })], builders: [SAN_ANTONIO], book: null, todayYmd: TODAY })
    expect(rows.find((c) => c.key === 'juniperhospitalitygroup')?.reads).toBe('never_win')
    expect(rows.find((c) => c.key === 'limebuild')?.reads).toBe('early')
  })

  it('counts a bid under its customer and under the old builders list’s name, once for one key', () => {
    const rows = bidCompanies({ bids: [bid('Harbor Fitouts', { gcName: 'Harbor Fitouts Inc' }), bid(null, { gcName: 'Lime Build' }), bid('Larkspur Commercial', { gcName: 'Lime Build' })], builders: [SAN_ANTONIO], book: null, todayYmd: TODAY })
    expect(rows.find((c) => c.key === 'harborfitouts')?.bids).toBe(1)
    // A name only on the old list is a company too, with no customer row of ours.
    expect(rows.find((c) => c.key === 'limebuild')).toMatchObject({ name: 'Lime Build', bids: 2, customerIds: [] })
    expect(rows.find((c) => c.key === 'larkspurcommercial')?.bids).toBe(1)
  })

  it('leaves out practice bids, ZZ customers, a bid platform’s bucket and bids older than two years', () => {
    const bids = [
      bid('Harbor Fitouts', { projectName: 'ZZ Shadow MILL STREET LOFTS' }),
      bid('Harbor Fitouts', { projectName: 'zz test' }),
      bid('ZZ Test Builders'),
      bid('PlanHub - Subcontractor Prime Opportunity'),
      bid('Harbor Fitouts', { bidOn: '2024-11-18' }),
      bid('Harbor Fitouts', { bidOn: '2024-11-19' }),
      bid(null),
    ]
    const rows = bidCompanies({ bids, builders: [SAN_ANTONIO], book: null, todayYmd: TODAY })
    expect(rows.map((c) => [c.key, c.bids])).toEqual([['harborfitouts', 1]])
  })

  it('counts the permits under a name a person tied to the customer, and says which', () => {
    const customers = [{ id: 'c:Aster Ridge Contracting', name: 'Aster Ridge Contracting' }]
    const book = answerBook([tie('danawhitlock', 'c:Aster Ridge Contracting')], customers)
    const rows = bidCompanies({ bids: [bid('Aster Ridge Contracting', { outcome: 'won' })], builders: [SAN_ANTONIO], book, todayYmd: TODAY })
    const aster = rows.find((c) => c.key === 'asterridgecontracting')
    expect(aster).toMatchObject({ permits: 4, reads: 'wins', looksLike: null })
    expect(aster?.sources).toEqual([{ city: 'San Antonio', builderKey: 'danawhitlock', name: 'Dana Whitlock', permits: 4, tied: true }])
    expect(permitsWhereWords(aster as never)).toBe('San Antonio 4 · under Dana Whitlock')
  })

  it('does not count a tie someone took back, or one a person refused', () => {
    const customers = [{ id: 'c:Aster Ridge Contracting', name: 'Aster Ridge Contracting' }]
    const back = answerBook([tie('danawhitlock', 'c:Aster Ridge Contracting'), tie('danawhitlock', 'c:Aster Ridge Contracting', { id: 'a2', answer: 'taken_back', scope: null, answered_at: '2026-11-10T18:00:00Z' })], customers)
    expect(bidCompanies({ bids: [bid('Aster Ridge Contracting')], builders: [SAN_ANTONIO], book: back, todayYmd: TODAY })[0]?.permits).toBe(0)
  })

  it('offers a name that begins the company’s own, for a customer with no permit on record', () => {
    const rows = bidCompanies({ bids: [bid('Aster Ridge Contracting'), bid('Larkspur Commercial'), bid(null, { gcName: 'Aster Ridge Contracting of Texas Holdings' })], builders: [SAN_ANTONIO, AUSTIN], book: null, todayYmd: TODAY })
    expect(rows.find((c) => c.key === 'asterridgecontracting')?.looksLike).toBe('Aster Ridge Contracting of Texas')
    expect(rows.find((c) => c.key === 'larkspurcommercial')?.looksLike).toBeNull()
    // A name only on the old list has no customer row to tie on, so none is offered.
    expect(rows.find((c) => c.key === 'asterridgecontractingoftexasholdings')?.looksLike).toBeNull()
  })

  it('does not offer a name someone already refused for the customer', () => {
    const customers = [{ id: 'c:Aster Ridge Contracting', name: 'Aster Ridge Contracting' }]
    const book = answerBook([tie('asterridgecontractingoftexas', 'c:Aster Ridge Contracting', { answer: 'someone_else', scope: null })], customers)
    expect(bidCompanies({ bids: [bid('Aster Ridge Contracting')], builders: [SAN_ANTONIO], book, todayYmd: TODAY })[0]?.looksLike).toBeNull()
  })
})

describe('the chips and the words', () => {
  const rows = bidCompanies({
    bids: [bid('Harbor Fitouts', { outcome: 'won' }), bid('Lime Build'), bid('Aster Ridge Contracting'), bid('Larkspur Commercial')],
    builders: [SAN_ANTONIO],
    book: null,
    todayYmd: TODAY,
  })

  it('counts each chip and filters by it', () => {
    expect(bidCompanyChipCounts(rows)).toEqual({ builds: 2, no_permit: 2, tie: 1 })
    expect(bidCompaniesShowing(rows, 'builds').map((c) => c.key)).toEqual(['harborfitouts', 'limebuild'])
    expect(bidCompaniesShowing(rows, 'tie').map((c) => c.key)).toEqual(['asterridgecontracting'])
  })

  it('says what a row reads as', () => {
    expect(readsWords({ reads: 'wins', bids: 4, looksLike: null })).toEqual({ tag: 'Builds, and we win', tone: 'green', hint: 'keep close' })
    expect(readsWords({ reads: 'never_win', bids: 4, looksLike: null })).toEqual({ tag: 'Builds, we never win', tone: 'red', hint: 'ask why' })
    expect(readsWords({ reads: 'early', bids: 1, looksLike: null }).tag).toBe('Builds, one try')
    expect(readsWords({ reads: 'early', bids: 2, looksLike: null })).toEqual({ tag: 'Builds, two tries', tone: 'amber', hint: 'too early to say' })
    expect(readsWords({ reads: 'no_permit', bids: 9, looksLike: null })).toEqual({ tag: 'No permit on record', tone: 'grey', hint: 'may build elsewhere, or file under another name' })
    const maybe = readsWords({ reads: 'no_permit', bids: 1, looksLike: 'Aster Ridge Contracting of Texas' }).hint
    expect(plainSentence(maybe)).toBe('Aster Ridge Contracting of Texas on the permits may be them')
    // The name is a value in the sentence, marked for the screen to draw apart.
    expect(sentenceParts(maybe)).toEqual([{ kind: 'name', text: 'Aster Ridge Contracting of Texas' }, ' on the permits may be them'])
  })

  it('folds a company’s three counts into one line for a phone, each one a value', () => {
    expect(plainSentence(companyCountsWords({ bids: 3, won: 0, permits: 11 }))).toBe('3 bids, 0 won · 11 permits')
    expect(plainSentence(companyCountsWords({ bids: 1, won: 1, permits: 1 }))).toBe('1 bid, 1 won · 1 permit')
    expect(sentenceParts(companyCountsWords({ bids: 3, won: 0, permits: 11 })).filter((p) => typeof p !== 'string')).toEqual([
      { kind: 'bids', text: '3 bids' },
      { kind: 'won', text: '0 won' },
      { kind: 'permits', text: '11 permits' },
    ])
  })

  it('writes the first tile', () => {
    expect(builtTile(rows)).toEqual({ value: '2 of 4', words: 'companies we bid pulled a permit in the cities we read' })
    expect(builtTile([])).toEqual({ value: '0 of 0', words: 'companies we bid pulled a permit in the cities we read' })
    expect(builtTile(rows.slice(0, 1)).words).toBe('company we bid pulled a permit in the cities we read')
  })

  it('counts every city and says so, since the same count is drawn on each city’s page', () => {
    // A company whose only permits are in the other city still built, on either page.
    const elsewhere: CityBuilders = { city: 'New Braunfels', rows: [builder('larkspurcommercial', 'Larkspur Commercial', 4)] }
    const both = bidCompanies({ bids: [bid('Harbor Fitouts'), bid('Larkspur Commercial')], builders: [SAN_ANTONIO, AUSTIN, elsewhere], book: null, todayYmd: TODAY })
    expect(both.find((c) => c.key === 'larkspurcommercial')).toMatchObject({ permits: 4, reads: 'early' })
    expect(both.find((c) => c.key === 'harborfitouts')?.permits).toBe(8)
    expect(builtTile(both)).toEqual({ value: '2 of 2', words: 'companies we bid pulled a permit in the cities we read' })
    // No word over the count names one place.
    for (const words of [builtTile(both).words, BID_COMPANY_SHOWING_WORDS.builds, BID_COMPANY_PERMITS_HEAD]) expect(words).not.toMatch(/\bhere\b/)
    expect(BID_COMPANY_PERMITS_HEAD).toBe('Permits, all cities, 12 mo')
    expect(BID_COMPANY_SHOWING_WORDS.builds).toBe('Builds')
  })
})

describe('the clock', () => {
  it('finds the quarter marks and the middle, in whole days', () => {
    expect(clockSpread([10, 20, 30, 40, 50])).toEqual({ n: 5, q1: 20, median: 30, q3: 40 })
    expect(clockSpread([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ n: 8, q1: 3, median: 5, q3: 6 })
    // Too few jobs to say, and a day that is not a count is no job.
    expect(clockSpread([1, 2, 3, 4])).toBeNull()
    expect(clockSpread([1, 2, 3, 4, Number.NaN, -3])).toBeNull()
  })

  it('reads an application to its permit: submitted in twelve months, with an issued day', () => {
    const rows = [
      { stage: 'applied', submitted_on: '2026-09-01', issued_on: '2026-10-16' },
      { stage: 'applied', submitted_on: '2026-10-01', issued_on: null },
      { stage: 'issued', submitted_on: '2026-09-01', issued_on: '2026-09-11' },
      { stage: 'applied', submitted_on: '2025-11-18', issued_on: '2025-12-18' },
      { stage: 'applied', submitted_on: '2025-11-19', issued_on: '2025-12-19' },
      { stage: 'applied', submitted_on: '2026-09-10', issued_on: '2026-09-01' },
    ]
    expect(applicationClockDays(rows, TODAY)).toEqual([45, 30])
  })

  it('reads a building permit to the plumber’s permit, and a permit pulled first as none', () => {
    const rows = [
      { filed_on: '2026-09-01', plumber_permit_on: '2026-09-06' },
      { filed_on: '2026-09-01', plumber_permit_on: null },
      { filed_on: '2026-09-10', plumber_permit_on: '2026-09-02' },
      { filed_on: '2025-11-18', plumber_permit_on: '2025-11-20' },
      { filed_on: null, plumber_permit_on: '2026-09-02' },
    ]
    expect(plumberClockDays(rows, TODAY)).toEqual([5, 0])
  })

  it('draws the application clock where applications carry both days, and the plumber clock only where plumbers are named', () => {
    const applications = [30, 40, 45, 50, 80].map((d, i) => ({ stage: 'applied', submitted_on: '2026-06-01', issued_on: `2026-0${d >= 61 ? 8 : d >= 30 ? 7 : 6}-${String(i + 10).padStart(2, '0')}` }))
    const rows = [1, 3, 5, 7, 9].map((d) => ({ filed_on: '2026-09-01', plumber_permit_on: `2026-09-${String(1 + d).padStart(2, '0')}` }))
    const unnamed = marketClocks({ city: 'San Antonio', applications, rows, namesPlumbers: false, todayYmd: TODAY })
    expect(unnamed.map((c) => c.kind)).toEqual(['application'])
    const named = marketClocks({ city: 'Austin', applications: [], rows, namesPlumbers: true, todayYmd: TODAY })
    expect(named).toEqual([{ kind: 'plumber', city: 'Austin', spread: { n: 5, q1: 3, median: 5, q3: 7 } }])
    expect(marketClocks({ city: 'Seguin', applications: [], rows: [], namesPlumbers: false, todayYmd: TODAY })).toEqual([])
  })

  it('says the days, the weeks, the title and the note', () => {
    expect(clockDaysWords(45)).toBe('45 days')
    expect(clockDaysWords(1)).toBe('1 day')
    expect(clockDaysWords(0)).toBe('the same day')
    expect(aboutWeeksWords(45)).toBe('about 6 weeks')
    expect(aboutWeeksWords(9)).toBe('9 days')
    const application = { kind: 'application' as const, city: 'San Antonio', spread: { n: 1200, q1: 25, median: 45, q3: 80 } }
    const plumber = { kind: 'plumber' as const, city: 'Austin', spread: { n: 80, q1: 1, median: 5, q3: 9 } }
    expect(clockTitle(application)).toBe('San Antonio · application to permit')
    expect(clockTitle(plumber)).toBe('Austin · building permit to the plumber’s permit')
    expect(plainSentence(clockNote(application))).toBe('Half of the applications wait 45 days or more for the permit. That is the time to call in. The middle half took 25 to 80 days, over 1,200 applications.')
    // The middle wait, the middle half and how many it is over are the note's values.
    expect(sentenceParts(clockNote(application)).filter((p) => typeof p !== 'string')).toEqual([
      { kind: 'median', text: '45 days' },
      { kind: 'middle', text: '25 to 80 days' },
      { kind: 'over', text: '1,200 applications' },
    ])
    expect(plainSentence(clockNote(plumber))).toBe('Half of the jobs have a plumber’s permit within 5 days of the building permit. The job is taken by the time the city shows it. Read Austin for who builds. The middle half took 1 to 9 days, over 80 jobs.')
    expect(clockNote({ ...plumber, spread: { n: 80, q1: 0, median: 0, q3: 4 } })).toContain('by the day of the building permit')
    expect(clockTile([application, plumber])).toEqual({ value: '~6 weeks', words: 'from an application to its permit' })
    expect(clockTile([plumber])).toEqual({ value: '5 days', words: 'from a building permit to the plumber’s permit' })
    expect(clockTile([])).toBeNull()
  })

  it('scales the bar to 120 days, or past the widest third quarter', () => {
    const at = (q3: number) => ({ kind: 'application' as const, city: 'San Antonio', spread: { n: 9, q1: 1, median: 2, q3 } })
    expect(clockScaleDays([at(80)])).toBe(120)
    expect(clockScaleDays([at(80), at(131)])).toBe(150)
    expect(clockScaleDays([])).toBe(120)
    expect(clockAt(30, 120)).toBe(25)
    expect(clockAt(500, 120)).toBe(100)
    expect(clockAt(-4, 120)).toBe(0)
    // A middle of 7 days on a 120-day bar sits at the bar's start, where the first word is: its days go beside the word.
    expect(clockMiddleNearStart(clockAt(7, 120))).toBe(true)
    expect(clockMiddleNearStart(clockAt(0, 120))).toBe(true)
    expect(clockMiddleNearStart(clockAt(45, 120))).toBe(false)
  })
})
