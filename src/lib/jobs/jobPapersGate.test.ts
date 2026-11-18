/**
 * Papers before a job opens: the prompt's words, a locked job in a list, the Needs you line, and the way back from
 * the signing page. Made-up names only.
 */
import { describe, expect, it } from 'vitest'
import {
  type MyJobPapers,
  LOCKED_PICK_NAME,
  jobPapersGateView,
  jobPapersNeedsYou,
  lockedJobWords,
  maskLockedPick,
  myOwedPapers,
  parseClosedJobIds,
  parseJobPapersReturn,
  parseJobsNeedingMe,
} from './jobPapers'

const mine = (nda: 'none' | 'sent' | 'signed', site: 'none' | 'signed', linked = true): MyJobPapers => ({
  jobNumber: 'J2391',
  linked,
  papers: [
    { id: 'nda', paperName: 'Ridgeway Builders NDA', isForm: true, documentId: nda === 'none' ? null : 'd1', status: nda, signedAt: nda === 'signed' ? '2026-11-17' : null },
    { id: 'site', paperName: 'Site rules and photo policy', isForm: false, documentId: site === 'none' ? null : 'd2', status: site, signedAt: site === 'signed' ? '2026-11-15' : null },
  ],
})

describe('jobPapersGateView', () => {
  it('before anything is signed it names the job, the papers and the first one to sign', () => {
    const v = jobPapersGateView(mine('none', 'none'), '2026-11-17')
    expect(v.title).toBe('Before you open J2391')
    expect(v.lead).toBe('This job has 2 papers to sign first. It opens when both are signed.')
    expect(v.rows.map((r) => `${r.paperName}|${r.done}|${r.sub}`)).toEqual(['Ridgeway Builders NDA|false|Not signed yet', 'Site rules and photo policy|false|Not signed yet'])
    expect(v.nextLabel).toBe('Read and sign: Ridgeway Builders NDA')
    expect(v.allSigned).toBe(false)
    expect(v.hidden).toBe('Until then the job’s name, address, customer, notes, photos and materials stay shut.')
    expect(v.blocked).toBeNull()
  })
  it('after one signature it says what is left and moves to the next paper', () => {
    const v = jobPapersGateView(mine('signed', 'none'), '2026-11-17')
    expect(v.lead).toBe('This job has 2 papers to sign first. 1 paper is left.')
    expect(v.rows[0]!.sub).toBe('Signed today')
    expect(v.next?.id).toBe('site')
    expect(v.nextLabel).toBe('Read and sign: Site rules and photo policy')
  })
  it('with nothing left it offers the job', () => {
    const v = jobPapersGateView(mine('signed', 'signed'), '2026-11-17')
    expect(v.lead).toBe('Nothing is left to sign.')
    expect(v.rows.map((r) => r.sub)).toEqual(['Signed today', 'Signed Nov 15'])
    expect(v.next).toBeNull()
    expect(v.allSigned).toBe(true)
    expect(v.hidden).toBeNull()
  })
  it('one paper reads in the singular, three as all', () => {
    const one: MyJobPapers = { jobNumber: 'J7', linked: true, papers: [mine('none', 'none').papers[0]!] }
    expect(jobPapersGateView(one).lead).toBe('This job has 1 paper to sign first. It opens when it is signed.')
    const three: MyJobPapers = { jobNumber: 'J7', linked: true, papers: [...mine('none', 'none').papers, { id: 'x', paperName: 'Gate rules', isForm: false, documentId: null, status: 'none', signedAt: null }] }
    expect(jobPapersGateView(three).lead).toBe('This job has 3 papers to sign first. It opens when all are signed.')
  })
  it('a login with no file tied to it cannot sign, and the prompt says why', () => {
    const v = jobPapersGateView(mine('none', 'none', false))
    expect(v.next).toBeNull()
    expect(v.nextLabel).toBeNull()
    expect(v.blocked).toBe('Your login is not tied to your file yet. Ask the office to link it on People. Then you can sign.')
  })
  it('a job with no number still has a title, and a job with no papers is not signed', () => {
    expect(jobPapersGateView({ jobNumber: '', linked: true, papers: [] }).title).toBe('Before you open this job')
    expect(jobPapersGateView({ jobNumber: '', linked: true, papers: [] }).allSigned).toBe(false)
  })
})

describe('a locked job in a list', () => {
  it('shows the number and the count, never a name', () => {
    expect(lockedJobWords(mine('none', 'none'))).toEqual({ number: 'J2391', line: '2 papers to sign before this job opens' })
    expect(lockedJobWords(mine('signed', 'none'))).toEqual({ number: 'J2391', line: '1 paper to sign before this job opens' })
    expect(lockedJobWords(mine('none', 'none'), 'clock')).toEqual({ number: 'J2391', line: 'Sign 2 papers to clock in here' })
  })
  it('before the papers are read it still says there are papers', () => {
    expect(lockedJobWords(null)).toEqual({ number: 'A job', line: 'Papers to sign before this job opens' })
    expect(lockedJobWords(null, 'clock').line).toBe('Sign its papers to clock in here')
  })
  it('a pick keeps its number and loses its name and address', () => {
    const closed = new Set(['job-1'])
    const job = { source: 'job', id: 'job-1', hcp_number: 'J2391', job_name: 'Cedar Bluff Lofts', job_address: '1200 Quarry Rd' }
    expect(maskLockedPick(job, closed)).toEqual({ source: 'job', id: 'job-1', hcp_number: 'J2391', job_name: LOCKED_PICK_NAME, job_address: '' })
    const open = { ...job, id: 'job-2' }
    expect(maskLockedPick(open, closed)).toBe(open)
    const bid = { source: 'bid', id: 'job-1', project_name: 'Cedar Bluff Lofts' }
    expect(maskLockedPick(bid, closed)).toBe(bid)
  })
  it('counts what is owed', () => {
    expect(myOwedPapers(mine('sent', 'signed')).map((p) => p.id)).toEqual(['nda'])
  })
})

describe('the Needs you line', () => {
  it('one job names its number and its papers', () => {
    expect(jobPapersNeedsYou([{ jobId: 'job-1', jobNumber: 'J2391', owed: 2, total: 2 }])).toEqual({ title: 'J2391 opens after you sign 2 papers', detail: 'Read and sign, then the job opens.', figure: '2', jobId: 'job-1' })
    expect(jobPapersNeedsYou([{ jobId: 'job-1', jobNumber: 'J2391', owed: 1, total: 2 }])?.title).toBe('J2391 opens after you sign 1 paper')
  })
  it('several jobs are counted, and the first is named', () => {
    const need = jobPapersNeedsYou([{ jobId: 'job-1', jobNumber: 'J2391', owed: 2, total: 2 }, { jobId: 'job-2', jobNumber: 'J2402', owed: 1, total: 1 }])
    expect(need).toEqual({ title: '2 jobs open after you sign their papers', detail: 'J2391 is first. Read and sign, then each job opens.', figure: '3', jobId: 'job-1' })
  })
  it('no job, no line', () => {
    expect(jobPapersNeedsYou([])).toBeNull()
  })
  it('reads the database answers, and leaves out a job with nothing owed', () => {
    expect(parseJobsNeedingMe([{ job_id: 'job-1', job_number: 'J2391', owed: 2, total: 2 }, { job_id: 'job-2', job_number: 'J2402', owed: 0, total: 1 }, { job_number: 'J9' }])).toEqual([{ jobId: 'job-1', jobNumber: 'J2391', owed: 2, total: 2 }])
    expect(parseJobsNeedingMe(null)).toEqual([])
    expect(parseClosedJobIds(['job-1', '', 7, 'job-2'])).toEqual(['job-1', 'job-2'])
    expect(parseClosedJobIds('job-1')).toEqual([])
  })
})

describe('the way back from the signing page', () => {
  it('keeps an in-app path and a job', () => {
    expect(parseJobPapersReturn(JSON.stringify({ jobId: 'job-1', path: '/dashboard?tab=today' }))).toEqual({ jobId: 'job-1', path: '/dashboard?tab=today' })
  })
  it('refuses anything that is not an in-app path', () => {
    expect(parseJobPapersReturn(JSON.stringify({ jobId: 'job-1', path: 'https://example.test/x' }))).toBeNull()
    expect(parseJobPapersReturn(JSON.stringify({ jobId: 'job-1', path: '//example.test/x' }))).toBeNull()
    expect(parseJobPapersReturn(JSON.stringify({ path: '/dashboard' }))).toBeNull()
    expect(parseJobPapersReturn('not json')).toBeNull()
    expect(parseJobPapersReturn(null)).toBeNull()
  })
})
