import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { lienReminderPlan, lienReminderWords, type LienReminderPaper } from './lienLeaderReminder'
import { lienReminderSignatureLabel, lienReminderTally, lienTellMissReason } from './lienLeaderTold'

/** The notices that wait on the leader's signature, in the office's Remind press (v2.7491). */
const paper = (kind: LienReminderPaper['kind'], label: string, over: Partial<LienReminderPaper> = {}): LienReminderPaper => ({ kind, label, itemId: `i-${label}`, dueYmd: '2026-11-16', ...over })

describe('a notice to sign in the reminder', () => {
  it('the notices to sign are a lot of their own, counted with the rest, and one with no item stays out', () => {
    const plan = lienReminderPlan([paper('notice', '891'), paper('signature', '650'), paper('signature', '651'), paper('affidavit', '804'), paper('signature', '652', { itemId: null })])
    expect(plan.notices.map((p) => p.label)).toEqual(['891'])
    expect(plan.affidavits.map((p) => p.label)).toEqual(['804'])
    expect(plan.signatures).toEqual([{ itemId: 'i-650', dueYmd: '2026-11-16', label: '650' }, { itemId: 'i-651', dueYmd: '2026-11-16', label: '651' }])
    expect(plan.held.map((h) => h.label)).toEqual(['652'])
    expect(plan.ready).toBe(4)
  })

  it('with only notices to sign the press is live, names its count and says they go as one message', () => {
    const words = lienReminderWords(lienReminderPlan(['650', '651', '652'].map((n) => paper('signature', n))), 'malachi whites')
    expect(words.button).toBe('Remind Malachi of 3 papers')
    expect(words.dead).toBe(false)
    expect(words.title).toBe('Remind Malachi of 3 papers?')
    expect(words.message).toBe('650, 651, 652. Malachi gets one message for the 3 notices to sign. It goes to Malachi’s phone, or by email. A text with the link goes too. Nothing on the papers changes.')
    expect(words.confirmLabel).toBe('Remind Malachi')
    expect(lienReminderWords(lienReminderPlan([paper('signature', '650')]), null).message).toContain('The leader gets one message for the notice to sign.')
  })

  it('a paper to approve and a notice to sign are one press, each lot with its own sentence, in plain words', () => {
    const words = lienReminderWords(lienReminderPlan([paper('notice', '891'), paper('signature', '650')]), 'Sam')
    expect(words.button).toBe('Remind Sam of 2 papers')
    expect(words.message).toContain('Sam gets one message for the notice. Sam gets one message for the notice to sign.')
    expect(plainWordsFailures(words.message)).toEqual([])
  })

  it('the tally names what a missed notice no longer waits on, and the outcome names the lot', () => {
    const told = (n: number) => ({ ok: true as const, told: { pushSent: 1, emailSent: false, leaderName: 'Sam', told: n } })
    expect(lienReminderTally(told(8), 8, 'signature')).toEqual({ done: 8, missed: 0, reason: null })
    expect(lienReminderTally(told(6), 8, 'signature')).toEqual({ done: 6, missed: 2, reason: 'not waiting on a signature now' })
    expect(lienReminderTally(told(6), 8)).toEqual({ done: 6, missed: 2, reason: 'not waiting for approval now' })
    expect(lienTellMissReason({ pushSent: 0, emailSent: false, leaderName: null, said: 'Not waiting on a signature', told: 0 })).toBe('not waiting on a signature now')
    const labels = ['650', '651', '652']
    expect(lienReminderSignatureLabel(['650'], 1)).toBe('650')
    expect(lienReminderSignatureLabel(labels, 3)).toBe('the 3 notices to sign')
    expect(lienReminderSignatureLabel(labels, 1)).toBe('1 of the 3 notices to sign')
  })
})
