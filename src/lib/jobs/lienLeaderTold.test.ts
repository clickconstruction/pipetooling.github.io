import { describe, expect, it } from 'vitest'
import { lienNoticeToldWords, lienReminderAffidavitLabel, lienReminderTally, lienTellMissReason } from './lienLeaderTold'
import type { LienLeaderTellResult, LienLeaderTold } from './lienAffidavitApprovalTell'
import { lienReminderOutcome } from './lienLeaderReminder'
import { plainWordsFailures } from '../plainWords'

const told = (over: Partial<LienLeaderTold> = {}): LienLeaderTellResult => ({ ok: true, told: { pushSent: 0, emailSent: false, leaderName: 'Malachi Whites', held: 0, said: null, told: null, ...over } })
const sentences = (s: string) => s.split(/(?<=[.?!])\s+/).filter(Boolean)

describe('after Send for approval on a notice (v2.7445)', () => {
  it('a tell that reached the leader says which way', () => {
    expect(lienNoticeToldWords(told({ pushSent: 2 }))).toEqual({ said: "Sent for approval. Malachi's phone has it.", tone: 'success' })
    expect(lienNoticeToldWords(told({ emailSent: true }))).toEqual({ said: 'Sent for approval. Malachi has it by email.', tone: 'success' })
    expect(lienNoticeToldWords(told())).toEqual({ said: 'Sent for approval. Malachi will see it on the Dashboard.', tone: 'success' })
    expect(lienNoticeToldWords(told({ leaderName: null })).said).toBe('Sent for approval. The leader will see it on the Dashboard.')
  })

  it('a tell that failed is said, with its reason and what to do, and the paper is still sent', () => {
    expect(lienNoticeToldWords({ ok: false, reason: 'Not the office' }, 'Malachi Whites')).toEqual({
      said: 'Sent for approval. The message to Malachi did not go. Not the office. The paper is on the Dashboard. Tell Malachi another way.',
      tone: 'warning',
    })
    expect(lienNoticeToldWords({ ok: false, reason: '' }, '').said).toBe('Sent for approval. The message to the leader did not go. The message could not be sent. The paper is on the Dashboard. Tell the leader another way.')
    // The function as it was before v2.7445 answers a second office person this way until it is redeployed.
    expect(lienNoticeToldWords({ ok: false, reason: 'Not your draft' }, 'malachi').said).toContain('The message to Malachi did not go. Not your draft.')
  })

  it('every sentence passes the plain-words rule', () => {
    for (const r of [told({ pushSent: 1 }), told({ emailSent: true }), told(), { ok: false, reason: 'Not the office' } as const]) {
      for (const s of sentences(lienNoticeToldWords(r, 'Malachi').said)) expect(plainWordsFailures(s), s).toEqual([])
    }
  })
})

describe('whether a message the function took reached anyone', () => {
  it('a push or an email reached the leader', () => {
    expect(lienTellMissReason(told({ pushSent: 1 }).ok ? { pushSent: 1, emailSent: false, leaderName: null } : { pushSent: 0, emailSent: false, leaderName: null })).toBeNull()
    expect(lienTellMissReason({ pushSent: 0, emailSent: true, leaderName: null })).toBeNull()
    // One leader pushed and one held: the message went.
    expect(lienTellMissReason({ pushSent: 1, emailSent: false, leaderName: null, held: 1 })).toBeNull()
  })

  it('a 200 with nothing sent says why', () => {
    expect(lienTellMissReason({ pushSent: 0, emailSent: false, leaderName: null, said: 'Not awaiting approval' })).toBe('not waiting for approval now')
    expect(lienTellMissReason({ pushSent: 0, emailSent: false, leaderName: null, said: 'No leader to tell' })).toBe('no leader to tell')
    expect(lienTellMissReason({ pushSent: 0, emailSent: false, leaderName: 'Malachi', held: 1 })).toBe('outside the leader’s Push me hours, so it waits on the Dashboard')
    expect(lienTellMissReason({ pushSent: 0, emailSent: false, leaderName: 'Malachi' })).toBe('no phone set up and no email sent')
  })
})

describe('one call of a reminder, counted', () => {
  it('a notice the leader was reminded of is one done', () => {
    expect(lienReminderTally(told({ pushSent: 1 }), 1)).toEqual({ done: 1, missed: 0, reason: null })
    expect(lienReminderTally(told({ emailSent: true }), 1)).toEqual({ done: 1, missed: 0, reason: null })
  })

  it('a refusal is none done, with the function’s reason and no full stop for the list', () => {
    expect(lienReminderTally({ ok: false, reason: 'Not the office' }, 1)).toEqual({ done: 0, missed: 1, reason: 'Not the office' })
    expect(lienReminderTally({ ok: false, reason: '' }, 3)).toEqual({ done: 0, missed: 3, reason: 'The message could not be sent' })
    expect(lienReminderTally(null, 2)).toEqual({ done: 0, missed: 2, reason: 'the message could not be sent' })
  })

  it('an answer that sent nothing is never a reminder sent', () => {
    expect(lienReminderTally(told({ said: 'Not awaiting approval', told: 0 }), 2)).toEqual({ done: 0, missed: 2, reason: 'not waiting for approval now' })
    expect(lienReminderTally(told({ held: 1 }), 1)).toEqual({ done: 0, missed: 1, reason: 'outside the leader’s Push me hours, so it waits on the Dashboard' })
  })

  it('the affidavits count what the function told the leader of', () => {
    expect(lienReminderTally(told({ pushSent: 1, told: 3 }), 3)).toEqual({ done: 3, missed: 0, reason: null })
    expect(lienReminderTally(told({ pushSent: 1, told: 2 }), 3)).toEqual({ done: 2, missed: 1, reason: 'not waiting for approval now' })
    // More than was asked, or no count at all: never more than the papers of the press.
    expect(lienReminderTally(told({ pushSent: 1, told: 9 }), 3).done).toBe(3)
    expect(lienReminderTally(told({ pushSent: 1 }), 3).done).toBe(3)
    expect(lienReminderTally(told({ pushSent: 1 }), 0)).toEqual({ done: 0, missed: 0, reason: null })
  })

  it('the missed affidavits are named as the paper, the lot, or how many of the lot', () => {
    expect(lienReminderAffidavitLabel(['650 · Tune 5'], 1)).toBe('650 · Tune 5')
    expect(lienReminderAffidavitLabel(['a', 'b', 'c'], 3)).toBe('the 3 affidavits')
    expect(lienReminderAffidavitLabel(['a', 'b', 'c'], 1)).toBe('1 of the 3 affidavits')
  })

  it('reads as one line in the reminder’s outcome', () => {
    const t = lienReminderTally(told({ said: 'Not awaiting approval', told: 0 }), 2)
    expect(lienReminderOutcome({ done: 1, failed: [{ label: lienReminderAffidavitLabel(['a', 'b'], t.missed), reason: t.reason! }] }, 'Malachi')).toEqual({
      line: 'Malachi was reminded of 1 paper. 1 reminder did not send: the 2 affidavits (not waiting for approval now).',
      tone: 'warning',
    })
  })
})
