import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { LIEN_REMINDER_TEXT_MISS, LIEN_REMINDER_TEXT_MISS_OTHER, lienApprovalPush, lienReminderText, lienReminderTextMiss, lienSignatureReminderPush } from './lienApprovalPush'
import { lienReminderOutcome, lienReminderPlan, lienReminderWords } from './lienLeaderReminder'
import { lienReminderTextOf, lienTellMissReason } from './lienLeaderTold'

/** The reminder as a text message (v2.7495): its words, why one did not go, and what the office reads after the press. */
describe('lienReminderText', () => {
  it('says who is reminding, the push’s own title and line, and ends on the link', () => {
    const words = lienSignatureReminderPush({ papers: [{ jobLabel: '650 · Tune 5 Liberty Hill', jobId: 'j650', mailByYmd: '2026-11-20' }], todayYmd: '2026-11-16', senderName: 'Wendi Park' })
    expect(lienReminderText(words, 'Wendi Park', 'https://app.test/')).toBe('Wendi is reminding you: Sign a lien notice. 650, Tune 5 Liberty Hill, mail by Nov 20, 4 days. https://app.test/lien-desk?tab=notices&job=j650&pile=ready')
  })

  it('keeps to plain characters, so the carrier does not switch to the wide alphabet', () => {
    const words = lienApprovalPush({ jobLabel: '891 · O’Brien “Lofts”', jobId: 'j1', claim: 27_199, gcName: 'Brund & Assoc.', dueYmd: '2026-12-15', todayYmd: '2026-11-16', senderName: null, reminder: true })
    const text = lienReminderText(words, null, 'https://app.test')
    expect(text).toMatch(/^[\x20-\x7e]+$/)
    expect(text).toBe('The office is reminding you: Approve a lien notice. 891, O\'Brien "Lofts", $27,199 owed by Brund & Assoc., mail by Dec 15, 29 days. https://app.test/lien-desk?tab=notices&job=j1&pile=awaiting')
  })
})

describe('why a text did not go', () => {
  it('each refusal of the text line has its own reason, and one the list does not name still says the line refused', () => {
    expect(lienReminderTextMiss('noCell')).toBe('there is no mobile number on the account')
    expect(lienReminderTextMiss('textsOff')).toBe('Send texts is off in Settings')
    expect(lienReminderTextMiss('stopped')).toBe('that number sent STOP')
    expect(lienReminderTextMiss('quo')).toBe(LIEN_REMINDER_TEXT_MISS_OTHER)
    expect(lienReminderTextMiss(null)).toBe(LIEN_REMINDER_TEXT_MISS_OTHER)
    // Each one finishes the sentence *No text went: … .* in plain words.
    for (const why of [...Object.values(LIEN_REMINDER_TEXT_MISS), LIEN_REMINDER_TEXT_MISS_OTHER]) expect(plainWordsFailures(`No text went: ${why}.`)).toEqual([])
  })
})

describe('the text over one press', () => {
  const told = (over: Record<string, unknown> = {}) => ({ ok: true as const, told: { pushSent: 1, emailSent: false, leaderName: 'Sam', ...over } })
  it('a text on any call is a text sent; with none, the first reason is kept', () => {
    expect(lienReminderTextOf([told({ textSent: 0, textSaid: 'Send texts is off in Settings' }), told({ textSent: 1, textSaid: null })])).toEqual({ sent: true, why: null })
    expect(lienReminderTextOf([told({ textSent: 0, textSaid: 'there is no mobile number on the account' }), told({ textSent: 0, textSaid: 'texts are paused' })])).toEqual({ sent: false, why: 'there is no mobile number on the account' })
  })
  it('the function as it was, a failed call and no call say nothing about a text', () => {
    expect(lienReminderTextOf([told(), { ok: false, reason: 'Not the office' }, null])).toEqual({ sent: false, why: null })
    expect(lienReminderTextOf([])).toEqual({ sent: false, why: null })
  })
  it('a text alone is a reminder that reached him', () => {
    expect(lienTellMissReason({ pushSent: 0, emailSent: false, leaderName: 'Sam', textSent: 1 })).toBeNull()
    expect(lienTellMissReason({ pushSent: 0, emailSent: false, leaderName: 'Sam', textSent: 0 })).toBe('no phone set up and no email sent')
  })
})

describe('what the office reads', () => {
  it('the confirm window says a text with the link goes too', () => {
    const words = lienReminderWords(lienReminderPlan([{ kind: 'signature', label: '650', itemId: 'i1', dueYmd: null }]), 'Sam')
    expect(words.message).toBe('650. Sam gets one message for the notice to sign. It goes to Sam’s phone, or by email. A text with the link goes too. Nothing on the papers changes.')
    expect(plainWordsFailures(words.message)).toEqual([])
  })
  it('after the press: a text that went is said, one that did not is said in amber with its reason, and silence says nothing', () => {
    expect(lienReminderOutcome({ done: 8, failed: [] }, 'Sam', { sent: true, why: null })).toEqual({ line: 'Sam was reminded of 8 papers. A text went too.', tone: 'success' })
    expect(lienReminderOutcome({ done: 8, failed: [] }, 'Sam', { sent: false, why: 'there is no mobile number on the account' })).toEqual({ line: 'Sam was reminded of 8 papers. No text went: there is no mobile number on the account.', tone: 'warning' })
    expect(lienReminderOutcome({ done: 8, failed: [] }, 'Sam', { sent: false, why: null })).toEqual({ line: 'Sam was reminded of 8 papers.', tone: 'success' })
    expect(lienReminderOutcome({ done: 8, failed: [] }, 'Sam')).toEqual({ line: 'Sam was reminded of 8 papers.', tone: 'success' })
    // Nothing reached him: the reminders' own reasons say why, and the text's reason is not stacked on top.
    expect(lienReminderOutcome({ done: 0, failed: [{ label: '650', reason: 'Not the office' }] }, 'Sam', { sent: false, why: 'texts are paused' }).line).toBe('Sam was not reminded. 1 reminder did not send: 650 (Not the office).')
    expect(lienReminderOutcome({ done: 1, failed: [{ label: '650', reason: 'not waiting for approval now' }] }, 'Sam', { sent: true, why: null })).toEqual({ line: 'Sam was reminded of 1 paper. A text went too. 1 reminder did not send: 650 (not waiting for approval now).', tone: 'warning' })
  })
})
