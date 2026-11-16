import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { doneLineWords, nextTaskId, notePressLabel, splitToday, taskHearsId, todayHeadDate, todayPartLabel, todaySentence } from './todayPage'

describe('todayHeadDate', () => {
  it('reads the weekday, the short month and the day', () => {
    expect(todayHeadDate(new Date(2026, 10, 16, 9, 0))).toBe('Monday, Nov 16')
  })
})

describe('todaySentence', () => {
  it('says how many of the day are done, then the older ones', () => {
    expect(todaySentence({ today: 3, done: 1, stillOpen: 8 })).toBe('1 of 3 done today. 8 older tasks are still open.')
  })
  it('a finished day says so, for one task and for several', () => {
    expect(todaySentence({ today: 1, done: 1, stillOpen: 0 })).toBe('Your 1 task for today is done.')
    expect(todaySentence({ today: 4, done: 4, stillOpen: 0 })).toBe('All 4 tasks for today are done.')
  })
  it('a day with nothing dated says so and still counts the older ones', () => {
    expect(todaySentence({ today: 0, done: 0, stillOpen: 0 })).toBe('Nothing is due today.')
    expect(todaySentence({ today: 0, done: 0, stillOpen: 1 })).toBe('Nothing is due today. 1 older task is still open.')
  })
  it('every shape is plain words', () => {
    for (const today of [0, 1, 2, 12]) {
      for (const done of [0, 1, 12]) {
        for (const stillOpen of [0, 1, 40]) {
          expect(plainWordsFailures(todaySentence({ today, done: Math.min(done, today), stillOpen }))).toEqual([])
        }
      }
    }
  })
})

describe('splitToday', () => {
  it('keeps the list order inside each half', () => {
    const rows = [
      { id: 'a', completed_at: null },
      { id: 'b', completed_at: '2026-11-16T18:00:00Z' },
      { id: 'c', completed_at: null },
    ]
    const { open, done } = splitToday(rows)
    expect(open.map((r) => r.id)).toEqual(['a', 'c'])
    expect(done.map((r) => r.id)).toEqual(['b'])
  })
})

describe('nextTaskId', () => {
  const older = [{ id: 'old-1' }, { id: 'old-2' }, { id: 'old-3' }]
  it('is the first open task dated today', () => {
    expect(nextTaskId([{ id: 't1' }, { id: 't2' }], older)).toBe('t1')
  })
  it('with today finished, a task sent back comes before the oldest', () => {
    expect(nextTaskId([], older, new Set(['old-3']))).toBe('old-3')
    expect(nextTaskId([], older)).toBe('old-1')
  })
  it('is nothing when nothing is open', () => {
    expect(nextTaskId([], [])).toBeNull()
  })
})

describe('doneLineWords', () => {
  it('names who hears, and says only when for a task nobody is told about', () => {
    expect(doneLineWords('12:22 PM', 'Imani')).toBe('Done 12:22 PM. Imani hears it is done.')
    expect(doneLineWords('12:22 PM', null)).toBe('Done 12:22 PM.')
    expect(doneLineWords('12:22 PM', '  ')).toBe('Done 12:22 PM.')
    expect(plainWordsFailures(doneLineWords('Tue 3:12 PM', 'Imani'))).toEqual([])
  })
})

describe('taskHearsId', () => {
  it('is the person named on the task, else the giver who asked to hear', () => {
    expect(taskHearsId({ notify_on_complete_user_id: 'u-office', notify_creator_on_complete: true, created_by_user_id: 'u-giver' }, 'u-me')).toBe('u-office')
    expect(taskHearsId({ notify_on_complete_user_id: null, notify_creator_on_complete: true, created_by_user_id: 'u-giver' }, 'u-me')).toBe('u-giver')
    expect(taskHearsId({ notify_on_complete_user_id: null, notify_creator_on_complete: false, created_by_user_id: 'u-giver' }, 'u-me')).toBeNull()
  })
  it('is never the person doing the task', () => {
    expect(taskHearsId({ notify_on_complete_user_id: 'u-me' }, 'u-me')).toBeNull()
    expect(taskHearsId({ notify_creator_on_complete: true, created_by_user_id: 'u-me' }, 'u-me')).toBeNull()
    expect(taskHearsId(null, 'u-me')).toBeNull()
  })
})

describe('labels', () => {
  it('the parts of the day carry their counts', () => {
    expect(todayPartLabel('next', 1)).toBe('Next')
    expect(todayPartLabel('then', 2)).toBe('Then · 2')
    expect(todayPartLabel('done', 1)).toBe('Done today · 1')
  })
  it('the note press counts the notes once there is one', () => {
    expect(notePressLabel(0)).toBe('＋ Note')
    expect(notePressLabel(1)).toBe('1 note')
    expect(notePressLabel(3)).toBe('3 notes')
  })
})
