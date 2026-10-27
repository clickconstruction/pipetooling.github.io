/**
 * Empty words for the Calendar (punch list #184, sweep C): My Day with nothing planned, and
 * Upcoming with nothing ahead, in `EmptyState`'s shape (`main`, the press, `tail`). A role that
 * opens the Schedule hub gets it as the press, since planning blocks happens there; anyone else
 * reads the sentence alone. `calendarEmptyWords.test.ts` holds every sentence to plain words.
 */
import type { EmptyStateWords } from './emptyWords'

/** The Schedule hub, where blocks are planned. */
export const SCHEDULE_HUB_PATH = '/schedule-dispatch'

/** My Day with no planned block on the picked day. */
export function calendarMyDayEmptyWords(canOpenScheduleHub: boolean): EmptyStateWords {
  const main = 'Nothing planned for this day.'
  return canOpenScheduleHub ? { main, next: { label: 'Schedule hub', to: SCHEDULE_HUB_PATH }, tail: 'plans the next block.' } : { main }
}

/** Upcoming with nothing dated ahead: the kinds of rows that fill it. */
export const CALENDAR_UPCOMING_EMPTY: EmptyStateWords = { main: 'Nothing coming up.', tail: 'Your stage dates, bid due dates and callbacks land here.' }
