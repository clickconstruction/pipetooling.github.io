import { describe, expect, it } from 'vitest'
import { firmExhibitTitle, firmEntryKindWords, firmEntryStatusWords, firmFeeKindWords, firmHistoryKindWords, firmRecipientStatusWords, firmSavedWords, legalFirmStageWords } from './legalFirmWords'
import { legalStageLabel } from './legalMatters'

const entry = (kind: string, via_portal: boolean, meta: unknown = {}, acknowledged_at: string | null = null) => ({ kind, via_portal, meta, acknowledged_at })

describe('legalFirmWords · punch list #85 item 3 · the firm reads its own words', () => {
  it('stages read as a firm says them, and the office keeps its own labels', () => {
    expect(['referred', 'demand', 'suit', 'judgment', 'settled', 'pulled'].map(legalFirmStageWords)).toEqual(['referred', 'demand sent', 'suit filed', 'judgment entered', 'settled', 'referral withdrawn'])
    expect(legalFirmStageWords(null)).toBe('under review by the office')
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
