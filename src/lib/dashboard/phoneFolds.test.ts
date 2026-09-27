// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { billingPipelineFoldHeadline, crewDayFoldHeadline, myTimeFoldHeadline, recentReportsFoldHeadline, hideEmptyMySchedule, myInboxFoldHeadline, needsYouDoorWords, readPhoneFoldOpen, requestInboxFoldWords, teamsInboxFoldHeadline, whosInFoldHeadline, writePhoneFoldOpen } from './phoneFolds'

const TODAY = '2026-09-27'
const NOW = Date.parse('2026-09-27T15:00:00Z')
const req = (status: string, created_at: string | null) => ({ status, created_at })

describe('myInboxFoldHeadline', () => {
  it('counts what is open today and what is overdue; done items are not counted', () => {
    const h = myInboxFoldHeadline(
      [
        { scheduled_date: TODAY, completed_at: null },
        { scheduled_date: TODAY, completed_at: null },
        { scheduled_date: TODAY, completed_at: '2026-09-27T14:00:00Z' },
        { scheduled_date: '2026-09-20', completed_at: null },
        { scheduled_date: '2026-10-01', completed_at: null },
      ],
      TODAY,
    )
    expect(h).toEqual({ words: 'due today 2 · overdue 1', tone: 'red' })
    expect(myInboxFoldHeadline([{ scheduled_date: TODAY, completed_at: null }], TODAY)).toEqual({ words: 'due today 1', tone: 'amber' })
    expect(myInboxFoldHeadline([], TODAY)).toEqual({ words: 'nothing due', tone: 'quiet' })
  })
})

describe('the request inboxes', () => {
  it('says how many are open and how old the oldest is', () => {
    expect(requestInboxFoldWords([req('open', '2026-09-23T10:00:00Z'), req('open', '2026-09-27T09:00:00Z'), req('closed', '2026-09-01T00:00:00Z')], NOW)).toBe('2 open · oldest 4 d')
    expect(requestInboxFoldWords([req('open', '2026-09-27T09:00:00Z')], NOW)).toBe('1 open')
    expect(requestInboxFoldWords([req('open', null)], NOW)).toBe('1 open')
    expect(requestInboxFoldWords([req('closed', '2026-09-01T00:00:00Z')], NOW)).toBe('none open')
  })
  it('names each inbox the role can see on one line', () => {
    expect(teamsInboxFoldHeadline({ dispatch: [req('open', '2026-09-23T10:00:00Z')], estimator: [] }, NOW)).toEqual({ words: 'Dispatch 1 open · oldest 4 d · Estimator none open', tone: 'amber' })
    expect(teamsInboxFoldHeadline({ dispatch: null, estimator: [] }, NOW)).toEqual({ words: 'Estimator none open', tone: 'quiet' })
  })
})

describe('the fold remembers per device and per section', () => {
  beforeEach(() => localStorage.clear())
  it('is closed until opened, and closing forgets it', () => {
    expect(readPhoneFoldOpen('u1', 'my-inbox')).toBe(false)
    writePhoneFoldOpen('u1', 'my-inbox', true)
    expect(readPhoneFoldOpen('u1', 'my-inbox')).toBe(true)
    expect(readPhoneFoldOpen('u1', 'teams-inbox')).toBe(false)
    expect(readPhoneFoldOpen('u2', 'my-inbox')).toBe(false)
    writePhoneFoldOpen('u1', 'my-inbox', false)
    expect(readPhoneFoldOpen('u1', 'my-inbox')).toBe(false)
    expect(readPhoneFoldOpen(null, 'my-inbox')).toBe(false)
  })
})

describe('the dashboard folds (v2.3883)', () => {
  it('who is in, the billing pipeline, the Needs You door', () => {
    expect(whosInFoldHeadline(7).words).toBe('7 in')
    expect(whosInFoldHeadline(0).words).toBe('nobody in')
    expect(billingPipelineFoldHeadline({ ready: 2, billed: 71, loading: false })).toEqual({ words: '2 ready · 71 billed', tone: 'amber' })
    expect(billingPipelineFoldHeadline({ ready: 0, billed: 3, loading: false })).toEqual({ words: '0 ready · 3 billed', tone: 'quiet' })
    expect(billingPipelineFoldHeadline({ ready: 0, billed: 0, loading: false })?.words).toBe('nothing waiting')
    expect(billingPipelineFoldHeadline({ ready: 2, billed: 1, loading: true })).toBeNull()
    expect(needsYouDoorWords([{ title: '1 lien window closes today' }, { title: 'x' }])).toEqual({ count: 2, first: '1 lien window closes today' })
    expect(needsYouDoorWords([])).toBeNull()
  })
  it('My Schedule hides only when folding, loaded, and both days are empty', () => {
    expect(hideEmptyMySchedule({ fold: true, loading: false, todayCount: 0, tomorrowCount: 0 })).toBe(true)
    expect(hideEmptyMySchedule({ fold: true, loading: true, todayCount: 0, tomorrowCount: 0 })).toBe(false)
    expect(hideEmptyMySchedule({ fold: true, loading: false, todayCount: 0, tomorrowCount: 1 })).toBe(false)
    expect(hideEmptyMySchedule({ fold: false, loading: false, todayCount: 0, tomorrowCount: 0 })).toBe(false)
  })
})

describe('the three folds that had no count (v2.3891)', () => {
  it('Crew Day: people, jobs, and flags when there are any', () => {
    expect(crewDayFoldHeadline({ people: 12, jobs: 14, flags: 8 })).toEqual({ words: '12 people · 14 jobs · 8 flags', tone: 'amber' })
    expect(crewDayFoldHeadline({ people: 1, jobs: 1, flags: 0 })).toEqual({ words: '1 person · 1 job', tone: 'quiet' })
    expect(crewDayFoldHeadline({ people: 0, jobs: 0, flags: 0 })?.words).toBe('nobody on the day')
    expect(crewDayFoldHeadline(null)).toBeNull()
  })
  it('Recent reports: what is new, and what is listed', () => {
    expect(recentReportsFoldHeadline({ listed: 12, fresh: 3 })).toEqual({ words: '3 new · 12 listed', tone: 'amber' })
    expect(recentReportsFoldHeadline({ listed: 4, fresh: 0 })).toEqual({ words: '4 listed · all read', tone: 'quiet' })
    expect(recentReportsFoldHeadline({ listed: 0, fresh: 0 })?.words).toBe('none yet')
    expect(recentReportsFoldHeadline(null)).toBeNull()
  })
  it('My Time: the week so far', () => {
    expect(myTimeFoldHeadline(22320)?.words).toBe('6.2 h this week')
    expect(myTimeFoldHeadline(28800)?.words).toBe('8 h this week')
    expect(myTimeFoldHeadline(0)?.words).toBe('0 h this week')
    expect(myTimeFoldHeadline(null)).toBeNull()
  })
})
