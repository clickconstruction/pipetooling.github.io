import { describe, expect, it } from 'vitest'
import {
  CONTRACT_BOOK_PREVIEW_TTL_MS,
  parseContractPreviewEntry,
  serializeContractPreviewEntry,
  type ContractBookExportEntry,
} from './contractBookPreviewHandoff'

function entry(overrides: Partial<ContractBookExportEntry> = {}): ContractBookExportEntry {
  return {
    document_name: 'Non-disclosure agreement',
    book_body_html: '# Terms\n**Binding**',
    book_body_format: 'markdown',
    ...overrides,
  }
}

describe('serializeContractPreviewEntry / parseContractPreviewEntry', () => {
  it('round-trips an entry', () => {
    const e = entry()
    expect(parseContractPreviewEntry(serializeContractPreviewEntry(e))).toEqual(e)
  })

  it('round-trips a null body', () => {
    const e = entry({ book_body_html: null })
    expect(parseContractPreviewEntry(serializeContractPreviewEntry(e))).toEqual(e)
  })

  it('returns null for null, non-JSON, or non-object input', () => {
    expect(parseContractPreviewEntry(null)).toBeNull()
    expect(parseContractPreviewEntry('not json')).toBeNull()
    expect(parseContractPreviewEntry('[]')).toBeNull()
    expect(parseContractPreviewEntry('"x"')).toBeNull()
  })

  it('returns null for a wrong-shaped payload', () => {
    const badName = JSON.stringify({
      v: 1,
      writtenAt: Date.now(),
      payload: { document_name: 123, book_body_html: null, book_body_format: 'plain' },
    })
    const missingField = JSON.stringify({
      v: 1,
      writtenAt: Date.now(),
      payload: { document_name: 'x', book_body_format: 'plain' },
    })
    expect(parseContractPreviewEntry(badName)).toBeNull()
    expect(parseContractPreviewEntry(missingField)).toBeNull()
  })

  it('returns null for a missing/unknown version or invalid writtenAt', () => {
    expect(parseContractPreviewEntry(JSON.stringify({ v: 2, writtenAt: Date.now(), payload: entry() }))).toBeNull()
    expect(parseContractPreviewEntry(JSON.stringify({ v: 1, payload: entry() }))).toBeNull()
    expect(parseContractPreviewEntry(JSON.stringify({ v: 1, writtenAt: 'soon', payload: entry() }))).toBeNull()
  })

  it('returns null for an envelope older than the TTL', () => {
    const stale = JSON.stringify({
      v: 1,
      writtenAt: Date.now() - CONTRACT_BOOK_PREVIEW_TTL_MS - 1000,
      payload: entry(),
    })
    expect(parseContractPreviewEntry(stale)).toBeNull()
  })
})
