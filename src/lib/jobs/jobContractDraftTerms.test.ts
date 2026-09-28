import { describe, expect, it } from 'vitest'
import { DEFAULT_JOB_CONTRACT_TERMS_PLAIN } from './jobContractDocument'
import { BUILTIN_JOB_CONTRACT_TERMS_NAME, draftTermsToWrite, jobContractTermsFromTemplate, jobContractTermsInEffect, pickJobContractTerms, type JobContractTermsRow } from './jobContractDraftTerms'

const BOOK = { id: 't1', document_name: 'Service agreement', book_body_html: '<p>Late payment: 1.5% a month.</p>', book_body_format: 'html', book_version_date: '2026-09-27' }
const NOW = jobContractTermsFromTemplate(BOOK)

/** A draft written from the Book document a week ago, before the wording changed. */
const STALE: JobContractTermsRow = {
  status: 'draft',
  voided_at: null,
  body_html: '<p>Late payment: 1% a month.</p>',
  body_format: 'html',
  template_document_id: 't1',
  template_name: 'Service agreement',
  template_version_date: '2026-09-20',
}

describe('jobContractTermsFromTemplate', () => {
  it('reads the five terms columns off a Book document', () => {
    expect(NOW).toEqual({ body_html: '<p>Late payment: 1.5% a month.</p>', body_format: 'html', template_document_id: 't1', template_name: 'Service agreement', template_version_date: '2026-09-27' })
  })

  it('a Book document with no body yet is blank terms, never the built-in wording', () => {
    expect(jobContractTermsFromTemplate({ ...BOOK, book_body_html: null }).body_html).toBe('')
  })

  it('with no document it is the built-in wording, plain, with no version', () => {
    expect(jobContractTermsFromTemplate(null)).toEqual({ body_html: DEFAULT_JOB_CONTRACT_TERMS_PLAIN, body_format: 'plain', template_document_id: null, template_name: BUILTIN_JOB_CONTRACT_TERMS_NAME, template_version_date: null })
  })
})

describe('pickJobContractTerms', () => {
  it('keeps the terms columns and nothing else', () => {
    expect(pickJobContractTerms({ ...STALE, job_id: 'j1' } as never)).toEqual({ body_html: STALE.body_html, body_format: 'html', template_document_id: 't1', template_name: 'Service agreement', template_version_date: '2026-09-20' })
  })

  it('a missing column reads as the column default', () => {
    expect(pickJobContractTerms({})).toEqual({ body_html: null, body_format: 'plain', template_document_id: null, template_name: null, template_version_date: null })
  })
})

describe('draftTermsToWrite', () => {
  it('same document, newer wording: the draft takes the current wording, name and version', () => {
    expect(draftTermsToWrite(STALE, NOW)).toEqual(NOW)
  })

  it('same document, only the name or the version moved: still a refresh', () => {
    expect(draftTermsToWrite({ ...STALE, body_html: NOW.body_html }, NOW)).toEqual(NOW)
    expect(draftTermsToWrite({ ...STALE, body_html: NOW.body_html, template_version_date: NOW.template_version_date, template_name: 'Old name' }, NOW)).toEqual(NOW)
    expect(draftTermsToWrite({ ...STALE, body_html: NOW.body_html, template_version_date: NOW.template_version_date, body_format: 'plain' }, NOW)).toEqual(NOW)
  })

  it('same document, identical wording: nothing to write', () => {
    expect(draftTermsToWrite({ ...STALE, ...NOW }, NOW)).toBeNull()
    // A blank body is blank whether the row holds '' or null.
    const blank = jobContractTermsFromTemplate({ ...BOOK, book_body_html: null })
    expect(draftTermsToWrite({ ...STALE, ...blank, body_html: null }, blank)).toBeNull()
  })

  it('a draft written from a different document keeps its terms', () => {
    expect(draftTermsToWrite({ ...STALE, template_document_id: 't2', template_name: 'Commercial agreement' }, NOW)).toBeNull()
  })

  it('a draft written from the built-in wording keeps its terms', () => {
    const builtin: JobContractTermsRow = { ...jobContractTermsFromTemplate(null), status: 'draft', voided_at: null }
    expect(draftTermsToWrite(builtin, NOW)).toBeNull()
    // …and saving with the built-in wording never matches a built-in draft either: there is no document to follow.
    expect(draftTermsToWrite({ ...builtin, body_html: 'typed in the Contract window' }, jobContractTermsFromTemplate(null))).toBeNull()
  })

  it('a Book draft saved while the sweep is on the built-in wording keeps its terms', () => {
    expect(draftTermsToWrite(STALE, jobContractTermsFromTemplate(null))).toBeNull()
  })

  it('no row yet: the insert carries the template’s terms', () => {
    expect(draftTermsToWrite(null, NOW)).toEqual(NOW)
    expect(draftTermsToWrite(null, jobContractTermsFromTemplate(null))?.body_html).toBe(DEFAULT_JOB_CONTRACT_TERMS_PLAIN)
  })

  it('a sent row is never touched — it keeps the wording it went out with', () => {
    expect(draftTermsToWrite({ ...STALE, status: 'sent' }, NOW)).toBeNull()
  })

  it('nor is a signed or a voided one', () => {
    expect(draftTermsToWrite({ ...STALE, status: 'signed' }, NOW)).toBeNull()
    expect(draftTermsToWrite({ ...STALE, status: 'voided' }, NOW)).toBeNull()
    expect(draftTermsToWrite({ ...STALE, voided_at: '2026-09-21T00:00:00Z' }, NOW)).toBeNull()
  })
})

describe('jobContractTermsInEffect', () => {
  it('no row: the chosen terms', () => {
    expect(jobContractTermsInEffect(null, NOW)).toEqual(NOW)
  })

  it('a draft behind its document shows the current wording — what the send will write', () => {
    expect(jobContractTermsInEffect(STALE, NOW)).toEqual(NOW)
  })

  it('a draft from another document, a built-in draft and a sent row show their own', () => {
    const other = { ...STALE, template_document_id: 't2', template_name: 'Commercial agreement' }
    expect(jobContractTermsInEffect(other, NOW)).toEqual(pickJobContractTerms(other))
    const builtin: JobContractTermsRow = { ...jobContractTermsFromTemplate(null), status: 'draft' }
    expect(jobContractTermsInEffect(builtin, NOW).template_name).toBe(BUILTIN_JOB_CONTRACT_TERMS_NAME)
    expect(jobContractTermsInEffect({ ...STALE, status: 'sent' }, NOW).body_html).toBe(STALE.body_html)
  })
})
