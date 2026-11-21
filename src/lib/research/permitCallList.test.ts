import { describe, expect, it } from 'vitest'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import type { BuilderRow } from './permitBuilders'
import type { MarketPermit } from './permitMarket'
import type { ResearchPermitRow } from './permitResearch'
import {
  CALL_WEEK,
  answeredDay,
  answeredWords,
  backWithNewJob,
  callChipCounts,
  callChips,
  callCountWords,
  callEmptyWords,
  callHistoryWords,
  callNoteWords,
  callRows,
  callRowsShowing,
  callTags,
  callTiles,
  callWaitingWords,
  callWorkWords,
  foldCallAnswers,
  lookAgainOn,
  lookupCandidates,
  nameReads,
  openJobsByBuilder,
  openJobsTail,
  permitRowOfSite,
  pursuePermit,
  saysItBuilds,
  standingWords,
  trendKnown,
  trendOf,
  trendWindows,
  valuesReliable,
  type CallAnswerRow,
  type CallStanding,
} from './permitCallList'

/** A marked sentence as its plain words (values in place): what a reader sees, value or not. */
const plain = (sentence: string | null): string | null => (sentence == null ? null : plainSentence(sentence))
/** The values a sentence marks, in order. */
const values = (sentence: string | null) => sentenceParts(sentence ?? '').filter((p) => typeof p !== 'string')
import { foldLookups, type LookupCheckRow, type LookupRow } from './builderLookups'

/** Every company, person, address and number here is made up. */
const TODAY = '2026-11-19'
const RECORDS = '2025-01-01'

function builder(key: string, contact: string, over: Partial<BuilderRow> = {}): BuilderRow {
  return { key, name: null, sample_contact: contact, kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 0, open: 0, last_permit_on: null, plumber: null, plumber_jobs: 0, bids: 0, won: 0, last_bid_on: null, ...over }
}

/** `n` issued permits of one builder on one day. */
function issued(key: string, day: string, n = 1, over: Partial<MarketPermit> = {}): MarketPermit[] {
  return Array.from({ length: n }, () => ({ builder_key: key, stage: 'issued', work_type: 'Commercial remodel', submitted_on: null, issued_on: day, declared_value: null, address_key: null, ...over }))
}

function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1',
    city: 'San Antonio',
    source: 'sa-applied',
    permit_number: 'COM-PRJ-APP26-00000001',
    permit_type: 'Commercial Project Application',
    stage: 'applied',
    residential: false,
    work_type: 'Commercial project',
    project_name: null,
    address: '2100 SAMPLE PKWY',
    zip: '78201',
    lat: null,
    lng: null,
    submitted_on: '2026-11-04',
    issued_on: null,
    filed_on: '2026-11-04',
    declared_value: 600_000,
    area_sf: null,
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
    builder_key: 'ridgewaybuilders',
    ...over,
  }
}

const answer = (over: Partial<CallAnswerRow> = {}): CallAnswerRow => ({ id: 'a1', builder_key: 'ridgewaybuilders', answer: 'not_for_us', reason: '', look_again_on: '2027-11-19', city: 'San Antonio', prospect_id: null, permit_id: null, answered_by: 'u1', answered_at: '2026-11-19T15:00:00Z', ...over })

const NONE: ReadonlyMap<string, CallStanding> = new Map()

describe('foldCallAnswers', () => {
  it('keeps the newest answer on a name, and a put-back leaves none', () => {
    const rows = [answer(), answer({ id: 'a2', builder_key: 'tallpinedevelopment', answer: 'pursue', look_again_on: '2027-02-17', prospect_id: 'lead-1' }), answer({ id: 'a3', answer: 'back', look_again_on: null, answered_at: '2026-11-19T16:00:00Z' })]
    const folded = foldCallAnswers(rows, TODAY)
    expect(folded.has('ridgewaybuilders')).toBe(false)
    expect(folded.get('tallpinedevelopment')).toMatchObject({ answer: 'pursue', off: true })
  })

  it('holds a name off the list until its day to look again, and for good with no day', () => {
    expect(foldCallAnswers([answer({ look_again_on: '2026-11-20' })], TODAY).get('ridgewaybuilders')?.off).toBe(true)
    expect(foldCallAnswers([answer({ look_again_on: '2026-11-19' })], TODAY).get('ridgewaybuilders')?.off).toBe(false)
    expect(foldCallAnswers([answer({ look_again_on: null })], TODAY).get('ridgewaybuilders')?.off).toBe(true)
  })

  it('reads two answers saved in one instant by their ids', () => {
    const same = [answer({ id: 'a2', answer: 'back' }), answer({ id: 'a1' })]
    expect(foldCallAnswers(same, TODAY).size).toBe(0)
  })

  it('dates an answer on the app’s calendar, so an evening answer is not tomorrow’s', () => {
    expect(answeredDay({ answered_at: '2026-11-20T03:30:00Z' })).toBe('2026-11-19')
    expect(answeredDay({ answered_at: '2026-11-19T15:00:00Z' })).toBe('2026-11-19')
    const late = foldCallAnswers([answer({ answered_at: '2026-11-20T03:30:00Z' })], TODAY).get('ridgewaybuilders') as CallStanding
    expect(plain(standingWords(late, () => 'Eve', TODAY))).toBe('Not for us. Eve, Nov 19. Off the list until Nov 19, 2027, and then until it applies for a new job.')
  })

  it('sets the day to look again: a quarter after a pursue, a year after a pass', () => {
    expect(lookAgainOn('pursue', TODAY)).toBe('2027-02-17')
    expect(lookAgainOn('not_for_us', TODAY)).toBe('2027-11-19')
  })
})

describe('nameReads', () => {
  it('reads a company that builds, a person, and a firm that designs or files', () => {
    expect(nameReads(builder('a', 'Ridgeway Builders'))).toBe('builder')
    expect(nameReads(builder('a', 'Tall Pine Development LLC'))).toBe('builder')
    expect(nameReads(builder('a', 'Dana Whitlock'))).toBe('person')
    expect(nameReads(builder('a', 'Quill Permits'))).toBe('files')
    expect(nameReads(builder('a', 'PermitQuickNow LLC'))).toBe('files')
    expect(nameReads(builder('a', 'Larkspur Engineers & Associates'))).toBe('files')
    expect(nameReads(builder('a', 'Heron Architects'))).toBe('files')
  })

  it('reads a design-build contractor as a builder', () => {
    expect(nameReads(builder('a', 'Juniper Design & Construction'))).toBe('builder')
  })

  it('reads a name with a building word as a builder, though the splitter knows no such company word', () => {
    // "Constructors" is no company word to `contactParts`, and the name read as a person.
    expect(nameReads(builder('a', 'Marsh Constructors'))).toBe('builder')
    expect(nameReads(builder('a', 'Sample Design Build'))).toBe('builder')
  })

  it('takes the office’s word over the name', () => {
    expect(nameReads(builder('a', 'Dana Whitlock', { kind: 'gc' }))).toBe('builder')
    expect(nameReads(builder('a', 'Ridgeway Builders', { kind: 'person' }))).toBe('person')
    expect(nameReads(builder('a', 'Ridgeway Builders', { kind: 'architect' }))).toBe('files')
    expect(nameReads(builder('a', 'Sam Ortega', { name: 'Harbor Fitouts' }))).toBe('person')
  })
})

describe('trendOf', () => {
  it('tells new and busy, picking up and slowing by the card’s rules', () => {
    expect(trendOf(3, 0)).toBe('new_busy')
    expect(trendOf(2, 0)).toBe('picking_up')
    expect(trendOf(6, 2)).toBe('picking_up')
    expect(trendOf(5, 4)).toBeNull()
    expect(trendOf(1, 3)).toBe('slowing')
    expect(trendOf(2, 3)).toBeNull()
    expect(trendOf(0, 2)).toBeNull()
  })

  it('cuts two equal halves: today and the 89 days before it, then the 90 days ahead of those', () => {
    expect(trendWindows(TODAY)).toEqual({ lastFrom: '2026-08-22', priorFrom: '2026-05-24' })
    const one = builder('ridgewaybuilders', 'Ridgeway Builders')
    const count = (days: string[]) => callRows({ builders: [one], permits: days.flatMap((d) => issued('ridgewaybuilders', d)), rows: [], standings: NONE, recordsStartYmd: RECORDS, todayYmd: TODAY })[0]
    // The first day of each half is in it, and the day before is in the half before.
    expect(count(['2026-11-19', '2026-08-22', '2026-08-21', '2026-05-24', '2026-05-23'])).toMatchObject({ permits: 5, last90: 2, prior90: 2 })
  })

  it('is known only where the records reach back two ninety-day halves', () => {
    expect(trendKnown('2025-01-01', TODAY)).toBe(true)
    expect(trendKnown('2026-05-24', TODAY)).toBe(true)
    expect(trendKnown('2026-05-25', TODAY)).toBe(false)
    expect(trendKnown('2026-08-27', TODAY)).toBe(false)
    expect(trendKnown(null, TODAY)).toBe(false)
  })
})

describe('openJobsByBuilder', () => {
  it('keeps an application with no plumbing permit and no answer that closes it, the newest first', () => {
    const rows = [
      row(),
      row({ id: 'p2', address: '77 KILN ST', submitted_on: '2026-10-28', filed_on: '2026-10-28' }),
      // A plumbing permit on file, named or not.
      row({ id: 'p3', plumber_permit_on: '2026-11-10' }),
      row({ id: 'p4', plumber: 'Copperline Mechanical', plumber_permit_on: '2026-11-10' }),
      // An answer that closes it: passed, or said to have a plumber.
      row({ id: 'p5', verdict: 'not_for_us' }),
      row({ id: 'p6', verdict: 'taken' }),
      // An issued permit is not an application, and a permit with no applicant has no builder.
      row({ id: 'p7', stage: 'issued', issued_on: '2026-11-01' }),
      row({ id: 'p8', builder_key: null }),
      // Investigating and pursuing close nothing.
      row({ id: 'p9', address: '5 ASTER RDG', verdict: 'look', submitted_on: '2026-10-09', filed_on: '2026-10-09' }),
    ]
    const open = openJobsByBuilder(rows).get('ridgewaybuilders') ?? []
    expect(open.map((j) => j.id)).toEqual(['p1', 'p2', 'p9'])
    expect(open[0]).toEqual({ id: 'p1', address: '2100 SAMPLE PKWY', appliedOn: '2026-11-04', work: 'Commercial project', value: 600_000 })
  })
})

describe('valuesReliable', () => {
  const valued = (values: number[]) => values.map((v) => ({ declared_value: v }))
  it('trusts values that vary, and not a city that fills one figure in', () => {
    const varied = Array.from({ length: 30 }, (_, i) => 100_000 + i * 7_000)
    expect(valuesReliable(valued(varied))).toBe(true)
    // One figure on a sixth of them or more.
    expect(valuesReliable(valued([...varied.slice(0, 25), ...Array.from({ length: 5 }, () => 1_000_000)]))).toBe(false)
    expect(valuesReliable(valued([...varied.slice(0, 26), ...Array.from({ length: 4 }, () => 1_000_000)]))).toBe(true)
  })

  it('needs twenty valued permits', () => {
    expect(valuesReliable(valued(Array.from({ length: 19 }, (_, i) => 1000 + i)))).toBe(false)
    expect(valuesReliable([{ declared_value: null }, { declared_value: 0 }])).toBe(false)
  })
})

describe('saysItBuilds', () => {
  it('leads on a building word, and not on any company word', () => {
    expect(saysItBuilds(builder('a', 'Ridgeway Builders'))).toBe(true)
    expect(saysItBuilds(builder('a', 'Aster Ridge Contracting'))).toBe(true)
    expect(saysItBuilds(builder('a', 'Juniper Design & Construction'))).toBe(true)
    expect(saysItBuilds(builder('a', 'Nine GCs Company LLC'))).toBe(true)
    // A company word alone does not lead: a design firm, a trade and an owner all carry one.
    expect(saysItBuilds(builder('a', 'Tall Pine Development LLC'))).toBe(false)
    expect(saysItBuilds(builder('a', 'Larkin & Associates, Inc.'))).toBe(false)
    expect(saysItBuilds(builder('a', 'Shade Sail Group LLC'))).toBe(false)
    expect(saysItBuilds(builder('a', 'Dana Whitlock'))).toBe(false)
  })

  it('takes the office’s word over the name', () => {
    expect(saysItBuilds(builder('a', 'Tall Pine Development LLC', { kind: 'gc' }))).toBe(true)
    expect(saysItBuilds(builder('a', 'Ridgeway Builders', { kind: 'architect' }))).toBe(false)
    expect(saysItBuilds(builder('a', 'Ridgeway Builders', { kind: 'owner' }))).toBe(false)
  })
})

describe('backWithNewJob', () => {
  const due = (over: Partial<CallAnswerRow> = {}) => foldCallAnswers([answer({ answer: 'pursue', look_again_on: '2026-11-01', answered_at: '2026-08-03T15:00:00Z', ...over })], TODAY).get('ridgewaybuilders') as CallStanding

  it('offers a name again only with a job open now that it applied for after the answer', () => {
    expect(backWithNewJob(due(), [{ appliedOn: '2026-10-28' }])).toBe(true)
    expect(backWithNewJob(due(), [{ appliedOn: '2026-08-03' }, { appliedOn: '2026-07-01' }])).toBe(false)
    expect(backWithNewJob(due(), [{ appliedOn: null }])).toBe(false)
    expect(backWithNewJob(due(), [])).toBe(false)
  })

  it('never offers a name whose day has not come', () => {
    const off = foldCallAnswers([answer()], TODAY).get('ridgewaybuilders') as CallStanding
    expect(backWithNewJob(off, [{ appliedOn: '2026-11-19' }])).toBe(false)
  })
})

describe('callRows', () => {
  const builders = [
    builder('ridgewaybuilders', 'Ridgeway Builders'),
    builder('tallpinedevelopment', 'Tall Pine Development LLC'),
    builder('juniperhospitalitygroup', 'Juniper Hospitality Group', { bids: 4, won: 0, last_bid_on: '2026-06-03' }),
    builder('quillpermits', 'Quill Permits'),
    builder('danawhitlock', 'Dana Whitlock'),
    builder('harborfitouts', 'Harbor Fitouts', { mark: 'avoid' }),
    builder('limebuild', 'Lime Build', { kind: 'files_for_others' }),
    builder('asterridgecontracting', 'Aster Ridge Contracting'),
  ]
  const permits: MarketPermit[] = [
    // Picking up: 6 in the last ninety days against 2 in the ninety before, 14 in the year.
    ...issued('ridgewaybuilders', '2026-10-20', 6),
    ...issued('ridgewaybuilders', '2026-07-01', 2),
    ...issued('ridgewaybuilders', '2026-02-01', 6),
    // New and busy: 5, all in the last ninety days.
    ...issued('tallpinedevelopment', '2026-11-01', 5, { work_type: 'New commercial' }),
    // Steady, and we bid them four times.
    ...issued('juniperhospitalitygroup', '2026-10-01', 4),
    ...issued('juniperhospitalitygroup', '2026-07-15', 4),
    ...issued('juniperhospitalitygroup', '2026-01-15', 3),
    // The busiest of all reads as a filer, and the next as a person.
    ...issued('quillpermits', '2026-11-05', 20),
    ...issued('danawhitlock', '2026-11-05', 9),
    ...issued('harborfitouts', '2026-11-05', 9),
    ...issued('limebuild', '2026-11-05', 9),
    // Two permits is not three, and a permit over a year old does not count.
    ...issued('asterridgecontracting', '2026-11-05', 2),
    ...issued('asterridgecontracting', '2025-11-18', 4),
    // A permit with no applicant belongs to nobody.
    ...issued('ridgewaybuilders', '2026-11-05', 1, { builder_key: null }),
  ]
  const rows = [row(), row({ id: 'p2', submitted_on: '2026-10-28', filed_on: '2026-10-28' }), row({ id: 'p3', builder_key: 'juniperhospitalitygroup' })]
  const input = { builders, permits, rows, standings: NONE, recordsStartYmd: RECORDS, todayYmd: TODAY }

  it('lists the builders with three or more permits, never an Avoid or a name that files for others', () => {
    const list = callRows(input)
    expect(list.map((r) => r.key)).toEqual(['ridgewaybuilders', 'juniperhospitalitygroup', 'tallpinedevelopment', 'quillpermits', 'danawhitlock'])
  })

  it('counts the year and the two halves, and says the trend', () => {
    const list = callRows(input)
    expect(list.find((r) => r.key === 'ridgewaybuilders')).toMatchObject({ permits: 14, last90: 6, prior90: 2, trend: 'picking_up', reads: 'builder' })
    expect(list.find((r) => r.key === 'tallpinedevelopment')).toMatchObject({ permits: 5, last90: 5, prior90: 0, trend: 'new_busy', mostly: 'New commercial' })
    expect(list.find((r) => r.key === 'juniperhospitalitygroup')).toMatchObject({ permits: 11, last90: 4, prior90: 4, trend: null, bids: 4, won: 0 })
  })

  it('orders by a name that reads as a builder, then a job open now, then the trend, then never bid, then the ninety days', () => {
    const list = callRows(input)
    // Both have a job open now. Ridgeway is picking up and Juniper is not.
    expect(list.slice(0, 2).map((r) => [r.key, r.openJobs.length])).toEqual([['ridgewaybuilders', 2], ['juniperhospitalitygroup', 1]])
    // No open job: the builder comes before the busier filer and the busier person.
    expect(list.slice(2).map((r) => [r.key, r.reads])).toEqual([['tallpinedevelopment', 'builder'], ['quillpermits', 'files'], ['danawhitlock', 'person']])
  })

  it('puts a name with a building word ahead of a company with a job open now', () => {
    // Juniper Hospitality Group has a job open now and no building word. Aster Ridge Contracting has the word and no open job.
    const more = [...permits, ...issued('asterridgecontracting', '2026-09-01', 2)]
    const list = callRows({ ...input, permits: more })
    expect(list.map((r) => [r.key, r.leads])).toEqual([
      ['ridgewaybuilders', true],
      ['asterridgecontracting', true],
      ['juniperhospitalitygroup', false],
      ['tallpinedevelopment', false],
      ['quillpermits', false],
      ['danawhitlock', false],
    ])
  })

  it('counts a job once: an application with its permit, and the buildings of one project', () => {
    const at = (address_key: string, over: Partial<MarketPermit> = {}): MarketPermit => ({ builder_key: 'tallpinedevelopment', stage: 'issued', work_type: 'New commercial', submitted_on: null, issued_on: '2026-11-01', declared_value: 1_800_000, address_key, ...over })
    const project: MarketPermit[] = [
      // One project: the application, which took the permit's issued day, ten buildings and the site work. Twelve rows, one job.
      at('100 sample pkwy', { stage: 'applied', work_type: 'Commercial project', submitted_on: '2026-08-01' }),
      ...Array.from({ length: 10 }, () => at('100 sample pkwy')),
      at('100 sample pkwy', { work_type: 'Commercial site work' }),
      // Two more jobs of theirs, at other addresses.
      at('7 elm st', { issued_on: '2026-10-10', declared_value: 300_000 }),
      at('9 oak st', { issued_on: '2026-06-10', declared_value: 500_000 }),
    ]
    const list = callRows({ ...input, permits: project })
    // Counted as rows this name read 13 in the last ninety days against none, new and busy. It is two against none.
    expect(list.find((r) => r.key === 'tallpinedevelopment')).toMatchObject({ permits: 3, last90: 2, prior90: 1, trend: null, mostly: 'New commercial' })
    // Under three jobs a name is not on the list, however many rows it has.
    expect(callRows({ ...input, permits: project.slice(0, 13) }).map((r) => r.key)).not.toContain('tallpinedevelopment')
  })

  it('keeps an answered name off after its day until it has a new job', () => {
    // Pursued Nov 10 and due again Nov 15. The only jobs open now were applied for before the answer.
    const stale = foldCallAnswers([answer({ answer: 'pursue', look_again_on: '2026-11-15', answered_at: '2026-11-10T15:00:00Z' })], TODAY)
    expect(stale.get('ridgewaybuilders')?.off).toBe(false)
    expect(callRows({ ...input, standings: stale }).map((r) => r.key)).not.toContain('ridgewaybuilders')
    const fresh = [...rows, row({ id: 'p9', submitted_on: '2026-11-12', filed_on: '2026-11-12' })]
    expect(callRows({ ...input, rows: fresh, standings: stale }).find((r) => r.key === 'ridgewaybuilders')?.earlier?.answer).toBe('pursue')
  })

  it('takes an answered name off, and offers it again once its day has come', () => {
    const off = foldCallAnswers([answer()], TODAY)
    expect(callRows({ ...input, standings: off }).map((r) => r.key)).not.toContain('ridgewaybuilders')
    const due = foldCallAnswers([answer({ look_again_on: '2026-11-01', answered_at: '2026-08-03T15:00:00Z', answer: 'pursue' })], TODAY)
    const again = callRows({ ...input, standings: due }).find((r) => r.key === 'ridgewaybuilders')
    expect(again?.earlier?.answer).toBe('pursue')
    expect(callTags(again as never, TODAY).map((t) => t.words)).toContain('Pursued Aug 3')
  })

  it('says no trend where the records are shorter than two ninety-day halves', () => {
    const list = callRows({ ...input, recordsStartYmd: '2026-08-27' })
    expect(list.every((r) => r.trend == null)).toBe(true)
    // The order then falls to the open jobs and the ninety days.
    expect(list[0]?.key).toBe('ridgewaybuilders')
  })

  it('reads the typical job and the jobs over $1M only where the city’s values can be trusted', () => {
    const varied = Array.from({ length: 30 }, (_, i) => issued('ridgewaybuilders', '2026-10-20', 1, { declared_value: 400_000 + i * 40_000 })).flat()
    const list = callRows({ ...input, permits: varied })
    expect(list[0]).toMatchObject({ key: 'ridgewaybuilders', over1m: 15 })
    expect(plain(callWorkWords(list[0] as never))).toBe('Mostly commercial remodel. Typical job $690k to $1.3M.')
    const round = Array.from({ length: 30 }, () => issued('ridgewaybuilders', '2026-10-20', 1, { declared_value: 1_000_000 })).flat()
    expect(callRows({ ...input, permits: round })[0]).toMatchObject({ over1m: 0, typical: null })
  })
})

describe('the chips', () => {
  const builders = Array.from({ length: 8 }, (_, i) => builder(`builder${i}`, `Builder ${i} Construction`, { bids: i === 0 ? 2 : 0, won: i === 0 ? 1 : 0 }))
  // Every permit its own value, so no one figure repeats: the city's values can be trusted.
  const permits = builders.flatMap((b, i) => Array.from({ length: 3 + i }, (_, j) => issued(b.key, '2026-11-01', 1, { declared_value: (i === 7 ? 2_000_000 : 50_000 + i * 11_000) + j * 1_000 })).flat())
  const list = callRows({ builders, permits, rows: [row({ builder_key: 'builder3' })], standings: NONE, recordsStartYmd: RECORDS, todayYmd: TODAY })

  it('shows five this week and counts each chip', () => {
    expect(callRowsShowing(list, 'week')).toHaveLength(CALL_WEEK)
    expect(callChipCounts(list)).toEqual({ week: 5, open: 1, picking_up: 0, new_busy: 8, never_bid: 7, over_1m: 1 })
    expect(callRowsShowing(list, 'open').map((r) => r.key)).toEqual(['builder3'])
    expect(callRowsShowing(list, 'over_1m').map((r) => r.key)).toEqual(['builder7'])
  })

  it('leaves out the chips a city’s records cannot fill', () => {
    expect(callChips({ trendKnown: true, hasApplications: true, valuesReliable: true })).toEqual(['week', 'open', 'picking_up', 'new_busy', 'never_bid', 'over_1m'])
    expect(callChips({ trendKnown: false, hasApplications: false, valuesReliable: false })).toEqual(['week', 'never_bid'])
  })

  it('fills the two tiles from the week’s five', () => {
    expect(callTiles(callRowsShowing(list, 'week'))).toEqual([
      { value: '5', words: 'builders to call this week' },
      { value: '1', words: 'of their jobs is applied for, with no plumber yet' },
    ])
    expect(callTiles([])).toEqual([
      { value: '0', words: 'builders to call this week' },
      { value: '0', words: 'of their jobs are applied for, with no plumber yet' },
    ])
  })
})

describe('values in place', () => {
  it('marks every count, day, amount and name in a row’s lines, and leaves the words as they were', () => {
    expect(values(callCountWords({ permits: 14, last90: 6, prior90: 2 }, 'in the last year', true))).toEqual([
      { kind: 'jobs', text: '14 jobs' },
      { kind: 'last90', text: '6' },
      { kind: 'prior90', text: '2' },
    ])
    // The day the records start is a value too.
    expect(values(callCountWords({ permits: 4, last90: 4, prior90: 0 }, 'since Aug 27', false))).toEqual([
      { kind: 'jobs', text: '4 jobs' },
      { kind: 'since', text: 'Aug 27' },
    ])
    expect(values(callWorkWords({ mostly: 'New commercial', typical: { low: 400_000, high: 1_200_000 } }))).toEqual([
      { kind: 'mostly', text: 'new commercial' },
      { kind: 'typical', text: '$400k to $1.2M' },
    ])
    expect(values(callHistoryWords({ bids: 4, won: 0, lastBidOn: '2026-06-03' }, TODAY))).toEqual([
      { kind: 'bids', text: '4' },
      { kind: 'won', text: 'none' },
      { kind: 'day', text: 'Jun 3' },
    ])
    expect(values(callNoteWords({ city: 'Austin', trendKnown: false, hasApplications: false, recordsStart: 'Aug 27' }))).toEqual([{ kind: 'day', text: 'Aug 27' }])
    expect(values(callNoteWords({ city: 'San Antonio', trendKnown: true, hasApplications: true, recordsStart: 'Jan 1, 2025' }))).toEqual([])
  })

  it('says how many more wait behind the week’s five', () => {
    expect(plain(callWaitingWords(3))).toBe('3 more wait behind these. A name leaves the list when it is answered, the way a permit leaves the skim, and the next takes its place.')
    expect(plain(callWaitingWords(1))).toMatch(/^1 more waits behind these\./)
    expect(values(callWaitingWords(12))).toEqual([{ kind: 'waiting', text: '12' }])
  })

  it('leaves a toast plain: it cannot draw a value apart', () => {
    expect(answeredWords('Harbor Fitouts', 'pursue', '2027-02-17', TODAY)).not.toMatch(/[⟪⟫]/)
  })
})

describe('the words', () => {
  const base = callRows({
    builders: [builder('ridgewaybuilders', 'Ridgeway Builders', { kind: 'gc', mark: 'good', bids: 4, won: 0, last_bid_on: '2026-06-03' }), builder('danawhitlock', 'Dana Whitlock'), builder('quillpermits', 'Quill Permits', { bids: 2, won: 1 })],
    permits: [...issued('ridgewaybuilders', '2026-10-20', 6), ...issued('ridgewaybuilders', '2026-07-01', 2), ...issued('danawhitlock', '2026-10-20', 1), ...issued('danawhitlock', '2026-07-01', 4), ...issued('quillpermits', '2026-02-01', 3)],
    rows: [row(), row({ id: 'p2' }), row({ id: 'p3' })],
    standings: NONE,
    recordsStartYmd: RECORDS,
    todayYmd: TODAY,
  })
  const ridgeway = base.find((r) => r.key === 'ridgewaybuilders') as never
  const dana = base.find((r) => r.key === 'danawhitlock') as never
  const quill = base.find((r) => r.key === 'quillpermits') as never

  it('gives a row its reasons as tags', () => {
    expect(callTags(ridgeway, TODAY)).toEqual([
      { words: 'Picking up', tone: 'green' },
      { words: 'We bid 4, won 0', tone: 'red' },
      { words: '3 jobs open now', tone: 'amber' },
      { words: 'Good', tone: 'green' },
      { words: 'General contractor', tone: 'grey' },
    ])
    expect(callTags(dana, TODAY)).toEqual([
      { words: 'Slowing', tone: 'grey' },
      { words: 'Never bid', tone: 'blue' },
      { words: 'Could be a person', tone: 'grey' },
    ])
    expect(callTags(quill, TODAY)).toEqual([
      { words: 'We bid 2, won 1', tone: 'green' },
      { words: 'May file for others', tone: 'grey' },
    ])
  })

  it('says the counts, the work and our history', () => {
    expect(plain(callCountWords({ permits: 14, last90: 6, prior90: 2 }, 'in the last year', true))).toBe('14 jobs in the last year, 6 in the last 90 days against 2 in the 90 before.')
    expect(plain(callCountWords({ permits: 4, last90: 4, prior90: 0 }, 'since Aug 27', false))).toBe('4 jobs since Aug 27.')
    expect(plain(callCountWords({ permits: 1, last90: 0, prior90: 0 }, null, false))).toBe('1 job we can see.')
    expect(plain(callWorkWords({ mostly: 'New commercial', typical: { low: 400_000, high: 1_200_000 } }))).toBe('Mostly new commercial. Typical job $400k to $1.2M.')
    expect(plain(callWorkWords({ mostly: null, typical: { low: 1_000_000, high: 1_000_000 } }))).toBe('Typical job $1M.')
    expect(callWorkWords({ mostly: null, typical: null })).toBeNull()
    expect(plain(callHistoryWords({ bids: 4, won: 0, lastBidOn: '2026-06-03' }, TODAY))).toBe('We priced 4 of their jobs and won none. The last was Jun 3.')
    expect(plain(callHistoryWords({ bids: 1, won: 1, lastBidOn: null }, TODAY))).toBe('We priced 1 of their job and won 1.')
    expect(callHistoryWords({ bids: 0, won: 0, lastBidOn: null }, TODAY)).toBeNull()
    expect(openJobsTail(1)).toBe('It has no plumbing permit yet.')
    expect(openJobsTail(3)).toBe('They have no plumbing permit yet.')
  })

  it('says what an empty list means', () => {
    expect(callEmptyWords({ city: 'Seguin', builders: 0, eligible: 0, showing: 'week' })).toBe('Seguin publishes no applicant on its permits, so no builder can be named here.')
    expect(callEmptyWords({ city: 'Austin', builders: 40, eligible: 0, showing: 'week' })).toBe('Nothing waiting on a call. Every builder with 3 or more jobs here is answered.')
    expect(callEmptyWords({ city: 'Austin', builders: 40, eligible: 9, showing: 'open' })).toBe('Nothing waiting on a call under Has a job open now.')
  })

  it('says the order under the list, and what a city’s records leave out', () => {
    expect(plain(callNoteWords({ city: 'San Antonio', trendKnown: true, hasApplications: true, recordsStart: 'Jan 1, 2025' }))).toBe('A name with a building word comes first, then the other companies. After that a job open now, then picking up or new, then never bid. A job is counted once.')
    expect(plain(callNoteWords({ city: 'Austin', trendKnown: false, hasApplications: false, recordsStart: 'Aug 27' }))).toBe(
      'A name with a building word comes first, then the other companies. After that a job open now, then picking up or new, then never bid. A job is counted once. Austin’s records start Aug 27, so nothing here reads as picking up or new yet. Austin shows only issued permits, so no job is open here by the time we see it.',
    )
  })

  it('says what an answer did, and what stands on an answered name', () => {
    expect(answeredWords('Ridgeway Builders', 'pursue', '2027-02-17', TODAY)).toBe('Ridgeway Builders is off the list while you pursue them. It may be offered again after Feb 17, 2027, once it applies for a new job.')
    expect(answeredWords('Quill Permits', 'not_for_us', '2027-11-19', TODAY)).toBe('Quill Permits is off the list. It may be offered again after Nov 19, 2027, once it applies for a new job.')
    const standing = foldCallAnswers([answer({ reason: 'They file for others' })], TODAY).get('ridgewaybuilders') as CallStanding
    expect(plain(standingWords(standing, (id) => (id === 'u1' ? 'Eve' : null), TODAY))).toBe('Not for us, They file for others. Eve, Nov 19. Off the list until Nov 19, 2027, and then until it applies for a new job.')
    const pursued = foldCallAnswers([answer({ answer: 'pursue', look_again_on: null, answered_by: 'u9' })], TODAY).get('ridgewaybuilders') as CallStanding
    expect(plain(standingWords(pursued, () => null, TODAY))).toBe('Pursuing. someone, Nov 19. Off the list.')
    const due = foldCallAnswers([answer({ answer: 'pursue', look_again_on: '2026-11-15', answered_at: '2026-08-17T15:00:00Z' })], TODAY).get('ridgewaybuilders') as CallStanding
    expect(plain(standingWords(due, () => 'Eve', TODAY))).toBe('Pursuing. Eve, Aug 17. Off the list until it applies for a new job.')
  })

  it('ends an answered name’s reason with one full stop, whatever the reason was kept with', () => {
    const line = (reason: string): string | null => {
      const standing = foldCallAnswers([answer({ answer: 'pursue', look_again_on: null, reason })], TODAY).get('ridgewaybuilders') as CallStanding
      return plain(standingWords(standing, () => 'Eve', TODAY))
    }
    // A pursue keeps its reason with a full stop. The line read "Pursuing, Pursued for this job.. Eve".
    expect(line('Pursued for this job.')).toBe('Pursuing, Pursued for this job. Eve, Nov 19. Off the list.')
    expect(line('Pursued for this job')).toBe('Pursuing, Pursued for this job. Eve, Nov 19. Off the list.')
    expect(line('  Called twice...  ')).toBe('Pursuing, Called twice. Eve, Nov 19. Off the list.')
    // A question or an exclamation closes the sentence by itself.
    expect(line('Do they build here?')).toBe('Pursuing, Do they build here? Eve, Nov 19. Off the list.')
    // Only full stops, or nothing: no reason at all.
    expect(line(' . ')).toBe('Pursuing. Eve, Nov 19. Off the list.')
    expect(line('')).toBe('Pursuing. Eve, Nov 19. Off the list.')
  })
})

describe('pursue', () => {
  it('makes the lead from the newest job open now, else the newest permit of theirs the tab holds', () => {
    const rows = [row({ id: 'old', filed_on: '2026-09-01', stage: 'issued' }), row({ id: 'open', filed_on: '2026-10-01' }), row({ id: 'newest', filed_on: '2026-11-10', stage: 'issued' }), row({ id: 'other', builder_key: 'tallpinedevelopment', filed_on: '2026-11-12' })]
    expect(pursuePermit({ key: 'ridgewaybuilders', openJobs: [{ id: 'open', address: null, appliedOn: null, work: null, value: null }] }, rows)?.id).toBe('open')
    expect(pursuePermit({ key: 'ridgewaybuilders', openJobs: [] }, rows)?.id).toBe('newest')
    expect(pursuePermit({ key: 'limebuild', openJobs: [] }, rows)).toBeNull()
  })

  it('turns a permit read off the table into the row a lead is made from', () => {
    const made = permitRowOfSite('San Antonio', { id: 's1', permit_number: 'COM-BLG-PMT26-00000009', permit_type: 'Comm New Building Permit', kind: 'building', stage: 'issued', work_type: 'New commercial', submitted_on: '2026-01-02', issued_on: '2026-02-03', contact: 'Ridgeway Builders', address: '60 MILLRACE ROW', declared_value: 1_800_000 }, { key: 'ridgewaybuilders', name: null, kind: 'gc' })
    expect(made).toMatchObject({ id: 's1', city: 'San Antonio', stage: 'issued', filed_on: '2026-02-03', address: '60 MILLRACE ROW', contact: 'Ridgeway Builders', builder_key: 'ridgewaybuilders', builder_kind: 'gc', verdict: null, plumber: null })
  })
})

describe('what was looked up', () => {
  const builders = [builder('ridgewaybuilders', 'Ridgeway Builders'), builder('haldenassociates', 'Halden & Associates, Inc.'), builder('copperlinegroup', 'Copperline Group LLC'), builder('danawhitlock', 'Dana Whitlock')]
  const permits = [...issued('ridgewaybuilders', '2026-10-20', 5), ...issued('haldenassociates', '2026-10-20', 9), ...issued('copperlinegroup', '2026-10-20', 6), ...issued('danawhitlock', '2026-10-20', 4)]
  const kind = (key: string, value: string, id = `k-${key}`): LookupRow => ({ id, builder_key: key, fact: 'kind', value, detail: '', source_url: `https://${key}.example/about`, looked_up_on: '2026-11-18', looked_up_by: 'dev', looked_up_how: 'agent', city: 'San Antonio', created_at: '2026-11-18T18:00:00Z' })
  const checked = (lookupId: string): LookupCheckRow => ({ id: `c-${lookupId}`, lookup_id: lookupId, verdict: 'checked', said_by: 'u1', said_at: '2026-11-19T15:00:00Z' })
  const list = (rows: LookupRow[], checks: LookupCheckRow[] = [], over: BuilderRow[] = builders) => callRows({ builders: over, permits, rows: [], standings: NONE, lookups: foldLookups(rows, checks), recordsStartYmd: RECORDS, todayYmd: TODAY })
  const keys = (rows: LookupRow[], checks: LookupCheckRow[] = [], over: BuilderRow[] = builders) => list(rows, checks, over).map((r) => r.key)

  // Every name here is new and busy and never bid, so the order turns on the name and then on the ninety days.
  // With nothing looked up: the name with a building word leads, then the companies, then the name that reads as a person.
  const asIs = ['ridgewaybuilders', 'haldenassociates', 'copperlinegroup', 'danawhitlock']

  it('carries the lookup on its row, and null where nobody looked', () => {
    const rows = list([kind('haldenassociates', 'design_firm')])
    expect(rows.find((r) => r.key === 'haldenassociates')?.lookup?.kind?.row.value).toBe('design_firm')
    expect(rows.find((r) => r.key === 'ridgewaybuilders')?.lookup).toBeNull()
  })

  it('moves no name on a lookup nobody checked', () => {
    expect(keys([])).toEqual(asIs)
    expect(keys([kind('haldenassociates', 'design_firm'), kind('copperlinegroup', 'builder')])).toEqual(asIs)
  })

  it('leads with a builder a person checked, and holds a checked design firm, permit service or trade behind the companies', () => {
    const copper = kind('copperlinegroup', 'builder')
    expect(keys([copper], [checked(copper.id)])).toEqual(['copperlinegroup', 'ridgewaybuilders', 'haldenassociates', 'danawhitlock'])
    for (const value of ['design_firm', 'permit_service', 'trade']) {
      const halden = kind('haldenassociates', value)
      expect(keys([halden], [checked(halden.id)])).toEqual(['ridgewaybuilders', 'copperlinegroup', 'haldenassociates', 'danawhitlock'])
    }
  })

  it('holds a name with a building word behind the companies once a person checked it is a trade', () => {
    const ridgeway = kind('ridgewaybuilders', 'trade')
    expect(keys([ridgeway], [checked(ridgeway.id)])).toEqual(['haldenassociates', 'copperlinegroup', 'ridgewaybuilders', 'danawhitlock'])
  })

  it('never takes a name off the list, whatever was looked up', () => {
    const rows = [kind('ridgewaybuilders', 'trade'), kind('haldenassociates', 'permit_service'), kind('copperlinegroup', 'unknown'), kind('danawhitlock', 'design_firm')]
    expect(keys(rows, rows.map((r) => checked(r.id))).sort()).toEqual([...asIs].sort())
  })

  it('lets the office’s own kind order and tag the name, whatever was looked up', () => {
    const over = builders.map((b) => (b.key === 'copperlinegroup' ? { ...b, kind: 'owner' } : b))
    const copper = kind('copperlinegroup', 'builder')
    expect(keys([copper], [checked(copper.id)], over)).toEqual(asIs)
    const row = list([copper], [checked(copper.id)], over).find((r) => r.key === 'copperlinegroup') as never
    expect(callTags(row, TODAY).map((t) => t.words)).toEqual(['New and busy', 'Never bid', 'Owner'])
  })

  it('tags a looked-up kind as an outline until it is checked, in place of the reading of the name', () => {
    const halden = kind('haldenassociates', 'design_firm')
    const tags = (checks: LookupCheckRow[]) => callTags(list([halden], checks).find((r) => r.key === 'haldenassociates') as never, TODAY)
    expect(tags([])).toEqual([
      { words: 'New and busy', tone: 'green' },
      { words: 'Never bid', tone: 'blue' },
      { words: 'Looked up: a design firm', tone: 'grey', outline: true },
    ])
    expect(tags([checked(halden.id)])).toEqual([
      { words: 'New and busy', tone: 'green' },
      { words: 'Never bid', tone: 'blue' },
      { words: 'A design firm, checked', tone: 'grey', outline: false },
    ])
    // A kind that could not be told tags nothing, and the reading of the name stands.
    const dana = callTags(list([kind('danawhitlock', 'unknown')]).find((r) => r.key === 'danawhitlock') as never, TODAY)
    expect(dana.map((t) => t.words)).toEqual(['New and busy', 'Never bid', 'Could be a person'])
  })

  it('picks the names to look up: the first on the list, never one that reads as a person, never one already looked up', () => {
    expect(lookupCandidates(list([]), 25).map((r) => r.key)).toEqual(['ridgewaybuilders', 'haldenassociates', 'copperlinegroup'])
    expect(lookupCandidates(list([]), 2).map((r) => r.key)).toEqual(['ridgewaybuilders', 'haldenassociates'])
    expect(lookupCandidates(list([kind('ridgewaybuilders', 'builder')]), 2).map((r) => r.key)).toEqual(['haldenassociates', 'copperlinegroup'])
  })
})
