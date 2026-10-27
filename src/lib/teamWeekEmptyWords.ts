/**
 * What an empty Team week says (punch list #184, sweep C), on the board and the ledger alike. With
 * Only exceptions on, empty is the good state. Otherwise the week holds nothing, and Previous week
 * (the pager's ‹, the tab's own control) shows the one before.
 */
import type { EmptyStateWords } from './emptyWords'

export const TEAM_NO_EXCEPTIONS = 'No exceptions this week. Every plan matches its clock.'

export function teamWeekEmptyWords(input: { onlyExceptions: boolean; nothing: string }, onPreviousWeek?: () => void): EmptyStateWords {
  if (input.onlyExceptions) return { main: TEAM_NO_EXCEPTIONS }
  return onPreviousWeek ? { main: input.nothing, next: { label: 'Previous week', onPress: onPreviousWeek }, tail: 'shows the week before.' } : { main: input.nothing }
}
