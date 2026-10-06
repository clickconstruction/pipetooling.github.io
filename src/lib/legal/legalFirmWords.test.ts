import { describe, expect, it } from 'vitest'
import { firmAgreementWords, firmExhibitTitle, firmEntryKindWords, firmEntryStatusWords, firmFeeKindWords, firmHistoryKindWords, firmJobRecord, firmJobRecordWords, firmRecipientStatusWords, firmSaidKindWords, firmSaidRecordedBy, firmSavedWords, legalFirmStageWords } from './legalFirmWords'
import { legalStageLabel } from './legalMatters'
import type { LegalJobLine } from './legalPacket'

describe('firmJobRecord · punch list #85 item 4 · facts on file, not a theory to plead', () => {
  const allFacts: LegalJobLine['record'] = { bill: 'sent', field: 'gps', dispute: false }
  const signed: LegalJobLine['contract'] = { kind: 'signed', source: 'contract', signedAt: '2026-04-22T15:00:00Z', signerName: 'Pat Sample', contractId: 'c', estimateNumber: null, estimateId: null }

  it('a signed agreement reads with its date and signer, and every other fact', () => {
    expect(firmJobRecordWords({ contract: signed, record: allFacts })).toBe('signed agreement 2026-04-22 by Pat Sample, bill sent, field record with a GPS location, no dispute logged')
  })

  it('no agreement: the facts on file, then what is not on file', () => {
    expect(firmJobRecord({ contract: { kind: 'none' }, record: allFacts })).toEqual({ onFile: ['bill sent', 'field record with a GPS location', 'no dispute logged'], notOnFile: ['signed agreement'] })
    expect(firmJobRecordWords({ contract: { kind: 'none' }, record: allFacts })).toBe('bill sent, field record with a GPS location, no dispute logged. Not on file: signed agreement')
  })

  it('an agreement sent and never signed, a bill never sent, no GPS, a dispute', () => {
    const r = firmJobRecord({ contract: { kind: 'sent', contractId: 'c', revision: 1, sentAt: '2026-03-02T15:00:00Z', viewCount: 2, recipientEmail: null }, record: { bill: 'not_sent', field: 'no_gps', dispute: true } })
    expect(r.onFile).toEqual(['agreement sent 2026-03-02, not signed', 'bill line, not sent', 'field records, no GPS location', 'dispute logged'])
    expect(r.notOnFile).toEqual(['signed agreement', 'bill sent to the customer', 'a GPS location'])
  })

  it('nothing from the field and no bill line are named as not on file', () => {
    expect(firmJobRecord({ contract: { kind: 'none' }, record: { bill: 'none', field: 'none', dispute: false } }).notOnFile).toEqual(['signed agreement', 'bill line', 'field records'])
  })

  it('says clock sessions awaiting approval beside the field record', () => {
    expect(firmJobRecord({ contract: { kind: 'none' }, record: { ...allFacts, awaitingApproval: 2 } }).onFile).toContain('2 clock sessions awaiting approval')
    expect(firmJobRecord({ contract: { kind: 'none' }, record: { ...allFacts, awaitingApproval: 1 } }).onFile).toContain('1 clock session awaiting approval')
  })

  it('no agreement needed reads the same on Account and Paper, and is not a missing agreement', () => {
    const nn = { kind: 'not_needed', at: '2026-09-01T12:00:00Z', reason: 'service call under $500' } as const
    expect(firmJobRecordWords({ contract: nn, record: allFacts })).toMatch(/^no agreement of ours needed, per the office: service call under \$500/)
    expect(firmAgreementWords(nn)).toEqual({ words: 'No agreement of ours needed, per the office: service call under $500', missing: false })
    expect(firmAgreementWords({ kind: 'none' })).toEqual({ words: 'None on file', missing: true })
    expect(firmAgreementWords(signed).missing).toBe(false)
  })

  it('never pleads a theory', () => {
    for (const record of [allFacts, { bill: 'none', field: 'none', dispute: true } as const]) {
      for (const contract of [signed, { kind: 'none' } as const]) expect(firmJobRecordWords({ contract, record })).not.toMatch(/sworn|holds|theory|contract\b/i)
    }
  })
})

const entry = (kind: string, via_portal: boolean, meta: unknown = {}, acknowledged_at: string | null = null) => ({ kind, via_portal, meta, acknowledged_at })

describe('legalFirmWords · punch list #85 item 3 · the firm reads its own words', () => {
  it('stages read as a firm says them, and the office keeps its own labels', () => {
    expect(['referred', 'demand', 'suit', 'judgment', 'settled', 'pulled'].map(legalFirmStageWords)).toEqual(['referred', 'demand sent', 'suit filed', 'judgment entered', 'settled', 'referral withdrawn'])
    expect(legalFirmStageWords(null)).toBe('under review by the office')
    expect(['post_judgment', 'payment_plan', 'uncollectible', 'dismissed'].map(legalFirmStageWords)).toEqual(['after judgment', 'payment plan', 'uncollectible', 'dismissed'])
    expect(legalStageLabel('referred')).toBe('With the firm · new')
  })

  it('the stage chip and the step picker agree on judgment entered', () => {
    expect(legalFirmStageWords('judgment')).toBe('judgment entered')
  })

  it('names whose act each entry is, with no raw kind names', () => {
    expect(firmEntryKindWords(entry('recovery_applied', false))).toBe('applied by the office')
    expect(firmEntryKindWords(entry('payment_received', true))).toBe('payment you received')
    expect(firmEntryKindWords(entry('step', true))).toBe('your step')
    expect(firmEntryKindWords(entry('note', false))).toBe('note from the office')
    expect(firmEntryKindWords(entry('question', true))).toBe('your question')
    expect(firmEntryKindWords(entry('question', false, { flavor: 'question' }))).toBe('question from the office')
    expect(firmEntryKindWords(entry('question', false, { flavor: 'signoff', jobLabel: '1042' }))).toBe('sign-off asked by the office, job 1042')
    expect(firmEntryKindWords(entry('answer', true, { askId: 'a', signedOff: true }))).toBe('your answer: signed off')
    expect(firmEntryKindWords(entry('answer', false))).toBe("the office's answer")
    for (const k of ['fee', 'cost', 'step', 'question', 'answer', 'payment_received', 'recovery_applied', 'note']) {
      expect(firmEntryKindWords(entry(k, true))).not.toMatch(/_/)
      expect(firmEntryKindWords(entry(k, false))).not.toMatch(/_/)
    }
  })

  it('the status says whether the office has seen it, or is waiting on the firm', () => {
    expect(firmEntryStatusWords(entry('fee', true))).toBe('not yet seen by the office')
    expect(firmEntryStatusWords(entry('fee', true, {}, '2026-10-05T12:00:00Z'))).toBe('seen by the office')
    expect(firmEntryStatusWords(entry('question', false))).toBe('waiting on you')
    expect(firmEntryStatusWords(entry('question', false, {}, '2026-10-05T12:00:00Z'))).toBe('withdrawn by the office')
    expect(firmEntryStatusWords(entry('recovery_applied', false))).toBe('from the office')
  })

  it('fees, history kinds and the email list read in plain words', () => {
    expect(firmFeeKindWords('fee')).toBe('Attorney fee')
    expect(firmFeeKindWords('cost')).toBe('Cost')
    expect(firmHistoryKindWords('billed')).toBe('bill sent')
    expect(firmHistoryKindWords('collections')).toBe('sent to collections')
    expect(firmHistoryKindWords('contract')).toBe('agreement')
    expect(firmExhibitTitle('What was said — contacts, promises, calls')).toBe('Record of contact: calls, emails, visits, promises')
    expect(firmExhibitTitle('Signed agreements')).toBe('Signed agreements')
    expect(firmRecipientStatusWords({ paused: false, confirmed: false })).toBe('not confirmed yet')
    expect(firmRecipientStatusWords({ paused: true, confirmed: true })).toBe('stopped')
  })

  it('after an act, says what happens next for that act, never the office’s Needs You list', () => {
    expect(firmSavedWords({ kind: 'fee' })).toBe('Saved. The office sees it now, and it counts toward the total demand.')
    expect(firmSavedWords({ kind: 'step', stage: 'suit' })).toBe('Saved. The matter now reads suit filed.')
    expect(firmSavedWords({ kind: 'payment_received' })).toMatch(/applies it to the job/)
    expect(firmSavedWords({ kind: 'recipient_add' })).toBe('Sent. They get one confirmation email.')
    expect(firmSavedWords({ kind: 'recipient_rules' })).toBe('Saved.')
    for (const kind of ['fee', 'cost', 'step', 'payment_received', 'question', 'answer', 'recipient_add', 'recipient_resend', 'recipient_stop', 'recipient_resume', 'recipient_rules']) {
      expect(firmSavedWords({ kind, stage: 'demand' })).not.toMatch(/Needs You|Click|—/)
    }
  })
})

describe('firmSaidRecordedBy · firmSaidKindWords (integration pass)', () => {
  it('says the customer only for a promise the customer made on their own page', () => {
    expect(firmSaidRecordedBy({ by: 'Taunya', kind: 'call' })).toBe('Taunya')
    expect(firmSaidRecordedBy({ by: null, kind: 'promise', fromCustomer: true })).toBe('the customer')
    expect(firmSaidRecordedBy({ by: null, kind: 'promise', fromCustomer: false })).toBe('—')
    expect(firmSaidRecordedBy({ by: null, kind: 'note' })).toBe('—')
    expect((['contact', 'promise', 'call', 'note'] as const).map(firmSaidKindWords)).toEqual(['contact', 'promise to pay', 'collection call', 'collections note'])
  })
})
