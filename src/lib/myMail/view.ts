/**
 * Messages → My email (punch list #230 PR 1): what each of the tab's three views draws, and the tab's words. **To tag**
 * (the default) hides what is on a job already (a tagged conversation, or a line the boxes read and tied) and what
 * folds, so an untouched tab looks empty, not nagging. **Tagged** is what is on a job. **All** is every mail read, the
 * folded ones still behind their one line. A tagged mail never folds: the tag says a person wrote it. Pure; the words
 * follow plain words (`plainWords.ts`) and the empty lines are `emptyWords`' kinds.
 */
import { emptyWords, type EmptyWords } from '../emptyWords'
import type { MyMailRow, MyMailView } from './contract'

/** A view's list: the rows it draws, newest first, and the rows behind its one fold line. */
export interface MyMailViewRows {
  rows: MyMailRow[]
  folded: MyMailRow[]
}

/** On a job already: the conversation is tagged, or a line the boxes wrote holds this mail and is tied. */
const onAJob = (r: MyMailRow): boolean => r.tagged !== null || Boolean(r.inMessages?.jobKey)

/** Behind the fold: folded, and not tagged. */
const behindTheFold = (r: MyMailRow): boolean => r.folded !== null && r.tagged === null

/** Newest first; one instant, the higher Gmail id first, so a page always draws in one order. */
const newestFirst = (a: MyMailRow, b: MyMailRow): number => b.at.localeCompare(a.at) || b.gmailId.localeCompare(a.gmailId)

/** The rows a view draws and the ones behind its fold line. */
export function viewRows(rows: readonly MyMailRow[], view: MyMailView): MyMailViewRows {
  const sorted = [...rows].sort(newestFirst)
  switch (view) {
    case 'toTag':
      return { rows: sorted.filter((r) => !onAJob(r) && r.folded === null), folded: sorted.filter((r) => !onAJob(r) && r.folded !== null) }
    case 'tagged':
      return { rows: sorted.filter((r) => r.tagged !== null), folded: [] }
    case 'all':
      return { rows: sorted.filter((r) => !behindTheFold(r)), folded: sorted.filter(behindTheFold) }
  }
}

/** The rows a view draws, newest first: To tag hides the tagged, the folded and a line already on a job; Tagged shows the tagged; All shows the rest behind one fold line. */
export function rowsForView(rows: readonly MyMailRow[], view: MyMailView): MyMailRow[] {
  return viewRows(rows, view).rows
}

/** How many rows sit behind a view's fold line (To tag's when no view is named); Tagged has none. */
export function foldedCount(rows: readonly MyMailRow[], view: MyMailView = 'toTag'): number {
  return viewRows(rows, view).folded.length
}

/** The tab's words. */
export const MY_MAIL_WORDS = {
  /** The three views' pills. */
  views: { toTag: 'To tag', tagged: 'Tagged', all: 'All' } as Readonly<Record<MyMailView, string>>,
  /** The line over the list: what is read, what is kept, what a tag does. */
  card: (address: string): string =>
    `Your mail, read live from ${address.trim()}. Nothing is kept until you tag it. A tag puts that conversation on the job for the office to read.`,
  /** The one line the folded mail sits behind. */
  fold: (n: number): string =>
    n === 1 ? '1 notice or newsletter, left out as the bids@ reader leaves it out' : `${n} notices and newsletters, left out as the bids@ reader leaves them out`,
  /**
   * What an empty view says, in `EmptyState`'s parts: a search that finds nothing offers to clear it; To tag empty is the
   * good state; Tagged empty points at To tag; All empty points at the card on Settings → Your account, which says what
   * the tab reads.
   */
  empty: (view: MyMailView, query = ''): EmptyWords => {
    if (query.trim()) return emptyWords({ kind: 'filter', noun: 'emails', query })
    switch (view) {
      case 'toTag':
        return { main: 'Nothing waiting to tag.', next: '', tail: '' }
      case 'tagged':
        return emptyWords({ kind: 'data', noun: 'tagged conversations', page: { label: 'To tag', tail: 'lists the mail you can tag.' } })
      case 'all':
        return emptyWords({ kind: 'data', noun: 'emails in your Inbox or Sent', page: { label: 'Your account', tail: 'shows what this tab reads.' } })
    }
  },
} as const
