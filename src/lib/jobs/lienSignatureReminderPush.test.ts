import { describe, expect, it } from 'vitest'
import { lienSignatureReminderPush, lienSignatureUrl } from './lienApprovalPush'

/** The words a leader gets when the office reminds him of notices that wait on his signature (v2.7491). */
const paper = (n: string, mailByYmd: string | null) => ({ jobLabel: `${n} · Job ${n}`, jobId: `j${n}`, mailByYmd })

describe('lienSignatureReminderPush', () => {
  it('one notice: the job, the mail-by day and the days left, and the tap opens that job among the approved notices', () => {
    const p = lienSignatureReminderPush({ papers: [paper('650', '2026-11-20')], todayYmd: '2026-11-16', senderName: 'Wendi Park' })
    expect(p.title).toBe('Sign a lien notice')
    expect(p.body).toBe('650 · Job 650 · mail by Nov 20 · 4 days')
    expect(p.url).toBe('/lien-desk?tab=notices&job=j650&pile=ready')
    expect(p.tag).toBe('lien-signature-j650')
    expect(p.subject).toBe('Sign a lien notice · 650 · Job 650')
    expect(p.emailText.split('\n')).toEqual([
      'Wendi is reminding you of a lien notice that waits for your signature.',
      '',
      '650 · Job 650',
      'Mail by Nov 20, 4 days from now.',
      'It is approved. It cannot be printed or mailed until you sign it.',
      '',
      'Open the Lien desk to sign it.',
    ])
  })

  it('eight notices are one message: the count, the soonest day, and each job beside its own day in the email', () => {
    const papers = [paper('1', '2026-12-15'), paper('2', '2026-11-16'), paper('3', null), ...['4', '5', '6', '7', '8'].map((n) => paper(n, '2026-12-01'))]
    const p = lienSignatureReminderPush({ papers, todayYmd: '2026-11-16', senderName: null })
    expect(p.title).toBe('Sign 8 lien notices')
    expect(p.body).toBe('8 jobs · first to mail by Nov 16 · today')
    expect(p.url).toBe('/lien-desk?tab=notices&pile=ready')
    expect(p.subject).toBe('Sign 8 lien notices')
    const lines = p.emailText.split('\n')
    expect(lines[0]).toBe('The office is reminding you of 8 lien notices that wait for your signature.')
    expect(lines.slice(2, 10)).toEqual(['2 · Job 2 · mail by Nov 16', '4 · Job 4 · mail by Dec 1', '5 · Job 5 · mail by Dec 1', '6 · Job 6 · mail by Dec 1', '7 · Job 7 · mail by Dec 1', '8 · Job 8 · mail by Dec 1', '1 · Job 1 · mail by Dec 15', '3 · Job 3'])
    expect(p.emailText).toContain('The first must be in the mail by Nov 16. That is today.')
    expect(p.emailText).toContain('None can be printed or mailed until you sign it.')
  })

  it('a day that has passed is named without a count, and a notice with no day says none', () => {
    expect(lienSignatureReminderPush({ papers: [paper('650', '2026-11-01')], todayYmd: '2026-11-16', senderName: 'Wendi' }).body).toBe('650 · Job 650 · mail by Nov 1')
    const none = lienSignatureReminderPush({ papers: [paper('650', null)], todayYmd: '2026-11-16', senderName: 'Wendi' })
    expect(none.body).toBe('650 · Job 650')
    expect(none.emailText).not.toContain('Mail by')
  })

  it('the door is the approved notices, on the job when the message is about one', () => {
    expect(lienSignatureUrl('j 1')).toBe('/lien-desk?tab=notices&job=j%201&pile=ready')
    expect(lienSignatureUrl(null)).toBe('/lien-desk?tab=notices&pile=ready')
  })
})
