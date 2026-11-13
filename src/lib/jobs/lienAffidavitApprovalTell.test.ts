import { describe, expect, it } from 'vitest'
import { lienAffidavitBatchToldWords, lienAffidavitTellPapers, lienAffidavitToldWords, lienTellFailureReason, type LienLeaderTellResult } from './lienAffidavitApprovalTell'
import { leaderToldWords } from './lienDeskIo'
import { plainWordsFailures } from '../plainWords'

const told = (pushSent: number, emailSent: boolean, leaderName: string | null): LienLeaderTellResult => ({ ok: true, told: { pushSent, emailSent, leaderName } })

describe('which papers of a press the leader is told of (punch list #305, v2.7180)', () => {
  it('only the ones the send landed in Awaiting approval', () => {
    const sent = [
      { jobId: 'a', itemId: 'ia', outcome: { status: 'awaiting_approval', reason: 'no_rule' } as const },
      { jobId: 'b', itemId: 'ib', outcome: { status: 'approved', approval_mode: 'rule' } as const },
      { jobId: 'c', itemId: 'ic', outcome: { status: 'held', hold_reason: 'rule', hold_until: '2026-11-20' } as const },
      { jobId: 'd', itemId: 'id', outcome: { status: 'awaiting_approval', reason: 'first_notice' } as const },
      { jobId: 'e', itemId: 'ie', outcome: { status: 'awaiting_approval', reason: 'no_rule' } as const },
    ]
    // e's send failed, so it is still a draft.
    expect(lienAffidavitTellPapers(sent, ['a', 'b', 'c', 'd']).map((p) => p.itemId)).toEqual(['ia', 'id'])
    expect(lienAffidavitTellPapers(sent, [])).toEqual([])
  })
})

describe('the office’s words after one affidavit is sent for approval', () => {
  it('says which way it reached him, in the notice send’s own words', () => {
    expect(lienAffidavitToldWords(told(2, false, 'Malachi Whites'))).toBe("Sent for approval. Malachi's phone has it.")
    expect(lienAffidavitToldWords(told(0, true, 'Malachi Whites'))).toBe('Sent for approval. Malachi has it by email.')
    expect(lienAffidavitToldWords(told(0, false, null))).toBe('Sent for approval. The leader will see it on the Dashboard.')
    expect(lienAffidavitToldWords(null)).toBe('Sent for approval. The leader will see it on the Dashboard.')
    for (const r of [{ pushSent: 2, emailSent: false, leaderName: 'Malachi Whites' }, { pushSent: 0, emailSent: true, leaderName: 'Malachi Whites' }, { pushSent: 0, emailSent: false, leaderName: null }]) {
      expect(lienAffidavitToldWords({ ok: true, told: r })).toBe(leaderToldWords(r))
    }
  })

  it('a tell that failed says so with its reason, and the paper is still sent', () => {
    expect(lienAffidavitToldWords({ ok: false, reason: 'Not the office' })).toBe('Sent for approval. The leader was not told. Not the office. The paper is on the Dashboard.')
    expect(lienAffidavitToldWords({ ok: false, reason: '' })).toBe('Sent for approval. The leader was not told. The message could not be sent. The paper is on the Dashboard.')
  })

  it('until the function is redeployed its refusal reads as what it is', () => {
    expect(lienTellFailureReason('Missing item_id')).toBe('The part of the app that tells the leader is waiting for its update.')
    expect(lienTellFailureReason('You are offline.')).toBe('You are offline.')
    expect(lienTellFailureReason(null)).toBe('The message could not be sent.')
  })
})

describe('the office’s words after a batch is sent for approval', () => {
  it('twelve are one message, and the sentence says so', () => {
    expect(lienAffidavitBatchToldWords(told(1, false, 'Malachi Whites'), 12)).toBe("Malachi's phone has the 12 that wait for approval in one message.")
    expect(lienAffidavitBatchToldWords(told(0, true, 'Malachi Whites'), 12)).toBe('Malachi has the 12 that wait for approval by email in one message.')
    expect(lienAffidavitBatchToldWords(told(0, false, null), 12)).toBe('The leader will see the 12 that wait for approval on the Dashboard.')
    expect(lienAffidavitBatchToldWords(null, 2)).toBe('The leader will see the 2 that wait for approval on the Dashboard.')
  })

  it('one reads as one, and none says nothing', () => {
    expect(lienAffidavitBatchToldWords(told(1, false, 'Malachi'), 1)).toBe("Malachi's phone has the 1 that waits for approval.")
    expect(lienAffidavitBatchToldWords(told(1, false, 'Malachi'), 0)).toBe('')
    expect(lienAffidavitBatchToldWords({ ok: false, reason: 'x' }, 0)).toBe('')
  })

  it('a tell that failed names its reason and where the papers are', () => {
    expect(lienAffidavitBatchToldWords({ ok: false, reason: 'Missing item_id' }, 3)).toBe('The leader was not told of the 3 that wait for approval. The part of the app that tells the leader is waiting for its update. The Dashboard shows them.')
    expect(lienAffidavitBatchToldWords({ ok: false, reason: 'Not the office' }, 1)).toBe('The leader was not told of the 1 that waits for approval. Not the office. The Dashboard shows it.')
  })
})

it('every sentence the office reads passes the plain-words rule', () => {
  const results: Array<LienLeaderTellResult | null> = [told(1, false, 'Malachi'), told(0, true, 'Malachi'), told(0, false, null), null, { ok: false, reason: 'Missing item_id' }, { ok: false, reason: '' }]
  for (const r of results) {
    expect(plainWordsFailures(lienAffidavitToldWords(r)), lienAffidavitToldWords(r)).toEqual([])
    for (const n of [1, 12]) expect(plainWordsFailures(lienAffidavitBatchToldWords(r, n)), lienAffidavitBatchToldWords(r, n)).toEqual([])
  }
})
