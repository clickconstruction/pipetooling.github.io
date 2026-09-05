import { describe, expect, it } from 'vitest'
import {
  buildSubDocumentInsert,
  defaultSubDocumentName,
  emptySubDocumentDraft,
  subDocumentDraftValid,
  suggestSubDocumentType,
  suggestedRetype,
  type SubDocumentDraft,
} from './subDocumentDraft'

function draft(overrides: Partial<SubDocumentDraft>): SubDocumentDraft {
  return { ...emptySubDocumentDraft(), ...overrides }
}

describe('subDocumentDraftValid', () => {
  it('requires a type', () => {
    expect(subDocumentDraftValid(emptySubDocumentDraft())).toEqual({ ok: false, reason: 'Pick what the document is.' })
    expect(subDocumentDraftValid(draft({ docType: 'bogus' as never }))).toEqual({ ok: false, reason: 'Unknown document type.' })
  })

  it('a COI needs an expiration; a W-9 does not', () => {
    const coi = subDocumentDraftValid(draft({ docType: 'coi' }))
    expect(coi.ok).toBe(false)
    expect(!coi.ok && coi.reason).toMatch(/COI needs its expiration/)
    expect(subDocumentDraftValid(draft({ docType: 'coi', expiresAt: '2027-01-31' }))).toEqual({ ok: true })
    expect(subDocumentDraftValid(draft({ docType: 'w9' }))).toEqual({ ok: true })
    expect(subDocumentDraftValid(draft({ docType: 'license' }))).toEqual({ ok: true })
    expect(subDocumentDraftValid(draft({ docType: 'agreement' }))).toEqual({ ok: true })
  })

  it('an expiry, when given, must be a calendar date', () => {
    expect(subDocumentDraftValid(draft({ docType: 'w9', expiresAt: 'next year' })).ok).toBe(false)
    expect(subDocumentDraftValid(draft({ docType: 'w9', expiresAt: '2027-06-01' })).ok).toBe(true)
  })

  it('a link, when given, must be https', () => {
    expect(subDocumentDraftValid(draft({ docType: 'w9', url: 'drive.google.com/x' })).ok).toBe(false)
    expect(subDocumentDraftValid(draft({ docType: 'w9', url: 'http://example.com/w9.pdf' })).ok).toBe(false)
    expect(subDocumentDraftValid(draft({ docType: 'w9', url: 'https://drive.google.com/file/d/abc/view' }))).toEqual({ ok: true })
  })
})

describe('buildSubDocumentInsert', () => {
  const person = { personId: 'p-1', personName: 'Jesse Ramos' }

  it('files the document as on-file (signed) with the type set from birth', () => {
    const row = buildSubDocumentInsert(draft({ docType: 'coi', expiresAt: '2027-01-31', url: ' https://drive.google.com/file/d/abc/view ' }), person, '2026-09-05T15:00:00.000Z', 'lineage-1')
    expect(row).toEqual({
      person_id: 'p-1',
      person_name: 'Jesse Ramos',
      document_name: 'COI (filed)',
      doc_type: 'coi',
      expires_at: '2027-01-31',
      url: 'https://drive.google.com/file/d/abc/view',
      status: 'signed',
      signed_at: '2026-09-05T15:00:00.000Z',
      contract_lineage_id: 'lineage-1',
      lineage_version: 1,
      supersedes_person_contract_document_id: null,
    })
  })

  it('keeps a typed name, blanks become the type default, no expiry/link become null', () => {
    const named = buildSubDocumentInsert(draft({ docType: 'w9', documentName: '  W-9 2026  ' }), person, 'now', 'l')
    expect(named.document_name).toBe('W-9 2026')
    expect(named.expires_at).toBeNull()
    expect(named.url).toBeNull()
    const blank = buildSubDocumentInsert(draft({ docType: 'license' }), { personId: null, personName: 'Roster Only' }, 'now', 'l')
    expect(blank.document_name).toBe(defaultSubDocumentName('license'))
    expect(blank.person_id).toBeNull()
  })
})

describe('name → type suggestions (J32-N2: everything minted on Contracts defaults to agreement)', () => {
  it('recognises W-9, COI and license spellings; leaves contracts alone', () => {
    expect(suggestSubDocumentType('W-9')).toBe('w9')
    expect(suggestSubDocumentType('w9 2026')).toBe('w9')
    expect(suggestSubDocumentType('COI 2026')).toBe('coi')
    expect(suggestSubDocumentType('Certificate of Liability Insurance')).toBe('coi')
    expect(suggestSubDocumentType('Plumbing License')).toBe('license')
    expect(suggestSubDocumentType('Master Subcontract Agreement')).toBeNull()
    expect(suggestSubDocumentType('Employee Handbook')).toBeNull()
  })

  it('suggestedRetype fires only for rows still on the DB default', () => {
    expect(suggestedRetype({ document_name: 'COI 2026', doc_type: 'agreement' })).toBe('coi')
    expect(suggestedRetype({ document_name: 'COI 2026', doc_type: null })).toBe('coi')
    expect(suggestedRetype({ document_name: 'COI 2026', doc_type: 'coi' })).toBeNull()
    expect(suggestedRetype({ document_name: 'COI 2026', doc_type: 'other' })).toBeNull()
    expect(suggestedRetype({ document_name: 'Master Subcontract Agreement', doc_type: 'agreement' })).toBeNull()
  })
})
