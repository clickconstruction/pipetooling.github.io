/**
 * GC mode, Owner Billing's O10b: the office's notices in words (`supabase/functions/_shared/gcOfficeNotices.ts`).
 * The switch holds the day it went on, and anything that is not a real day is off. Each kind says what the README's
 * table promised, and the architect's reminder wears the customer frame while ours stay staff mail.
 */
import { describe, expect, it } from 'vitest'
import {
  billTheCustomerUrl,
  buildOfficeNoticeEmail,
  GC_CERTIFY_REMINDER_FILED_AS,
  GC_OFFICE_NOTICE_EMAIL_TYPE,
  GC_OFFICE_NOTICE_KINDS,
  gcOfficeNoticesSince,
  noticeDay,
  noticeDollars,
  officeNoticeWords,
  testSubject,
  waiverDrawWords,
  type GcOfficeNotice,
} from '../../../supabase/functions/_shared/gcOfficeNotices'

const URL = 'https://clicktooling.com/gc?bill=p1'

const billDay: GcOfficeNotice = {
  kind: 'bill_day',
  projectId: 'p1',
  project: 'Oak Ridge Clinic',
  billingJobId: 'j1',
  billDay: '2026-10-25',
  number: 4,
  waiversOwed: [
    { company: 'Halverson Steel', draws: [], final: true },
    { company: 'Ridgeway Concrete', draws: [1, 2], final: false },
  ],
  to: { userId: 'u1', name: 'Pat Controller', email: 'pm@x.test' },
}
const reminder: GcOfficeNotice = {
  kind: 'certify_reminder',
  projectId: 'p1',
  project: 'Oak Ridge Clinic',
  billingJobId: 'j1',
  payAppId: 'a3',
  number: 3,
  final: false,
  due: 288879,
  sentOn: '2026-10-02',
  to: { customerId: 'c2', name: 'Hart Architects' },
  replyTo: { name: 'Pat Controller', email: 'pm@x.test' },
}
const late: GcOfficeNotice = {
  kind: 'certify_late',
  projectId: 'p1',
  project: 'Oak Ridge Clinic',
  billingJobId: 'j1',
  payAppId: 'a3',
  number: 3,
  final: false,
  due: 288879,
  sentOn: '2026-10-02',
  architect: 'Hart Architects',
  remindedOn: '2026-10-05',
  to: { userId: 'u1', name: 'Pat Controller', email: 'pm@x.test' },
}

describe('the switch holds the day it went on', () => {
  it('a real ISO day is on since that day', () => {
    expect(gcOfficeNoticesSince('2026-10-15')).toBe('2026-10-15')
    expect(gcOfficeNoticesSince(' 2026-10-15 ')).toBe('2026-10-15')
  })

  it('anything else is off: false, true, a word, a day that never was, nothing', () => {
    for (const v of ['false', 'true', 'today', '2026-02-30', '2026-13-01', '10/15/2026', '', null, undefined]) {
      expect(gcOfficeNoticesSince(v), String(v)).toBeNull()
    }
  })
})

describe('each kind in words', () => {
  it('bill day: the day, the pay application to draft, each trade owing a waiver, and the press', () => {
    expect(officeNoticeWords(billDay, URL)).toEqual({
      subject: 'Bill day for Oak Ridge Clinic is Oct 25',
      lines: [
        'Bill day for Oak Ridge Clinic is Oct 25. Pay application 4 is ready to draft in Bill the customer.',
        'Halverson Steel still owes its unconditional waiver on the final draw.',
        'Ridgeway Concrete still owes its unconditional waiver on draws 1 and 2.',
        `Open Bill the customer: ${URL}`,
      ],
    })
  })

  it('bill day with no waivers owed says only the day and the press', () => {
    expect(officeNoticeWords({ ...billDay, waiversOwed: [] }, URL).lines).toHaveLength(2)
  })

  it('the architect: when it went, for how much, and that we wait on the certificate', () => {
    expect(officeNoticeWords(reminder, URL)).toEqual({
      subject: 'Pay application 3 for Oak Ridge Clinic waits on your certificate',
      lines: ['Hello,', 'We sent you pay application 3 for Oak Ridge Clinic on Oct 2, for $288,879, to certify.', 'We have not had your certificate yet.', 'Reply here if anything on it needs a change.'],
    })
    expect(officeNoticeWords({ ...reminder, final: true }, URL).subject).toBe('Our final pay application for Oak Ridge Clinic waits on your certificate')
  })

  it('the project manager at 5: who has it, since when, and the reminder or why there was none', () => {
    expect(officeNoticeWords(late, URL)).toEqual({
      subject: 'Pay application 3 for Oak Ridge Clinic still waits on the architect',
      lines: ['Pay application 3 for Oak Ridge Clinic went to Hart Architects on Oct 2 and still waits on their certificate.', 'We reminded them on Oct 5.', `Open Bill the customer: ${URL}`],
    })
    expect(officeNoticeWords({ ...late, remindedOn: null }, URL).lines[1]).toBe('They have no email on file, so they were not reminded.')
    expect(officeNoticeWords({ ...late, remindedOn: null, architect: null }, URL).lines).toEqual([
      'Pay application 3 for Oak Ridge Clinic went to the architect on Oct 2 and still waits on their certificate.',
      'The job has no architect on file, so no one was reminded.',
      `Open Bill the customer: ${URL}`,
    ])
  })
})

describe('the frames', () => {
  it('the architect’s reminder is from Click Construction, signed by the project manager, with no portal line', () => {
    const email = buildOfficeNoticeEmail(reminder, URL, 'Pat Controller')
    expect(email.text).toContain('We sent you pay application 3')
    expect(email.text).toContain('Thank you,\nPat Controller\nClick Construction')
    expect(email.text).not.toContain('portal')
    expect(email.html).toContain('Click Construction')
  })

  it('ours are staff mail: the press is a link, the text keeps the address', () => {
    const email = buildOfficeNoticeEmail(late, URL, null)
    expect(email.text).toContain(`Open Bill the customer: ${URL}`)
    expect(email.html).toContain(`<a href="${URL}"`)
    expect(email.html).not.toContain('Click Construction')
  })

  it('escapes what a job’s name carries', () => {
    const email = buildOfficeNoticeEmail({ ...late, project: 'Oak <Ridge> & Sons' }, URL, null)
    expect(email.html).toContain('Oak &lt;Ridge&gt; &amp; Sons')
    expect(email.html).not.toContain('<Ridge>')
  })

  it('a test copy says so before its subject', () => {
    expect(testSubject('Bill day for Oak Ridge Clinic is Oct 25')).toBe('[TEST] Bill day for Oak Ridge Clinic is Oct 25')
  })
})

describe('the small words', () => {
  it('days, dollars and draws', () => {
    expect(noticeDay('2026-10-05')).toBe('Oct 5')
    expect(noticeDay(null)).toBe('')
    expect(noticeDollars(288879)).toBe('$288,879')
    expect(noticeDollars(8666.37)).toBe('$8,666.37')
    expect(waiverDrawWords({ draws: [1], final: false })).toBe('draw 1')
    expect(waiverDrawWords({ draws: [1, 2, 3], final: true })).toBe('draws 1, 2 and 3 and the final draw')
    expect(billTheCustomerUrl('https://clicktooling.com/', 'p 1')).toBe('https://clicktooling.com/gc?bill=p%201')
  })

  it('every kind has its email type, and only the architect’s reminder is filed', () => {
    expect(Object.keys(GC_OFFICE_NOTICE_EMAIL_TYPE).sort()).toEqual([...GC_OFFICE_NOTICE_KINDS].sort())
    expect(GC_OFFICE_NOTICE_EMAIL_TYPE.certify_reminder).toBe(GC_CERTIFY_REMINDER_FILED_AS)
  })
})
