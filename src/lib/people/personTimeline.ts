/**
 * The person file's Timeline (v2.6392): one dated line of everything on record about a person. The kernel lives in
 * `supabase/functions/_shared/personTimeline.ts`, with no app import, so the People → HR tab and the dev MCP's
 * `get_person_file` draw one line from one implementation; this file is the app's door to it, as `hoursStatement.ts`
 * is to its kernel. The one piece that stays here is the empty state's words, which speak `EmptyStateWords`.
 */
import type { EmptyStateWords } from '../emptyWords'

export * from '../../../supabase/functions/_shared/personTimeline'

/** What the timeline says with nothing on it, by whether a filter hides the lines and whether the viewer may add one. */
export function personTimelineEmptyWords(input: { filtered: boolean; canAdd: boolean; clearFilter: () => void; openComposer: () => void }): EmptyStateWords {
  if (input.filtered) return { main: 'Nothing on the line under that filter.', next: { label: 'All ›', onPress: input.clearFilter }, tail: 'shows the whole record.' }
  if (!input.canAdd) return { main: 'Nothing on record yet.' }
  return { main: 'Nothing on record yet.', next: { label: 'Add an entry', onPress: input.openComposer }, tail: 'writes the first line, dated the day it happened.' }
}
