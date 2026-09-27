// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { myInboxFoldHeadline, readPhoneFoldOpen, requestInboxFoldWords, teamsInboxFoldHeadline, writePhoneFoldOpen } from './phoneFolds'

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
