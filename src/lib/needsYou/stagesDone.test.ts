import { describe, expect, it } from 'vitest'
import { STAGES_DONE_ACTION, stagesDone, stagesDoneDetail, stagesDoneHref, stagesDoneTitle, type StagesDoneJobSource, type StagesDoneLineSource } from './stagesDone'

/** Every job, name and figure here is made up. */
const job = (id: string, over: Partial<StagesDoneJobSource> = {}): StagesDoneJobSource => ({ id, hcp_number: null, click_number: '900', job_name: 'ZZ Test Oak', job_address: null, status: 'working', ...over })
const line = (id: string, job_id: string, over: Partial<StagesDoneLineSource> = {}): StagesDoneLineSource => ({ id, job_id, name: 'Rough In', count: 1, line_unit_price: 1000, line_kind: null, invoice_id: null, progress_pct: null, ...over })

describe('stagesDone', () => {
  it('lists a stage at 100% with no bill on a Working job that has stages', () => {
    const d = stagesDone([job('j1')], [line('a', 'j1', { progress_pct: 100, line_unit_price: 14_400 }), line('b', 'j1', { name: 'Top Out', progress_pct: 40 })])
    expect(d.rows).toEqual([{ fixtureId: 'a', jobId: 'j1', jobLabel: '#900 ZZ Test Oak', name: 'Rough In', priceUsd: 14_400 }])
    expect(d.usd).toBe(14_400)
    expect(d.jobIds).toEqual(['j1'])
  })

  it('reads a percent that came back as text, and one over 100', () => {
    const d = stagesDone([job('j1')], [line('a', 'j1', { progress_pct: '100.00' }), line('b', 'j1', { name: 'Top Out', progress_pct: 120 })])
    expect(d.rows.map((r) => r.fixtureId).sort()).toEqual(['a', 'b'])
  })

  it('leaves a stage under 100%, and one nobody put a percent on', () => {
    const d = stagesDone([job('j1')], [line('a', 'j1', { progress_pct: 99 }), line('b', 'j1', { progress_pct: null })])
    expect(d.rows).toEqual([])
  })

  it('leaves a stage that is already on a bill', () => {
    const d = stagesDone([job('j1')], [line('a', 'j1', { progress_pct: 100, invoice_id: 'inv1' }), line('b', 'j1', { progress_pct: 10 })])
    expect(d.rows).toEqual([])
  })

  it('leaves a job on one line: its 100% is the whole job, and Ready to Bill covers it', () => {
    expect(stagesDone([job('j1')], [line('a', 'j1', { progress_pct: 100 })]).rows).toEqual([])
    // A discount and a $0 line are not stages, so they do not make a second one.
    expect(stagesDone([job('j1')], [line('a', 'j1', { progress_pct: 100 }), line('d', 'j1', { line_kind: 'discount', line_unit_price: -50 }), line('z', 'j1', { line_unit_price: 0 })]).rows).toEqual([])
  })

  it('never lists a discount or a $0 line, even at 100%', () => {
    const d = stagesDone([job('j1')], [line('a', 'j1'), line('b', 'j1', { name: 'Top Out' }), line('d', 'j1', { line_kind: 'discount', progress_pct: 100 }), line('z', 'j1', { line_unit_price: 0, progress_pct: 100 })])
    expect(d.rows).toEqual([])
  })

  it('reads only a Working job: Waiting has nothing to bill, Ready to Bill and after are past this', () => {
    const lines = (id: string) => [line(`${id}a`, id, { progress_pct: 100 }), line(`${id}b`, id, { name: 'Top Out' })]
    for (const status of ['waiting', 'ready_to_bill', 'billed', 'paid', null]) {
      expect(stagesDone([job('j1', { status })], lines('j1')).rows).toEqual([])
    }
    // A line whose job the read did not return (it is not Working) is dropped the same way.
    expect(stagesDone([], lines('j9')).rows).toEqual([])
  })

  it('prices a line by its count, and puts the most money first', () => {
    const d = stagesDone(
      [job('j1'), job('j2', { click_number: '901', job_name: 'ZZ Test Elm' })],
      [line('a', 'j1', { progress_pct: 100, line_unit_price: 500, count: 3 }), line('b', 'j1', { name: 'Top Out', progress_pct: 100, line_unit_price: 900 }), line('c', 'j2', { name: 'Trim Set', progress_pct: 100, line_unit_price: 4000 }), line('e', 'j2')],
    )
    expect(d.rows.map((r) => [r.fixtureId, r.priceUsd])).toEqual([['c', 4000], ['a', 1500], ['b', 900]])
    expect(d.usd).toBe(6400)
    expect(d.jobIds).toEqual(['j2', 'j1'])
  })

  it('names a stage with no name, and a job with no number', () => {
    const d = stagesDone([job('abcdef12-0000', { click_number: null, job_name: null })], [line('a', 'abcdef12-0000', { name: '  ', progress_pct: 100 }), line('b', 'abcdef12-0000')])
    expect(d.rows[0]).toMatchObject({ name: 'A stage', jobLabel: 'job abcdef12' })
  })
})

describe('the words', () => {
  const rows = [
    { fixtureId: 'a', jobId: 'j1', jobLabel: '#900 ZZ Test Oak', name: 'Rough In', priceUsd: 14_400 },
    { fixtureId: 'b', jobId: 'j2', jobLabel: '#901 ZZ Test Elm', name: 'Top Out', priceUsd: 9_600.4 },
  ]

  it('titles one stage and many', () => {
    expect(stagesDoneTitle(1)).toBe('A stage reads 100% and is not billed')
    expect(stagesDoneTitle(3)).toBe('3 stages read 100% and are not billed')
  })

  it('names the first stage, its job and its dollars, then how much more', () => {
    expect(stagesDoneDetail({ rows: rows.slice(0, 1), usd: 14_400 })).toBe('Rough In on #900 ZZ Test Oak, $14,400. The crew put it at 100%. Open the job to bill it.')
    expect(stagesDoneDetail({ rows, usd: 24_000.4 })).toBe('Rough In on #900 ZZ Test Oak, $14,400. 1 more, $24,000 in all. The crew put each at 100%. Open a job to bill it.')
    expect(stagesDoneDetail({ rows: [], usd: 0 })).toBe('')
  })

  it('the press opens the job, and says so', () => {
    expect(STAGES_DONE_ACTION).toBe('Open the job')
    expect(stagesDoneHref('j1')).toBe('/jobs?tab=stages&jobDetail=j1')
    expect(stagesDoneHref(null)).toBe('/jobs?tab=stages')
  })
})
