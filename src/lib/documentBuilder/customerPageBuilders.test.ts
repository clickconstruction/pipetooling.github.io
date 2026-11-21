import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { customerBuildersFrom, customerBuilderWords, placeCustomerBuilders, type CustomerBuilder } from './customerPageBuilders'
import { SECRECY_PAPER_FIXTURE } from './secrecyPaper.fixture'

/** A builder as the customer portal answers it. Every name is made up, and the contents are the placeholder fixture. */
const sent = (over: Record<string, unknown> = {}) => ({ sendId: 's1', builderKey: 'sub-nda', aboutJobId: null, aboutJob: null, revision: 2, contents: JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)), openedOn: null, opened: false, changed: false, ...over })
const builder = (over: Partial<CustomerBuilder> = {}): CustomerBuilder => ({ ...(customerBuildersFrom([sent()])[0] as CustomerBuilder), ...over })

describe('the builders out of the customer portal\u2019s answer', () => {
  it('reads each one sent, with the job it is about and the paper as published', () => {
    const got = customerBuildersFrom([sent(), sent({ sendId: 's2', aboutJobId: 'j1', aboutJob: ' Pike Street clinic · Job 1180 ', openedOn: '2026-11-21', opened: true })])
    expect(got).toHaveLength(2)
    expect(got[0]).toMatchObject({ sendId: 's1', builderKey: 'sub-nda', aboutJobId: null, aboutJob: null, revision: 2, openedOn: null, opened: false, changed: false })
    expect(got[0]?.def.title).toBe(SECRECY_PAPER_FIXTURE.title)
    expect(got[1]).toMatchObject({ aboutJobId: 'j1', aboutJob: 'Pike Street clinic · Job 1180', openedOn: '2026-11-21', opened: true })
  })

  it('reads none from an older function, and never half a builder', () => {
    expect(customerBuildersFrom(undefined)).toEqual([])
    expect(customerBuildersFrom('builders')).toEqual([])
    expect(customerBuildersFrom([null, {}, sent({ sendId: '' }), sent({ revision: '2' }), sent({ contents: { title: 'Not a whole paper' } })])).toEqual([])
    // A job's label with no job id is dropped: the builder sits with all their jobs.
    expect(customerBuildersFrom([sent({ aboutJob: 'A label with no job' })])[0]).toMatchObject({ aboutJobId: null, aboutJob: null })
    expect(customerBuildersFrom([sent({ openedOn: 'yesterday' })])[0]?.openedOn).toBeNull()
  })
})

describe('where a builder sits on a GC\u2019s page', () => {
  const all = builder({ sendId: 'a' })
  const pike = builder({ sendId: 'p', aboutJobId: 'j1', aboutJob: 'Pike Street clinic · Job 1180' })
  const harbor = builder({ sendId: 'h', aboutJobId: 'j2', aboutJob: 'Harbor annex · Job 1204' })

  it('is at the top when it is about all their jobs, and under its job when it is about one', () => {
    const placed = placeCustomerBuilders([pike, all, harbor], ['j1', 'j2'])
    expect(placed.top).toEqual([all])
    expect(placed.byJob).toEqual([
      { jobId: 'j1', job: 'Pike Street clinic · Job 1180', builders: [pike] },
      { jobId: 'j2', job: 'Harbor annex · Job 1204', builders: [harbor] },
    ])
  })

  it('keeps the page\u2019s own order of jobs, and puts a job the page does not list after, by its label', () => {
    expect(placeCustomerBuilders([pike, harbor], ['j2', 'j1']).byJob.map((j) => j.jobId)).toEqual(['j2', 'j1'])
    expect(placeCustomerBuilders([pike, harbor]).byJob.map((j) => j.jobId)).toEqual(['j2', 'j1'])
    expect(placeCustomerBuilders([pike, harbor], ['j1']).byJob.map((j) => j.jobId)).toEqual(['j1', 'j2'])
    expect(placeCustomerBuilders([])).toEqual({ top: [], byJob: [] })
  })
})

describe('the words of a builder\u2019s block', () => {
  it('speaks of all their jobs, or of this job', () => {
    expect(customerBuilderWords(builder(), 'Made-up Plumbing')).toEqual({
      title: 'Secrecy on your jobs',
      chip: { tone: 'new', words: 'New' },
      says: 'See how Made-up Plumbing binds the people it brings onto your jobs. Pick a level and read what it asks.',
      open: 'Open the Sub NDA builder',
      close: 'Close the builder',
      fine: 'You can look. Nothing is sent.',
    })
    const job = customerBuilderWords(builder({ aboutJobId: 'j1' }), 'Made-up Plumbing')
    expect(job.title).toBe('Secrecy on this job')
    expect(job.says).toBe('See how Made-up Plumbing binds the people it brings onto this job. Pick a level and read what it asks.')
  })

  it('is new until they open it, says the day they did, and says it changed after a newer revision', () => {
    const opened = customerBuilderWords(builder({ opened: true, openedOn: '2026-11-21' }), 'Made-up Plumbing')
    expect(opened.chip).toBeNull()
    expect(opened.fine).toBe('You opened this on Nov 21. You can look. Nothing is sent.')
    expect(customerBuilderWords(builder({ opened: false, changed: true, openedOn: '2026-11-21' }), 'Made-up Plumbing').chip).toEqual({ tone: 'changed', words: 'Changed since you opened it' })
  })

  it('reads in plain words', () => {
    const w = customerBuilderWords(builder({ opened: true, openedOn: '2026-11-21' }), 'a company')
    expect([w.title, w.says, w.open, w.close, w.fine, 'Changed since you opened it'].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
