import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from './emptyWords'
import { plainWordsFailures } from './plainWords'
import { BOARD_RANGE_ORDER } from './checklistTeamBoard'
import {
  CHECKLIST_REVIEW_EMPTY,
  CHECKLIST_TIMELINE_EMPTY,
  CHECKLIST_UPCOMING_EMPTY,
  HISTORY_MONTHS_MAX,
  NEW_TASK_CONTROL,
  ROADMAP_PLAN_EMPTY,
  checklistHistoryEmptyWords,
  checklistManageEmptyWords,
  checklistOutstandingEmptyWords,
  checklistTodayEmptyWords,
  roadmapGroupsEmptyWords,
  roadmapLinksSearchEmptyWords,
  roadmapsEmptyWords,
} from './checklistEmptyWords'

const noop = () => {}
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
function press(w: EmptyStateWords | null) {
  if (!w?.next || !('onPress' in w.next)) throw new Error(`no handler press on: ${w?.main}`)
  w.next.onPress()
}

describe('checklistEmptyWords', () => {
  it('Today: a dev gets Upcoming, everyone else the sentence alone', () => {
    const show = vi.fn()
    const dev = checklistTodayEmptyWords(show)
    expect(read(dev)).toBe('Nothing due today. Upcoming shows what comes next.')
    press(dev)
    expect(show).toHaveBeenCalledTimes(1)
    expect(checklistTodayEmptyWords(null)).toEqual({ main: 'Nothing due today.' })
    expect(CHECKLIST_UPCOMING_EMPTY.main).toBe('Nothing scheduled ahead.')
  })

  it('History names the months picked and offers the widest range until it is already picked', () => {
    const year = vi.fn()
    const month = checklistHistoryEmptyWords(1, year)
    expect(read(month)).toBe(`No checklist history in the last month. Show ${HISTORY_MONTHS_MAX} months`)
    press(month)
    expect(year).toHaveBeenCalledTimes(1)
    expect(checklistHistoryEmptyWords(6, year).main).toBe('No checklist history in the last 6 months.')
    expect(checklistHistoryEmptyWords(HISTORY_MONTHS_MAX, year)).toEqual({ main: 'No checklist history in the last 12 months.' })
  })

  it('Outstanding says the good state for each range', () => {
    expect(read(checklistOutstandingEmptyWords('non_repeating'))).toBe('Nothing outstanding. Everyone is caught up.')
    expect(read(checklistOutstandingEmptyWords('missed'))).toBe('Nothing missed. Everyone is caught up.')
    expect(checklistOutstandingEmptyWords('next_day').main).toBe('Nothing due tomorrow.')
    expect(checklistOutstandingEmptyWords('next_week').main).toBe('Nothing due in the next week.')
  })

  it('Manage: ＋ New task for no task, the person picked, Clear the search for a search, null with rows', () => {
    const newTask = vi.fn()
    const clearSearch = vi.fn()
    const none = checklistManageEmptyWords({ total: 0, shown: 0, query: '', forPerson: false, newTask, clearSearch })
    expect(read(none!)).toBe(`No tasks yet. ${NEW_TASK_CONTROL} adds the first.`)
    press(none)
    expect(newTask).toHaveBeenCalledTimes(1)
    expect(checklistManageEmptyWords({ total: 0, shown: 0, query: '', forPerson: true, newTask, clearSearch })?.main).toBe('No tasks for this person yet.')
    const search = checklistManageEmptyWords({ total: 4, shown: 0, query: 'gate', forPerson: false, newTask, clearSearch })
    expect(read(search!)).toBe('No tasks match ‘gate’. Clear the search')
    press(search)
    expect(clearSearch).toHaveBeenCalledTimes(1)
    expect(checklistManageEmptyWords({ total: 4, shown: 2, query: 'gate', forPerson: false, newTask, clearSearch })).toBeNull()
  })

  it('the roadmap: Create first roadmap for an editor, the add row named for a group, Clear the search in Links', () => {
    const create = vi.fn()
    const roadmaps = roadmapsEmptyWords(create)
    press(roadmaps)
    expect(create).toHaveBeenCalledTimes(1)
    expect(roadmapsEmptyWords(null)).toEqual({ main: 'No roadmaps yet.' })
    expect(read(roadmapGroupsEmptyWords(true))).toBe('No groups yet. Add your first group above to build the roadmap.')
    expect(roadmapGroupsEmptyWords(false)).toEqual({ main: 'No roadmap groups yet.' })
    const clear = vi.fn()
    const links = roadmapLinksSearchEmptyWords('Rough', clear)
    expect(links.main).toBe('No links match ‘Rough’.')
    press(links)
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('every sentence reads in plain words', () => {
    const all: EmptyStateWords[] = [
      checklistTodayEmptyWords(noop),
      CHECKLIST_UPCOMING_EMPTY,
      checklistHistoryEmptyWords(3, noop),
      ...BOARD_RANGE_ORDER.map((r) => checklistOutstandingEmptyWords(r)),
      checklistManageEmptyWords({ total: 0, shown: 0, query: '', forPerson: true, newTask: noop, clearSearch: noop })!,
      checklistManageEmptyWords({ total: 3, shown: 0, query: 'gate', forPerson: false, newTask: noop, clearSearch: noop })!,
      CHECKLIST_TIMELINE_EMPTY,
      CHECKLIST_REVIEW_EMPTY,
      ROADMAP_PLAN_EMPTY,
      roadmapsEmptyWords(noop),
      roadmapGroupsEmptyWords(true),
      roadmapLinksSearchEmptyWords('Rough', noop),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
