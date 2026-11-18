/**
 * Papers before a job opens: the rules and the words of the office's section. Made-up names only.
 */
import { describe, expect, it } from 'vitest'
import {
  type BookPaperRow,
  type JobPapersRoster,
  JOB_PAPERS_LOCK_STAGE,
  cellWords,
  copyLinksLabel,
  isSubPortalPath,
  jobPapersBackLabel,
  jobPapersChip,
  lockStageNote,
  noLinkReason,
  owedPapers,
  parseJobPapersRoster,
  parseMyJobPapers,
  personRoleLabel,
  pickablePapers,
  requireButton,
  requireFoot,
  requiredToast,
  rosterSummary,
  shortDay,
  signingLinksText,
} from './jobPapers'

const raw = {
  job_number: 'J2391',
  papers: [
    { id: 'nda', paper_name: 'Ridgeway Builders NDA', is_form: true, book_document_id: 'book-nda', required_at: '2026-11-14T15:00:00Z' },
    { id: 'site', paper_name: 'Site rules and photo policy', is_form: false, book_document_id: 'book-site', required_at: '2026-11-14T15:00:01Z' },
  ],
  people: [
    { key: 'p1', person_id: 'p1', user_id: 'u1', name: 'Renee Alvarez', role: 'assistant', ways: ['office'], has_login: true, linked: true, papers: [
      { required_paper_id: 'nda', document_id: 'd1', status: 'signed', signed_at: '2026-11-14' },
      { required_paper_id: 'site', document_id: 'd2', status: 'signed', signed_at: '2026-11-14' },
    ] },
    { key: 'p2', person_id: 'p2', user_id: 'u2', name: 'Luis Ortega', role: 'helpers', ways: ['crew'], has_login: true, linked: true, papers: [
      { required_paper_id: 'nda', document_id: 'd3', status: 'signed', signed_at: '2026-11-16' },
      { required_paper_id: 'site', document_id: null, status: 'none', signed_at: null },
    ] },
    { key: 'u3', person_id: null, user_id: 'u3', name: 'Dana Whitlock', role: 'helpers', ways: ['crew'], has_login: true, linked: false, papers: [] },
    { key: 'p4', person_id: 'p4', user_id: 'u4', name: 'Tall Pine Excavating', role: 'subcontractor', ways: ['sub'], has_login: false, linked: true, papers: [
      { required_paper_id: 'nda', document_id: 'd4', status: 'sent', signed_at: null },
    ] },
  ],
}
const roster: JobPapersRoster = parseJobPapersRoster(raw)

describe('parseJobPapersRoster', () => {
  it('reads the job, its papers and its people', () => {
    expect(roster.jobNumber).toBe('J2391')
    expect(roster.papers.map((p) => `${p.paperName}:${p.isForm}`)).toEqual(['Ridgeway Builders NDA:true', 'Site rules and photo policy:false'])
    expect(roster.people.map((p) => p.name)).toEqual(['Renee Alvarez', 'Luis Ortega', 'Dana Whitlock', 'Tall Pine Excavating'])
  })
  it('reads anything missing as empty, never as signed', () => {
    expect(parseJobPapersRoster(null)).toEqual({ jobNumber: '', papers: [], people: [] })
    const odd = parseJobPapersRoster({ people: [{ key: 'x', papers: [{ required_paper_id: 'nda', status: 'approved' }], ways: ['owner', 'crew'] }] })
    expect(odd.people[0]!.papers[0]!.status).toBe('none')
    expect(odd.people[0]!.ways).toEqual(['crew'])
    expect(odd.people[0]!.linked).toBe(false)
  })
})

describe('parseMyJobPapers', () => {
  it('reads the prompt', () => {
    const mine = parseMyJobPapers({ job_number: 'J2391', linked: true, papers: [{ id: 'nda', paper_name: 'Ridgeway Builders NDA', is_form: true, document_id: null, status: 'none', signed_at: null }] })
    expect(mine).toEqual({ jobNumber: 'J2391', linked: true, papers: [{ id: 'nda', paperName: 'Ridgeway Builders NDA', isForm: true, documentId: null, status: 'none', signedAt: null }] })
    expect(parseMyJobPapers(undefined)).toEqual({ jobNumber: '', linked: false, papers: [] })
  })
})

describe('who owes what', () => {
  it('a paper with no copy is owed, a signed one is not', () => {
    expect(owedPapers(roster.people[0]!, roster.papers).map((p) => p.id)).toEqual([])
    expect(owedPapers(roster.people[1]!, roster.papers).map((p) => p.id)).toEqual(['site'])
    expect(owedPapers(roster.people[2]!, roster.papers).map((p) => p.id)).toEqual(['nda', 'site'])
    expect(owedPapers(roster.people[3]!, roster.papers).map((p) => p.id)).toEqual(['nda', 'site'])
  })
  it('counts who has signed everything from the rows drawn', () => {
    expect(rosterSummary(roster)).toEqual({ total: 4, open: 1, owing: 3, words: '1 of 4 have signed. 3 still owe a paper.' })
    const one = { ...roster, people: roster.people.slice(0, 2) }
    expect(rosterSummary(one).words).toBe('1 of 2 have signed. 1 still owes a paper.')
    expect(rosterSummary({ ...roster, people: roster.people.slice(0, 1) }).words).toBe('All 1 have signed.')
  })
})

describe('the words', () => {
  it('a day is written short', () => {
    expect(shortDay('2026-11-14')).toBe('Nov 14')
    expect(shortDay('2026-01-05T00:00:00Z')).toBe('Jan 5')
    expect(shortDay(null)).toBe('')
    expect(shortDay('soon')).toBe('')
  })
  it('a cell says signed with its day, or not yet', () => {
    expect(cellWords({ requiredPaperId: 'nda', documentId: 'd', status: 'signed', signedAt: '2026-11-14' })).toEqual({ signed: true, label: 'signed ✓', day: 'Nov 14' })
    expect(cellWords({ requiredPaperId: 'nda', documentId: 'd', status: 'sent', signedAt: null })).toEqual({ signed: false, label: 'not yet', day: '' })
  })
  it('names how a person comes to the job', () => {
    expect(roster.people.map(personRoleLabel)).toEqual(['Office', 'Crew', 'Crew', 'Sub, no login'])
    expect(personRoleLabel({ ways: ['crew'], role: 'superintendent', hasLogin: true })).toBe('Superintendent')
    expect(personRoleLabel({ ways: [], role: 'subcontractor', hasLogin: true })).toBe('Sub')
    expect(personRoleLabel({ ways: [], role: 'controller', hasLogin: true })).toBe('Office')
  })
  it('the save button names its count and is dead with nothing picked', () => {
    expect(requireButton(2)).toEqual({ label: 'Require 2 papers', dead: false })
    expect(requireButton(1)).toEqual({ label: 'Require 1 paper', dead: false })
    expect(requireButton(0)).toEqual({ label: 'Require papers', dead: true })
  })
  it('the foot counts who the save reaches and never claims a lock that is not live', () => {
    expect(JOB_PAPERS_LOCK_STAGE).toBe('database')
    expect(requireFoot(8, 'none')).toBe('8 people can open this job today. Each one is asked to sign, the office and you included.')
    expect(requireFoot(8, 'prompt')).toBe('8 people can open this job today. Each one is locked out of it until they sign, the office and you included.')
    expect(requireFoot(1, 'database')).toBe('1 person can open this job today. Each one is locked out of it until they sign, the office and you included.')
    expect(requireFoot(0, 'database')).toBe('Nobody is on this job yet. Each person signs before the job opens to them.')
    expect(lockStageNote('none')).toMatch(/does not lock yet/)
    expect(lockStageNote('prompt')).toMatch(/only lock for now/)
    expect(lockStageNote('database')).toBeNull()
  })
  it('the toast says what was required', () => {
    expect(requiredToast(2)).toBe('Required 2 papers.')
    expect(requiredToast(0)).toBe('This job already requires those papers.')
  })
  it('the roster door copies one link per paper owed', () => {
    expect(copyLinksLabel(1)).toBe('Copy the signing link')
    expect(copyLinksLabel(2)).toBe('Copy 2 signing links')
    expect(signingLinksText([{ paperName: 'Site rules', url: 'https://example.test/a' }])).toBe('https://example.test/a')
    expect(signingLinksText([{ paperName: 'NDA', url: 'https://example.test/a' }, { paperName: 'Site rules', url: 'https://example.test/b' }])).toBe('NDA: https://example.test/a\nSite rules: https://example.test/b')
  })
  it('a row with no file tied to it has no link, and says why', () => {
    expect(noLinkReason(roster.people[0]!)).toBeNull()
    expect(noLinkReason(roster.people[2]!)).toMatch(/No file is linked to this login/)
    expect(noLinkReason({ linked: false, hasLogin: false })).toMatch(/Not on the roster yet/)
  })
  it('the chip counts the papers, and a job with none has no chip', () => {
    expect(jobPapersChip(2)?.label).toBe('2 papers to sign')
    expect(jobPapersChip(1)?.label).toBe('1 paper to sign')
    expect(jobPapersChip(0)).toBeNull()
  })
})

describe('pickablePapers', () => {
  const book: BookPaperRow[] = [
    { id: 'book-nda', document_name: 'Ridgeway Builders NDA', book_body_html: null, book_body_format: 'html', form_template_id: 'form-1', audience: 'staff' },
    { id: 'book-site', document_name: 'Site rules and photo policy', book_body_html: '<p>No photos.</p>', book_body_format: 'html', audience: 'sub' },
    { id: 'book-site-2', document_name: 'Site rules and photo policy', book_body_html: '<p>No photos.</p>', book_body_format: 'html', audience: 'staff' },
    { id: 'book-blank', document_name: 'Blank paper', book_body_html: ' ', book_body_format: 'html', audience: 'staff' },
    { id: 'book-cust', document_name: 'Customer agreement', book_body_html: '<p>Terms.</p>', book_body_format: 'html', audience: 'customer' },
    { id: 'book-flow', document_name: 'Flow receipt', book_body_html: '<p>Thanks.</p>', book_body_format: 'html', audience: 'sub', flow_kind: 'residential' },
  ]
  it('offers one entry per named paper, without customer contracts and flow papers', () => {
    expect(pickablePapers(book, []).map((p) => `${p.paperName}|${p.isForm}|${p.hasWords}`)).toEqual(['Blank paper|false|false', 'Ridgeway Builders NDA|true|true', 'Site rules and photo policy|false|true'])
  })
  it('says where a paper comes from, and why a blank one cannot be picked', () => {
    const byName = new Map(pickablePapers(book, []).map((p) => [p.paperName, p.from]))
    expect(byName.get('Ridgeway Builders NDA')).toBe('A form from the Contract Book')
    expect(byName.get('Site rules and photo policy')).toBe('From the Contract Book')
    expect(byName.get('Blank paper')).toBe('No words yet. Write it in the Contract Book first.')
  })
  it('a paper with two copies is offered by the copy that has words', () => {
    const two: BookPaperRow[] = [
      { id: 'w9-shell', document_name: 'W-9', book_body_html: null, book_body_format: 'html', audience: 'sub', updated_at: '2026-11-10T00:00:00Z' },
      { id: 'w9-form', document_name: 'W-9', book_body_html: null, book_body_format: 'html', form_template_id: 'form-w9', audience: 'staff', updated_at: '2026-09-01T00:00:00Z' },
    ]
    expect(pickablePapers(two, [])).toEqual([{ bookDocumentId: 'w9-form', paperName: 'W-9', isForm: true, hasWords: true, from: 'A form from the Contract Book' }])
  })
  it('leaves out what the job already requires and what is already picked', () => {
    expect(pickablePapers(book, roster.papers).map((p) => p.paperName)).toEqual(['Blank paper'])
    expect(pickablePapers(book, [], ['book-nda']).map((p) => p.paperName)).toEqual(['Blank paper', 'Site rules and photo policy'])
  })
})

describe('the way back from the signing page', () => {
  it('a sub with no login goes back to their own page, by its link or its short address', () => {
    for (const path of ['/sub?t=0123456789abcdef0123456789abcdef', '/sub?t=0123456789abcdef&view=statements', '/sub', '/s/tall-pine', '/s/tall-pine?view=statements']) {
      expect(isSubPortalPath(path), path).toBe(true)
      expect(jobPapersBackLabel(path), path).toBe('Back to your page')
    }
  })

  it('anyone else goes back to the job', () => {
    for (const path of ['/dashboard?tab=today', '/jobs', '/submittal?t=abc', '/subs', '/s', '/s/', '/settings/s/tall-pine', '', null, undefined]) {
      expect(isSubPortalPath(path), String(path)).toBe(false)
      expect(jobPapersBackLabel(path), String(path)).toBe('Back to the job')
    }
  })
})
