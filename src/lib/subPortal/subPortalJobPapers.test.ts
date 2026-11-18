/**
 * Papers before a job opens, step 6: what a sub's own page reads of the jobs that wait on their signature, and the
 * card's words in the page's two languages. Made-up names only.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { parseSubPortalPayload } from './subPortalPayload'
import { parseSubPortalJobPapers, subJobPapersCardView, subPapersFirstLine, type SubPortalJobPapers } from './subPortalJobPapers'

const RAW = [
  {
    job_id: 'job-cedar',
    job_number: 'J2391',
    papers: [
      { id: 'nda', paper_name: 'Ridgeway Builders NDA', is_form: true, status: 'none', signed_at: null },
      { id: 'site', paper_name: 'Site rules and photo policy', is_form: false, status: 'none', signed_at: null },
    ],
  },
]
const [owed] = parseSubPortalJobPapers(RAW) as [SubPortalJobPapers]
const oneSigned: SubPortalJobPapers = { ...owed, papers: [{ ...owed.papers[0]!, status: 'signed', signedAt: '2026-11-15' }, owed.papers[1]!] }

describe('parseSubPortalJobPapers', () => {
  it('reads each waiting job with its number and its papers', () => {
    expect(owed).toEqual({
      jobId: 'job-cedar',
      jobNumber: 'J2391',
      unread: false,
      papers: [
        { id: 'nda', paperName: 'Ridgeway Builders NDA', isForm: true, documentId: null, status: 'none', signedAt: null },
        { id: 'site', paperName: 'Site rules and photo policy', isForm: false, documentId: null, status: 'none', signedAt: null },
      ],
    })
  })

  it('a job with nothing left to sign is not a waiting job, and a job held shut unread is', () => {
    const signed = { job_id: 'job-marsh', job_number: 'J2402', papers: [{ id: 'nda', paper_name: 'Ridgeway Builders NDA', status: 'signed', signed_at: '2026-11-15' }] }
    expect(parseSubPortalJobPapers([signed])).toEqual([])
    expect(parseSubPortalJobPapers([{ job_id: 'job-marsh', job_number: 'J2402', papers: [], unread: true }])).toEqual([{ jobId: 'job-marsh', jobNumber: 'J2402', unread: true, papers: [] }])
  })

  it('anything that is not a list of jobs reads as none', () => {
    for (const raw of [undefined, null, {}, 'J2391', [null, 7, [], { job_number: 'J2391' }, { job_id: ' ' }]]) expect(parseSubPortalJobPapers(raw)).toEqual([])
  })

  it('the page’s payload carries them, and the marks on the rows held back', () => {
    const payload = parseSubPortalPayload({
      subName: 'Tall Pine Excavating',
      totals: { earned: 6000, paid: 1500, open: 4500 },
      sheets: [{ id: 's1', jobNumber: 'J2391', items: [], agreed: 6000, paid: 1500, open: 4500, papersFirstJobId: 'job-cedar' }, { id: 's2', jobNumber: 'J2402', address: '88 Linden Ct', items: [] }],
      offers: [{ id: 'o1', title: 'Work order', lines: [], total: 2600, papersFirstJobId: 'job-cedar' }, { id: 'o2', title: 'J2402 · 88 Linden Ct', lines: [], total: 300 }],
      days: { bookings: [{ start: '2026-11-20', end: '2026-11-24', label: '#J2391', jobNumber: 'J2391', papersFirstJobId: 'job-cedar' }, { start: '2026-11-19', label: '#J2402', address: '88 Linden Ct' }], offDays: [] },
      job_papers: RAW,
    })!
    expect(payload.jobPapers).toEqual([owed])
    expect(payload.sheets.map((s) => s.papersFirstJobId)).toEqual(['job-cedar', undefined])
    expect(payload.offers.map((o) => o.papersFirstJobId)).toEqual(['job-cedar', undefined])
    expect(payload.days.bookings.map((b) => b.papersFirstJobId)).toEqual(['job-cedar', undefined])
    // A page whose function predates the papers reads exactly as before.
    const before = parseSubPortalPayload({ subName: 'Ortega Mechanical', totals: { earned: 0, paid: 0, open: 0 }, sheets: [{ id: 's2', items: [] }] })!
    expect(before.jobPapers).toEqual([])
    expect('papersFirstJobId' in before.sheets[0]!).toBe(false)
  })
})

describe('subJobPapersCardView', () => {
  it('names the job, counts the papers and offers the first one not signed', () => {
    const view = subJobPapersCardView(owed, '2026-11-17')
    expect(view.title).toBe('Work on J2391')
    expect(view.lead).toBe('This job has 2 papers to sign before you can see where it is and what the work is.')
    expect(view.rows).toEqual([
      { id: 'nda', paperName: 'Ridgeway Builders NDA', done: false, sub: 'Not signed yet' },
      { id: 'site', paperName: 'Site rules and photo policy', done: false, sub: 'Not signed yet' },
    ])
    expect(view.next?.id).toBe('nda')
    expect(view.nextLabel).toBe('Read and sign: Ridgeway Builders NDA')
    expect(view.busyLabel).toBe('Opening the paper…')
  })

  it('one paper reads in the singular, and a job with no number is a job', () => {
    const one: SubPortalJobPapers = { ...owed, jobNumber: '', papers: [owed.papers[0]!] }
    const view = subJobPapersCardView(one)
    expect(view.title).toBe('Work on a job')
    expect(view.lead).toBe('This job has 1 paper to sign before you can see where it is and what the work is.')
  })

  it('after one is signed it says what is left, the day it was signed, and moves the press to the next paper', () => {
    const view = subJobPapersCardView(oneSigned, '2026-11-17')
    expect(view.lead).toBe('This job has 2 papers to sign before you can see where it is and what the work is. 1 paper is left.')
    expect(view.rows.map((r) => [r.done, r.sub])).toEqual([[true, 'Signed Nov 15'], [false, 'Not signed yet']])
    expect(view.nextLabel).toBe('Read and sign: Site rules and photo policy')
    expect(subJobPapersCardView(oneSigned, '2026-11-15').rows[0]!.sub).toBe('Signed today')
    const three: SubPortalJobPapers = { ...owed, papers: [...oneSigned.papers, { ...owed.papers[1]!, id: 'gc', paperName: 'Ridgeway Builders safety form' }] }
    expect(subJobPapersCardView(three).lead).toBe('This job has 3 papers to sign before you can see where it is and what the work is. 2 papers are left.')
  })

  it('a job whose papers could not be read says so and offers no press', () => {
    const view = subJobPapersCardView({ jobId: 'job-cedar', jobNumber: 'J2391', unread: true, papers: [] })
    expect(view.title).toBe('Work on J2391')
    expect(view.lead).toBe('We could not check this job’s papers just now. Reload the page, or call the office.')
    expect(view.rows).toEqual([])
    expect(view.next).toBeNull()
    expect(view.nextLabel).toBeNull()
  })

  it('reads in Spanish on a page set to Spanish', () => {
    const view = subJobPapersCardView(oneSigned, '2026-11-17', 'es')
    expect(view.title).toBe('Trabajo en J2391')
    expect(view.lead).toBe('Este trabajo tiene 2 documentos por firmar antes de que pueda ver dónde es y cuál es el trabajo. Falta 1 documento.')
    expect(view.rows.map((r) => r.sub)).toEqual(['Firmado el 15 nov', 'Sin firmar todavía'])
    expect(view.nextLabel).toBe('Leer y firmar: Site rules and photo policy')
    expect(view.busyLabel).toBe('Abriendo el documento…')
    expect(subJobPapersCardView(oneSigned, '2026-11-15', 'es').rows[0]!.sub).toBe('Firmado hoy')
    expect(subJobPapersCardView({ ...owed, jobNumber: '', papers: [owed.papers[0]!] }, null, 'es')).toMatchObject({ title: 'Trabajo en una obra', lead: 'Este trabajo tiene 1 documento por firmar antes de que pueda ver dónde es y cuál es el trabajo.' })
    expect(subJobPapersCardView({ jobId: 'job-cedar', jobNumber: 'J2391', unread: true, papers: [] }, null, 'es').lead).toBe('No pudimos revisar los documentos de este trabajo. Vuelva a cargar la página, o llame a la oficina.')
  })

  it('the row line, in both languages', () => {
    expect(subPapersFirstLine()).toBe('Papers to sign first')
    expect(subPapersFirstLine('es')).toBe('Primero hay documentos por firmar')
  })

  it('every word a sub reads keeps the plain-words rules, in both languages', () => {
    const unread: SubPortalJobPapers = { jobId: 'job-cedar', jobNumber: 'J2391', unread: true, papers: [] }
    const failing: string[] = []
    for (const lang of ['en', 'es'] as const) {
      for (const job of [owed, oneSigned, unread]) {
        const view = subJobPapersCardView(job, '2026-11-17', lang)
        for (const words of [view.title, view.lead, view.busyLabel, ...view.rows.map((r) => r.sub), subPapersFirstLine(lang)]) failing.push(...plainWordsFailures(words).map((f) => `${lang}: ${f}`))
      }
    }
    expect(failing).toEqual([])
  })
})
