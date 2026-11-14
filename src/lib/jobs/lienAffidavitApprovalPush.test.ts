import { describe, expect, it } from 'vitest'
import {
  LIEN_AFFIDAVIT_ASK_FRESH_MS,
  LIEN_AFFIDAVIT_ASK_MAX,
  lienAffidavitApprovalPush,
  lienAffidavitApprovalUrl,
  lienAffidavitAskable,
  lienAffidavitAskItems,
  lienAffidavitTellsByLeader,
  lienApprovalPush,
} from './lienApprovalPush'
import { plainWordsFailures } from '../plainWords'

const paper = (n: number, fileByYmd: string | null = '2026-11-16') => ({ jobLabel: `${600 + n} · Job ${n}`, jobId: `j${n}`, fileByYmd })
/** The lines of an email a person reads as sentences: not the blank lines, not a job's own line. */
const sentences = (emailText: string) => emailText.split('\n').filter((l) => /[a-z]{3}/i.test(l) && !/^\d/.test(l))

describe('the leader’s push for an affidavit (punch list #305, v2.7180)', () => {
  it('names the job, the day to file by and what he is asked to do; the tap opens the Affidavits list on the job', () => {
    const p = lienAffidavitApprovalPush({ papers: [{ jobLabel: '891 · Tune 5 Liberty Hill', jobId: 'j891', fileByYmd: '2026-11-16' }], todayYmd: '2026-11-13', senderName: 'Taunya Smith' })
    expect(p.title).toBe('Approve a lien affidavit')
    expect(p.body).toBe('891 · Tune 5 Liberty Hill · file by Nov 16 · 3 days')
    expect(p.url).toBe('/lien-desk?tab=affidavits&job=j891')
    expect(p.tag).toBe('lien-affidavit-approval-j891')
    expect(p.subject).toBe('Approve a lien affidavit · 891 · Tune 5 Liberty Hill')
    expect(p.emailText).toBe(
      'Taunya sent a lien affidavit for your approval.\n\n891 · Tune 5 Liberty Hill\nFile by Nov 16, 3 days from now.\nThe lien right ends after that day.\n\nOpen the Lien desk to approve it or hold it.',
    )
    expect(lienAffidavitApprovalUrl('a b')).toBe('/lien-desk?tab=affidavits&job=a%20b')
    expect(lienAffidavitApprovalUrl(null)).toBe('/lien-desk?tab=affidavits')
  })

  it('never borrows a notice’s words: no claim, no mail-by day, and its own door', () => {
    const affidavit = lienAffidavitApprovalPush({ papers: [paper(1)], todayYmd: '2026-11-13', senderName: 'Taunya' })
    const notice = lienApprovalPush({ jobLabel: '601 · Job 1', jobId: 'j1', claim: 5_000, gcName: 'A GC', dueYmd: '2026-11-16', todayYmd: '2026-11-13', senderName: 'Taunya' })
    expect(`${affidavit.title} ${affidavit.body} ${affidavit.emailText}`).not.toMatch(/notice|mail by|\$/i)
    expect(affidavit.url).not.toBe(notice.url)
    expect(affidavit.tag).not.toBe(notice.tag)
  })

  it('leaves out what it does not know, says today, and never counts to a day that passed', () => {
    const bare = lienAffidavitApprovalPush({ papers: [{ jobLabel: '650', jobId: 'j650', fileByYmd: null }], todayYmd: '2026-11-13', senderName: null })
    expect(bare.body).toBe('650')
    expect(bare.emailText).toBe('The office sent a lien affidavit for your approval.\n\n650\n\nOpen the Lien desk to approve it or hold it.')
    const today = lienAffidavitApprovalPush({ papers: [paper(1, '2026-11-13')], todayYmd: '2026-11-13', senderName: 'R' })
    expect(today.body).toBe('601 · Job 1 · file by Nov 13 · today')
    expect(today.emailText).toContain('File by Nov 13. That is today.')
    expect(lienAffidavitApprovalPush({ papers: [paper(1, '2026-11-14')], todayYmd: '2026-11-13', senderName: 'R' }).body).toBe('601 · Job 1 · file by Nov 14 · 1 day')
    const passed = lienAffidavitApprovalPush({ papers: [paper(1, '2026-11-01')], todayYmd: '2026-11-13', senderName: 'R' })
    expect(passed.body).toBe('601 · Job 1 · file by Nov 1')
    expect(passed.emailText).toContain('File by Nov 1.\n')
    expect(lienAffidavitApprovalPush({ papers: [paper(1, 'soon')], todayYmd: '2026-11-13', senderName: 'R' }).body).toBe('601 · Job 1')
  })

  it('the batch rule: twelve papers are one message that names the count, never twelve', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => paper(i + 1, i === 4 ? '2026-11-16' : '2026-12-15'))
    const p = lienAffidavitApprovalPush({ papers: twelve, todayYmd: '2026-11-13', senderName: 'Taunya Smith' })
    expect(p.title).toBe('Approve 12 lien affidavits')
    expect(p.body).toBe('12 jobs · first to file by Nov 16 · 3 days')
    expect(p.subject).toBe('Approve 12 lien affidavits')
    expect(p.url).toBe('/lien-desk?tab=affidavits')
    const lines = p.emailText.split('\n')
    expect(lines[0]).toBe('Taunya sent 12 lien affidavits for your approval.')
    // Every job once, beside its own day, the soonest first.
    expect(lines.slice(2, 14)).toHaveLength(12)
    expect(lines[2]).toBe('605 · Job 5 · file by Nov 16')
    expect(lines[3]).toBe('601 · Job 1 · file by Dec 15')
    expect(new Set(lines.slice(2, 14)).size).toBe(12)
    expect(lines.slice(14)).toEqual(['', 'The first must be filed by Nov 16, 3 days from now.', 'The lien right on a job ends after its day.', '', 'Open the Lien desk to approve each one or hold it.'])
  })

  it('a batch with no day on any paper still names the count and the ask', () => {
    const p = lienAffidavitApprovalPush({ papers: [paper(1, null), paper(2, null)], todayYmd: '2026-11-13', senderName: null })
    expect(p.body).toBe('2 jobs')
    expect(p.emailText).toBe('The office sent 2 lien affidavits for your approval.\n\n601 · Job 1\n602 · Job 2\n\nOpen the Lien desk to approve each one or hold it.')
    // A paper with no day sorts after one with a day.
    expect(lienAffidavitApprovalPush({ papers: [paper(1, null), paper(2, '2026-12-15')], todayYmd: '2026-11-13', senderName: null }).body).toBe('2 jobs · first to file by Dec 15 · 32 days')
  })

  it('a later press is its own message: two batches never share a tag', () => {
    const a = lienAffidavitApprovalPush({ papers: [paper(1), paper(2)], todayYmd: '2026-11-13', senderName: null })
    const b = lienAffidavitApprovalPush({ papers: [paper(3), paper(4)], todayYmd: '2026-11-13', senderName: null })
    expect(a.tag).not.toBe(b.tag)
  })

  it('every sentence the leader reads passes the plain-words rule', () => {
    const one = lienAffidavitApprovalPush({ papers: [paper(1)], todayYmd: '2026-11-13', senderName: 'Taunya' })
    const today = lienAffidavitApprovalPush({ papers: [paper(1, '2026-11-13')], todayYmd: '2026-11-13', senderName: 'Taunya' })
    const many = lienAffidavitApprovalPush({ papers: [paper(1), paper(2), paper(3)], todayYmd: '2026-11-13', senderName: 'Taunya' })
    for (const p of [one, today, many]) {
      expect(plainWordsFailures(p.title), p.title).toEqual([])
      for (const line of sentences(p.emailText)) expect(plainWordsFailures(line), line).toEqual([])
    }
  })
})

describe('who is told, once each (the batch rule on the server)', () => {
  it('twelve papers under one leader are one message of twelve', () => {
    const tells = lienAffidavitTellsByLeader(Array.from({ length: 12 }, (_, i) => ({ paper: `p${i}`, leaderIds: ['malachi'] })))
    expect(tells).toHaveLength(1)
    expect(tells[0]!.leaderId).toBe('malachi')
    expect(tells[0]!.papers).toHaveLength(12)
  })

  it('each leader hears of his own jobs, and a job with no leader of its own asks every leader', () => {
    const tells = lienAffidavitTellsByLeader([
      { paper: 'a', leaderIds: ['malachi'] },
      { paper: 'b', leaderIds: ['robert'] },
      { paper: 'c', leaderIds: ['malachi', 'robert'] },
      { paper: 'd', leaderIds: ['malachi', 'malachi'] },
      { paper: 'e', leaderIds: [] },
    ])
    expect(tells).toEqual([
      { leaderId: 'malachi', papers: ['a', 'c', 'd'] },
      { leaderId: 'robert', papers: ['b', 'c'] },
    ])
    expect(lienAffidavitTellsByLeader([])).toEqual([])
  })
})

describe('what a caller may say, and which rows the leader is told of', () => {
  it('reads the papers of a request: each id once, a day only when it is a date', () => {
    expect(lienAffidavitAskItems([{ item_id: 'a', due_ymd: '2026-11-16' }, { item_id: ' b ', due_ymd: 'Monday' }, { item_id: 'a', due_ymd: '2026-12-15' }, { item_id: '' }, null, 'c', { due_ymd: '2026-11-16' }])).toEqual([
      { itemId: 'a', fileByYmd: '2026-11-16' },
      { itemId: 'b', fileByYmd: null },
    ])
    expect(lienAffidavitAskItems(undefined)).toEqual([])
    expect(lienAffidavitAskItems({ item_id: 'a' })).toEqual([])
    expect(lienAffidavitAskItems(Array.from({ length: LIEN_AFFIDAVIT_ASK_MAX + 20 }, (_, i) => ({ item_id: `i${i}` })))).toHaveLength(LIEN_AFFIDAVIT_ASK_MAX)
  })

  it('tells him only of an affidavit that was just sent for his approval', () => {
    const now = Date.parse('2026-11-13T18:00:00Z')
    const row = { kind: 'affidavit', status: 'awaiting_approval', voided_at: null, submitted_at: '2026-11-13T17:58:00Z' }
    expect(lienAffidavitAskable(row, now)).toBe(true)
    expect(lienAffidavitAskable({ ...row, kind: 'notice_53_056' }, now)).toBe(false)
    expect(lienAffidavitAskable({ ...row, status: 'approved' }, now)).toBe(false)
    expect(lienAffidavitAskable({ ...row, status: 'held' }, now)).toBe(false)
    expect(lienAffidavitAskable({ ...row, voided_at: '2026-11-13T17:59:00Z' }, now)).toBe(false)
    expect(lienAffidavitAskable({ ...row, submitted_at: null }, now)).toBe(false)
    expect(lienAffidavitAskable({ ...row, submitted_at: new Date(now - LIEN_AFFIDAVIT_ASK_FRESH_MS - 1000).toISOString() }, now)).toBe(false)
    expect(lienAffidavitAskable({ ...row, submitted_at: new Date(now - LIEN_AFFIDAVIT_ASK_FRESH_MS + 1000).toISOString() }, now)).toBe(true)
    expect(lienAffidavitAskable(null, now)).toBe(false)
  })
})
