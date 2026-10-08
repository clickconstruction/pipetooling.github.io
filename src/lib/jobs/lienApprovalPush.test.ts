import { describe, expect, it } from 'vitest'
import { daysUntil, lienApprovalPush, lienApprovalUrl, shortDay } from './lienApprovalPush'
import { leaderToldWords } from './lienDeskIo'
import { plainWordsFailures } from '../plainWords'

describe('the leader’s push (v2.4872)', () => {
  it('is one line: the job, the money, the mail-by day; the tap lands on the job in the awaiting pile', () => {
    const p = lienApprovalPush({ jobLabel: '891 · Take 5 Liberty Hill', jobId: 'j891', claim: 27_198.65, gcName: 'Burd & Assoc.', dueYmd: '2026-10-15', todayYmd: '2026-10-07', senderName: 'Taunya Smith' })
    expect(p.title).toBe('Approve a lien notice')
    expect(p.body).toBe('891 · Take 5 Liberty Hill · $27,199 owed by Burd & Assoc. · mail by Oct 15 · 8 days')
    expect(p.url).toBe('/jobs?tab=stages&liendesk=1&liendeskPile=awaiting&liendeskJob=j891')
    expect(p.tag).toBe('lien-approval-j891')
    expect(p.subject).toBe('Approve a lien notice · 891 · Take 5 Liberty Hill')
    expect(p.emailText).toBe('Taunya sent a lien notice for your approval.\n\n891 · Take 5 Liberty Hill\n$27,199 owed by Burd & Assoc.\nMail by Oct 15, 8 days from now.\n\nOpen the Lien desk to approve it or hold it.')
    expect(lienApprovalUrl('a b')).toBe('/jobs?tab=stages&liendesk=1&liendeskPile=awaiting&liendeskJob=a%20b')
  })

  it('leaves out what it does not know, and never says a day that passed', () => {
    const p = lienApprovalPush({ jobLabel: '650', jobId: 'j650', claim: null, gcName: null, dueYmd: null, todayYmd: '2026-10-07', senderName: null })
    expect(p.body).toBe('650')
    expect(p.emailText.startsWith('The office sent a lien notice for your approval.')).toBe(true)
    expect(lienApprovalPush({ jobLabel: '650', jobId: 'j650', claim: 0, gcName: 'GC', dueYmd: '2026-10-01', todayYmd: '2026-10-07', senderName: 'R' }).body).toBe('650 · mail by Oct 1')
    expect(shortDay('2026-01-05')).toBe('Jan 5')
    expect(shortDay('nope')).toBeNull()
    expect(daysUntil('2026-10-15', '2026-10-07')).toBe(8)
    expect(daysUntil('2026-10-08', '2026-10-07')).toBe(1)
    expect(lienApprovalPush({ jobLabel: '650', jobId: 'j', claim: 1, gcName: 'GC', dueYmd: '2026-10-08', todayYmd: '2026-10-07', senderName: null }).body).toContain('· 1 day')
  })

  it('the office’s toast says which way it reached him', () => {
    expect(leaderToldWords({ pushSent: 2, emailSent: false, leaderName: 'Malachi Whites' })).toBe("Sent for approval. Malachi's phone has it.")
    expect(leaderToldWords({ pushSent: 0, emailSent: true, leaderName: 'Malachi Whites' })).toBe('Sent for approval. Malachi has it by email.')
    expect(leaderToldWords({ pushSent: 0, emailSent: false, leaderName: null })).toBe('Sent for approval. The leader will see it on the Dashboard.')
    expect(leaderToldWords(null)).toBe('Sent for approval. The leader will see it on the Dashboard.')
  })

  it('every sentence the leader or the office reads passes the plain-words rule', () => {
    const p = lienApprovalPush({ jobLabel: '891 · Take 5 Liberty Hill', jobId: 'j891', claim: 27_199, gcName: 'Burd & Assoc.', dueYmd: '2026-10-15', todayYmd: '2026-10-07', senderName: 'Taunya' })
    for (const line of p.emailText.split('\n').filter((l) => /[a-z]{3}/i.test(l) && !/^\d/.test(l))) expect(plainWordsFailures(line), line).toEqual([])
    for (const w of [leaderToldWords({ pushSent: 1, emailSent: false, leaderName: 'Malachi' }), leaderToldWords({ pushSent: 0, emailSent: true, leaderName: 'Malachi' }), leaderToldWords(null)]) expect(plainWordsFailures(w), w).toEqual([])
  })
})
