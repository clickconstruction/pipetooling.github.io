/**
 * What an empty Stages group says (punch list #184, sweep C). Every board group (Waiting, Working,
 * Ready to Bill, Billed Awaiting Payment, Uncollectible, Paid in Full) draws these words when it
 * holds no row, on the desk tables and in the phone rows. The order they are checked:
 *
 * 1. The phone strip's Needs me or Today hid every row the group holds: *Nothing in Working needs
 *    you. All ▸ shows the other 3.*
 * 2. The board's search hid them: *No jobs in Working match ‘Ridgeway’. Clear the search ▸*
 * 3. A board filter hid them (Hide groups, a GC, development, Account Man or contract filter, or
 *    Working's schedule pill): *No jobs in Working match the filters.* The chips that set them sit
 *    above the board, each with its own ×, so there is no one press to name.
 * 4. Paid in Full holds nothing: a fact, *No jobs in Paid in Full yet.*
 * 5. Otherwise empty is the good state: *Nothing in Working needs you.* (the phone's words, now the
 *    desk's too).
 *
 * Without a context (the follow-up deck's one-row tables, never empty) the group reads *this group*.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'
import type { PhoneRowFilter } from './jobNextLine'

/** What the Stages tab tells a group's table about its empty state. */
export type StagesGroupEmptyContext = {
  /** The group's name, as its band reads it. */
  group: string
  /** The board's search text, '' when none. */
  search: string
  /** A board filter or Working's schedule pill is on. */
  filtered: boolean
  /** Paid in Full: a finished group, where empty is a fact rather than the good state. */
  done?: boolean
  onClearSearch?: () => void
}

/** The phone rows' side: the strip's filter, how many rows it hid, and its All. */
export type StagesGroupPhoneEmpty = {
  filter: PhoneRowFilter
  /** Rows the group holds before the filter. */
  hidden: number
  onShowAll?: () => void
}

export const STAGES_GROUP_FALLBACK = 'this group'

export function stagesGroupEmptyWords(ctx: StagesGroupEmptyContext | null | undefined, phone?: StagesGroupPhoneEmpty | null): EmptyStateWords {
  const group = ctx?.group.trim() || STAGES_GROUP_FALLBACK
  if (phone && phone.hidden > 0 && phone.filter !== 'all') {
    const main = phone.filter === 'today' ? `Nothing in ${group} is on today.` : `Nothing in ${group} needs you.`
    return phone.onShowAll ? { main, next: { label: 'All', onPress: phone.onShowAll }, tail: `shows the other ${phone.hidden}.` } : { main }
  }
  const query = ctx?.search.trim() ?? ''
  if (query) {
    const words = emptyWords({ kind: 'filter', noun: `jobs in ${group}`, query })
    return ctx?.onClearSearch ? emptyWordsWithPress(words, { onPress: ctx.onClearSearch }) : { main: words.main }
  }
  if (ctx?.filtered) return { main: emptyWords({ kind: 'filter', noun: `jobs in ${group}`, query: '' }).main }
  if (ctx?.done) return { main: `No jobs in ${group} yet.` }
  return { main: `Nothing in ${group} needs you.` }
}
