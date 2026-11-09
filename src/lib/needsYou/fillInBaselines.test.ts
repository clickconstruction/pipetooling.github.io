import { describe, expect, it } from 'vitest'
import { baselineFillInRows, baselinePressWords, baselineRowRpcArgs, baselineTrailWords, projectsWithNoBaseline, type BaselineJobSource, type BaselineSources } from './fillInBaselines'
import { needsYouActorOf } from '../needsYouActor'
import { needsYouDoor, type NeedsYouDoorData } from '../needsYouDoors'
import { fillInKindOfItem } from './fillIn'
import type { BaselineRate } from '../bids/bidBaselineRates'

const job = (id: string, created: string, over: Partial<BaselineJobSource> = {}): BaselineJobSource => ({
  id,
  status: 'working',
  billing_only: false,
  kind: null,
  hcp_number: '',
  click_number: id,
  bid_id: null,
  project_id: null,
  revenue: 56_000,
  first_work_date: '2026-09-01',
  job_name: `Job ${id}`,
  job_address: null,
  customer_name: null,
  created_at: `${created}T12:00:00Z`,
  ...over,
})

const rate = (price: number, hours: number): BaselineRate => ({ job_id: `r${price}`, bid_id: null, kept_at: '2026-01-01', kept_on: 'billed', price_usd: price, team_hours: hours, hours_per_thousand: hours / (price / 1000), people_count: 2, grade: 'per_thousand' })
const book = [rate(40_000, 160), rate(60_000, 252), rate(80_000, 336), rate(50_000, 210)]

const sources = (): BaselineSources => ({
  jobs: [
    // A project from a bid whose Labor rows are usable: the bid is the pick.
    job('1031', '2026-08-01', { bid_id: 'b901', kind: 'project' }),
    // A project pressed, no bid, the book usable: the book is the pick.
    job('1042', '2026-09-01', { kind: 'project', customer_name: 'Ridgeway Builders' }),
    // A service call: never here.
    job('1050', '2026-09-02', { kind: 'service' }),
    // A project that already has a baseline: not here.
    job('1060', '2026-09-03', { kind: 'project' }),
    // Reads as a project from its bid, bid sent without hours, book usable.
    job('1070', '2026-09-04', { bid_id: 'b917', revenue: 112_000 }),
  ],
  fixtures: [],
  budgets: [{ job_id: '1060', kind: 'typed', labor_hours: 200 }],
  bids: [
    { bid_id: 'b901', bid_number: '901', breakdown: { has_estimate: true, labor_hours: 158, labor_rate: 42, labor_usd: 6_636, materials_usd: 20_000, completeness: { rows_total: 24, rows_with_hours: 22, rate_set: true, usable: true } } },
    { bid_id: 'b917', bid_number: '917', breakdown: { has_estimate: true, labor_hours: 71, labor_rate: 42, labor_usd: 2_982, materials_usd: 0, completeness: { rows_total: 31, rows_with_hours: 9, rate_set: true, usable: false } } },
  ],
  book,
})

describe('projectsWithNoBaseline', () => {
  it('keeps the working projects with no hours on a budget row, whatever its kind', () => {
    const s = sources()
    expect(projectsWithNoBaseline(s.jobs, s.fixtures, s.budgets).map((j) => j.id)).toEqual(['1031', '1042', '1070'])
    expect(projectsWithNoBaseline(s.jobs, s.fixtures, [{ job_id: '1031', kind: 'book', labor_hours: '470.4' }]).map((j) => j.id)).toEqual(['1042', '1060', '1070'])
    expect(projectsWithNoBaseline([job('1', '2026-01-01', { kind: 'project', status: 'billed' })], [], [])).toEqual([])
    // The $2,500 floor (the owner's second call of 2026-11-09): a $350 project never appears; one with no price yet still does.
    expect(projectsWithNoBaseline([job('2', '2026-01-01', { kind: 'project', revenue: 350 }), job('3', '2026-01-01', { kind: 'project', revenue: 2_500 }), job('4', '2026-01-01', { kind: 'project', revenue: null })], [], []).map((j) => j.id)).toEqual(['3', '4'])
  })
})

describe('baselineFillInRows', () => {
  const rows = baselineFillInRows(sources(), 45)
  it('newest first, each with what the app knows and the first usable source leading', () => {
    expect(rows.map((r) => r.jobId)).toEqual(['1070', '1042', '1031'])
    const late = rows[2]!
    expect(late.title).toBe('#1031 Job 1031 · $56,000')
    expect(late.pick).toBe('bid')
    expect(late.knows[0]).toBe('A project, made Aug 1, before baselines were written at award.')
    expect(late.knows[1]).toBe('B901 has hours on 22 of 24 rows: 158 h.')
    expect(late.knows[2]).toMatch(/^The book says 235 h: 4\.2 h per \$1k × \$56,000, from 4 similar projects\.$/)
    expect(baselinePressWords(late, 'bid')).toBe("Take B901's estimate · 158 h")
    expect(baselinePressWords(late, 'book')).toBe("Freeze the book's 235 h")
    expect(late.doorHref).toBe('/jobs?tab=stages&edit=1031')
  })
  it('a bid sent without hours leaves the book leading and says what would make the bid the pick', () => {
    const r = rows[0]!
    expect(r.pick).toBe('book')
    expect(r.knows[1]).toBe('Not usable: hours on 9 of 31 rows. Fill the Labor rows on B917 and this becomes the pick. The 9 rows carry 71 h.')
    expect(baselinePressWords(r, 'bid')).toBe('')
    expect(baselinePressWords(r, 'book')).toBe("Freeze the book's 470 h")
    expect(baselineRowRpcArgs(r, 'book')).toMatchObject({ p_job_id: '1070', p_source: 'book', p_labor_hours: 470.4, p_labor_rate: 42, p_book: { hours_per_thousand: 4.2, n: 4, price_usd: 112_000 } })
    expect(baselineRowRpcArgs(r, 'bid')).toBeNull()
  })
  it('no bid and no book: the door is the answer', () => {
    const s = { ...sources(), bids: null, book: null }
    const r = baselineFillInRows(s, 45).find((x) => x.jobId === '1042')!
    expect(r.pick).toBeNull()
    expect(r.knows).toEqual(['A project, made Sep 1, before baselines were written at award.', 'No bid is linked.', "Type a figure on the job's Costs tab, or fill the Labor rows on the bid."])
    expect(baselinePressWords(r, 'book')).toBe('')
    // A bid read that failed says so instead of judging the bid.
    const failed = baselineFillInRows({ ...sources(), bids: [] }, 45).find((x) => x.jobId === '1031')!
    expect(failed.knows[1]).toBe('The bid could not be read.')
  })
  it('the bid press writes the bid and the trail names the source', () => {
    const r = rows[2]!
    expect(baselineRowRpcArgs(r, 'bid')).toEqual({ p_job_id: '1031', p_source: 'bid', p_bid_id: 'b901', p_labor_hours: null, p_labor_rate: null, p_book: {}, p_note: null })
    expect(baselineTrailWords('bid', 158)).toBe('158 h from the bid · frozen as the baseline')
    expect(baselineTrailWords('book', 470.4)).toBe('470 h assumed from the book · frozen as the baseline')
  })
  it('is wired as a Needs you line: the assistant, a door, a deck kind', () => {
    expect(needsYouActorOf({ key: 'projects-no-baseline' })).toBe('assistant')
    expect(needsYouDoor({ key: 'projects-no-baseline' }, { role: 'assistant' } as NeedsYouDoorData, 'dashboard')).toEqual({ kind: 'href', href: '/jobs?tab=stages&kind=project' })
    expect(fillInKindOfItem('projects-no-baseline')).toBe('baseline')
  })
})
