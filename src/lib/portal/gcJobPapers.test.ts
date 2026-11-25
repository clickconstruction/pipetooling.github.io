import { describe, expect, it } from 'vitest'
import { GC_OWN_FORM_TITLE, GC_PAPER_SAMPLE, gcJobPapersFromSql, gcOwnFormFine, gcOwnFormLead, gcProposalAsk, gcProposeDef, gcJobPapersOrNone, gcPaperBusiness, gcPaperFine, gcPaperGate, gcPaperLevel, gcPaperRevisionLine, gcPaperSampleUrl, gcPaperSigned, gcPaperSigner, gcPaperViewOf, parseGcJobPapers } from './gcJobPapers'

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
            view: 'businesses',
            businesses: [
              { name: 'Pine Ridge Excavating', people: 2, signed: 2, signedOn: '2026-11-24' },
              { name: 'Sam Sole', people: 1, signed: 0, signedOn: null },
            ],
            signers: [],
            propose: null,
            proposal: null,
          },
        ],
        ownForms: [],
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

  // The office's setting for what a GC sees. One paper's answer, as the database would send it under each.
  const seen = (view: unknown, extra: Record<string, unknown> = {}) => {
    const paper = {
      id: 'r',
      paper_name: 'P',
      signed: 2,
      total: 4,
      view,
      businesses: [{ name: 'Pine Ridge Excavating', people: 2, signed: 2, signed_on: '2026-11-24' }],
      signers: [
        { name: 'Tall Pine', business: 'Pine Ridge Excavating', signed_on: '2026-11-23' },
        { name: 'Hector Helper', business: null, signed_on: '2026-11-24T09:00:00Z' },
        { name: '', business: 'Nobody', signed_on: '2026-11-24' },
      ],
      ...extra,
    }
    return gcJobPapersFromSql([{ job_id: 'job-1', papers: [paper] }], GC_JOBS)[0]!.papers[0]!
  }

  it('every signer by name: the businesses, and each signer with the company of a sub', () => {
    const paper = seen('names')
    expect(paper.view).toBe('names')
    expect(paper.businesses).toHaveLength(1)
    expect(paper.signers).toEqual([
      { name: 'Tall Pine', business: 'Pine Ridge Excavating', signedOn: '2026-11-23' },
      { name: 'Hector Helper', business: null, signedOn: '2026-11-24' },
    ])
  })

  it('never hands on a list the setting hides, whatever the answer carries', () => {
    expect(seen('businesses').signers).toEqual([])
    expect(seen('businesses').businesses).toHaveLength(1)
    const count = seen('count')
    expect([count.view, count.businesses, count.signers, count.signed]).toEqual(['count', [], [], 2])
    // An answer with no setting, or one that does not read, is the way every paper starts.
    for (const v of [undefined, null, 7, 'everything', '']) expect(seen(v).view).toBe('businesses')
    expect(gcPaperViewOf(' Names ')).toBe('names')
  })

  it('the page reads the setting and the signers back as sent', () => {
    const sent = gcJobPapersFromSql([{ job_id: 'job-1', papers: [{ id: 'r', paper_name: 'P', signed: 1, total: 2, view: 'names', businesses: [], signers: [{ name: 'Tall Pine', business: null, signed_on: '2026-11-23' }] }] }], GC_JOBS)
    expect(parseGcJobPapers(JSON.parse(JSON.stringify(sent)))).toEqual(sent)
    expect(sent[0]!.papers[0]!.signers).toEqual([{ name: 'Tall Pine', business: null, signedOn: '2026-11-23' }])
  })

  it('says a signer’s day, and the company of a sub', () => {
    expect(gcPaperSigner({ name: 'Tall Pine', business: 'Pine Ridge Excavating', signedOn: '2026-11-23' })).toEqual({ chip: 'Signed Nov 23, 2026', detail: 'Pine Ridge Excavating' })
    expect(gcPaperSigner({ name: 'Hector Helper', business: null, signedOn: null })).toEqual({ chip: 'Signed', detail: null })
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

  it('opens the sample at the function that draws it, with the page’s token and the paper’s id', () => {
    expect(gcPaperSampleUrl('https://x.supabase.co/functions/v1/', 'tok en', 'row-1')).toBe('https://x.supabase.co/functions/v1/open-job-paper-sample?t=tok%20en&p=row-1')
    expect(gcPaperSampleUrl('https://x.supabase.co/functions/v1', '', 'row-1')).toBeNull()
    expect(gcPaperSampleUrl('https://x.supabase.co/functions/v1', 'tok', '')).toBeNull()
    expect(GC_PAPER_SAMPLE.press).toBe('Download a sample')
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

// The GC's own form (step 7): what the database answers for a job that requires one, with made-up words.
const OWN_SQL = [
  {
    job_id: 'job-1',
    papers: [],
    own_forms: [
      { id: 'row-f', paper_name: 'Sample GC form', signed: 12, total: 4, businesses: [{ name: 'Pine Ridge Excavating', people: 2, signed: 2, signed_on: '2026-11-24' }, { name: 'Nobody Co', people: 0, signed: 0, signed_on: null }] },
      { id: '', paper_name: 'No id, so it is dropped' },
    ],
  },
  { job_id: 'job-2', papers: SQL[0]!.papers, own_forms: [{ id: 'row-g', paper_name: 'Another sample form', signed: 0, total: 0, businesses: [] }] },
]

describe('gcJobPapers · the GC’s own form', () => {
  it('keeps a job that requires only the GC’s own form, with the form in a list of its own', () => {
    expect(gcJobPapersFromSql(OWN_SQL, GC_JOBS)).toEqual([
      { jobId: 'job-2', jobLabel: 'J200 · Marsh', papers: gcJobPapersFromSql(SQL, GC_JOBS)[0]!.papers, ownForms: [{ id: 'row-g', name: 'Another sample form', signed: 0, total: 0, businesses: [] }] },
      {
        jobId: 'job-1',
        jobLabel: 'J100 · Cedar Bluff',
        papers: [],
        // Never more signed than there are people, and a business with nobody on it is dropped.
        ownForms: [{ id: 'row-f', name: 'Sample GC form', signed: 4, total: 4, businesses: [{ name: 'Pine Ridge Excavating', people: 2, signed: 2, signedOn: '2026-11-24' }] }],
      },
    ])
  })

  it('reads the forms back on the page as sent', () => {
    const sent = gcJobPapersFromSql(OWN_SQL, GC_JOBS)
    expect(parseGcJobPapers(JSON.parse(JSON.stringify(sent)))).toEqual(sent)
  })

  it('an answer from before the step, with no such list, reads as no own form', () => {
    expect(gcJobPapersFromSql(SQL, GC_JOBS)[0]!.ownForms).toEqual([])
    expect(parseGcJobPapers([{ jobId: 'job-1', jobLabel: 'J100', papers: [{ id: 'row-1', name: 'Sample paper' }] }])[0]!.ownForms).toEqual([])
  })

  it('drops a job whose lists are both empty, and a form with no name', () => {
    expect(gcJobPapersFromSql([{ job_id: 'job-1', papers: [], own_forms: [] }], GC_JOBS)).toEqual([])
    expect(parseGcJobPapers([{ jobId: 'job-1', papers: [], ownForms: [{ id: 'row-f', name: '' }] }])).toEqual([])
  })

  it('never puts a form among the papers, whatever the answer carries', () => {
    const jobs = gcJobPapersFromSql(OWN_SQL, GC_JOBS)
    expect(jobs.flatMap((j) => j.papers.map((x) => x.name))).toEqual(['Sample paper'])
    // A form carries no level, no plain words, no sample and no proposal: the shape has no place for them.
    expect(Object.keys(jobs[1]!.ownForms[0]!).sort()).toEqual(['businesses', 'id', 'name', 'signed', 'total'])
  })

  it('says whose form it is, and counts as a paper counts', () => {
    expect(GC_OWN_FORM_TITLE).toBe('Subs sign your own form')
    expect(gcOwnFormLead('Sample Plumbing')).toBe('Every person Sample Plumbing brings onto this job signs the form you gave us before they see the job.')
    expect(gcOwnFormLead('')).toBe('Every person our company brings onto this job signs the form you gave us before they see the job.')
    expect(gcOwnFormFine('Sample Plumbing')).toBe('This is your form. It does not change the agreement between Sample Plumbing and you.')
    expect(gcPaperSigned({ signed: 2, total: 4 })).toEqual({ head: '2 of 4 people have signed', percent: 50 })
  })
})

// What the database holds for a settings list, with made-up words: more than a GC's page gets.
const BOOK_DEF = {
  settings: [
    {
      key: 'photos',
      label: 'Photos and video',
      labelEs: 'Fotos',
      choices: [
        { key: 'off', label: 'Off', says: 'Placeholder: no photo rule.', out: true },
        { key: 'standard', label: 'Standard', says: 'Placeholder: ask first.', breach: ['Placeholder breach line.'], site: ['Placeholder site line.'], fills: { party: 'Placeholder' } },
      ],
    },
    { label: 'No key, so it is dropped', choices: [] },
  ],
  fields: [{ key: 'party', label: 'Party' }],
  levels: [{ key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'standard', 'Bad Key': 'x' } }],
  notice: { title: 'Before you start', tick: 'I have read this.', lines: ['Placeholder notice line.', '  '] },
  siteNote: { title: 'Match the paper to the site', lines: ['Placeholder site note.'] },
}

describe('gcJobPapers · what a GC’s proposal is drawn from, and what their page sends', () => {
  it('hands the page a list with names and plain words only', () => {
    const trimmed = gcProposeDef(BOOK_DEF)
    expect(trimmed).toEqual({
      settings: [
        {
          key: 'photos',
          label: 'Photos and video',
          choices: [
            { key: 'off', label: 'Off', says: 'Placeholder: no photo rule.', out: true },
            { key: 'standard', label: 'Standard', says: 'Placeholder: ask first.' },
          ],
        },
      ],
      levels: [{ key: 'standard', label: 'Standard', alignedWith: 'Aligned with a placeholder place', picks: { photos: 'standard' } }],
      notice: { title: 'Before you start', tick: 'I have read this.', lines: ['Placeholder notice line.'] },
    })
    // What the office reads beside a choice never leaves.
    expect(JSON.stringify(trimmed)).not.toMatch(/breach|site|fills|party|Fotos/i)
    // Reading the page's own copy back gives the same list, and nothing that is no list gives none.
    expect(gcProposeDef(trimmed)).toEqual(trimmed)
    expect(gcProposeDef(null)).toBeNull()
    expect(gcProposeDef({ settings: [] })).toBeNull()
    expect(gcProposeDef({ settings: [{ key: 'a', label: 'A', choices: [] }] })).toEqual({ settings: [{ key: 'a', label: 'A', choices: [] }], levels: [] })
  })

  it('shapes the list, the picks and the last proposal from the database, and reads them back on the page', () => {
    const sql = [{ job_id: 'job-1', papers: [{ id: 'row-1', paper_name: 'Sample paper', settings_revision: 1, level: null, said: [], signed: 0, total: 2, businesses: [], picks: { photos: 'standard' }, basis: 'standard', def: BOOK_DEF, proposal: { state: 'declined', by_name: ' Greta Sample ', proposed_at: '2026-11-25T02:00:00.123+00:00', decided_at: '2026-11-25T03:00:00+00:00', why: 'Placeholder reason.', settings: { photos: 'standard' } } }] }]
    const shaped = gcJobPapersFromSql(sql, [{ id: 'job-1', label: 'J100' }])
    const paper = shaped[0]!.papers[0]!
    expect(paper.propose).toEqual({ def: gcProposeDef(BOOK_DEF), picks: { photos: 'standard' }, basis: 'standard' })
    expect(paper.proposal).toEqual({ state: 'declined', byName: 'Greta Sample', proposedAt: '2026-11-25T02:00:00.123+00:00', decidedAt: '2026-11-25T03:00:00+00:00', why: 'Placeholder reason.', picks: { photos: 'standard' } })
    // The page reads its own keys back to the same paper.
    expect(parseGcJobPapers(JSON.parse(JSON.stringify(shaped)))).toEqual(shaped)
    // A paper whose list did not come has nothing to propose from, and a day that is no instant is no day.
    const bare = gcJobPapersFromSql([{ job_id: 'job-1', papers: [{ id: 'row-1', paper_name: 'Sample paper', settings_revision: 1, signed: 0, total: 1, proposal: { state: 'waiting', by_name: 'G', proposed_at: 'yesterday', settings: null } }] }], [{ id: 'job-1', label: 'J100' }])[0]!.papers[0]!
    expect(bare.propose).toBeNull()
    expect(bare.proposal).toEqual({ state: 'waiting', byName: 'G', proposedAt: null, decidedAt: null, why: null, picks: {} })
  })

  it('reads what a page sends to propose, and refuses what is no proposal', () => {
    const id = '11111111-2222-3333-4444-555555555555'
    expect(gcProposalAsk({ requiredPaperId: id, picks: { photos: 'strict', 'Bad Key': 'x', term: 7 }, name: '  Greta Sample  ', noticeRead: true })).toEqual({ requiredPaperId: id, picks: { photos: 'strict' }, name: 'Greta Sample', noticeRead: true })
    expect(gcProposalAsk({ requiredPaperId: id, picks: {}, name: 'x'.repeat(300) })).toEqual({ requiredPaperId: id, picks: {}, name: 'x'.repeat(120), noticeRead: false })
    expect(gcProposalAsk({ requiredPaperId: 'row-1', picks: {} })).toBeNull()
    expect(gcProposalAsk({ requiredPaperId: id })).toBeNull()
    expect(gcProposalAsk({ requiredPaperId: id, picks: ['photos'] })).toBeNull()
    expect(gcProposalAsk(null)).toBeNull()
    // A tick is true only when it is the value true.
    expect(gcProposalAsk({ requiredPaperId: id, picks: {}, noticeRead: 'yes' })!.noticeRead).toBe(false)
  })
})

