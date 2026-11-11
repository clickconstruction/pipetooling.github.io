import { describe, expect, it } from 'vitest'
import type { ResearchPermitRow } from './permitResearch'
import {
  builderChipCounts,
  builderLine,
  builderName,
  builderNameOfPermit,
  buildersShowing,
  closedChipCounts,
  closedRows,
  funnelLines,
  funnelTiles,
  funnelVerdict,
  keptByWords,
  keptChipCounts,
  keptRows,
  markHold,
  neverBid,
  notPursuingVerdict,
  nudgeAsks,
  nudgeWords,
  ourBidsWords,
  placeCounts,
  stripCounts,
  placeOf,
  plumberUsedWords,
  pursueReason,
  pursuingRows,
  skimBuilderContext,
  tookPlumberSinceKept,
  type BuilderRow,
  type PermitFunnel,
} from './permitBuilders'

// Every name, street and number here is made up.
function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1', city: 'San Antonio', source: 'sa-applied', permit_number: 'COM-1', permit_type: 'Commercial Project Application', stage: 'applied', residential: false,
    work_type: 'Commercial project', project_name: null, address: '100 SAMPLE ST', zip: '78245', lat: null, lng: null, submitted_on: '2026-11-06', issued_on: null, filed_on: '2026-11-06',
    declared_value: null, area_sf: null, contact: 'Dana Whitlock, Ridgeway Builders', plumber: null, plumber_permit_on: null,
    verdict: null, verdict_reason: null, verdict_look_again_on: null, verdict_prospect_id: null, verdict_by: null, verdict_by_name: null, verdict_at: null,
    ...over,
  }
}
function builder(over: Partial<BuilderRow> = {}): BuilderRow {
  return { key: 'ridgewaybuilders', name: null, sample_contact: 'Dana Whitlock, Ridgeway Builders', kind: null, customer_id: null, mark: null, mark_reason: null, mark_by_name: null, mark_at: null, permits: 4, open: 2, last_permit_on: '2026-11-06', plumber: 'Blue Heron Plumbing', plumber_jobs: 2, bids: 5, won: 3, last_bid_on: '2026-06-01', ...over }
}

describe('the four places (punch list #302)', () => {
  it('puts every permit in exactly one', () => {
    expect(placeOf(row())).toEqual({ place: 'skim', why: null })
    expect(placeOf(row({ verdict: 'look' }))).toEqual({ place: 'kept', why: null })
    expect(placeOf(row({ verdict: 'approach' }))).toEqual({ place: 'pursuing', why: null })
    expect(placeOf(row({ verdict: 'not_for_us', verdict_reason_code: 'too_far' }))).toEqual({ place: 'closed', why: 'passed' })
    expect(placeOf(row({ verdict: 'not_for_us', verdict_reason_code: 'np_no_answer' }))).toEqual({ place: 'closed', why: 'not_pursuing' })
    expect(placeOf(row({ verdict: 'taken' }))).toEqual({ place: 'closed', why: 'plumber' })
    expect(placeOf(row({ plumber_permit_on: '2026-11-08' }))).toEqual({ place: 'closed', why: 'plumber' })
  })

  it('a kept permit a plumber has since taken is closed, and a pursued one stays ours', () => {
    const kept = row({ verdict: 'look', plumber: 'Blue Heron Plumbing', plumber_permit_on: '2026-11-08' })
    expect(placeOf(kept)).toEqual({ place: 'closed', why: 'plumber' })
    expect(tookPlumberSinceKept(kept)).toBe(true)
    expect(tookPlumberSinceKept(row({ verdict: 'look' }))).toBe(false)
    expect(placeOf(row({ verdict: 'approach', plumber_permit_on: '2026-11-08' })).place).toBe('pursuing')
  })

  it('counts the four over the rows above the floor, and they add up', () => {
    const rows = [row(), row({ id: 'p2', verdict: 'look' }), row({ id: 'p3', verdict: 'approach' }), row({ id: 'p4', verdict: 'not_for_us' }), row({ id: 'p5', plumber_permit_on: '2026-11-07' }), row({ id: 'p6', declared_value: 5_000 })]
    expect(placeCounts(rows, 25_000)).toEqual({ skim: 1, kept: 1, pursuing: 1, closed: 2 })
    expect(placeCounts(rows, 0)).toEqual({ skim: 2, kept: 1, pursuing: 1, closed: 2 })
    // The strip is the one count while the skim is open: the deck's number, and a held answer already counted.
    const places = { skim: 10, kept: 2, pursuing: 1, closed: 4 }
    expect(stripCounts(places, null)).toBe(places)
    expect(stripCounts(places, { mode: 'skim', left: 10, held: null })).toEqual(places)
    expect(stripCounts(places, { mode: 'skim', left: 9, held: 'keep' })).toEqual({ skim: 9, kept: 3, pursuing: 1, closed: 4 })
    expect(stripCounts(places, { mode: 'skim', left: 9, held: 'pass' })).toEqual({ skim: 9, kept: 2, pursuing: 1, closed: 5 })
    // A second look deals from Closed: a held keep leaves Closed for Kept, a held pass moves nothing.
    expect(stripCounts(places, { mode: 'second', left: 3, held: 'keep' })).toEqual({ skim: 10, kept: 3, pursuing: 1, closed: 3 })
    expect(stripCounts(places, { mode: 'second', left: 3, held: 'pass' })).toBe(places)
  })

  it('Kept opens on the ones to look at again today, then the longest kept, and sorts by whose they are', () => {
    const rows = [
      row({ id: 'new', verdict: 'look', verdict_at: '2026-11-09T12:00:00Z', verdict_for_user: 'sam' }),
      row({ id: 'old', verdict: 'look', verdict_at: '2026-11-03T12:00:00Z' }),
      row({ id: 'due', verdict: 'look', verdict_at: '2026-11-08T12:00:00Z', verdict_look_again_on: '2026-11-10', verdict_for_user: 'eve' }),
      row({ id: 'not-kept' }),
    ]
    expect(keptRows(rows, 25_000, 'everyone', 'eve', '2026-11-10').map((r) => r.id)).toEqual(['due', 'old', 'new'])
    expect(keptRows(rows, 25_000, 'mine', 'eve', '2026-11-10').map((r) => r.id)).toEqual(['due'])
    expect(keptRows(rows, 25_000, 'nobody', 'eve', '2026-11-10').map((r) => r.id)).toEqual(['old'])
    expect(keptChipCounts(rows, 25_000, 'eve', '2026-11-10')).toEqual({ everyone: 3, mine: 1, nobody: 1, again: 1 })
    expect(keptByWords(row({ verdict_by_name: 'Casey', verdict_for_name: 'Sam', verdict_at: '2026-11-10T08:00:00Z' }), '2026-11-10')).toBe('Marked to investigate by Casey for Sam, today')
    expect(keptByWords(row({ verdict_by_name: 'Casey', verdict_at: '2026-11-07T08:00:00Z' }), '2026-11-10')).toBe('Marked to investigate by Casey, for nobody yet, 3 days ago')
  })

  it('Closed sorts by why and finds a street, a builder or a number', () => {
    const rows = [
      row({ id: 'far', verdict: 'not_for_us', verdict_reason_code: 'too_far', verdict_at: '2026-11-09T10:00:00Z', address: '60 MILLRACE ROW' }),
      row({ id: 'sign', verdict: 'not_for_us', verdict_at: '2026-11-10T10:00:00Z', contact: 'Permit Runners of Texas' }),
      row({ id: 'dropped', verdict: 'not_for_us', verdict_reason_code: 'np_no_answer', verdict_at: '2026-11-10T11:00:00Z' }),
      row({ id: 'plumb', plumber: 'Blue Heron Plumbing', plumber_permit_on: '2026-11-08' }),
    ]
    expect(closedRows(rows, 25_000, 'passed', '').map((r) => r.id)).toEqual(['sign', 'far'])
    expect(closedRows(rows, 25_000, 'passed', 'millrace').map((r) => r.id)).toEqual(['far'])
    expect(closedRows(rows, 25_000, 'plumber', 'blue heron').map((r) => r.id)).toEqual(['plumb'])
    expect(closedChipCounts(rows, 25_000)).toEqual({ passed: 2, not_pursuing: 1, plumber: 1 })
    expect(pursuingRows([row({ id: 'a', verdict: 'approach', verdict_at: '2026-11-08T00:00:00Z' }), row({ id: 'b', verdict: 'approach', verdict_at: '2026-11-09T00:00:00Z' })], 0).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('writes a close-out a reader can read and a count can count', () => {
    expect(notPursuingVerdict('np_no_answer')).toEqual({ reason: 'Not pursuing: could not reach anyone.', reasonCode: 'np_no_answer' })
    expect(pursueReason('this_job')).toBe('Pursued for this job.')
    expect(pursueReason('next_jobs')).toBe('Pursued for their next jobs.')
    expect(pursueReason('both')).toBe('Pursued for this job and their next ones.')
  })
})

describe('builders', () => {
  it('names a builder by what the office called it, else the company on its newest permit', () => {
    expect(builderName(builder())).toBe('Ridgeway Builders')
    expect(builderName(builder({ name: 'Ridgeway' }))).toBe('Ridgeway')
    expect(builderName(builder({ sample_contact: 'Dana Whitlock' }))).toBe('Dana Whitlock')
    expect(builderName(builder({ sample_contact: null }))).toBe('ridgewaybuilders')
    expect(builderNameOfPermit(row())).toBe('Ridgeway Builders')
    expect(builderNameOfPermit(row({ builder_name: 'Ridgeway' }))).toBe('Ridgeway')
    expect(builderNameOfPermit(row({ contact: null }))).toBeNull()
  })

  it('finds who to get to know: three or more permits and never bid, and not a name that files for others', () => {
    expect(neverBid(builder({ permits: 3, bids: 0 }))).toBe(true)
    expect(neverBid(builder({ permits: 2, bids: 0 }))).toBe(false)
    expect(neverBid(builder({ permits: 9, bids: 1 }))).toBe(false)
    expect(neverBid(builder({ permits: 31, bids: 0, kind: 'files_for_others' }))).toBe(false)
    const rows = [builder({ mark: 'good' }), builder({ key: 'tallpine', sample_contact: 'Tall Pine Development', mark: 'avoid', bids: 0, permits: 5 }), builder({ key: 'juniper', sample_contact: 'Juniper Hospitality Group', bids: 0, permits: 3, plumber: null, plumber_jobs: 0 })]
    expect(builderChipCounts(rows)).toEqual({ all: 3, good: 1, avoid: 1, unmarked: 1, never_bid: 2 })
    expect(buildersShowing(rows, 'never_bid', '').map((r) => r.key)).toEqual(['tallpine', 'juniper'])
    expect(buildersShowing(rows, 'all', 'juniper').map((r) => r.key)).toEqual(['juniper'])
    expect(ourBidsWords(builder())).toBe('5 priced, 3 won')
    expect(ourBidsWords(builder({ bids: 2, won: 0 }))).toBe('2 priced, none won')
    expect(ourBidsWords(builder({ bids: 0, won: 0 }))).toBe('never')
    expect(plumberUsedWords(builder())).toBe('Blue Heron Plumbing on 2')
    expect(plumberUsedWords(builder({ plumber: null, plumber_jobs: 0 }))).toBe('nobody yet')
  })

  it("says how busy a builder is under the card's Who line", () => {
    expect(builderLine(row({ builder_permits: 4, builder_open: 2 }), 'since Aug 26')).toBe('4 permits since Aug 26. 2 have no plumber yet.')
    expect(builderLine(row({ builder_permits: 4, builder_open: 1 }), 'since Aug 26')).toBe('4 permits since Aug 26. 1 has no plumber yet.')
    expect(builderLine(row({ builder_permits: 4, builder_open: 0 }), 'in the last year')).toBe('4 permits in the last year. A plumber is on every one.')
    expect(builderLine(row({ builder_permits: 1, builder_open: 1 }), 'since Aug 26')).toBe('Their one permit since Aug 26.')
    // The start of the records not known: no span is claimed.
    expect(builderLine(row({ builder_permits: 4, builder_open: 2 }), null)).toBe('4 permits we can see. 2 have no plumber yet.')
    expect(builderLine(row({ builder_permits: 1, builder_open: 1 }), null)).toBe('Their one permit we can see.')
    expect(builderLine(row(), 'since Aug 26')).toBeNull()
  })

  it('holds a good and an avoid with no reason, and lets a mark be cleared with none', () => {
    expect(markHold('avoid', '  ')).toBe('Say why in a line. Every estimator reads it on the card.')
    expect(markHold('good', 'Pays on time.')).toBeNull()
    expect(markHold('none', '')).toBeNull()
  })

  it("hands the skim's score each builder's mark and the names that file for others", () => {
    const ctx = skimBuilderContext([row({ id: 'a', builder_mark: 'good' }), row({ id: 'b', builder_kind: 'files_for_others' }), row({ id: 'c' })])
    expect([...(ctx.marks ?? [])]).toEqual([['a', 'good']])
    expect([...(ctx.filesForOthers ?? [])]).toEqual(['b'])
  })
})

describe('the nudge and the count', () => {
  it('says how many wait and how long the oldest has, and asks the Leader first', () => {
    expect(nudgeWords(14, 3)).toEqual({ title: '14 permits wait on a skim', detail: 'The oldest has waited 3 days. About a minute.' })
    expect(nudgeWords(1, 1)).toEqual({ title: '1 permit waits on a skim', detail: 'The oldest has waited 1 day. About a minute.' })
    expect(nudgeWords(2, 0)?.detail).toBe('The oldest arrived today. About a minute.')
    expect(nudgeWords(2, null)?.detail).toBe('About a minute.')
    expect(nudgeWords(0, null)).toBeNull()
    expect(nudgeAsks('master_technician', 0)).toBe(true)
    expect(nudgeAsks('dev', null)).toBe(true)
    expect(nudgeAsks('estimator', 1)).toBe(false)
    expect(nudgeAsks('estimator', 2)).toBe(true)
    expect(nudgeAsks('assistant', 5)).toBe(true)
    expect(nudgeAsks('assistant', null)).toBe(false)
  })

  it('reads the count as six numbers and the lines under them', () => {
    const f: PermitFunnel = {
      since: '2026-11-01', arrived: 212, skimmed: 198, kept: 31, passed: 160, pursuing: 7, has_plumber: 0, bid: 3, won: 1,
      by_person: [{ name: 'Sam', n: 120 }, { name: 'Jordan', n: 69 }, { name: 'Casey', n: 9 }],
      pass_reasons: [{ code: 'not_our_work', n: 88 }, { code: 'too_small', n: 41 }, { code: 'none', n: 16 }, { code: 'np_no_answer', n: 2 }],
      pursue_for: [{ code: 'this_job', n: 4 }, { code: 'next_jobs', n: 3 }],
    }
    expect(funnelTiles(f).map((t) => `${t.n} ${t.words}`)).toEqual(['212 arrived', '198 skimmed', '31 investigating', '7 pursuing', '3 bid', '1 won'])
    expect(funnelLines(f)).toEqual([
      { label: 'Skimmed by', words: 'Sam 120 · Jordan 69 · Casey 9' },
      { label: 'Passed, why', words: 'not our work 88 · too small 41 · no reason given 16 · could not reach anyone 2' },
      { label: 'Pursued for', words: 'this job 4 · their next jobs 3' },
    ])
    expect(funnelVerdict(f)).toBeNull()
    expect(funnelVerdict({ ...f, pursuing: 0 })).toBe('Nothing skimmed has been pursued yet.')
    expect(funnelVerdict({ ...f, skimmed: 0 })).toBe('Nothing has been skimmed since then.')
    expect(funnelLines({ ...f, by_person: [], pass_reasons: [], pursue_for: [] })).toEqual([])
    // A second look's passes read as such on the count.
    expect(funnelLines({ ...f, by_person: [], pursue_for: [], pass_reasons: [{ code: 'sl_too_far', n: 2 }, { code: 'sl_none', n: 1 }] })).toEqual([{ label: 'Passed, why', words: 'too far, on a second look 2 · passed twice, no reason given 1' }])
  })
})
