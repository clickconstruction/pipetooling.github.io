import { describe, expect, it } from 'vitest'
import { esignConsentText } from '../esignConsent'
import { builtinEstimateExperience, resolveEstimateCustomerExperience, serializableSnapshot } from '../estimateCustomerExperience'
import { CUSTOMER_CONTRACT_CATALOG, resolveContractTexts, type ContractCatalogData, type ContractCatalogEntry, type ResolvedContractText } from './customerContractCatalog'
import {
  EMPTY_LAST_SENT,
  LAST_SENT_READERS,
  contractLastSent,
  lastSentDiffers,
  normalizeWording,
  sameWording,
  sentCompareKey,
  type ContractLastSentData,
  type JobContractSentRow,
} from './contractLastSent'

const entry = (id: string): ContractCatalogEntry => {
  const e = CUSTOMER_CONTRACT_CATALOG.find((x) => x.id === id)
  if (!e) throw new Error(`no catalog entry ${id}`)
  return e
}

const DOC = { id: 'doc-1', document_name: 'Service agreement', book_body_html: '1. Scope. Today.\n2. Payment.', book_body_format: 'plain', book_version_date: '2026-09-28' }
const DATA: ContractCatalogData = { settings: new Map([['bid_cover_letter_terms_default_v1', 'Net 30.']]), bookDocs: [DOC] }
const text = (id: string, data: ContractCatalogData = DATA): ResolvedContractText => resolveContractTexts(entry(id), data)[0]!
const sent = (over: Partial<ContractLastSentData>): ContractLastSentData => ({ ...EMPTY_LAST_SENT, ...over })

const row = (over: Partial<JobContractSentRow>): JobContractSentRow => ({
  id: 'c1',
  status: 'sent',
  body_html: '1. Scope. Today.\n2. Payment.',
  body_format: 'plain',
  template_document_id: 'doc-1',
  template_version_date: '2026-09-28',
  last_sent_at: '2026-09-25T15:00:00Z',
  sent_at: '2026-09-24T15:00:00Z',
  signed_at: null,
  voided_at: null,
  ...over,
})

describe('sameWording', () => {
  it('ignores spacing and line ends, and nothing else', () => {
    expect(normalizeWording('  1. Scope.\r\n\r\n\r\n2.  Payment. \n')).toBe('1. Scope.\n2. Payment.')
    expect(sameWording('1. Scope.\n\n2. Payment.', '1. Scope.\r\n2.   Payment.')).toBe(true)
    expect(sameWording('30 days', '45 days')).toBe(false)
    expect(sameWording(null, '')).toBe(true)
  })
})

describe('the readers', () => {
  it('every reader names a catalog entry', () => {
    for (const id of Object.keys(LAST_SENT_READERS)) expect(CUSTOMER_CONTRACT_CATALOG.some((e) => e.id === id), id).toBe(true)
  })

  it('an entry that keeps no copy has nothing to say', () => {
    expect(contractLastSent(entry('estimate-terms'), text('estimate-terms'), EMPTY_LAST_SENT)).toBeNull()
    expect(contractLastSent(entry('bid-closing'), text('bid-closing'), EMPTY_LAST_SENT)).toBeNull()
  })

  it('a compare key of its own', () => {
    expect(sentCompareKey('bid-terms')).toBe('sent:bid-terms')
  })
})

describe('job service agreement', () => {
  const e = entry('job-standard-terms')

  it('nothing sent yet', () => {
    expect(contractLastSent(e, text(e.id), EMPTY_LAST_SENT)).toMatchObject({ status: 'never', sentText: null, staleDrafts: 0, staleOut: 0 })
  })

  it('the last one sent carries the wording on the card', () => {
    const l = contractLastSent(e, text(e.id), sent({ jobContracts: [row({})] }))!
    expect(l.status).toBe('same')
    expect(l.line).toBe('The last agreement sent, Sep 25, 2026, carries this wording.')
    expect(l.sentLabel).toBe('Sent Sep 25')
  })

  it('the last one sent carries older wording, and says which', () => {
    const l = contractLastSent(e, text(e.id), sent({ jobContracts: [row({ body_html: '1. Scope. Before.', template_version_date: '2026-09-20' })] }))!
    expect(l.status).toBe('differs')
    expect(l.line).toContain('carries older wording (the wording of Sep 20)')
    expect(l.line).toContain('1 agreement is out for signature with older wording; it keeps what it went out with')
    expect(l.staleOut).toBe(1)
    expect(l.sentText).toBe('1. Scope. Before.')
  })

  it('reads the newest send, by the last time it went out', () => {
    const l = contractLastSent(e, text(e.id), sent({ jobContracts: [row({ id: 'old', body_html: 'old', last_sent_at: '2026-09-01T12:00:00Z', status: 'signed' }), row({ id: 'new' })] }))!
    expect(l.status).toBe('same')
  })

  it('counts unsent drafts on older wording, and says so even when nothing was ever sent', () => {
    const drafts = [row({ id: 'd1', status: 'draft', body_html: 'old', last_sent_at: null, sent_at: null }), row({ id: 'd2', status: 'draft', last_sent_at: null, sent_at: null })]
    const l = contractLastSent(e, text(e.id), sent({ jobContracts: drafts }))!
    expect(l).toMatchObject({ status: 'never', staleDrafts: 1, staleOut: 0 })
    expect(l.line).toContain('1 unsent draft still carries older wording')
  })

  it('leaves out a voided row, another document\'s rows, and paper that was filed and never sent', () => {
    const rows = [
      row({ id: 'void', voided_at: '2026-09-26T00:00:00Z', body_html: 'x' }),
      row({ id: 'other', template_document_id: 'doc-2', body_html: 'x' }),
      row({ id: 'built-in', template_document_id: null, body_html: 'x' }),
      row({ id: 'paper', status: 'signed', last_sent_at: null, sent_at: null, signed_at: '2026-09-26T00:00:00Z', body_html: 'x' }),
    ]
    expect(contractLastSent(e, text(e.id), sent({ jobContracts: rows }))).toMatchObject({ status: 'never', staleDrafts: 0, staleOut: 0 })
  })

  it('the built-in wording reads the rows written from it', () => {
    const builtIn = text(e.id, { settings: new Map(), bookDocs: [] })
    const l = contractLastSent(e, builtIn, sent({ jobContracts: [row({ template_document_id: null, body_html: builtIn.text, template_version_date: null })] }))!
    expect(l.status).toBe('same')
  })
})

describe('bid terms and exclusions', () => {
  it('nothing published yet', () => {
    expect(contractLastSent(entry('bid-terms'), text('bid-terms'), EMPTY_LAST_SENT)?.status).toBe('never')
  })

  it('the last proposal carried this wording, or its own', () => {
    const rev = { payload: { v: 1, terms: 'Net 30.', exclusions: 'No concrete.' }, published_at: '2026-09-26T18:00:00Z', rev_number: 2 }
    const same = contractLastSent(entry('bid-terms'), text('bid-terms'), sent({ bidRevision: rev }))!
    expect(same.status).toBe('same')
    expect(same.line).toBe('The last proposal published, Sep 26, 2026 (rev 2), carries this wording.')
    const own = contractLastSent(entry('bid-exclusions'), text('bid-exclusions'), sent({ bidRevision: rev }))!
    expect(own.status).toBe('differs')
    expect(own.line).toContain('A bid can carry its own.')
    expect(own.sentText).toBe('No concrete.')
    expect(own.sentLabel).toBe('Published Sep 26')
  })

  it('says so when the proposal went out with none', () => {
    const l = contractLastSent(entry('bid-terms'), text('bid-terms'), sent({ bidRevision: { payload: { v: 1, terms: '', exclusions: 'x' }, published_at: '2026-09-26T18:00:00Z', rev_number: 1 } }))!
    expect(l).toMatchObject({ status: 'differs', sentText: null })
    expect(l.line).toBe('The last proposal published, Sep 26, 2026 (rev 1), went out with no Terms at all.')
  })

  it('a payload that is not an object reads as none', () => {
    expect(contractLastSent(entry('bid-terms'), text('bid-terms'), sent({ bidRevision: { payload: null, published_at: '2026-09-26T18:00:00Z', rev_number: 1 } }))?.sentText).toBeNull()
  })
})

describe('estimates', () => {
  const est = (over: Record<string, unknown> = {}) => ({ terms_snapshot: '', customer_experience_sent: null, sent_at: '2026-09-27T14:00:00Z', estimate_number: 412, title: 'Water heater', ...over })

  it('the Terms box has no one wording to set against', () => {
    expect(contractLastSent(entry('estimate-terms-box'), text('estimate-terms-box'), EMPTY_LAST_SENT)?.status).toBe('never')
    const empty = contractLastSent(entry('estimate-terms-box'), text('estimate-terms-box'), sent({ estimate: est() }))!
    expect(empty).toMatchObject({ status: 'only', sentText: null })
    expect(empty.line).toBe('The last estimate sent, Sep 27, 2026 (estimate 412), went out with the Terms box empty.')
    const own = contractLastSent(entry('estimate-terms-box'), text('estimate-terms-box'), sent({ estimate: est({ terms_snapshot: 'Net 15.' }) }))!
    expect(own).toMatchObject({ status: 'only', sentText: 'Net 15.', sentLabel: 'Sent Sep 27' })
  })

  it('the agreement sentence is read from the copy frozen at send', () => {
    const e = entry('estimate-agree-sentence')
    const builtIn = builtinEstimateExperience().accept_checkbox_label
    const frozen = serializableSnapshot(resolveEstimateCustomerExperience([], {}, { title: 'x', estimateNumber: '1', acceptUrl: 'u' } as never))
    expect(frozen.acceptCheckboxLabel).toBe(builtIn)
    const card = text(e.id, { settings: new Map(), bookDocs: [] })
    expect(contractLastSent(e, card, sent({ estimate: est({ customer_experience_sent: frozen }) }))?.status).toBe('same')
    const own = contractLastSent(e, card, sent({ estimate: est({ customer_experience_sent: { ...frozen, acceptCheckboxLabel: 'I accept.' } }) }))!
    expect(own.status).toBe('differs')
    expect(own.line).toContain('An estimate can carry its own.')
    expect(contractLastSent(e, card, sent({ estimate: est({ customer_experience_sent: null }) }))).toMatchObject({ status: 'only', sentText: null })
  })
})

describe('electronic-signature consent', () => {
  const e = entry('esign-consent')
  const today = esignConsentText({ audience: 'customer', documentNoun: 'this agreement' })

  it('nothing signed yet', () => {
    expect(contractLastSent(e, text(e.id), EMPTY_LAST_SENT)?.status).toBe('never')
  })

  it('the last signature agreed to today\'s wording, for its own audience, noun and language', () => {
    const l = contractLastSent(e, text(e.id), sent({ consent: { clause_text: today.clauseText, consent_version: today.version, lang: 'en', audience: 'customer', document_noun: 'this agreement', consented_at: '2026-09-27T20:00:00Z' } }))!
    expect(l.status).toBe('same')
    expect(l.line).toContain('version 2, English, on this agreement')
    const es = esignConsentText({ audience: 'customer', documentNoun: 'este acuerdo', lang: 'es' })
    expect(contractLastSent(e, text(e.id), sent({ consent: { clause_text: es.clauseText, consent_version: es.version, lang: 'es', audience: 'customer', document_noun: 'este acuerdo', consented_at: '2026-09-27T20:00:00Z' } }))?.status).toBe('same')
  })

  it('an older wording is named as one', () => {
    const l = contractLastSent(e, text(e.id), sent({ consent: { clause_text: 'An older consent.', consent_version: 1, lang: 'en', audience: 'gc', document_noun: 'this proposal', consented_at: '2026-09-01T20:00:00Z' } }))!
    expect(l.status).toBe('differs')
    expect(l.line).toContain('version 1')
    expect(l.line).toContain('today is version 2')
    expect(l.sentText).toBe('An older consent.')
  })
})

describe('lastSentDiffers', () => {
  it('counts the cards whose customers are getting something else', () => {
    const e = entry('job-standard-terms')
    const stale = contractLastSent(e, text(e.id), sent({ jobContracts: [row({ id: 'd', status: 'draft', body_html: 'old', last_sent_at: null, sent_at: null })] }))
    const same = contractLastSent(e, text(e.id), sent({ jobContracts: [row({})] }))
    const only = contractLastSent(entry('estimate-terms-box'), text('estimate-terms-box'), sent({ estimate: { terms_snapshot: 'x', customer_experience_sent: null, sent_at: '2026-09-27T14:00:00Z', estimate_number: 1, title: '' } }))
    expect(lastSentDiffers([stale, same, only, null])).toBe(1)
  })
})
