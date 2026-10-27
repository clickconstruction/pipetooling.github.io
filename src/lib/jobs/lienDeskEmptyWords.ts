/**
 * The Lien desk's other empty lists (punch list #184, sweep C): the words the rest of the desk draws
 * with `EmptyState`, in the voice of the notice piles (`lienEmptyPileWords` in `lienDesk.ts`). Each
 * one takes the press it offers, so the component hands over its own setter and the words live here:
 * the affidavit and retainage piles (Show every pile) and their find (Clear the find), the affidavit
 * list (Deadlines), the Deadlines board and its search (Clear the search), the Timeline book (Show
 * All), the run, and Records for an owner. Where empty is the good state the words say so and offer
 * nothing.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'
import { lienFindNothingWords } from './lienDeskFind'
import type { LienBookShow } from './lienTimelineBook'

/** The press every empty pile offers, the notice list's too: it lifts the pile and shows the whole list. */
export const LIEN_SHOW_EVERY_PILE = 'Show every pile ›'

/** The find box's own clear, by its name (`LienDeskFindBox`). */
export const LIEN_CLEAR_THE_FIND = 'Clear the find'

/** An affidavit or retainage pile with nothing in it. */
export function lienPileEmptyWords(showEveryPile: () => void): EmptyStateWords {
  return { main: 'Nothing in this pile.', next: { label: LIEN_SHOW_EVERY_PILE, onPress: showEveryPile } }
}

/** The affidavit or retainage list when the find box hides every row: the desk's find words and the box's clear. */
export function lienListFindEmptyWords(find: string, clearFind: () => void): EmptyStateWords {
  return { main: lienFindNothingWords(find).head, next: { label: LIEN_CLEAR_THE_FIND, onPress: clearFind } }
}

/** The affidavit list when no window closes inside the desk's 30 days: the later ones are on Deadlines. */
export function lienAffidavitsEmptyWords(openDeadlines: () => void): EmptyStateWords {
  return { main: 'No affidavit window closes within 30 days.', next: { label: 'Deadlines ›', onPress: openDeadlines }, tail: 'shows what falls due later.' }
}

/** The Deadlines board with nothing on it: the good state. */
export const LIEN_CALENDAR_EMPTY: EmptyStateWords = { main: 'Nothing billed is on a lien clock.' }

/** The Deadlines board, or one of its buckets, when the search hides every billed job. */
export function lienCalendarSearchEmptyWords(query: string, clearQuery: () => void): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'billed jobs', query }), { onPress: clearQuery })
}

/** The Timeline book: *Something due* with nothing due offers All; All with nothing in it is the good state. */
export function lienBookEmptyWords(show: LienBookShow, showAll: () => void): EmptyStateWords {
  return show === 'due'
    ? { main: 'Nothing is due inside 30 days on these jobs.', next: { label: 'Show All ›', onPress: showAll }, tail: 'lists the whole book.' }
    : { main: 'No job has money open and a lien month.' }
}

/** The run with no approved notice left in it, say after another person ran it. */
export const LIEN_RUN_EMPTY: EmptyStateWords = { main: 'Nothing approved is waiting.' }

/** Records for an owner before any notice went out: its owners come from the desk's notices, so the press is the desk. */
export function lienOwnerRecordsEmptyWords(backToDesk: () => void): EmptyStateWords {
  return { main: 'No job on the desk has a notice yet, so there is no owner to pick.', next: { label: 'Back to the desk ›', onPress: backToDesk } }
}

/** Records for an owner when the find box matches no owner. */
export function lienOwnerRecordsSearchEmptyWords(query: string, clearQuery: () => void): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'owners', query }), { onPress: clearQuery })
}
