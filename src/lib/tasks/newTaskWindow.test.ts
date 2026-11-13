import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  dropSoloSelfWhenAddingOthers,
  faceMark,
  newTaskSentence,
  recentAssigneeIds,
  reminderPressWords,
  taskAddRow,
  taskDayWords,
  taskFaces,
  taskPersonName,
  taskSendLabel,
  toggleFace,
  whenBarChoice,
  whenBarDayLabel,
  whenBarPick,
  type NewTaskSentenceInput,
  type TaskAddRowInput,
} from './newTaskWindow'

// Made-up people. Rosa gives the tasks.
const ROSTER = [
  { id: 'rosa', name: 'Rosa', email: 'rosa@example.com' },
  { id: 'theo', name: 'Theo', email: 'theo@example.com' },
  { id: 'imani', name: 'Imani', email: 'imani@example.com' },
  { id: 'wes', name: 'Wes', email: 'wes@example.com' },
  { id: 'nell', name: 'Nell', email: 'nell@example.com' },
  { id: 'cal', name: '', email: 'cal@example.com' },
]
const nameOf = (id: string) => taskPersonName(ROSTER.find((p) => p.id === id))
const TODAY = '2026-11-12' // a Thursday

describe('recentAssigneeIds', () => {
  const rows = [
    { checklist_item_id: 't3', user_id: 'theo' },
    { checklist_item_id: 't3', user_id: 'rosa' },
    { checklist_item_id: 't2', user_id: 'wes' },
    { checklist_item_id: 't2', user_id: 'imani' },
    { checklist_item_id: 't1', user_id: 'theo' },
    { checklist_item_id: 't1', user_id: 'nell' },
  ]

  it('lists the people given to last, newest task first, each once, without the giver', () => {
    expect(recentAssigneeIds(['t3', 't2', 't1'], rows, 'rosa')).toEqual(['theo', 'imani', 'wes', 'nell'])
  })

  it('does not turn on the order the rows came back in', () => {
    expect(recentAssigneeIds(['t3', 't2', 't1'], [...rows].reverse(), 'rosa')).toEqual(['theo', 'imani', 'wes', 'nell'])
  })

  it('stops at the limit and skips a task with nobody on it', () => {
    expect(recentAssigneeIds(['t9', 't3', 't2', 't1'], rows, 'rosa', 2)).toEqual(['theo', 'imani'])
    expect(recentAssigneeIds([], rows, 'rosa')).toEqual([])
  })
})

describe('taskFaces', () => {
  it('puts Me first, then the people given to last', () => {
    const faces = taskFaces({ meId: 'rosa', roster: ROSTER, recentIds: ['theo', 'imani'], extraIds: [] })
    expect(faces.map((f) => f.name)).toEqual(['Me', 'Theo', 'Imani'])
    expect(faces[0]).toEqual({ id: 'rosa', name: 'Me', mark: 'R', me: true })
  })

  it('seats a person picked from the full list right after Me, so the pick is never off the end', () => {
    const faces = taskFaces({ meId: 'rosa', roster: ROSTER, recentIds: ['theo', 'imani', 'wes'], extraIds: ['nell'] })
    expect(faces.map((f) => f.id)).toEqual(['rosa', 'nell', 'theo', 'imani', 'wes'])
  })

  it('draws each person once and nobody who is off the roster', () => {
    const faces = taskFaces({ meId: 'rosa', roster: ROSTER, recentIds: ['theo', 'gone', 'theo'], extraIds: ['theo', 'rosa'] })
    expect(faces.map((f) => f.id)).toEqual(['rosa', 'theo'])
  })

  it('falls back to the email for a person with no name, and marks the face with its first letter', () => {
    const faces = taskFaces({ meId: null, roster: ROSTER, recentIds: ['cal'], extraIds: [] })
    expect(faces).toEqual([{ id: 'cal', name: 'cal@example.com', mark: 'C', me: false }])
    expect(faceMark('  ')).toBe('?')
    expect(faceMark('3rd crew')).toBe('3')
  })
})

describe('the solo-self rule', () => {
  it('drops the giver when the task was only theirs and someone else is added', () => {
    expect(toggleFace(['rosa'], 'theo', 'rosa')).toEqual(['theo'])
    expect(dropSoloSelfWhenAddingOthers(['rosa'], ['rosa', 'theo', 'wes'], 'rosa')).toEqual(['theo', 'wes'])
  })

  it('keeps the giver once the giver is added back, and takes a lit face off', () => {
    expect(toggleFace(['theo'], 'rosa', 'rosa')).toEqual(['theo', 'rosa'])
    expect(toggleFace(['theo', 'rosa'], 'imani', 'rosa')).toEqual(['theo', 'rosa', 'imani'])
    expect(toggleFace(['theo', 'rosa'], 'theo', 'rosa')).toEqual(['rosa'])
  })
})

describe('the day bar', () => {
  it('lights Today, Repeats, and Tomorrow only when Tomorrow was pressed', () => {
    expect(whenBarChoice({ when: 'today', startDate: TODAY }, TODAY, false)).toBe('today')
    expect(whenBarChoice({ when: 'repeat', startDate: TODAY }, TODAY, true)).toBe('repeat')
    expect(whenBarChoice({ when: 'date', startDate: '2026-11-13' }, TODAY, true)).toBe('tomorrow')
    expect(whenBarChoice({ when: 'date', startDate: '2026-11-13' }, TODAY, false)).toBe('day')
    expect(whenBarChoice({ when: 'date', startDate: '2026-11-16' }, TODAY, true)).toBe('day')
  })

  it('stores what each press means', () => {
    const stored = { when: 'today' as const, startDate: TODAY }
    expect(whenBarPick('tomorrow', stored, TODAY)).toEqual({ when: 'date', startDate: '2026-11-13' })
    expect(whenBarPick('day', stored, TODAY)).toEqual({ when: 'date', startDate: TODAY })
    expect(whenBarPick('repeat', { when: 'date', startDate: '2026-11-16' }, TODAY)).toEqual({ when: 'repeat', startDate: '2026-11-16' })
    expect(whenBarPick('today', { when: 'date', startDate: '2026-11-16' }, TODAY)).toEqual({ when: 'today', startDate: TODAY })
  })

  it('never keeps a day that has passed', () => {
    expect(whenBarPick('day', { when: 'date', startDate: '2026-11-01' }, TODAY)).toEqual({ when: 'date', startDate: TODAY })
    expect(whenBarPick('repeat', { when: 'today', startDate: '' }, TODAY)).toEqual({ when: 'repeat', startDate: TODAY })
  })

  it('names the third segment by its day once it is lit', () => {
    expect(whenBarDayLabel('today', '2026-11-16')).toBe('Pick a day')
    expect(whenBarDayLabel('day', '2026-11-16')).toBe('Mon 16')
    expect(whenBarDayLabel('day', '')).toBe('Pick a day')
    expect(taskDayWords('2026-11-20')).toBe('Fri, Nov 20')
    expect(taskDayWords('soon')).toBe('soon')
  })
})

describe('taskAddRow', () => {
  const plain: TaskAddRowInput = { when: 'today', reminderTime: '', tellOtherName: null, linkCount: 0, dueDate: '', lineCount: 0, asksForPhoto: false, staysUntilDone: true }
  const labels = (input: TaskAddRowInput) => taskAddRow(input).map((p) => p.label)

  it('names every rare thing on a plain task, none lit', () => {
    expect(labels(plain)).toEqual(['+ Remind', '+ Tell someone else', '+ Link', '+ Due by', '+ Done when…', '+ Photo at the finish', '+ Just for the day'])
    expect(taskAddRow(plain).every((p) => !p.on)).toBe(true)
  })

  it('shows the value of each thing that is set', () => {
    expect(
      labels({ when: 'date', reminderTime: '07:00', tellOtherName: 'Imani', linkCount: 2, dueDate: '2026-11-20', lineCount: 1, asksForPhoto: true, staysUntilDone: true }),
    ).toEqual(['✓ Remind · Morning 7:00', '✓ Also tells Imani', '✓ 2 links', '✓ Due by Fri, Nov 20', '✓ Done when… · 1 line', '✓ Photo at the finish'])
    expect(reminderPressWords('09:30')).toBe('9:30 AM')
  })

  it('leaves the one-time things off a repeating task', () => {
    expect(labels({ ...plain, when: 'repeat' })).toEqual(['+ Remind', '+ Tell someone else', '+ Link', '+ Done when…', '+ Photo at the finish'])
  })

  it('lights Just for the day when the task does not stay, and only two presses flip in place', () => {
    const row = taskAddRow({ ...plain, staysUntilDone: false })
    expect(row.find((p) => p.key === 'oneDay')).toEqual({ key: 'oneDay', label: '✓ Just for the day', on: true, toggle: true })
    expect(row.filter((p) => p.toggle).map((p) => p.key)).toEqual(['photo', 'oneDay'])
  })
})

describe('taskSendLabel', () => {
  const who = (assigneeIds: string[]) => ({ meId: 'rosa', assigneeIds, nameOf })

  it('names the act and who it reaches', () => {
    expect(taskSendLabel(who(['rosa']))).toBe('Add to my list')
    expect(taskSendLabel(who(['theo']))).toBe('Send to Theo')
    expect(taskSendLabel(who(['theo', 'imani']))).toBe('Send to Theo and Imani')
    expect(taskSendLabel(who(['theo', 'rosa']))).toBe('Send to Theo and me')
    expect(taskSendLabel(who(['theo', 'imani', 'wes', 'nell']))).toBe('Send to 4 people')
    expect(taskSendLabel(who([]))).toBe('Send')
  })
})

describe('newTaskSentence', () => {
  const base: NewTaskSentenceInput = {
    meId: 'rosa',
    assigneeIds: ['theo'],
    nameOf,
    title: 'Grease the pump bearings',
    when: 'today',
    repeatMode: 'weekly',
    startDate: TODAY,
    todayStr: TODAY,
    daysOfWeek: [],
    daysAfter: 1,
    endDate: null,
    staysUntilDone: true,
    dueDate: null,
    lineCount: 0,
    asksForPhoto: false,
    tellMe: true,
    tellOtherName: null,
  }
  const say = (over: Partial<NewTaskSentenceInput>) => newTaskSentence({ ...base, ...over })

  it('names the one thing missing and holds Send', () => {
    expect(say({ title: '  ' })).toEqual({ text: 'Type the task first.', dead: true })
    expect(say({ assigneeIds: [] })).toEqual({ text: 'Pick who it is for.', dead: true })
    expect(say({ when: 'date', startDate: '' })).toEqual({ text: 'Pick a day.', dead: true })
    expect(say({ when: 'repeat', daysOfWeek: [] })).toEqual({ text: 'Pick at least one weekday.', dead: true })
    expect(say({ when: 'date', startDate: '2026-11-20', dueDate: '2026-11-16' })).toEqual({ text: 'The due day is before the task starts.', dead: true })
  })

  it('says the common task in three short sentences', () => {
    expect(say({})).toEqual({ text: 'Theo gets it today. It stays until it is done. You hear when it is done.', dead: false })
  })

  it('says whose list, and leaves out the hearing on a task that is only the giver\'s', () => {
    expect(say({ assigneeIds: ['rosa'] }).text).toBe('It goes on your list today. It stays until it is done.')
    expect(say({ assigneeIds: ['theo', 'rosa'] }).text).toBe('You and Theo each get it today. It stays until it is done. You hear when it is done.')
    expect(say({ assigneeIds: ['theo', 'imani', 'wes'] }).text).toMatch(/^Theo, Imani and Wes each get it today\./)
    expect(say({ assigneeIds: ['theo', 'imani', 'wes', 'nell'] }).text).toMatch(/^4 people each get it today\./)
  })

  it('names the day, the due day and a task that leaves', () => {
    expect(say({ when: 'date', startDate: '2026-11-13' }).text).toMatch(/^Theo gets it tomorrow\./)
    expect(say({ when: 'date', startDate: '2026-11-16' }).text).toMatch(/^Theo gets it on Mon, Nov 16\./)
    expect(say({ staysUntilDone: false }).text).toBe('Theo gets it today. It leaves the list when that day ends. You hear when it is done.')
    expect(say({ dueDate: '2026-11-20', staysUntilDone: false }).text).toBe(
      'Theo gets it today. It is late after Fri, Nov 20. It stays until it is done. You hear when it is done.',
    )
    expect(say({ dueDate: TODAY, staysUntilDone: false }).text).toBe('Theo gets it today. It stays until it is done. You hear when it is done.')
  })

  it('says a weekly task, its end, and a start that is not on a chosen day', () => {
    expect(say({ when: 'repeat', daysOfWeek: [4, 1] }).text).toBe(
      'Theo gets it every Mon and Thu. It starts today. A missed day does not carry over. You hear when it is done.',
    )
    expect(say({ when: 'repeat', daysOfWeek: [1], startDate: '2026-11-13', endDate: '2026-12-04' }).text).toBe(
      'Theo gets it every Mon. It starts Fri, Nov 13 and ends Fri, Dec 4. The first one lands on the next chosen day. A missed day does not carry over. You hear when it is done.',
    )
    expect(say({ when: 'repeat', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }).text).toMatch(/^Theo gets it every day\./)
  })

  it('says a task that comes back after it is done', () => {
    expect(say({ when: 'repeat', repeatMode: 'after_done', daysAfter: 3 }).text).toBe(
      'Theo gets it today. It comes back 3 days after each time it is done. You hear when it is done.',
    )
    expect(say({ when: 'repeat', repeatMode: 'after_done', daysAfter: 0, startDate: '2026-11-16', tellMe: false }).text).toBe(
      'Theo gets it starting Mon, Nov 16. It comes back 1 day after each time it is done.',
    )
  })

  it('says what the card carries and who hears', () => {
    expect(say({ lineCount: 2, asksForPhoto: true, tellMe: false }).text).toBe(
      'Theo gets it today. It stays until it is done. It has 2 Done when… lines and asks for a photo at the finish.',
    )
    expect(say({ lineCount: 1, tellMe: false }).text).toMatch(/It has 1 Done when… line\.$/)
    expect(say({ asksForPhoto: true, tellMe: false }).text).toMatch(/It asks for a photo at the finish\.$/)
    expect(say({ tellOtherName: 'Imani' }).text).toMatch(/You and Imani hear when it is done\.$/)
    expect(say({ tellOtherName: 'Imani', tellMe: false }).text).toMatch(/Imani hears when it is done\.$/)
    expect(say({ assigneeIds: ['rosa'], tellOtherName: 'Imani' }).text).toMatch(/Imani hears when it is done\.$/)
  })

  it('names the giver on an edit by someone else', () => {
    expect(say({ giverName: 'Rosa' }).text).toMatch(/Rosa hears when it is done\.$/)
    expect(say({ giverName: 'Rosa', tellOtherName: 'Imani' }).text).toMatch(/Rosa and Imani hear when it is done\.$/)
    expect(say({ giverName: 'Rosa', tellMe: false }).text).toBe('Theo gets it today. It stays until it is done.')
  })

  it('keeps every shape of the sentence to plain words', () => {
    const shapes: Array<Partial<NewTaskSentenceInput>> = [
      {},
      { title: '' },
      { assigneeIds: [] },
      { assigneeIds: ['rosa'] },
      { assigneeIds: ['theo', 'imani', 'wes'], when: 'date', startDate: '2026-11-16', dueDate: '2026-11-20', lineCount: 3, asksForPhoto: true, tellOtherName: 'Nell' },
      { assigneeIds: ['theo', 'imani', 'wes', 'nell'], when: 'repeat', daysOfWeek: [1, 2, 3, 4, 5, 6], startDate: '2026-11-15', endDate: '2026-12-24', lineCount: 12, asksForPhoto: true, tellOtherName: 'Nell' },
      { when: 'repeat', repeatMode: 'after_done', daysAfter: 14, startDate: '2026-11-30', lineCount: 1, tellOtherName: 'Imani' },
      { when: 'repeat', daysOfWeek: [] },
      { staysUntilDone: false },
    ]
    for (const shape of shapes) expect(plainWordsFailures(say(shape).text)).toEqual([])
  })
})
