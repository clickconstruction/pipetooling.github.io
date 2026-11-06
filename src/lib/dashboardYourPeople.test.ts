import { describe, expect, it } from 'vitest'
import { movedWords, reminderBody, yourPeopleHeadline, yourPeopleRows, type YourPeopleInstance } from './dashboardYourPeople'

const TODAY = '2026-11-06'
const dayOf = (iso: string) => iso.slice(0, 10)
const names = new Map([
  ['mateo', 'Mateo'],
  ['darren', 'Darren'],
  ['rosa', 'Rosa'],
  ['me', 'Taunya'],
])

const open: YourPeopleInstance[] = [
  { id: 'a', title: 'Put the plumbing tools in a neat home', scheduledDate: '2026-11-04', completedAt: null, percentComplete: 0, assigneeIds: ['mateo'], lines: 3, ticked: 2 },
  { id: 'b', title: 'Clear the back half of the floor', scheduledDate: '2026-08-24', completedAt: null, percentComplete: 50, assigneeIds: ['mateo'] },
  { id: 'c', title: 'Weld up the second set of shelves', scheduledDate: '2026-11-02', completedAt: null, percentComplete: 50, assigneeIds: ['darren'] },
  { id: 'd', title: 'One marker every mile', scheduledDate: '2026-10-05', completedAt: null, percentComplete: 0, assigneeIds: ['rosa'] },
  { id: 'e', title: 'Mine', scheduledDate: '2026-11-01', completedAt: null, percentComplete: 25, assigneeIds: ['me'] },
  { id: 'f', title: 'Done already', scheduledDate: '2026-11-01', completedAt: '2026-11-05T10:00:00Z', percentComplete: 100, assigneeIds: ['rosa'] },
]
const moves = [
  { instanceId: 'a', at: '2026-11-06T15:40:00Z' },
  { instanceId: 'b', at: '2026-11-03T20:12:00Z' },
  { instanceId: 'c', at: '2026-11-04T18:00:00Z' },
]

describe('yourPeopleRows', () => {
  it('one row per person, the viewer left out, the newest-moved card with its ring, moved-last first', () => {
    const rows = yourPeopleRows({ open, moves, nameById: names, todayYmd: TODAY, dayOf, excludeUserId: 'me' })
    expect(rows.map((r) => r.name)).toEqual(['Mateo', 'Darren', 'Rosa'])
    const mateo = rows[0]!
    expect(mateo).toMatchObject({ openCount: 2, state: 'moved_today', words: 'moved today', oldestAgeDays: 74 })
    expect(mateo.card).toMatchObject({ instanceId: 'a', title: 'Put the plumbing tools in a neat home' })
    expect(mateo.card?.ring.percent).toBe(67)
    expect(rows[1]).toMatchObject({ name: 'Darren', openCount: 1, state: 'moved_week', words: 'moved Wed' })
    expect(rows[1]!.card?.ring.percent).toBe(50)
  })

  it('a person with no move and a card past a month reads stuck; past a week but under a month reads quiet', () => {
    const rows = yourPeopleRows({ open, moves, nameById: names, todayYmd: TODAY, dayOf, excludeUserId: null })
    const rosa = rows.find((r) => r.name === 'Rosa')!
    expect(rosa).toMatchObject({ openCount: 1, state: 'stuck', words: 'stuck 32 days' })
    expect(rosa.card?.ring.untouched).toBe(true)
    const quiet = yourPeopleRows({
      open: [{ id: 'q', title: 'Quiet one', scheduledDate: '2026-10-28', completedAt: null, percentComplete: 0, assigneeIds: ['rosa'] }],
      moves: [],
      nameById: names,
      todayYmd: TODAY,
      dayOf,
      excludeUserId: null,
    })[0]!
    expect(quiet).toMatchObject({ state: 'quiet', words: 'nothing moved · oldest 9 days' })
  })

  it('a done card never counts as open', () => {
    const rows = yourPeopleRows({ open: open.filter((o) => o.id === 'f'), moves: [], nameById: names, todayYmd: TODAY, dayOf, excludeUserId: null })
    expect(rows).toEqual([])
  })
})

describe('the headline and the words', () => {
  it('counts done this week, moved and stuck', () => {
    const rows = yourPeopleRows({ open, moves, nameById: names, todayYmd: TODAY, dayOf, excludeUserId: 'me' })
    expect(yourPeopleHeadline(rows, 3)).toBe('3 cards done this week · 2 moved · 1 stuck')
    expect(yourPeopleHeadline([], 1)).toBe('1 card done this week · 0 moved')
  })
  it('says the weekday for a move this week and nothing moved for none', () => {
    expect(movedWords('moved_week', '2026-11-04T18:00:00Z', 3)).toBe('moved Wed')
    expect(movedWords('quiet', null, 0)).toBe('nothing moved')
  })
  it('the reminder reads as Review’s does', () => {
    expect(reminderBody(['a'])).toBe('You have 1 outstanding task: a')
    expect(reminderBody(['a', 'b', 'c', 'd'])).toBe('You have 4 outstanding tasks: a, b, c and 1 more')
  })
})
