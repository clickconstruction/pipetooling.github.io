import { fillableBookMatches, matchBookEntries, type BookMatch } from './takeoffBookMatch'
import { summarizeTakeoffCoverage, type CoverageLine } from './takeoffCoverage'

/**
 * Fill from book under Combined (docs/TAKEOFFS_REFRESH_PLAN.md PR 5,
 * decision 2): the takeoff book's matched assemblies expand into priced
 * part lines on every fixture that has none yet. Pure planning + copy; the
 * writes happen in `useTakeoffRoughLines.fillRowsFromAssemblies`.
 */

export type BookEntryWithItemsLike = {
  id: string
  fixture_name: string
  alias_names?: string[] | null
  sequence_order?: number
  items: ReadonlyArray<{ entry_id: string; template_id: string; stage?: string | null; sequence_order?: number }>
}

export type BookFillPlan = {
  /** Matched fixtures with no lines yet, in row order — what Fill will touch. */
  fillable: BookMatch[]
  /** Every fixture the book matches, costed or not. */
  matched: number
  /** Matched fixtures skipped because they already have lines. */
  alreadyCosted: number
}

export function planBookFill(
  countRows: ReadonlyArray<{ id: string; fixture: string | null | undefined; count: number | string | null | undefined }>,
  lines: ReadonlyArray<CoverageLine>,
  entries: ReadonlyArray<BookEntryWithItemsLike>,
): BookFillPlan {
  const matches = matchBookEntries(countRows, entries, entries.flatMap((e) => e.items))
  const { uncostedIds } = summarizeTakeoffCoverage(countRows, lines)
  const fillable = fillableBookMatches(countRows, matches, uncostedIds)
  return { fillable, matched: matches.size, alreadyCosted: matches.size - fillable.length }
}

export type BookFillResult = {
  fixturesFilled: number
  linesAdded: number
  partsWithoutPrice: number
  emptyAssemblies: number
}

/** The one-line outcome shown beside the button after a fill. */
export function bookFillMessage(r: BookFillResult): string {
  if (r.fixturesFilled === 0) {
    return r.emptyAssemblies > 0 ? 'Nothing added — the matched assemblies have no parts.' : 'Nothing to fill.'
  }
  const parts: string[] = [
    `Filled ${r.fixturesFilled} fixture${r.fixturesFilled === 1 ? '' : 's'} from the book (${r.linesAdded} line${r.linesAdded === 1 ? '' : 's'})`,
  ]
  if (r.partsWithoutPrice > 0) parts.push(`${r.partsWithoutPrice} without a catalog price`)
  if (r.emptyAssemblies > 0) parts.push(`${r.emptyAssemblies} empty assembl${r.emptyAssemblies === 1 ? 'y' : 'ies'} skipped`)
  return parts.join(' · ') + '.'
}

/** Label, enabled state, and hover title for the book button in each materials model. */
export function fillFromBookLabel(
  plan: BookFillPlan | null,
  applying: boolean,
  rough: boolean,
): { label: string; disabled: boolean; title: string } {
  if (!rough) {
    return { label: applying ? 'Applying…' : 'Apply Matching Fixture Assemblies', disabled: applying, title: '' }
  }
  const n = plan?.fillable.length ?? 0
  if (applying) return { label: 'Filling…', disabled: true, title: '' }
  if (n > 0) {
    return {
      label: `Fill from book · ${n} match${n === 1 ? '' : 'es'}`,
      disabled: false,
      title: `Expand the book's assemblies into priced part lines on ${n} fixture${n === 1 ? '' : 's'} that ${n === 1 ? 'has' : 'have'} none yet`,
    }
  }
  return {
    label: 'Fill from book · 0 matches',
    disabled: true,
    title:
      plan && plan.matched > 0
        ? 'Every fixture this book matches already has lines'
        : 'No entry in this book matches these fixtures yet — add entries in the Takeoff book section below',
  }
}
