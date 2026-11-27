/**
 * Secrecy on a site (punch list #439, piece 4): the rules and the words of the block. Made-up names only.
 */
import { describe, expect, it } from 'vitest'
import type { BookPaperRow } from '../jobs/jobPapers'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import {
  type SiteSecrecyRow,
  SITE_SECRECY_WORDS,
  TURNED_OFF_TOAST,
  canReadSecrecy,
  canTurnSecrecy,
  jobSecrecyDoor,
  liveSecrecy,
  onCountSentences,
  onSinceSentence,
  paperSecrecySite,
  parseSecrecyPreview,
  previewValues,
  secrecyDraws,
  secrecyLead,
  secrecyNotThereYet,
  secrecyPapers,
  turnOffConfirm,
  turnOnButton,
  turnedOnToast,
} from './siteSecrecy'

const row = (over: Partial<SiteSecrecyRow> = {}): SiteSecrecyRow => ({
  id: 'site-1',
  development_id: 'dev-1',
  address_key: null,
  address: null,
  book_document_id: 'book-sec',
  paper_name: 'ZZ Test site secrecy paper',
  turned_on_at: '2026-11-27T15:00:00Z',
  turned_off_at: null,
  ...over,
})

describe('who presses and who reads', () => {
  it('the four office roles turn it on and off', () => {
    expect(['dev', 'master_technician', 'assistant', 'controller'].map(canTurnSecrecy)).toEqual([true, true, true, true])
    expect(['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', null, undefined].map(canTurnSecrecy)).toEqual([false, false, false, false, false, false, false])
  })
  it('the estimator reads and presses nothing, and nobody else reads', () => {
    expect(canReadSecrecy('estimator')).toBe(true)
    expect(canReadSecrecy('assistant')).toBe(true)
    expect(['primary', 'superintendent', 'subcontractor', 'helpers', null].map(canReadSecrecy)).toEqual([false, false, false, false, false])
  })
})

describe('a job’s door (4c)', () => {
  it('a job in a development reads the development’s secrecy and presses nothing', () => {
    expect(jobSecrecyDoor({ development_id: 'dev-1', job_address: '12 Sample St' })).toEqual({ site: { developmentId: 'dev-1' }, mode: 'reads' })
  })
  it('a lone job’s site is its address, and its tab is the door', () => {
    expect(jobSecrecyDoor({ development_id: null, job_address: '  12 Sample St ' })).toEqual({ site: { address: '12 Sample St' }, mode: 'door' })
  })
  it('a job with no development and no address has no site', () => {
    expect(jobSecrecyDoor({ development_id: null, job_address: '   ' })).toBeNull()
    expect(jobSecrecyDoor({})).toBeNull()
  })
  it('the lead says which jobs: here on a development, at this address on a lone job', () => {
    expect(secrecyLead({ developmentId: 'dev-1' })).toBe(SITE_SECRECY_WORDS.lead)
    expect(secrecyLead({ address: '12 Sample St' })).toMatch(/every job at this address/)
    expect(plainWordsFailures(SITE_SECRECY_WORDS.leadAddress)).toEqual([])
    expect(plainWordsFailures(SITE_SECRECY_WORDS.onDevelopment)).toEqual([])
  })
})

describe('Send a paper’s offer (4d)', () => {
  it('a paper’s site is the block’s site: a development by its id, an address as it is written', () => {
    expect(paperSecrecySite({ kind: 'development', developmentId: 'dev-1', name: 'Sample Ranch' })).toEqual({ developmentId: 'dev-1' })
    expect(paperSecrecySite({ kind: 'address', key: '12 sample street', address: ' 12 Sample St ' })).toEqual({ address: '12 Sample St' })
  })
  it('a paper that names no site has none, and neither has an empty address', () => {
    expect(paperSecrecySite(null)).toBeNull()
    expect(paperSecrecySite(undefined)).toBeNull()
    expect(paperSecrecySite({ kind: 'address', key: '', address: '   ' })).toBeNull()
    expect(paperSecrecySite({ kind: 'development', developmentId: '', name: 'Sample Ranch' })).toBeNull()
  })
  it('the offer draws for whoever can turn secrecy on, until it is passed over, and says an on site is on', () => {
    const base = { mode: 'offer' as const, on: false, failed: false, canTurn: true, passed: false }
    expect(secrecyDraws(base)).toBe(true)
    expect(secrecyDraws({ ...base, passed: true })).toBe(false)
    expect(secrecyDraws({ ...base, canTurn: false })).toBe(false)
    expect(secrecyDraws({ ...base, failed: true })).toBe(false)
    // On, it says so even after Only send this one was pressed for the site while it was off.
    expect(secrecyDraws({ ...base, on: true, passed: true })).toBe(true)
    expect(secrecyDraws({ ...base, on: true, canTurn: false })).toBe(false)
  })
  it('the other two modes draw as they did', () => {
    const base = { on: false, failed: false, canTurn: false, passed: false }
    expect(secrecyDraws({ ...base, mode: 'door' })).toBe(true)
    expect(secrecyDraws({ ...base, mode: 'door', failed: true })).toBe(true)
    expect(secrecyDraws({ ...base, mode: 'reads' })).toBe(false)
    expect(secrecyDraws({ ...base, mode: 'reads', on: true })).toBe(true)
  })
  it('its words pass the plain-words rules', () => {
    expect(plainWordsFailures(SITE_SECRECY_WORDS.offerLead)).toEqual([])
    expect(SITE_SECRECY_WORDS.onlySend).toBe('Only send this one')
  })
})

describe('the row that is on', () => {
  it('is the one not turned off, the newest if two', () => {
    expect(liveSecrecy([])).toBeNull()
    expect(liveSecrecy([row({ turned_off_at: '2026-11-28T00:00:00Z' })])).toBeNull()
    expect(liveSecrecy([row({ id: 'old', turned_off_at: '2026-11-20T00:00:00Z' }), row({ id: 'now' })])?.id).toBe('now')
    expect(liveSecrecy([row({ id: 'a', turned_on_at: '2026-11-01T00:00:00Z' }), row({ id: 'b', turned_on_at: '2026-11-27T00:00:00Z' })])?.id).toBe('b')
  })
})

describe('before the migration is pushed', () => {
  it('a missing table reads as not there yet, and a refusal does not', () => {
    expect(secrecyNotThereYet({ code: 'PGRST205', message: 'Could not find the table public.site_secrecy in the schema cache' })).toBe(true)
    expect(secrecyNotThereYet({ code: '42P01', message: 'relation "public.site_secrecy" does not exist' })).toBe(true)
    expect(secrecyNotThereYet({ code: 'PGRST202', message: 'Could not find the function public.site_secrecy_preview' })).toBe(true)
    expect(secrecyNotThereYet({ code: 'PGRST202', message: 'Could not find the function public.something_else' })).toBe(false)
    expect(secrecyNotThereYet({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(secrecyNotThereYet(new Error('Failed to fetch'))).toBe(false)
    expect(secrecyNotThereYet(null)).toBe(false)
  })
})

describe('what the press would reach', () => {
  it('reads the two counts, and anything odd as none', () => {
    expect(parseSecrecyPreview({ jobs: 3, people: 12, address_key: null })).toEqual({ jobs: 3, people: 12 })
    expect(parseSecrecyPreview({ jobs: '3', people: -1 })).toEqual({ jobs: 0, people: 0 })
    expect(parseSecrecyPreview(null)).toEqual({ jobs: 0, people: 0 })
  })
  it('each count is a value with its noun', () => {
    expect(previewValues({ jobs: 3, people: 12 })).toEqual({ jobs: '3 jobs', people: '12 people', jobsNote: 'Each job stays shut to a person until they sign.' })
    expect(previewValues({ jobs: 1, people: 1 })).toEqual({ jobs: '1 job', people: '1 person', jobsNote: 'The job stays shut to each person until they sign.' })
    expect(previewValues({ jobs: 0, people: 4 }).jobsNote).toBe('No job is here yet. A job added later takes the paper.')
  })
  it('the last press names the act and its count, dead until a paper is picked and the count is read', () => {
    expect(turnOnButton({ jobs: 3, people: 12 }, true, false)).toEqual({ label: 'Turn it on and ask 12 people to sign', dead: false })
    expect(turnOnButton({ jobs: 1, people: 1 }, true, false)).toEqual({ label: 'Turn it on and ask 1 person to sign', dead: false })
    expect(turnOnButton({ jobs: 3, people: 12 }, false, false).dead).toBe(true)
    expect(turnOnButton(null, true, false)).toEqual({ label: 'Turn it on', dead: true })
    expect(turnOnButton({ jobs: 0, people: 0 }, true, false)).toEqual({ label: 'Turn it on', dead: false })
    expect(turnOnButton({ jobs: 3, people: 12 }, true, true)).toEqual({ label: 'Turning it on…', dead: true })
  })
})

describe('the papers the panel offers', () => {
  const book: BookPaperRow[] = [
    { id: 'book-sec', document_name: 'ZZ Test site secrecy paper', book_body_html: '<p>Say nothing.</p>', book_body_format: 'html', audience: 'staff' },
    { id: 'book-form', document_name: 'ZZ Test form', book_body_html: null, book_body_format: 'html', form_template_id: 'form-1', audience: 'staff' },
    { id: 'book-blank', document_name: 'Blank paper', book_body_html: '', book_body_format: 'html', audience: 'staff' },
    { id: 'book-set', document_name: 'Sample secrecy paper', book_body_html: null, book_body_format: 'html', audience: 'sub', settings_def: { settings: [], fields: [], levels: [] } },
    { id: 'book-cust', document_name: 'Customer contract', book_body_html: '<p>x</p>', book_body_format: 'html', audience: 'customer' },
  ]
  it('leaves out a paper built from settings and the customer’s papers, and keeps one with no words, dead', () => {
    const offered = secrecyPapers(book)
    expect(offered.map((p) => p.paperName).sort()).toEqual(['Blank paper', 'ZZ Test form', 'ZZ Test site secrecy paper'])
    expect(offered.find((p) => p.paperName === 'Blank paper')?.hasWords).toBe(false)
  })
})

describe('the on state', () => {
  it('says since when, with the day a value', () => {
    expect(plainSentence(onSinceSentence('2026-11-27'))).toBe('On since Nov 27')
    expect(onSinceSentence(null)).toBe('On')
  })
  it('counts the jobs and the signed, and leaves the signed out when it could not be read', () => {
    const many = onCountSentences({ jobs: 3, signed: 5 })
    expect(plainSentence(many.jobs)).toBe('3 jobs carry the paper')
    expect(plainSentence(many.signed ?? '')).toBe('5 people have signed')
    const one = onCountSentences({ jobs: 1, signed: 1 })
    expect(plainSentence(one.jobs)).toBe('1 job carries the paper')
    expect(plainSentence(one.signed ?? '')).toBe('1 person has signed')
    expect(onCountSentences({ jobs: 0, signed: 0 })).toEqual({ jobs: 'No job is here yet', signed: 'Nobody has signed yet' })
    expect(onCountSentences({ jobs: 2, signed: null }).signed).toBeNull()
  })
  it('the confirm names the act, what opens and what is kept', () => {
    expect(turnOffConfirm(row(), { jobs: 3, signed: 5 })).toEqual({
      title: 'Turn off secrecy for this site?',
      message: 'The 3 jobs here open at once. Every signature on ZZ Test site secrecy paper is kept. Turn it on again and only people who never signed are asked.',
      confirmLabel: 'Turn secrecy off',
      cancelLabel: 'Keep it on',
    })
    expect(turnOffConfirm(row(), { jobs: 1, signed: 0 }).message).toMatch(/^The 1 job here opens at once\./)
    expect(turnOffConfirm(row(), null).message).toMatch(/^Nobody will be asked to sign for this site any more\./)
  })
  it('the toasts say what changed', () => {
    expect(turnedOnToast(3)).toBe('Secrecy is on. 3 jobs now ask for the paper.')
    expect(turnedOnToast(1)).toBe('Secrecy is on. 1 job now asks for the paper.')
    expect(turnedOnToast(0)).toBe('Secrecy is on for this site.')
  })
})

describe('plain words', () => {
  it('every sentence a first-timer reads passes the rules', () => {
    const W = SITE_SECRECY_WORDS
    const said = [
      W.lead, W.pickPaperHint, W.noPapers, W.once, W.subs, W.later, W.undo, W.estimator, TURNED_OFF_TOAST,
      turnOffConfirm(row(), { jobs: 3, signed: 5 }).message,
      turnOffConfirm(row(), null).message,
      turnedOnToast(3),
      ...Object.values(previewValues({ jobs: 0, people: 0 })),
      previewValues({ jobs: 2, people: 2 }).jobsNote,
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})
