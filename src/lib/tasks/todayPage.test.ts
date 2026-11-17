import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { dayLabel } from '../checklistDueDates'
import { ADD_OWN_TASK_LABEL, MAP_PRESS_LABEL, MAP_PRESS_TITLE, taskMapIdOf, ADD_PHOTO_PRESS, ADD_PHOTO_SHEET_TITLE, FOLLOW_UP_LABEL, PHOTO_PRESS_LABEL, beforeStartWords, justDoneWords, FOLLOW_UP_TITLE_MAX, doneLineWords, followUpTellsId, followUpTitle, lateFirst, nextTaskId, notePressLabel, showMoreLabel, splitToday, stillOpenAge, stillOpenIsLate, stillOpenLabel, stillOpenOrderWords, stillOpenShown, taskHearsId, todayHeadDate, todayPartLabel, todaySentence } from './todayPage'

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

describe('stillOpenAge', () => {
  const today = '2026-11-16'
  it('a task with no due day says when it was given and wears its age, amber after a week', () => {
    expect(stillOpenAge('2026-08-20', null, today)).toEqual({ words: `given ${dayLabel('2026-08-20')}`, pill: '88 days', tone: 'old' })
    expect(stillOpenAge('2026-11-13', null, today)).toEqual({ words: `given ${dayLabel('2026-11-13')}`, pill: '3 days', tone: 'soft' })
    expect(stillOpenAge('2026-11-15', undefined, today).pill).toBe('1 day')
    expect(stillOpenAge('2026-11-09', null, today).tone).toBe('old')
  })
  it('red is kept for a due day that has passed', () => {
    expect(stillOpenAge('2026-10-01', '2026-11-06', today)).toEqual({ words: `due ${dayLabel('2026-11-06')}`, pill: '10 days late', tone: 'late' })
    expect(stillOpenAge('2026-10-01', '2026-11-15', today).pill).toBe('1 day late')
    expect(stillOpenIsLate('2026-11-06', today)).toBe(true)
    expect(stillOpenIsLate('2026-11-16', today)).toBe(false)
    expect(stillOpenIsLate(null, today)).toBe(false)
  })
  it('a task still inside its window is calm, and amber on its due day', () => {
    expect(stillOpenAge('2026-10-01', '2026-11-20', today)).toEqual({ words: `due ${dayLabel('2026-11-20')}`, pill: null, tone: 'soft' })
    expect(stillOpenAge('2026-10-01', today, today)).toEqual({ words: 'due today', pill: null, tone: 'old' })
  })
  it('never says due for a task that has no due day', () => {
    expect(stillOpenAge('2026-08-20', null, today).words.startsWith('due')).toBe(false)
  })
})

describe('stillOpenShown', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }))
  it('folds past three rows and counts the rest', () => {
    const { shown, hidden } = stillOpenShown(rows, false)
    expect(shown.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(hidden).toBe(3)
    expect(showMoreLabel(hidden)).toBe('Show 3 more')
  })
  it('draws a list one past the fold whole', () => {
    expect(stillOpenShown(rows.slice(0, 4), false)).toEqual({ shown: rows.slice(0, 4), hidden: 0 })
  })
  it('opens for the press, and for a row opened from the map that sat below the fold', () => {
    expect(stillOpenShown(rows, true).hidden).toBe(0)
    expect(stillOpenShown(rows, false, 'e').hidden).toBe(0)
    expect(stillOpenShown(rows, false, 'b').hidden).toBe(3)
  })
  it('labels the list with its count', () => {
    expect(stillOpenLabel(8)).toBe('Still open · 8')
  })
})

describe('lateFirst', () => {
  const rows = [
    { id: 'old', checklist_items: { due_date: null } },
    { id: 'late', checklist_items: { due_date: '2026-11-06' } },
    { id: 'older', checklist_items: null },
    { id: 'in-window', checklist_items: { due_date: '2026-11-20' } },
  ]
  it('lifts a task whose due day has passed to the top and keeps the rest in order', () => {
    expect(lateFirst(rows, '2026-11-16').map((r) => r.id)).toEqual(['late', 'old', 'older', 'in-window'])
  })
  it('leaves a list with nothing late as it came', () => {
    expect(lateFirst(rows, '2026-11-01').map((r) => r.id)).toEqual(['old', 'late', 'older', 'in-window'])
  })
  it('the words beside the label say the order', () => {
    expect(stillOpenOrderWords(true)).toBe('late first, then oldest')
    expect(stillOpenOrderWords(false)).toBe('oldest first')
  })
})

describe('a follow-up', () => {
  it('opens on the first task\'s words, with room after the colon', () => {
    expect(followUpTitle('Check the truck fluids')).toBe('After Check the truck fluids: ')
    expect(followUpTitle('  Sweep   the shop bays ')).toBe('After Sweep the shop bays: ')
    expect(followUpTitle('')).toBe('')
  })
  it('cuts a long title so the new words have room', () => {
    const long = 'Walk the whole north fence line and write down every post that leans or has rotted through'
    const out = followUpTitle(long)
    expect(out.endsWith('…: ')).toBe(true)
    expect(out.length).toBeLessThanOrEqual('After '.length + FOLLOW_UP_TITLE_MAX + 2)
  })
  it('tells the first task\'s giver, unless the writer is the giver', () => {
    expect(followUpTellsId('u-giver', 'u-me')).toBe('u-giver')
    expect(followUpTellsId('u-me', 'u-me')).toBeNull()
    expect(followUpTellsId(null, 'u-me')).toBeNull()
  })
  it('the two presses name what they do', () => {
    expect(ADD_OWN_TASK_LABEL).toBe('＋ Add a task for me')
    expect(FOLLOW_UP_LABEL).toBe('Follow-up')
  })
})

describe('proof and who hears (step B2)', () => {
  it('an open task says who hears and whether a photo is asked for, and nothing when neither', () => {
    expect(beforeStartWords('Imani', false)).toBe('Imani hears when it is done.')
    expect(beforeStartWords('Imani', true)).toBe('Imani hears when it is done. It asks for a photo at the finish.')
    expect(beforeStartWords(null, true)).toBe('It asks for a photo at the finish.')
    expect(beforeStartWords(' ', false)).toBeNull()
  })
  it('a task just finished offers the photo and the note in words', () => {
    expect(justDoneWords('Imani')).toBe('Add a photo or a note for Imani if it helps.')
    expect(justDoneWords(null)).toBe('Add a photo or a note if it helps.')
  })
  it('every line is plain words', () => {
    for (const s of [beforeStartWords('Imani', true)!, justDoneWords('Imani'), justDoneWords(null)]) expect(plainWordsFailures(s)).toEqual([])
  })
  it('the photo press and its sheet name what they do', () => {
    expect(PHOTO_PRESS_LABEL).toBe('📷 Photo')
    expect(ADD_PHOTO_SHEET_TITLE).toBe('Add a photo')
    expect(ADD_PHOTO_PRESS).toBe('Add the photo')
  })
})

describe('the map press (step B3)', () => {
  it('reads the task\'s map from its place first, then from the task', () => {
    expect(taskMapIdOf({ mapId: 'way-1' }, 'map-9')).toBe('way-1')
    expect(taskMapIdOf({ mapId: null }, 'map-9')).toBe('map-9')
    expect(taskMapIdOf(null, 'map-9')).toBe('map-9')
    expect(taskMapIdOf(null, null)).toBeNull()
    expect(taskMapIdOf({}, undefined)).toBeNull()
  })
  it('the press names itself', () => {
    expect(MAP_PRESS_LABEL).toBe('🗺 Map')
    expect(plainWordsFailures(MAP_PRESS_TITLE)).toEqual([])
  })
})
