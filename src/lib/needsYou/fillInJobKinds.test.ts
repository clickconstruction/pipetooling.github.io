import { describe, expect, it } from 'vitest'
import { needsYouDoor, type NeedsYouDoorData } from '../needsYouDoors'
import { needsYouActorOf } from '../needsYouActor'
import { needsYouSourceEnabled } from '../needsYouSources'
import {
  compareJobKindRows,
  jobKindBillWords,
  jobKindFillInRows,
  jobKindHours,
  jobKindHoursWords,
  jobKindLean,
  jobKindTrailWords,
  jobsWithNoKind,
  type JobKindFixtureSource,
  type JobKindJobSource,
  type JobKindSessionSource,
} from './fillInJobKinds'

const job = (over: Partial<JobKindJobSource> = {}): JobKindJobSource => ({
  id: 'j1',
  status: 'working',
  billing_only: false,
  kind: null,
  hcp_number: '',
  click_number: '1031',
  bid_id: null,
  project_id: null,
  revenue: 0,
  first_work_date: '2026-09-01',
  job_name: 'Lakeside duplex',
  job_address: '1 Test Lane',
  customer_name: 'Ridgeway Builders',
  created_at: '2026-09-01T12:00:00Z',
  ...over,
})

const session = (over: Partial<JobKindSessionSource> = {}): JobKindSessionSource => ({
  job_ledger_id: 'j1',
  user_id: 'u1',
  work_date: '2026-09-01',
  clocked_in_at: '2026-09-01T13:00:00Z',
  clocked_out_at: '2026-09-01T21:00:00Z',
  ...over,
})

const stageRow = (name: string, order: number): JobKindFixtureSource => ({ id: `f${order}`, job_id: 'j1', name, count: 1, line_unit_price: 1000, sequence_order: order, stage_kind: 'any' })

describe('jobsWithNoKind: who the line counts', () => {
  it('keeps a working job the kernel reads as not set, a blank status reading as working', () => {
    expect(jobsWithNoKind([job()], []).map((j) => j.id)).toEqual(['j1'])
    expect(jobsWithNoKind([job({ status: null })], [])).toHaveLength(1)
  })

  it('leaves out every other stage: the line is about the jobs working now', () => {
    for (const status of ['waiting', 'ready_to_bill', 'billed', 'paid']) expect(jobsWithNoKind([job({ status })], [])).toEqual([])
  })

  it('leaves out a job the signals or the office settle', () => {
    expect(jobsWithNoKind([job({ kind: 'service' })], [])).toEqual([])
    expect(jobsWithNoKind([job({ hcp_number: '9057' })], [])).toEqual([])
    expect(jobsWithNoKind([job({ bid_id: 'b1' })], [])).toEqual([])
    expect(jobsWithNoKind([job({ project_id: 'p1' })], [])).toEqual([])
    expect(jobsWithNoKind([job({ billing_only: true })], [])).toEqual([])
    expect(jobsWithNoKind([job({ revenue: 4200, first_work_date: null })], [])).toEqual([])
  })

  it('reads the stage rows it is given: a job with stages is a project, and one stage word is not a plan', () => {
    expect(jobsWithNoKind([job()], [stageRow('Rough In', 0), stageRow('Top Out', 1)])).toEqual([])
    expect(jobsWithNoKind([job()], [stageRow('Rough In', 0)])).toHaveLength(1)
  })

  it('keeps a priced job already worked: the row never remembers when its price was typed', () => {
    expect(jobsWithNoKind([job({ revenue: 56000, first_work_date: '2026-09-01' })], [])).toHaveLength(1)
  })
})

describe('what the hours say', () => {
  it('counts the closed sessions, the people and the span', () => {
    const h = jobKindHours([
      session(),
      session({ user_id: 'u2' }),
      session({ user_id: 'u1', work_date: '2026-10-12', clocked_in_at: '2026-10-12T13:00:00Z', clocked_out_at: '2026-10-12T17:00:00Z' }),
      session({ work_date: '2026-10-13', clocked_in_at: '2026-10-13T13:00:00Z', clocked_out_at: null }),
    ])
    expect(h).toEqual({ hours: 20, people: 2, spanDays: 43 })
    expect(jobKindHours([])).toBeNull()
  })

  it('words the hours in days under two weeks and weeks from there', () => {
    expect(jobKindHoursWords({ hours: 212.4, people: 3, spanDays: 42 })).toBe('Clocked 212 hours over 6 weeks by 3 people.')
    expect(jobKindHoursWords({ hours: 1, people: 1, spanDays: 1 })).toBe('Clocked 1 hour over 1 day by 1 person.')
    expect(jobKindHoursWords({ hours: 40, people: 2, spanDays: 13 })).toBe('Clocked 40 hours over 13 days by 2 people.')
    expect(jobKindHoursWords(null)).toBe('No approved clock time on it yet.')
  })

  it('leans to a project on three weeks and two people, to a service call on two days, and otherwise stays out', () => {
    expect(jobKindLean({ hours: 212, people: 3, spanDays: 42 })).toEqual({ kind: 'project', words: '6 weeks and 3 people on one job reads like a project. The press is yours.' })
    expect(jobKindLean({ hours: 212, people: 1, spanDays: 42 })).toBeNull()
    expect(jobKindLean({ hours: 40, people: 3, spanDays: 20 })).toBeNull()
    expect(jobKindLean({ hours: 3, people: 1, spanDays: 2 })).toEqual({ kind: 'service', words: '2 days on the job reads like a service call. The press is yours.' })
    expect(jobKindLean({ hours: 3, people: 1, spanDays: 3 })).toBeNull()
    expect(jobKindLean(null)).toBeNull()
  })
})

describe('what the billing says', () => {
  it('counts only the bills that went out, and names what is left', () => {
    expect(jobKindBillWords(56000, [{ job_id: 'j1', amount: 18000, status: 'billed' }, { job_id: 'j1', amount: 500, status: 'ready_to_bill' }])).toBe('Billed once, $18,000, with $38,000 left.')
    expect(jobKindBillWords(9000, [{ job_id: 'j1', amount: 4000, status: 'paid' }, { job_id: 'j1', amount: 5000, status: 'billed' }])).toBe('Billed twice, $9,000.')
    expect(jobKindBillWords(9000, [1, 2, 3].map(() => ({ job_id: 'j1', amount: 1000, status: 'billed' })))).toBe('Billed 3 times, $3,000, with $6,000 left.')
  })

  it('says when nothing went out, with or without a price', () => {
    expect(jobKindBillWords(4200, [])).toBe('Not billed yet, with $4,200 on the job.')
    expect(jobKindBillWords(0, [{ job_id: 'j1', amount: 100, status: 'ready_to_bill' }])).toBe('Not billed yet, and no price on the job.')
  })
})

describe('jobKindFillInRows: the card', () => {
  it('draws the money, the reason, the hours, the bills and the lean, with a door to the job', () => {
    const [row, ...rest] = jobKindFillInRows({
      jobs: [job({ revenue: 56000 })],
      fixtures: [],
      sessions: [session(), session({ user_id: 'u2' }), session({ user_id: 'u3', work_date: '2026-10-12' })],
      bills: [{ job_id: 'j1', amount: 18000, status: 'billed' }],
    })
    expect(rest).toEqual([])
    expect(row).toMatchObject({
      key: 'job-kind:j1',
      kind: 'job-kind',
      severity: 'gray',
      title: '#1031 Lakeside duplex · Ridgeway Builders · $56,000',
      doorHref: '/jobs?tab=stages&edit=j1',
      doorLabel: 'Open the job',
      jobId: 'j1',
      lean: 'project',
    })
    expect(row!.knows).toEqual([
      'No price before the work, no bid, no stages: your call.',
      'Clocked 24 hours over 6 weeks by 3 people.',
      'Billed once, $18,000, with $38,000 left.',
      '6 weeks and 3 people on one job reads like a project. The press is yours.',
    ])
  })

  it('a job with no clock time and no price still reads, with no lean', () => {
    const [row] = jobKindFillInRows({ jobs: [job({ first_work_date: null })], fixtures: [], sessions: [], bills: [] })
    expect(row!.title).toBe('#1031 Lakeside duplex · Ridgeway Builders')
    expect(row!.knows).toEqual(['No price before the work, no bid, no stages: your call.', 'No approved clock time on it yet.', 'Not billed yet, and no price on the job.'])
    expect(row!.lean).toBeNull()
  })

  it('a read that failed leaves its line out rather than say nothing happened', () => {
    const [row] = jobKindFillInRows({ jobs: [job()], fixtures: [], sessions: null, bills: null })
    expect(row!.knows).toEqual(['No price before the work, no bid, no stages: your call.'])
  })

  it('walks the newest job first', () => {
    const rows = jobKindFillInRows({
      jobs: [job({ id: 'old', created_at: '2026-08-01T12:00:00Z' }), job({ id: 'new', created_at: '2026-10-01T12:00:00Z' }), job({ id: 'none', created_at: null })],
      fixtures: [],
      sessions: [],
      bills: [],
    })
    expect(rows.map((r) => r.jobId)).toEqual(['new', 'old', 'none'])
    expect([...rows].sort(compareJobKindRows).map((r) => r.jobId)).toEqual(['new', 'old', 'none'])
  })

  it('says where the press landed', () => {
    expect(jobKindTrailWords('project')).toBe('Project · saved on the job')
    expect(jobKindTrailWords('service')).toBe('Service call · saved on the job')
  })
})

describe('the line around the deck', () => {
  it('is the office\'s, the assistant presses it, and its door is the board filtered to the jobs with no kind', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller'] as const) {
      expect(needsYouSourceEnabled('jobKindGaps', role, 'dashboard')).toBe(true)
      expect(needsYouSourceEnabled('jobKindGaps', role, 'quickfill')).toBe(true)
    }
    for (const role of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      expect(needsYouSourceEnabled('jobKindGaps', role, 'dashboard')).toBe(false)
    }
    expect(needsYouActorOf({ key: 'jobs-no-kind' })).toBe('assistant')
    expect(needsYouDoor({ key: 'jobs-no-kind' }, { role: 'assistant' } as NeedsYouDoorData, 'dashboard')).toEqual({ kind: 'href', href: '/jobs?tab=stages&kind=unset' })
  })
})
