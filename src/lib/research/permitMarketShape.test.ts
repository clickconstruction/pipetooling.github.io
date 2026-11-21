import { describe, expect, it } from 'vitest'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import type { MarketPermit } from './permitMarket'
import { builderTies, builderTiesWords, noValueBandsWords, permitsByKind, permitsByMonth, plumbersByJobs, tieOf, valueBands, valueBandsWords } from './permitMarketShape'

/** Every company, person and number here is made up. */
const TODAY = '2026-11-19'

type Job = { filed_on: string | null; plumber: string | null; builder_key: string | null; builder_name: string | null; contact: string | null }
const job = (builder: string, plumber: string | null, over: Partial<Job> = {}): Job => ({ filed_on: '2026-10-01', plumber, builder_key: builder.toLowerCase().replace(/[^a-z0-9]/g, ''), builder_name: null, contact: builder, ...over })
const jobs = (builder: string, plumbers: Array<string | null>): Job[] => plumbers.map((p) => job(builder, p))

describe('plumbersByJobs', () => {
  const rows = [
    ...jobs('Ridgeway Builders', ['Copperline Mechanical', 'COPPERLINE MECHANICAL LLC', 'Copperline Mechanical', 'Blue Heron Plumbing']),
    ...jobs('Tall Pine Development', ['Blue Heron Plumbing', 'Quill Plumbing', null]),
    // Over a year old, and a row with no day.
    job('Lime Build', 'Quill Plumbing', { filed_on: '2025-11-18' }),
    job('Lime Build', 'Quill Plumbing', { filed_on: null }),
  ]

  it('counts the jobs each named plumber is on, two spellings of one name as one', () => {
    expect(plumbersByJobs(rows, TODAY)).toEqual({
      jobs: 6,
      top: [
        { key: 'copperlinemechanical', name: 'Copperline Mechanical', jobs: 3 },
        { key: 'blueheronplumbing', name: 'Blue Heron Plumbing', jobs: 2 },
        { key: 'quillplumbing', name: 'Quill Plumbing', jobs: 1 },
      ],
      others: { plumbers: 0, jobs: 0 },
    })
  })

  it('folds the plumbers past the top few into one line', () => {
    const board = plumbersByJobs(rows, TODAY, 1)
    expect(board.top.map((p) => p.name)).toEqual(['Copperline Mechanical'])
    expect(board.others).toEqual({ plumbers: 2, jobs: 3 })
  })

  it('is empty where no permit names a plumber', () => {
    expect(plumbersByJobs(jobs('Ridgeway Builders', [null, null]), TODAY)).toEqual({ jobs: 0, top: [], others: { plumbers: 0, jobs: 0 } })
  })
})

describe('builderTies', () => {
  it('judges a builder on three or more named jobs: three in four uses one, half leans, fewer shops around', () => {
    expect(tieOf(3, 4)).toBe('uses_one')
    expect(tieOf(3, 3)).toBe('uses_one')
    expect(tieOf(2, 4)).toBe('leans')
    expect(tieOf(2, 3)).toBe('leans')
    expect(tieOf(1, 3)).toBe('shops')
    expect(tieOf(2, 5)).toBe('shops')
  })

  it('splits the builders, and names the ones that shop around', () => {
    const rows = [
      ...jobs('Ridgeway Builders', ['Copperline Mechanical', 'Copperline Mechanical', 'Copperline Mechanical', 'Blue Heron Plumbing']),
      ...jobs('Tall Pine Development', ['Blue Heron Plumbing', 'Blue Heron Plumbing', 'Quill Plumbing', 'Copperline Mechanical']),
      ...jobs('Harbor Fitouts', ['Blue Heron Plumbing', 'Quill Plumbing', 'Copperline Mechanical', 'Aster Plumbing', 'Aster Plumbing LLC']),
      ...jobs('Juniper Hospitality Group', ['Quill Plumbing', 'Copperline Mechanical', 'Aster Plumbing']),
      // Two named jobs is too few to judge, and an unnamed job is no named job.
      ...jobs('Lime Build', ['Quill Plumbing', 'Aster Plumbing', null, null]),
    ]
    const ties = builderTies(rows, TODAY)
    expect(ties).toMatchObject({ judged: 4, usesOne: 1, leans: 1, shops: 2 })
    expect(ties.shoppers).toEqual([
      { key: 'harborfitouts', name: 'Harbor Fitouts', jobs: 5, plumbers: 4 },
      { key: 'juniperhospitalitygroup', name: 'Juniper Hospitality Group', jobs: 3, plumbers: 3 },
    ])
    expect(plainSentence(builderTiesWords(ties))).toBe('Of 4 builders with 3 or more named jobs: 1 uses one plumber nearly every time, 1 leans to one and 2 shop around. The ones that shop around are the open doors.')
    // Values in place: the four counts are the sentence's values.
    expect(sentenceParts(builderTiesWords(ties)).filter((p) => typeof p !== 'string')).toEqual([
      { kind: 'judged', text: '4 builders' },
      { kind: 'uses_one', text: '1' },
      { kind: 'leans', text: '1' },
      { kind: 'shops', text: '2' },
    ])
  })

  it('says so when no builder can be judged', () => {
    const ties = builderTies(jobs('Lime Build', ['Quill Plumbing', 'Aster Plumbing']), TODAY)
    expect(ties.judged).toBe(0)
    expect(builderTiesWords(ties)).toBe('No builder has 3 or more jobs with a named plumber yet, so none can be judged.')
  })
})

describe('how much is being built', () => {
  const permit = (over: Partial<MarketPermit> = {}): MarketPermit => ({ builder_key: 'ridgewaybuilders', stage: 'issued', work_type: 'Commercial remodel', submitted_on: null, issued_on: '2026-10-01', declared_value: null, address_key: null, ...over })

  it('counts the whole months of the year, and leaves this month out', () => {
    const permits = [permit({ issued_on: '2025-11-25' }), permit({ issued_on: '2025-12-02' }), permit({ issued_on: '2026-10-01' }), permit({ issued_on: '2026-10-30' }), permit({ issued_on: null, submitted_on: '2026-10-31', stage: 'applied' }), permit({ issued_on: '2026-11-03' })]
    const months = permitsByMonth(permits, TODAY, '2025-01-01')
    expect(months.map((m) => m.label)).toEqual(['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'])
    expect(months[0]).toEqual({ ym: '2025-12', label: 'Dec', n: 1 })
    expect(months[months.length - 1]).toEqual({ ym: '2026-10', label: 'Oct', n: 3 })
    expect(months[3]?.n).toBe(0)
  })

  it('starts at the first whole month the records cover', () => {
    expect(permitsByMonth([permit({ issued_on: '2026-09-15' })], TODAY, '2026-08-27').map((m) => [m.label, m.n])).toEqual([['Sep', 1], ['Oct', 0]])
    // Records that start on the first of a month hold that month whole.
    expect(permitsByMonth([], TODAY, '2026-08-01').map((m) => m.label)).toEqual(['Aug', 'Sep', 'Oct'])
    // Records younger than a month cover no whole month.
    expect(permitsByMonth([], TODAY, '2026-10-20')).toEqual([])
    expect(permitsByMonth([], '2026-01-10', null).map((m) => m.label)).toEqual(['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
  })

  it('counts by kind: an application is its own kind, an issued permit the work it names', () => {
    const permits = [permit({ stage: 'applied', work_type: 'Commercial project' }), permit({ stage: 'applied', work_type: 'Commercial project' }), permit(), permit({ work_type: 'New commercial' }), permit({ work_type: 'New commercial' }), permit({ work_type: null })]
    expect(permitsByKind(permits)).toEqual([
      { kind: 'Applications', n: 2 },
      { kind: 'New commercial', n: 2 },
      { kind: 'Commercial remodel', n: 1 },
      { kind: 'Other', n: 1 },
    ])
  })

  it('reads how big from the permits that carry a value', () => {
    const values = Array.from({ length: 40 }, (_, i) => 60_000 * (i + 1))
    const bands = valueBands([...values.map((v) => permit({ declared_value: v })), permit({ declared_value: null }), permit({ declared_value: 0 })])
    expect(bands).toEqual({ valued: 40, ge250k: 36, ge1m: 24, median: 1_230_000 })
    expect(plainSentence(valueBandsWords(bands as never))).toBe('Of 40 with a value on the permit: 36 are $250k or more, 24 are $1M or more. The middle one is $1.2M.')
    expect(sentenceParts(valueBandsWords(bands as never)).filter((p) => typeof p !== 'string')).toEqual([
      { kind: 'valued', text: '40' },
      { kind: 'ge250k', text: '36' },
      { kind: 'ge1m', text: '24' },
      { kind: 'median', text: '$1.2M' },
    ])
  })

  it('draws no size where the values are missing or repeat one figure', () => {
    const round = Array.from({ length: 30 }, () => permit({ declared_value: 1_000_000 }))
    expect(valueBands(round)).toBeNull()
    expect(noValueBandsWords('Austin', round)).toBe('Austin’s declared values repeat one figure too often to trust, so no size is drawn.')
    expect(valueBands([permit()])).toBeNull()
    expect(noValueBandsWords('Seguin', [permit()])).toBe('Seguin’s permits carry no declared value, so no size is drawn.')
  })
})
