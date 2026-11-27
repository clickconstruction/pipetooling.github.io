/**
 * The card of changed pages on a walked builder, and the open cell on its map (punch list #416, part 3, against
 * #404's mock-up). The card says how many pages differ from the published revision, shows what each mark on the
 * page means, and lists each changed page with its way back. The map outlines the cell whose page is open on the
 * right.
 *
 * Which pages differ, and the way back, are `paperEdit.ts`. This file is what the card says of them.
 *
 * Pure: no React, no supabase, no clock.
 */
import { val } from '../valuesInPlace'
import { PAPER_OFF, type PaperDef, type PaperStop } from './documentBuilder'
import { PAPER_NAMES_PAGE } from './paperEdit'
import { plural } from './sheet'

/** The page the flow shows: its step, and for a topic the stop it stands on. */
export type ShownPage = { step: string; stop?: PaperStop }

/**
 * The page the flow is on, by the name the map and the card use (`paperEdit.ts`): `notice`, `basis`, `site`, `review`,
 * or a topic at a level or at Off (`topic:photos:gov`, `topic:photos:off`). Null when nothing is shown yet, or for a
 * step the paper does not have.
 */
export function shownPageId(def: PaperDef, shown: ShownPage | null | undefined): string | null {
  if (!shown) return null
  if (def.topics.some((t) => t.key === shown.step)) return shown.stop == null ? null : `topic:${shown.step}:${shown.stop}`
  return shown.step === 'notice' || shown.step === 'basis' || shown.step === 'site' || shown.step === 'review' ? shown.step : null
}

/** The card's head, its count and its revision marked as values. Before the first publish there is nothing to differ from. */
export function changedCardHead(revision: number, changed: number): string {
  if (revision < 1) return 'Not published yet'
  if (changed === 0) return `Nothing changed since revision ${val('revision', String(revision))}`
  return `${val('count', plural(changed, 'page', 'pages'))} changed since revision ${val('revision', String(revision))}`
}

/** The line under the head while the list is empty: what to press next, or that nothing waits. Null while pages are listed. */
export function changedCardEmpty(revision: number, changed: number): string | null {
  if (revision < 1) return 'Every word here is a draft. Publish to make revision 1.'
  return changed === 0 ? `Nothing waiting on a publish. This is revision ${revision}.` : null
}

/** What each mark on the page means, in the order the card shows them. The marks are the fields' own (`BuilderField`). */
export const CHANGED_LEGEND: ReadonlyArray<{ mark: 'usual' | 'own'; words: string }> = [
  { mark: 'usual', words: 'As published' },
  { mark: 'own', words: 'Changed, not published' },
]

/** A changed page as the card lists it: the page's own words, then where on it, apart from the words. */
export type ChangedRow = {
  page: string
  /** The topic's name, or the page's own: *Photos and video*, *Before you start*. */
  label: string
  /** The level the page is at, for its colour and its name. Null for a page that is not a topic at a level. */
  level: { stop: PaperStop; name: string } | null
  /** What of a topic changed when it is not a level: *Its name*. Null otherwise. */
  part: string | null
  /** True for the page open on the right. */
  open: boolean
  /** False for a page no step of the flow shows: the paper's own names, which are typed on a card of this side. */
  opens: boolean
}

const PAGE_LABELS: Record<string, string> = { [PAPER_NAMES_PAGE]: "The paper's names", notice: 'Before you start', basis: 'The basis', site: 'Match the paper to the site', review: 'Review' }

/** The changed pages as rows, in the order `changedPages` gives them. `openPage` is `shownPageId`'s answer. */
export function changedRows(def: PaperDef, changed: ReadonlyArray<string>, openPage: string | null = null): ChangedRow[] {
  return changed.map((page) => {
    const [head, key, level] = page.split(':')
    if (head !== 'topic' || key == null) return { page, label: PAGE_LABELS[page] ?? page, level: null, part: null, open: page === openPage, opens: page !== PAPER_NAMES_PAGE }
    const label = def.topics.find((t) => t.key === key)?.label ?? key
    if (level == null) return { page, label, level: null, part: 'Its name', open: false, opens: true }
    const name = level === PAPER_OFF ? 'Off' : (def.levels.find((l) => l.id === level)?.name ?? level)
    return { page, label, level: { stop: level, name }, part: null, open: page === openPage, opens: true }
  })
}
