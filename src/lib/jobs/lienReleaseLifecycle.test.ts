import { describe, expect, it } from 'vitest'
import {
  lienReleaseCancelTarget,
  canRequestLienSignature,
  lienReleaseChips,
  lienReleaseIsEditable,
  lienReleaseIsMinted,
  lienReleaseRowSignature,
  lienReleaseSignatureAuditLine,
  lienReleaseStatus,
} from './lienReleaseLifecycle'

describe('lienReleaseLifecycle', () => {
  it('status parses known values and defaults unknowns/legacy to issued', () => {
    expect(lienReleaseStatus({ status: 'draft' })).toBe('draft')
    expect(lienReleaseStatus({ status: 'awaiting_signature' })).toBe('awaiting_signature')
    expect(lienReleaseStatus({ status: 'signed' })).toBe('signed')
    expect(lienReleaseStatus({ status: 'issued' })).toBe('issued')
    expect(lienReleaseStatus({ status: '' })).toBe('issued')
    expect(lienReleaseStatus({ status: 'garbage' })).toBe('issued')
  })

  it('editable only while draft (or before any row exists); minted = anything past draft', () => {
    expect(lienReleaseIsEditable(null)).toBe(true)
    expect(lienReleaseIsEditable({ status: 'draft' })).toBe(true)
    expect(lienReleaseIsEditable({ status: 'issued' })).toBe(false)
    expect(lienReleaseIsMinted({ status: 'draft' })).toBe(false)
    expect(lienReleaseIsMinted({ status: 'issued' })).toBe(true)
    expect(lienReleaseIsMinted({ status: 'signed' })).toBe(true)
  })

  it('chips walk the lifecycle: draft → awaiting → signed → +sent; voided wins outright', () => {
    expect(lienReleaseChips({ status: 'draft', sent_to_customer_at: null, voided_at: null })).toEqual([
      { label: 'draft', tone: 'draft' },
    ])
    expect(lienReleaseChips({ status: 'awaiting_signature', sent_to_customer_at: null, voided_at: null })).toEqual([
      { label: 'awaiting signature', tone: 'awaiting' },
    ])
    expect(lienReleaseChips({ status: 'signed', sent_to_customer_at: '2026-09-02T00:00:00Z', voided_at: null })).toEqual([
      { label: 'signed ✓', tone: 'signed' },
      { label: 'sent ✓', tone: 'sent' },
    ])
    // Issued-unsigned (legacy Save & mark issued rows) shows no status chip — sent can still apply.
    expect(lienReleaseChips({ status: 'issued', sent_to_customer_at: null, voided_at: null })).toEqual([])
    expect(lienReleaseChips({ status: 'signed', sent_to_customer_at: null, voided_at: '2026-09-02T00:00:00Z' })).toEqual([
      { label: 'voided', tone: 'voided' },
    ])
  })

  it('a signature can be requested before mint, on drafts, and on issued rows — not on awaiting/signed/voided', () => {
    expect(canRequestLienSignature(null)).toBe(true)
    expect(canRequestLienSignature({ status: 'draft', voided_at: null })).toBe(true)
    expect(canRequestLienSignature({ status: 'issued', voided_at: null })).toBe(true)
    expect(canRequestLienSignature({ status: 'awaiting_signature', voided_at: null })).toBe(false)
    expect(canRequestLienSignature({ status: 'signed', voided_at: null })).toBe(false)
    expect(canRequestLienSignature({ status: 'issued', voided_at: '2026-09-02T00:00:00Z' })).toBe(false)
  })

  it('audit sentence (v2.4285): how, who, when in Chicago time, whose screen, consent; null without a signed_at', () => {
    expect(lienReleaseSignatureAuditLine({ signed_at: null, signer_consented_at: null })).toBeNull()
    const drawn = lienReleaseSignatureAuditLine(
      { signed_at: '2026-10-01T02:19:00Z', signer_consented_at: '2026-10-01T02:19:00Z', signer_printed_name: 'Malachi Whites', signer_signature_mode: 'draw' },
      'Robert',
    )
    expect(drawn).toBe('Drawn by Malachi Whites in ClickTooling on Sep 30, 2026 at 9:19 PM CT, on Robert’s screen, consent recorded.')
    const typed = lienReleaseSignatureAuditLine({ signed_at: '2026-09-01T20:41:00Z', signer_consented_at: '2026-09-01T20:41:00Z', signer_printed_name: 'Malachi Whites', signer_signature_mode: 'type' })
    expect(typed).toBe('Typed by Malachi Whites in ClickTooling on Sep 1, 2026 at 3:41 PM CT, consent recorded.')
    // Rows from before the loop carry no name — the old opener, still a sentence.
    const legacy = lienReleaseSignatureAuditLine({ signed_at: '2026-09-01T20:41:00Z', signer_consented_at: null })
    expect(legacy).toBe('Signed electronically in ClickTooling on Sep 1, 2026 at 3:41 PM CT.')
    expect(legacy).not.toContain('consent recorded')
  })
  it('lienReleaseRowSignature reads a signed row as the renderers’ signature — the row’s mode, the day signed', () => {
    const row = { status: 'signed', signed_at: '2026-10-01T02:19:00Z', signer_consented_at: '2026-10-01T02:19:00Z', signer_printed_name: 'Malachi Whites', signer_signature_mode: 'draw' }
    expect(lienReleaseRowSignature(row)).toEqual({
      mode: 'draw',
      printedName: 'Malachi Whites',
      pngDataUrl: null,
      auditLine: 'Drawn by Malachi Whites in ClickTooling on Sep 30, 2026 at 9:19 PM CT, consent recorded.',
      signedYmd: '2026-09-30',
    })
    expect(lienReleaseRowSignature({ ...row, status: 'awaiting_signature' })).toBeNull()
    expect(lienReleaseRowSignature({ ...row, signer_printed_name: null })).toBeNull()
  })
})

describe('lienReleaseCancelTarget (#87 C)', () => {
  const asked = '2026-10-01T18:00:00.000Z'
  it('sends a waiver minted by its own request back to a draft', () => {
    expect(lienReleaseCancelTarget({ status: 'awaiting_signature', minted_at: asked, signature_requested_at: asked })).toBe('draft')
    // The database may answer in another ISO shape for the same instant.
    expect(lienReleaseCancelTarget({ status: 'awaiting_signature', minted_at: '2026-10-01T18:00:00+00:00', signature_requested_at: asked })).toBe('draft')
  })
  it('keeps a waiver printed or marked issued first locked as issued', () => {
    expect(lienReleaseCancelTarget({ status: 'awaiting_signature', minted_at: '2026-10-01T15:12:00.000Z', signature_requested_at: asked })).toBe('issued')
  })
  it('keeps a row with no mint or request stamp locked (old rows, odd data)', () => {
    expect(lienReleaseCancelTarget({ status: 'awaiting_signature', minted_at: null, signature_requested_at: asked })).toBe('issued')
    expect(lienReleaseCancelTarget({ status: 'awaiting_signature', minted_at: null, signature_requested_at: null })).toBe('issued')
  })
  it('only applies to a waiting request', () => {
    expect(lienReleaseCancelTarget({ status: 'issued', minted_at: asked, signature_requested_at: asked })).toBe('issued')
    expect(lienReleaseCancelTarget({ status: 'signed', minted_at: asked, signature_requested_at: asked })).toBe('issued')
  })
})
