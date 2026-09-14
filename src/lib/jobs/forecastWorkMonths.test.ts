import { describe, expect, it } from 'vitest'
import {
  buildJobWorkMonths,
  buildWorkMonthsByJob,
  firstName,
  mondayOf,
  nearestOpenNotice,
  noticeStateFor,
  noticeStateText,
  summarizeNoticeMonths,
  workMonthLabel,
  type WorkMonthJobContext,
  type WorkSessionInput,
} from './forecastWorkMonths'

const TODAY = '2026-09-14'
const NAMES = { u1: 'Tristen Vela', u2: 'Malachi Ray', u3: 'Paige Ortiz' }

function s(partial: Partial<WorkSessionInput> & { workDate: string; userId?: string; hours?: number }): WorkSessionInput {
  const hours = partial.hours ?? 8
  return {
    jobId: partial.jobId ?? 'j650',
    userId: partial.userId ?? 'u1',
    workDate: partial.workDate,
    clockedInAt: `${partial.workDate}T13:00:00Z`,
    clockedOutAt: partial.clockedOutAt === null ? null : `${partial.workDate}T${String(13 + hours).padStart(2, '0')}:00:00Z`,
    approved: partial.approved ?? true,
  }
}

const SUB: WorkMonthJobContext = { jobId: 'j650', isSub: true, propertyKind: '', noticedMonths: new Set() }
const DIRECT: WorkMonthJobContext = { jobId: 'j273', isSub: false, propertyKind: '', noticedMonths: new Set() }

// The live example that motivated the feature: J650 worked Jun–Sep, nothing paid.
const J650 = [
  s({ workDate: '2026-06-08', userId: 'u1', hours: 6 }),
  s({ workDate: '2026-06-08', userId: 'u2', hours: 6 }),
  s({ workDate: '2026-06-09', userId: 'u1', hours: 9 }),
  s({ workDate: '2026-06-30', userId: 'u3', hours: 10 }),
  s({ workDate: '2026-07-01', userId: 'u3', hours: 8 }),
  s({ workDate: '2026-08-20', userId: 'u1', hours: 8 }),
  s({ workDate: '2026-09-08', userId: 'u2', hours: 8, approved: false }),
  s({ workDate: '2026-09-08', userId: 'u3', hours: 4 }),
]

describe('mondayOf / labels', () => {
  it('finds the Monday of a week and labels months', () => {
    expect(mondayOf('2026-06-08')).toBe('2026-06-08') // a Monday
    expect(mondayOf('2026-06-13')).toBe('2026-06-08') // Saturday
    expect(mondayOf('2026-06-14')).toBe('2026-06-08') // Sunday belongs to the week before
    expect(workMonthLabel('2026-06')).toBe('Jun 2026')
    expect(firstName('Tristen Vela')).toBe('Tristen')
  })
})

describe('buildJobWorkMonths', () => {
  it('groups sessions into chronological months and Monday weeks with people, hours, days and days-since', () => {
    const job = buildJobWorkMonths(J650, SUB, NAMES, TODAY)!
    expect(job.months.map((m) => m.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09'])
    const jun = job.months[0]!
    expect(jun.label).toBe('Jun 2026')
    expect(jun.people).toEqual(['Tristen Vela', 'Malachi Ray', 'Paige Ortiz'])
    expect(jun.hours).toBe(31)
    expect(jun.dayCount).toBe(3)
    expect(jun.weeks.map((w) => w.start)).toEqual(['2026-06-08', '2026-06-29'])
    expect(jun.weeks[0]).toMatchObject({ people: ['Tristen Vela', 'Malachi Ray'], hours: 21, dayCount: 2, daysSince: 98 })
    expect(jun.weeks[1]).toMatchObject({ people: ['Paige Ortiz'], hours: 10, dayCount: 1, daysSince: 77 })
    // June is 31 of 59 hours.
    expect(job.totalHours).toBe(59)
    expect(jun.hoursShare).toBe(53)
    expect(job.sessionCount).toBe(8)
  })

  it('carries pending (unapproved) hours separately so the UI can hatch them', () => {
    const job = buildJobWorkMonths(J650, SUB, NAMES, TODAY)!
    const sep = job.months[3]!
    expect(sep.hours).toBe(12)
    expect(sep.pendingHours).toBe(8)
    expect(sep.weeks[0]!.pendingHours).toBe(8)
    expect(job.pendingSessions).toBe(1)
    expect(job.months[0]!.pendingHours).toBe(0)
  })

  it('an open session (no clock-out) counts the day and the person but no hours', () => {
    const job = buildJobWorkMonths([s({ workDate: '2026-09-10', clockedOutAt: null })], SUB, NAMES, TODAY)!
    expect(job.months[0]).toMatchObject({ hours: 0, dayCount: 1, people: ['Tristen Vela'] })
  })

  it('returns null for a job with no sessions and names unknown users "Someone"', () => {
    expect(buildJobWorkMonths([], SUB, NAMES, TODAY)).toBeNull()
    const job = buildJobWorkMonths([s({ workDate: '2026-09-10', userId: 'ghost' })], SUB, {}, TODAY)!
    expect(job.months[0]!.people).toEqual(['Someone'])
  })
})

describe('the lien clock per month', () => {
  it('a sub job gets one § 53.056 notice per work month, keyed on that month, not the last one', () => {
    const job = buildJobWorkMonths(J650, SUB, NAMES, TODAY)!
    expect(job.role).toBe('sub')
    // Commercial (kind unknown → commercial): 15th of the 3rd month after, weekends rolled.
    expect(job.months.map((m) => m.notice?.due)).toEqual(['2026-09-15', '2026-10-15', '2026-11-16', '2026-12-15'])
    expect(job.months.map((m) => m.notice?.state)).toEqual(['due', 'open', 'open', 'open'])
    expect(job.months[0]!.notice).toMatchObject({ daysLeft: 1 })
    // The affidavit is one date from the LAST month worked.
    expect(job.lastMonthKey).toBe('2026-09')
    expect(job.affidavitDue).toBe('2027-01-15')
  })

  it('a direct-with-owner job has no monthly notice, only the affidavit from the last month', () => {
    const job = buildJobWorkMonths(J650.map((x) => ({ ...x, jobId: 'j273' })), DIRECT, NAMES, TODAY)!
    expect(job.role).toBe('direct')
    expect(job.months.every((m) => m.notice === null)).toBe(true)
    expect(job.affidavitDue).toBe('2027-01-15')
  })

  it('a residential property shortens both clocks by a month', () => {
    const job = buildJobWorkMonths(J650, { ...SUB, propertyKind: 'residential' }, NAMES, TODAY)!
    expect(job.months[0]!.notice?.due).toBe('2026-08-17') // Aug 15 2026 is a Saturday → Monday
    expect(job.months[0]!.notice?.state).toBe('closed')
    expect(job.affidavitDue).toBe('2026-12-15')
  })

  it('a month already named by a live notice reads "sent"; states follow the 7 / 14 day bands', () => {
    const job = buildJobWorkMonths(J650, { ...SUB, noticedMonths: new Set(['2026-06']) }, NAMES, TODAY)!
    expect(job.months[0]!.notice?.state).toBe('sent')
    expect(noticeStateFor(-1, false)).toBe('closed')
    expect(noticeStateFor(0, false)).toBe('due')
    expect(noticeStateFor(7, false)).toBe('due')
    expect(noticeStateFor(8, false)).toBe('closing')
    expect(noticeStateFor(14, false)).toBe('closing')
    expect(noticeStateFor(15, false)).toBe('open')
    expect(noticeStateText({ due: '2026-09-14', daysLeft: 0, state: 'due' })).toBe('due today')
    expect(noticeStateText({ due: '2026-09-15', daysLeft: 1, state: 'due' })).toBe('due tomorrow')
    expect(noticeStateText({ due: '2026-09-19', daysLeft: 5, state: 'due' })).toBe('due in 5d')
    expect(noticeStateText({ due: '2026-09-26', daysLeft: 12, state: 'closing' })).toBe('closes in 12d')
    expect(noticeStateText({ due: '2026-09-26', daysLeft: 12, state: 'sent' })).toBe('notice sent')
  })
})

describe('the row chip and the line above the buckets', () => {
  it('nearestOpenNotice picks the earliest due/closing month and ignores direct jobs, sent and closed months', () => {
    const sub = buildJobWorkMonths(J650, SUB, NAMES, TODAY)!
    expect(nearestOpenNotice(sub)?.month.key).toBe('2026-06')
    const sent = buildJobWorkMonths(J650, { ...SUB, noticedMonths: new Set(['2026-06']) }, NAMES, TODAY)!
    expect(nearestOpenNotice(sent)).toBeNull() // July is 31 days out — quiet
    const direct = buildJobWorkMonths(J650.map((x) => ({ ...x, jobId: 'j273' })), DIRECT, NAMES, TODAY)!
    expect(nearestOpenNotice(direct)).toBeNull()
    expect(nearestOpenNotice(null)).toBeNull()
  })

  it('summarizeNoticeMonths counts months and jobs and sums the open dollars on those jobs', () => {
    const byJob = buildWorkMonthsByJob(
      [...J650, s({ jobId: 'j273', workDate: '2026-08-26' }), s({ jobId: 'j977', workDate: '2026-06-03' })],
      [SUB, DIRECT, { jobId: 'j977', isSub: true, propertyKind: '', noticedMonths: new Set() }],
      NAMES,
      TODAY,
    )
    expect(Object.keys(byJob).sort()).toEqual(['j273', 'j650', 'j977'])
    const sum = summarizeNoticeMonths(byJob, { j650: 33_500, j273: 13_420, j977: 11_770 })
    expect(sum).toMatchObject({ monthCount: 2, jobCount: 2, dollars: 45_270 })
    expect(sum.first?.jobId).toBe('j650')
    expect(sum.first?.month.key).toBe('2026-06')
    expect(summarizeNoticeMonths({}, {})).toEqual({ monthCount: 0, jobCount: 0, dollars: 0, first: null })
  })
})
