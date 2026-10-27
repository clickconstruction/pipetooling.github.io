/**
 * Empty words for the Checklist (punch list #184, sweep C): what Today, Upcoming, History,
 * Outstanding, Manage, Review and the roadmap say when a list has no rows, in `EmptyState`'s shape
 * (`main`, the press, `tail`). The rule is `emptyWords.ts`'s: a list says what fills it and offers
 * the press, a search with no match quotes the search and offers Clear the search, and a list
 * whose empty is the good state says so. Each helper takes the tab's own handler, so the words and
 * the press travel together. `checklistEmptyWords.test.ts` fires every press and holds every
 * sentence to plain words.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from './emptyWords'
import type { BoardRange } from './checklistTeamBoard'

type Press = () => void

/** Manage's make button, the press that adds a task. */
export const NEW_TASK_CONTROL = '＋ New task'

/** The widest History range the Months picker offers. */
export const HISTORY_MONTHS_MAX = 12

/** Today with nothing due. A dev's Upcoming fold shows what comes next; everyone else reads the sentence alone. */
export function checklistTodayEmptyWords(showUpcoming: Press | null): EmptyStateWords {
  const main = 'Nothing due today.'
  return showUpcoming ? { main, next: { label: 'Upcoming', onPress: showUpcoming }, tail: 'shows what comes next.' } : { main }
}

/** The dev's Upcoming fold with nothing dated ahead. */
export const CHECKLIST_UPCOMING_EMPTY: EmptyStateWords = { main: 'Nothing scheduled ahead.' }

/** History with nothing in the picked months: Show 12 months widens the range, until it is already a year. */
export function checklistHistoryEmptyWords(monthsBack: number, showYear: Press): EmptyStateWords {
  const span = monthsBack === 1 ? 'the last month' : `the last ${monthsBack} months`
  const main = `No checklist history in ${span}.`
  return monthsBack < HISTORY_MONTHS_MAX ? { main, next: { label: `Show ${HISTORY_MONTHS_MAX} months`, onPress: showYear } } : { main }
}

/** Outstanding with nothing in the picked range: the good state, said for that range. */
export function checklistOutstandingEmptyWords(range: BoardRange): EmptyStateWords {
  switch (range) {
    case 'non_repeating':
      return { main: 'Nothing outstanding.', tail: 'Everyone is caught up.' }
    case 'missed':
      return { main: 'Nothing missed.', tail: 'Everyone is caught up.' }
    case 'next_day':
      return { main: 'Nothing due tomorrow.' }
    case 'next_week':
      return { main: 'Nothing due in the next week.' }
  }
}

/**
 * Manage: no task at all (for everyone, or for the person the assignee filter picked), or a search
 * hiding every task. ＋ New task opens on the picked person. Null when the list has rows.
 */
export function checklistManageEmptyWords(s: { total: number; shown: number; query: string; forPerson: boolean; newTask: Press; clearSearch: Press }): EmptyStateWords | null {
  if (s.total === 0) {
    if (s.forPerson) return { main: 'No tasks for this person yet.', next: { label: NEW_TASK_CONTROL, onPress: s.newTask }, tail: 'adds the first.' }
    return emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'tasks', control: NEW_TASK_CONTROL }), { onPress: s.newTask })
  }
  if (s.shown === 0 && s.query.trim()) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'tasks', query: s.query }), { onPress: s.clearSearch })
  return null
}

/** Manage → Timeline with no dated task: the task's own Due by field fills it. */
export const CHECKLIST_TIMELINE_EMPTY: EmptyStateWords = { main: 'No tasks with a due date yet.', tail: 'Give a one-off a Due by date and it shows here.' }

/** Review with nothing waiting. */
export const CHECKLIST_REVIEW_EMPTY: EmptyStateWords = { main: 'Nothing waiting on review.' }

/** The roadmap's Plan view with no open stage. */
export const ROADMAP_PLAN_EMPTY: EmptyStateWords = { main: 'Nothing open right now.', tail: 'Add tasks or unlock a stage.' }

/** The roadmap tab before any roadmap: an editor gets Create first roadmap. */
export function roadmapsEmptyWords(createFirst: Press | null): EmptyStateWords {
  return createFirst ? { main: 'No roadmaps yet.', next: { label: 'Create first roadmap', onPress: createFirst } } : { main: 'No roadmaps yet.' }
}

/** A roadmap with no group: an editor is pointed at the add row above the canvas. */
export function roadmapGroupsEmptyWords(canEdit: boolean): EmptyStateWords {
  return canEdit ? { main: 'No groups yet.', tail: 'Add your first group above to build the roadmap.' } : { main: 'No roadmap groups yet.' }
}

/** The roadmap's Links window after a search. */
export function roadmapLinksSearchEmptyWords(query: string, clearSearch: Press): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'links', query }), { onPress: clearSearch })
}
