import { describe, expect, it } from 'vitest'
import { gcJobPapersFromSql, gcJobPapersOrNone, gcPaperBusiness, gcPaperFine, gcPaperGate, gcPaperLevel, gcPaperRevisionLine, gcPaperSigned, parseGcJobPapers } from './gcJobPapers'

// What the database answers for one job, with made-up words.
const SQL = [
  {
    job_id: 'job-1',
    papers: [
      {
        id: 'row-1',
        paper_name: 'Sample paper',
        settings_revision: 2,
        level: { key: 'standard', label: 'Standard', aligned_with: 'Aligned with a placeholder place' },
        said: [
          { key: 'photos', label: 'Photos and video', choice: 'Standard', says: 'Placeholder: ask first.', out: false },
          { key: 'phones', label: 'Phones', choice: 'Off', says: 'Placeholder: no rule.', out: true },
        ],
        signed: 3,
        total: 9,
        businesses: [
          { name: 'Pine Ridge Excavating', people: 2, signed: 2, signed_on: '2026-11-24' },
          { name: 'Sam Sole', people: 1, signed: 0, signed_on: null },
        ],
      },
    ],
  },
  { job_id: 'job-9', papers: [{ id: 'row-9', paper_name: 'Another job’s paper', settings_revision: 1, level: null, said: [], signed: 0, total: 1, businesses: [] }] },
]
const GC_JOBS = [
  { id: 'job-2', label: 'J200 · Marsh' },
  { id: 'job-1', label: 'J100 · Cedar Bluff' },
]

describe('gcJobPapers · what a GC reads about a job’s papers', () => {
  it('shapes the database’s answer for the jobs on the page, under the page’s own labels', () => {
    expect(gcJobPapersFromSql(SQL, GC_JOBS)).toEqual([
      {
        jobId: 'job-1',
        jobLabel: 'J100 · Cedar Bluff',
        papers: [
          {
            id: 'row-1',
            name: 'Sample paper',
            settingsRevision: 2,
            level: { label: 'Standard', alignedWith: 'Aligned with a placeholder place' },
            said: [
              { label: 'Photos and video', choice: 'Standard', says: 'Placeholder: ask first.', out: false },
              { label: 'Phones', choice: 'Off', says: 'Placeholder: no rule.', out: true },
            ],
            signed: 3,
            total: 9,
            businesses: [
              { name: 'Pine Ridge Excavating', people: 2, signed: 2, signedOn: '2026-11-24' },
              { name: 'Sam Sole', people: 1, signed: 0, signedOn: null },
            ],
          },
        ],
      },
    ])
  })

  it('drops a job the page does not list, so the answer never names a job that is not theirs', () => {
    expect(gcJobPapersFromSql(SQL, GC_JOBS).map((j) => j.jobId)).toEqual(['job-1'])
    expect(gcJobPapersFromSql(SQL, [])).toEqual([])
  })

  it('reads back on the page exactly what the function sent', () => {
    const sent = gcJobPapersFromSql(SQL, GC_JOBS)
    expect(parseGcJobPapers(JSON.parse(JSON.stringify(sent)))).toEqual(sent)
  })

  it('reads nothing from an answer that does not read', () => {
    for (const bad of [null, undefined, 'x', 7, {}, [null], [{ job_id: '' }], [{ job_id: 'job-1', papers: [{ id: '', paper_name: 'x' }] }]]) expect(gcJobPapersFromSql(bad, GC_JOBS)).toEqual([])
    for (const bad of [null, undefined, {}, [{}], [{ jobId: 'job-1', papers: [] }], [{ jobId: 'job-1', papers: [{ id: 'row', name: '' }] }]]) expect(parseGcJobPapers(bad)).toEqual([])
  })

  it('never counts more signed than there are people, and gives a business a day only when all of it signed', () => {
    const [job] = gcJobPapersFromSql([{ job_id: 'job-1', papers: [{ id: 'r', paper_name: 'P', signed: 12, total: 4, businesses: [{ name: 'Half', people: 2, signed: 1, signed_on: '2026-11-24' }, { name: 'Over', people: 1, signed: 5, signed_on: '2026-11-20T10:00:00Z' }, { name: 'Empty', people: 0, signed: 0 }] }] }], GC_JOBS)
    expect(job!.papers[0]!.signed).toBe(4)
    expect(job!.papers[0]!.businesses).toEqual([
      { name: 'Half', people: 2, signed: 1, signedOn: null },
      { name: 'Over', people: 1, signed: 1, signedOn: '2026-11-20' },
    ])
  })

  it('says the level, or a mix of its own', () => {
    expect(gcPaperLevel({ level: { label: 'Standard', alignedWith: 'Aligned with a placeholder place' } })).toEqual({ chip: 'Standard', line: 'Aligned with a placeholder place' })
    expect(gcPaperLevel({ level: { label: 'Standard', alignedWith: '' } })).toEqual({ chip: 'Standard', line: null })
    expect(gcPaperLevel({ level: null })).toEqual({ chip: 'A mix of its own', line: null })
  })

  it('says how many have signed', () => {
    expect(gcPaperSigned({ signed: 3, total: 9 })).toEqual({ head: '3 of 9 people have signed', percent: 33 })
    expect(gcPaperSigned({ signed: 1, total: 1 })).toEqual({ head: '1 of 1 person has signed', percent: 100 })
    expect(gcPaperSigned({ signed: 0, total: 0 })).toEqual({ head: 'Nobody is on this job yet', percent: 0 })
  })

  it('says a business’s day once all of it signed, and how many of several signed', () => {
    expect(gcPaperBusiness({ name: 'A', people: 2, signed: 2, signedOn: '2026-11-24' })).toEqual({ chip: 'Signed Nov 24, 2026', done: true, detail: '2 of 2 people signed' })
    expect(gcPaperBusiness({ name: 'A', people: 2, signed: 1, signedOn: null })).toEqual({ chip: 'Not yet', done: false, detail: '1 of 2 people signed' })
    expect(gcPaperBusiness({ name: 'A', people: 1, signed: 1, signedOn: null })).toEqual({ chip: 'Signed', done: true, detail: null })
    expect(gcPaperBusiness({ name: 'A', people: 1, signed: 0, signedOn: null })).toEqual({ chip: 'Not yet', done: false, detail: null })
  })

  it('names the company in the gate line and the small print', () => {
    expect(gcPaperGate('Click Plumbing')).toBe('Nobody opens this job in Click Plumbing’s system until they sign.')
    expect(gcPaperGate('')).toBe('Nobody opens this job in our system until they sign.')
    expect(gcPaperFine('Click Plumbing')).toBe('This is Click Plumbing’s paper for the people it brings onto your job. It does not change the agreement between Click Plumbing and you.')
  })

  it('says a later revision started the count again', () => {
    expect(gcPaperRevisionLine({ settingsRevision: 1 })).toBeNull()
    expect(gcPaperRevisionLine({ settingsRevision: 3 })).toBe('These settings are revision 3 on this job. Everyone signs each revision.')
  })

  it('asks the database for the page’s jobs, and answers nothing when the read fails or no job is theirs', async () => {
    const calls: unknown[] = []
    const admin = { rpc: async (fn: string, args: Record<string, unknown>) => (calls.push([fn, args]), { data: SQL, error: null }) }
    expect((await gcJobPapersOrNone(admin, GC_JOBS)).map((j) => j.jobLabel)).toEqual(['J100 · Cedar Bluff'])
    expect(calls).toEqual([['job_papers_gc_page', { p_job_ids: ['job-2', 'job-1'] }]])
    expect(await gcJobPapersOrNone(admin, [])).toEqual([])
    expect(calls).toHaveLength(1)
    const refused = { rpc: async () => ({ data: null, error: { message: 'no such function' } }) }
    expect(await gcJobPapersOrNone(refused, GC_JOBS)).toEqual([])
  })
})
