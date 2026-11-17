import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { TASK_MAP_NOT_OPENED, TASK_MAP_SHEET_FOOT, TASK_MAP_SHEET_TITLE, TASK_MORE_LABEL, addDaysYmd, doerLineWords, moveDayPicks, moveDayPressLabel, moveDayPush, moveDayRule, moveDaySentence, movedTimesWords, taskMapStarts, taskMoreChoices } from './taskDoerActs'

describe('a map from the person doing the task', () => {
  it('offers a line by hand, a walked line and a point, in that order', () => {
    expect(taskMapStarts(true).map((r) => r.key)).toEqual(['line', 'walk', 'place'])
    expect(taskMapStarts(true).map((r) => r.label)).toEqual(['Draw it by hand', 'Walk or drive it', 'Leave a point'])
  })
  it('leaves the walk out on a device that cannot say where it is', () => {
    expect(taskMapStarts(false).map((r) => r.key)).toEqual(['line', 'place'])
  })
  it('every word a person reads is plain', () => {
    for (const row of taskMapStarts(true)) expect(plainWordsFailures(row.words)).toEqual([])
    for (const s of [TASK_MAP_SHEET_TITLE, TASK_MAP_SHEET_FOOT, TASK_MAP_NOT_OPENED]) expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('More', () => {
  it('offers Not today on an open one-time task, and nothing on a repeating or a done one', () => {
    expect(taskMoreChoices({ once: true, done: false }).map((r) => r.key)).toEqual(['move'])
    expect(taskMoreChoices({ once: false, done: false })).toEqual([])
    expect(taskMoreChoices({ once: true, done: true })).toEqual([])
  })
  it('names itself and its rows in plain words', () => {
    expect(TASK_MORE_LABEL).toBe('⋯ More')
    for (const row of taskMoreChoices({ once: true, done: false })) expect(plainWordsFailures(row.words)).toEqual([])
  })
})

describe('Not today', () => {
  it('counts days across a month end', () => {
    expect(addDaysYmd('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysYmd('2026-11-16', -30)).toBe('2026-10-17')
  })
  it('offers tomorrow and the next Monday', () => {
    // 2026-11-16 is a Monday.
    expect(moveDayPicks('2026-11-16')).toEqual([
      { key: 'tomorrow', label: 'Tomorrow', ymd: '2026-11-17' },
      { key: 'monday', label: 'Monday', ymd: '2026-11-23' },
    ])
    expect(moveDayPicks('2026-11-19')[1]!.ymd).toBe('2026-11-23')
  })
  it('on a Sunday, tomorrow is Monday, so the second pick is the Monday after', () => {
    expect(moveDayPicks('2026-11-22')).toEqual([
      { key: 'tomorrow', label: 'Tomorrow', ymd: '2026-11-23' },
      { key: 'monday', label: 'Monday', ymd: '2026-11-30' },
    ])
  })
  it('holds the press until the day is one the database will take, in its words', () => {
    expect(moveDayRule(null, '2026-11-16')).toBe('Pick a day.')
    expect(moveDayRule('2026-11-15', '2026-11-16')).toBe('Pick today or a later day.')
    expect(moveDayRule('2026-11-16', '2026-11-16')).toBeNull()
    expect(moveDayRule('2027-11-18', '2026-11-16')).toBe('Pick a day within a year.')
    expect(moveDayRule('2027-11-17', '2026-11-16')).toBeNull()
    expect(moveDayRule('2026-11-20', '2026-11-16', '2026-11-20')).toBe('This task is already due that day.')
  })
  it('the press and the sentence name the day, and who is told', () => {
    expect(moveDayPressLabel('Fri, Nov 20')).toBe('Move it to Fri, Nov 20')
    expect(moveDayPressLabel(null)).toBe('Pick a day first')
    expect(moveDaySentence('Fri, Nov 20', 'Imani')).toBe('It moves to Fri, Nov 20. Imani is told.')
    expect(moveDaySentence('Fri, Nov 20', null)).toBe('It moves to Fri, Nov 20.')
    expect(plainWordsFailures(moveDaySentence('Fri, Nov 20', 'Imani'))).toEqual([])
  })
  it('a row says how often its task was moved', () => {
    expect(movedTimesWords(0)).toBe('')
    expect(movedTimesWords(1)).toBe('moved once')
    expect(movedTimesWords(2)).toBe('moved twice')
    expect(movedTimesWords(5)).toBe('moved 5 times')
  })
  it('the giver\'s push says who moved what to when', () => {
    expect(moveDayPush('Theo', 'Give every tool a home', 'Fri, Nov 20')).toEqual({ title: 'A task was moved', body: 'Theo moved "Give every tool a home" to Fri, Nov 20.' })
  })
})

describe('the thread', () => {
  it('words each line the tools write, after the person\'s name', () => {
    expect(doerLineWords('moved', 'Fri, Nov 20')).toBe('moved it to Fri, Nov 20')
    expect(doerLineWords('stuck', 'Waiting on a part')).toBe('is stuck: Waiting on a part')
    expect(doerLineWords('unstuck', '')).toBe('is no longer stuck')
    expect(doerLineWords('dropped', 'Plans changed')).toBe('closed it as no longer applying: Plans changed')
    expect(doerLineWords('handed', 'Hal: wrong crew')).toBe('handed it to Hal: wrong crew')
    expect(doerLineWords('map', 'Shut-off run')).toBe('put a map on it: Shut-off run')
  })
  it('leaves the kinds it does not know to the thread', () => {
    expect(doerLineWords('completed', '')).toBeNull()
    expect(doerLineWords('comment', 'hello')).toBeNull()
  })
})
