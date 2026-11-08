import { describe, expect, it } from 'vitest'
import type { JobContractCoverage } from '../jobs/jobContractCoverage'
import { theirPaperFromRow, type TheirPaperRowLike } from '../jobs/theirPaper'
import { agreementCountsForSuit, signedAgreementBasis, theirPaperGapWords, theirPaperNotCounting } from './legalContractBasis'

const theirs = (over: Partial<TheirPaperRowLike> = {}): JobContractCoverage => {
  const row: TheirPaperRowLike = { id: 'c1', job_id: 'j1', status: 'signed', kind: 'their_paper', voided_at: null, paper_title: 'Harrow subcontract, their form', our_signer_name: 'D. Vasquez', our_signed_on: '2026-02-09', ...over }
  const record = theirPaperFromRow(row)
  return { kind: 'their_paper', contractId: 'c1', record, documentUrl: record.documentUrl }
}
const signed: JobContractCoverage = { kind: 'signed', source: 'paper', signedAt: '2026-04-01T10:00:00Z', signerName: 'Aaron Smith', contractId: 'c2', estimateNumber: null, estimateId: null }

describe('the Legal desk reads their paper (punch list #173)', () => {
  it('counts a signed agreement of ours, and their paper only once they rely on it or countersign', () => {
    expect(agreementCountsForSuit(signed)).toBe(true)
    expect(agreementCountsForSuit({ kind: 'none' })).toBe(false)
    expect(agreementCountsForSuit({ kind: 'not_needed', at: '2026-01-01T00:00:00Z', reason: null })).toBe(false)
    expect(agreementCountsForSuit(theirs())).toBe(false)
    expect(agreementCountsForSuit(theirs({ relied_on_on: '2026-10-02', relied_on_what: 'their notice of termination' }))).toBe(true)
    expect(agreementCountsForSuit(theirs({ their_signed_on: '2026-02-12' }))).toBe(true)
    expect(theirPaperNotCounting(theirs())?.record.ourSigner).toBe('D. Vasquez')
    expect(theirPaperNotCounting(theirs({ relied_on_on: '2026-10-02', relied_on_what: 'their notice' }))).toBeNull()
    expect(theirPaperNotCounting(signed)).toBeNull()
  })

  it('the basis line names what the theory stands on: ours when ours is signed, else their paper and the sworn account behind it', () => {
    expect(signedAgreementBasis([signed, theirs()], true)).toBe('a signed agreement is on file')
    expect(signedAgreementBasis([theirs({ relied_on_on: '2026-10-02', relied_on_what: 'their notice of termination' })], true)).toBe('their paper, signed by us only, relied on (their notice of termination, Oct 2, 2026); backup: sworn account')
    expect(signedAgreementBasis([theirs({ relied_on_on: '2026-10-02', relied_on_what: 'their notice of termination' })], false)).toBe('their paper, signed by us only, relied on (their notice of termination, Oct 2, 2026)')
    expect(signedAgreementBasis([theirs({ their_signed_on: '2026-02-12' })], true)).toBe('their paper, signed by both; backup: sworn account')
    // Nothing counts: the caller never asks, but the words stay safe.
    expect(signedAgreementBasis([theirs()], true)).toBe('a signed agreement is on file')
  })

  it('the gap for their paper that does not count yet: a note when the sworn account holds, a stop when it does not', () => {
    const cov = theirs()
    if (cov.kind !== 'their_paper') throw new Error('shape')
    const note = theirPaperGapWords(cov, '891', [])
    expect(note.severity).toBe('warn')
    expect(note.label).toBe('Their paper on 891 is signed by us only and not yet relied on — proceeds as a sworn account')
    expect(note.detail).toMatch(/^Harrow subcontract, their form, signed for us by D\. Vasquez on Feb 9, 2026, not countersigned\. Nothing recorded yet of them relying on it\. Record the day they relied on it/)
    const stop = theirPaperGapWords(cov, '891', ['an invoice the customer received'])
    expect(stop.severity).toBe('stop')
    expect(stop.label).toBe('Their paper on 891 is signed by us only, and no sworn-account basis')
    expect(stop.detail).toMatch(/fix what the sworn account is missing: an invoice the customer received\.$/)
  })
})
