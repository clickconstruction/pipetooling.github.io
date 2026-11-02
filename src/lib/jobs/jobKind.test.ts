import { describe, expect, it } from 'vitest'
import {
  filterJobsByKind,
  jobKind,
  jobKindChip,
  jobKindCounts,
  jobKindFacts,
  jobKindForNewJob,
  jobKindOfRow,
  jobKindPatch,
  normalizeJobKind,
  parseStagesKindFilter,
  stagesKindFilterOptionLabel,
  type JobKindFixture,
} from './jobKind'

const stage = (id: string, name: string, order: number): JobKindFixture => ({ id, name, count: 1, line_unit_price: 1000, sequence_order: order, stage_kind: 'any' })

describe('jobKind — the precedence the card lists', () => {
  it('reads only the two kinds; anything else is unset', () => {
    expect([normalizeJobKind('service'), normalizeJobKind('project'), normalizeJobKind(''), normalizeJobKind(null), normalizeJobKind('construction')]).toEqual(['service', 'project', null, null, null])
  })

  it('the explicit kind wins over every signal and is settled', () => {
    const read = jobKind({ kind: 'service', bid_id: 'b1', project_id: 'p1', revenue: 112000, firstWorkDate: null, fixtures: [stage('a', 'Rough In', 0), stage('b', 'Top Out', 1)] })
    expect(read).toMatchObject({ kind: 'service', source: 'explicit', settled: true })
    expect(jobKind({ kind: 'project', hcp_number: '9057' })).toMatchObject({ kind: 'project', source: 'explicit', settled: true })
  })

  it('a price on the job and no work yet is a project: the price was known before the work', () => {
    const read = jobKind({ revenue: 112000, firstWorkDate: null, hcp_number: '9024' })
    expect(read).toMatchObject({ kind: 'project', source: 'priced_before_work', settled: false })
    expect(read.reason).toBe('Project · priced $112,000 before the work.')
  })

  it('the same price from a bid names the bid: the mock-up words on New Job, where no work has happened yet', () => {
    const read = jobKind({ revenue: 112000, firstWorkDate: null, bid_id: 'b1', bidNumber: 'B917' })
    expect(read).toMatchObject({ kind: 'project', source: 'priced_before_work', reason: 'Project · priced $112,000 from bid B917.' })
    expect(jobKind({ revenue: 112000, firstWorkDate: null, bid_id: 'b1' }).reason).toBe('Project · priced $112,000 from its bid.')
  })

  it('a price set before the first day of work is a project; on or after it a service call', () => {
    expect(jobKind({ revenue: 4200, pricedOn: '2026-10-01', firstWorkDate: '2026-10-03' })).toMatchObject({ kind: 'project', source: 'priced_before_work' })
    const same = jobKind({ revenue: 850, pricedOn: '2026-10-03', firstWorkDate: '2026-10-03' })
    expect(same).toMatchObject({ kind: 'service', source: 'priced_with_work' })
    expect(same.reason).toBe('Service call · priced $850 with the work.')
    expect(jobKind({ revenue: 850, pricedOn: '2026-10-09', firstWorkDate: '2026-10-03' })).toMatchObject({ kind: 'service', source: 'priced_with_work' })
  })

  it('a priced job already worked, with no memory of when it was priced, falls to its other signals', () => {
    // The row never remembers the day the price was typed: the bid, the stages or the number decide.
    expect(jobKind({ revenue: 9000, firstWorkDate: '2026-09-01', bid_id: 'b1', bidNumber: 'B917' })).toMatchObject({ kind: 'project', source: 'bid' })
    expect(jobKind({ revenue: 9000, firstWorkDate: '2026-09-01', hcp_number: '9024' })).toMatchObject({ kind: 'service', source: 'hcp' })
    expect(jobKind({ revenue: 9000, firstWorkDate: '2026-09-01', click_number: '1031' })).toMatchObject({ kind: null, source: null })
  })

  it('an unknown first day of work skips the price rule rather than guessing', () => {
    expect(jobKind({ revenue: 9000, click_number: '1031' })).toMatchObject({ kind: null, source: null })
    expect(jobKind({ revenue: 9000, hcp_number: '9024' })).toMatchObject({ kind: 'service', source: 'hcp' })
  })

  it('a bid behind the job is a project, with the amount and the bid number in the reason', () => {
    expect(jobKind({ bid_id: 'b1', bidNumber: 'B917', revenue: 112000, firstWorkDate: '2026-09-01' }).reason).toBe('Project · priced $112,000 from bid B917.')
    expect(jobKind({ bid_id: 'b1', firstWorkDate: '2026-09-01' }).reason).toBe('Project · priced from its bid.')
    expect(jobKind({ bid_id: 'b1', revenue: 0, firstWorkDate: '2026-09-01' })).toMatchObject({ kind: 'project', source: 'bid' })
  })

  it('a bare bid number takes its B, the way the board prints it', () => {
    expect(jobKind({ bid_id: 'b1', bidNumber: '917', firstWorkDate: '2026-09-01' }).reason).toBe('Project · priced from bid B917.')
    expect(jobKind({ bid_id: 'b1', bidNumber: ' BP287 ', firstWorkDate: '2026-09-01' }).reason).toBe('Project · priced from bid BP287.')
  })

  it('a billing-only job is a project whatever its price says: it carries a GC project\'s bills and nobody clocks on it', () => {
    const read = jobKind({ billingOnly: true, hcp_number: '9024', revenue: 56000, firstWorkDate: null })
    expect(read).toMatchObject({ kind: 'project', source: 'billing_only', reason: 'Project · the bills of a GC project we build.', settled: false })
    expect(jobKind({ billingOnly: true, revenue: 0, firstWorkDate: null })).toMatchObject({ kind: 'project', source: 'billing_only' })
    expect(jobKind({ billingOnly: true, kind: 'service' })).toMatchObject({ kind: 'service', source: 'explicit' })
  })

  it('a GC project behind the job is a project', () => {
    expect(jobKind({ project_id: 'p1', hcp_number: '9024', firstWorkDate: '2026-09-01' })).toMatchObject({ kind: 'project', source: 'gc_project', reason: 'Project · a GC project we build.' })
  })

  it('Stage Plan rows make a project: an explicit Order row, or stage words in order', () => {
    expect(jobKind({ fixtures: [{ id: 'a', name: 'Rough In', count: 1, line_unit_price: 5000, sequence_order: 0, stage_kind: 'order' }], hcp_number: '9024', firstWorkDate: '2026-09-01' })).toMatchObject({ kind: 'project', source: 'stages' })
    expect(jobKind({ fixtures: [stage('a', 'Rough In', 0), stage('b', 'Top Out', 1), stage('c', 'Trim Set', 2)], hcp_number: '9024', firstWorkDate: '2026-09-01' })).toMatchObject({ kind: 'project', source: 'stages' })
    // Three service lines are not stages; one stage word alone is not a plan.
    expect(jobKind({ fixtures: [stage('a', 'Diagnostic', 0), stage('b', 'Parts', 1), stage('c', 'Labor', 2)], hcp_number: '9024', firstWorkDate: '2026-09-01' })).toMatchObject({ kind: 'service', source: 'hcp' })
    expect(jobKind({ fixtures: [stage('a', 'Rough In', 0)], click_number: '1031', firstWorkDate: '2026-09-01' })).toMatchObject({ kind: null })
  })

  it('fixtures not loaded skip the stages rule', () => {
    expect(jobKind({ fixtures: undefined, hcp_number: '9024', firstWorkDate: '2026-09-01' })).toMatchObject({ kind: 'service', source: 'hcp' })
    expect(jobKind({ fixtures: null, click_number: '1031', firstWorkDate: '2026-09-01' })).toMatchObject({ kind: null })
  })

  it('an HCP number with none of those is a service call, priced when done', () => {
    expect(jobKind({ hcp_number: '9057', click_number: '', firstWorkDate: null })).toMatchObject({ kind: 'service', source: 'hcp', reason: 'Service call · priced when done.' })
    expect(jobKind({ hcp_number: '  ', click_number: '1031', firstWorkDate: null })).toMatchObject({ kind: null })
  })

  it('nothing settles it: not set, with the sentence the control shows', () => {
    const read = jobKind({ click_number: '1031', firstWorkDate: null })
    expect(read).toEqual({ kind: null, source: null, reason: 'No price before the work, no bid, no stages: your call.', settled: false })
  })
})

describe('jobKindFacts — a ledger row', () => {
  it('reads the row loosely, the bid number from the embed, and never a priced-on day', () => {
    const facts = jobKindFacts({ kind: 'project', hcp_number: '9024', click_number: '', bid_id: 'b1', project_id: null, revenue: '112000', first_work_date: null, fixtures: [], linkedBid: { bid_number: 'B917' } })
    expect(facts).toEqual({ kind: 'project', hcp_number: '9024', click_number: '', bid_id: 'b1', project_id: null, bidNumber: 'B917', fixtures: [], revenue: '112000', firstWorkDate: null, billingOnly: null })
    expect(facts.pricedOn).toBeUndefined()
  })

  it('a row that never loaded first_work_date or fixtures leaves them unknown', () => {
    const facts = jobKindFacts({ hcp_number: '9024' })
    expect(facts.firstWorkDate).toBeUndefined()
    expect(facts.fixtures).toBeUndefined()
    expect(jobKindOfRow({ hcp_number: '9024', revenue: 500 })).toMatchObject({ kind: 'service', source: 'hcp' })
  })

  it('a row with a price and no approved work reads as a project until the office says otherwise', () => {
    expect(jobKindOfRow({ click_number: '1050', revenue: 56000, first_work_date: null })).toMatchObject({ kind: 'project', source: 'priced_before_work' })
    expect(jobKindOfRow({ kind: 'service', click_number: '1050', revenue: 56000, first_work_date: null })).toMatchObject({ kind: 'service', source: 'explicit' })
  })

  it('a blank first day on a job past the work skips the price rule: the clock never saw it, and the price may have come at billing', () => {
    for (const status of ['ready_to_bill', 'billed', 'paid']) {
      expect(jobKindFacts({ status, first_work_date: null }).firstWorkDate).toBeUndefined()
      expect(jobKindOfRow({ status, hcp_number: '9024', revenue: 850, first_work_date: null })).toMatchObject({ kind: 'service', source: 'hcp' })
      expect(jobKindOfRow({ status, click_number: '1050', revenue: 850, first_work_date: null })).toMatchObject({ kind: null, source: null })
      expect(jobKindOfRow({ status, bid_id: 'b1', revenue: 850, first_work_date: null })).toMatchObject({ kind: 'project', source: 'bid' })
    }
    for (const status of ['waiting', 'working', null]) {
      expect(jobKindOfRow({ status, click_number: '1050', revenue: 850, first_work_date: null })).toMatchObject({ kind: 'project', source: 'priced_before_work' })
    }
    // A date is a date whatever the status: the rule was skipped for it already.
    expect(jobKindFacts({ status: 'paid', first_work_date: '2026-09-01' }).firstWorkDate).toBe('2026-09-01')
  })

  it('reads billing_only off the row', () => {
    expect(jobKindOfRow({ billing_only: true, click_number: '1050', first_work_date: null })).toMatchObject({ kind: 'project', source: 'billing_only' })
    expect(jobKindOfRow({ billing_only: false, click_number: '1050', first_work_date: null })).toMatchObject({ kind: null })
  })
})

describe('jobKindChip', () => {
  it('blue Project, green Service call, amber Kind not set, with the reason as the title', () => {
    expect(jobKindChip(jobKind({ bid_id: 'b1', firstWorkDate: '2026-09-01' }))).toEqual({ label: 'Project', tone: 'project', title: 'Project · priced from its bid.' })
    expect(jobKindChip(jobKind({ hcp_number: '9057', firstWorkDate: '2026-09-01' }))).toEqual({ label: 'Service call', tone: 'service', title: 'Service call · priced when done.' })
    expect(jobKindChip(jobKind({ click_number: '1031', firstWorkDate: '2026-09-01' }))).toEqual({ label: 'Kind not set', tone: 'unset', title: 'Kind not set. No price before the work, no bid, no stages: your call.' })
  })
})

describe('the board filter', () => {
  const rows = [
    { id: 'a', kind: 'project', hcp_number: '1' },
    { id: 'b', bid_id: 'b1', hcp_number: '2', first_work_date: '2026-09-01' },
    { id: 'c', hcp_number: '3', first_work_date: '2026-09-01' },
    { id: 'd', click_number: '4', first_work_date: '2026-09-01' },
    { id: 'e', kind: 'service', click_number: '5' },
  ]

  it('parses the three filters and nothing else', () => {
    expect([parseStagesKindFilter('project'), parseStagesKindFilter('service'), parseStagesKindFilter('unset'), parseStagesKindFilter('all'), parseStagesKindFilter(null)]).toEqual(['project', 'service', 'unset', '', ''])
  })

  it('keeps the rows the filter names and every row with none', () => {
    expect(filterJobsByKind(rows, '').map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(filterJobsByKind(rows, 'project').map((r) => r.id)).toEqual(['a', 'b'])
    expect(filterJobsByKind(rows, 'service').map((r) => r.id)).toEqual(['c', 'e'])
    expect(filterJobsByKind(rows, 'unset').map((r) => r.id)).toEqual(['d'])
  })

  it('counts each kind for the menu and words the option with its count', () => {
    const counts = jobKindCounts(rows)
    expect(counts).toEqual({ project: 2, service: 2, unset: 1 })
    expect(stagesKindFilterOptionLabel('unset', counts)).toBe('Kind not set · 1')
    expect(stagesKindFilterOptionLabel('project', null)).toBe('Projects')
  })
})

describe('the press', () => {
  it('writes the kind, or clears it', () => {
    expect(jobKindPatch('project')).toEqual({ kind: 'project' })
    expect(jobKindPatch(null)).toEqual({ kind: null })
  })

})

describe('jobKindForNewJob: what New Job saves with the job', () => {
  const newJob = { firstWorkDate: null }

  it('the office\'s press, whatever the signals say', () => {
    expect(jobKindForNewJob({ ...newJob, kind: 'service', bid_id: 'b1', revenue: 112000 })).toBe('service')
    expect(jobKindForNewJob({ ...newJob, kind: 'project', hcp_number: '9057' })).toBe('project')
  })

  it('no press and nothing settled writes nothing, so the job reads Kind not set', () => {
    expect(jobKindForNewJob({ ...newJob, click_number: '1031' })).toBeNull()
  })

  it('no press and a signal that stays true writes nothing: the signals read on and the press stays the office\'s', () => {
    expect(jobKindForNewJob({ ...newJob, hcp_number: '9057' })).toBeNull()
    expect(jobKindForNewJob({ ...newJob, project_id: 'p1' })).toBeNull()
    expect(jobKindForNewJob({ ...newJob, fixtures: [stage('a', 'Rough In', 0), stage('b', 'Top Out', 1)] })).toBeNull()
    expect(jobKindForNewJob({ ...newJob, bid_id: 'b1', bidNumber: 'B917' })).toBeNull()
  })

  it('a price before any work with its bid or its stages behind it writes nothing: they keep the read after the first day of work', () => {
    expect(jobKindForNewJob({ ...newJob, bid_id: 'b1', revenue: 112000 })).toBeNull()
    expect(jobKindForNewJob({ ...newJob, revenue: 9000, fixtures: [stage('a', 'Rough In', 0), stage('b', 'Top Out', 1)] })).toBeNull()
  })

  it('a price before any work that nothing else would keep is saved as a project: the row never remembers the day it was typed', () => {
    expect(jobKindForNewJob({ ...newJob, revenue: 4200, click_number: '1031' })).toBe('project')
    expect(jobKindForNewJob({ ...newJob, revenue: 4200, hcp_number: '9057' })).toBe('project')
  })
})
