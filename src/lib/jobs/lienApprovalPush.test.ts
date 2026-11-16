import { describe, expect, it } from 'vitest'
import { daysUntil, lienApprovalPush, lienApprovalUrl, lienRetainageApprovalPush, lienRetainageApprovalUrl, shortDay } from './lienApprovalPush'
import { lienNoticeToldWords } from './lienLeaderTold'
import { plainWordsFailures } from '../plainWords'

describe('the leader’s push (v2.4872)', () => {
  it('is one line: the job, the money, the mail-by day; the tap lands on the job in the awaiting pile', () => {
    const p = lienApprovalPush({ jobLabel: '891 · Tune 5 Liberty Hill', jobId: 'j891', claim: 27_198.65, gcName: 'Brund & Assoc.', dueYmd: '2026-10-15', todayYmd: '2026-10-07', senderName: 'Taunya Smith' })
    expect(p.title).toBe('Approve a lien notice')
    expect(p.body).toBe('891 · Tune 5 Liberty Hill · $27,199 owed by Brund & Assoc. · mail by Oct 15 · 8 days')
    expect(p.url).toBe('/lien-desk?tab=notices&job=j891&pile=awaiting')
    expect(p.tag).toBe('lien-approval-j891')
    expect(p.subject).toBe('Approve a lien notice · 891 · Tune 5 Liberty Hill')
    expect(p.emailText).toBe('Taunya sent a lien notice for your approval.\n\n891 · Tune 5 Liberty Hill\n$27,199 owed by Brund & Assoc.\nMail by Oct 15, 8 days from now.\n\nOpen the Lien desk to approve it or hold it.')
    expect(lienApprovalUrl('a b')).toBe('/lien-desk?tab=notices&job=a%20b&pile=awaiting')
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
    const said = (pushSent: number, emailSent: boolean, leaderName: string | null) => lienNoticeToldWords({ ok: true, told: { pushSent, emailSent, leaderName } }).said
    expect(said(2, false, 'Malachi Whites')).toBe("Sent for approval. Malachi's phone has it.")
    expect(said(0, true, 'Malachi Whites')).toBe('Sent for approval. Malachi has it by email.')
    expect(said(0, false, null)).toBe('Sent for approval. The leader will see it on the Dashboard.')
  })

  it('a reminder says so in the email, names who pressed, and keeps the push’s one line (v2.7445)', () => {
    const base = { jobLabel: '891 · Tune 5 Liberty Hill', jobId: 'j891', claim: 27_199, gcName: 'Brund & Assoc.', dueYmd: '2026-10-15', todayYmd: '2026-10-07', senderName: 'Wendi Park' }
    const first = lienApprovalPush(base)
    const again = lienApprovalPush({ ...base, reminder: true })
    expect(again.emailText.split('\n')[0]).toBe('Wendi is reminding you of a lien notice that waits for your approval.')
    expect(lienApprovalPush({ ...base, senderName: null, reminder: true }).emailText.split('\n')[0]).toBe('The office is reminding you of a lien notice that waits for your approval.')
    expect({ ...again, emailText: '' }).toEqual({ ...first, emailText: '' })
    expect(again.emailText.split('\n').slice(1)).toEqual(first.emailText.split('\n').slice(1))
    expect(plainWordsFailures(again.emailText.split('\n')[0]!)).toEqual([])
  })

  it('every sentence the leader or the office reads passes the plain-words rule', () => {
    const p = lienApprovalPush({ jobLabel: '891 · Tune 5 Liberty Hill', jobId: 'j891', claim: 27_199, gcName: 'Brund & Assoc.', dueYmd: '2026-10-15', todayYmd: '2026-10-07', senderName: 'Taunya' })
    for (const line of p.emailText.split('\n').filter((l) => /[a-z]{3}/i.test(l) && !/^\d/.test(l))) expect(plainWordsFailures(line), line).toEqual([])
    for (const w of [lienNoticeToldWords({ ok: true, told: { pushSent: 1, emailSent: false, leaderName: 'Malachi' } }).said, lienNoticeToldWords({ ok: true, told: { pushSent: 0, emailSent: true, leaderName: 'Malachi' } }).said, lienNoticeToldWords({ ok: true, told: { pushSent: 0, emailSent: false, leaderName: null } }).said]) expect(plainWordsFailures(w), w).toEqual([])
  })
})

describe('the leader’s push for a retainage notice (v2.7478)', () => {
  it('is one line: the job, the retainage and who holds it, the mail-by day; the tap lands on the Retainage list on that job', () => {
    const p = lienRetainageApprovalPush({ jobLabel: '891 · Tune 5 Liberty Hill', jobId: 'j891', retainage: 12_400.4, gcName: 'Brund & Assoc.', dueYmd: '2026-10-15', todayYmd: '2026-10-07', senderName: 'Taunya Smith' })
    expect(p.title).toBe('Approve a retainage notice')
    expect(p.body).toBe('891 · Tune 5 Liberty Hill · $12,400 retainage held by Brund & Assoc. · mail by Oct 15 · 8 days')
    expect(p.url).toBe('/lien-desk?tab=retainage&job=j891')
    expect(p.tag).toBe('lien-retainage-approval-j891')
    expect(p.subject).toBe('Approve a retainage notice · 891 · Tune 5 Liberty Hill')
    expect(p.emailText).toBe('Taunya sent a retainage notice for your approval.\n\n891 · Tune 5 Liberty Hill\n$12,400 retainage held by Brund & Assoc.\nMail by Oct 15, 8 days from now.\n\nOpen the Lien desk to approve it or hold it.')
    expect(lienRetainageApprovalUrl('a b')).toBe('/lien-desk?tab=retainage&job=a%20b')
    expect(lienRetainageApprovalUrl('')).toBe('/lien-desk?tab=retainage')
    // Its own tag: a monthly notice's push on the same job never replaces it.
    expect(p.tag).not.toBe(lienApprovalPush({ jobLabel: '891', jobId: 'j891', claim: 1, gcName: null, dueYmd: null, todayYmd: '2026-10-07', senderName: null }).tag)
  })

  it('a reminder says so; what it does not know is left out, and a day that passed has no count', () => {
    const r = lienRetainageApprovalPush({ jobLabel: '650', jobId: 'j650', retainage: 900, gcName: null, dueYmd: '2026-10-08', todayYmd: '2026-10-07', senderName: 'wendi park', reminder: true })
    expect(r.emailText.split('\n')[0]).toBe('wendi is reminding you of a retainage notice that waits for your approval.')
    expect(r.body).toBe('650 · $900 retainage · mail by Oct 8 · 1 day')
    const bare = lienRetainageApprovalPush({ jobLabel: '650', jobId: 'j650', retainage: null, gcName: 'GC', dueYmd: null, todayYmd: '2026-10-07', senderName: null })
    expect(bare.body).toBe('650')
    expect(bare.emailText).toBe('The office sent a retainage notice for your approval.\n\n650\n\nOpen the Lien desk to approve it or hold it.')
    const late = lienRetainageApprovalPush({ jobLabel: '650', jobId: 'j650', retainage: 0, gcName: 'GC', dueYmd: '2026-10-01', todayYmd: '2026-10-07', senderName: 'R' })
    expect(late.body).toBe('650 · mail by Oct 1')
    expect(late.emailText).toContain('\nMail by Oct 1.\n')
  })

  it('the email’s own sentences keep to plain words', () => {
    const p = lienRetainageApprovalPush({ jobLabel: '650', jobId: 'j650', retainage: 900, gcName: 'GC', dueYmd: '2026-10-15', todayYmd: '2026-10-07', senderName: 'Wendi', reminder: true })
    const lines = p.emailText.split('\n')
    expect(plainWordsFailures(lines[0]!)).toEqual([])
    expect(plainWordsFailures(lines[lines.length - 1]!)).toEqual([])
  })
})
