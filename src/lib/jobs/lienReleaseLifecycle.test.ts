import { describe, expect, it } from 'vitest'
import {
  canRequestLienSignature,
  lienReleaseChips,
  lienReleaseIsEditable,
  lienReleaseIsMinted,
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

  it('audit line stamps Chicago time and consent; null without a signed_at', () => {
    expect(lienReleaseSignatureAuditLine({ signed_at: null, signer_consented_at: null })).toBeNull()
    const line = lienReleaseSignatureAuditLine({
      signed_at: '2026-09-01T20:41:00Z',
      signer_consented_at: '2026-09-01T20:41:00Z',
    })
    expect(line).toContain('Signed electronically in ClickTooling')
    expect(line).toContain('Sep 1, 2026')
    expect(line).toContain('consent recorded')
    const noConsent = lienReleaseSignatureAuditLine({ signed_at: '2026-09-01T20:41:00Z', signer_consented_at: null })
    expect(noConsent).not.toContain('consent recorded')
  })
})
