/**
 * What holds a Pipeline search's matches back (the owner's yes, 2026-11-03). Hide groups and the GC,
 * development, Account Man, contract and job kind filters run before the search, so a match behind one
 * of them never reached the board, and the board said *No match anywhere* with the jobs sitting behind
 * the hide.
 *
 * `countStagesSearchHeldBack` counts the jobs the search finds among the rows the filters took off. It
 * goes through the board's own builder, so a row the board would never draw (a billing-only job with no
 * bill) is never promised. `stagesSearchHeldBackLines` words them. The press sets the filters aside for
 * this search only: the hides stay saved, and clearing the search puts the board back.
 *
 * A dev's ZZ test jobs are held back earlier, by the jobs cache, so they are counted from the lookup's
 * ids (`countStagesZzHeldBack`), and only for a dev whose switch hides them. No other role hears of them.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildJobsStagesBoardLists } from '../jobsStagesBoard'

/** How many jobs the search finds behind the filters: `jobsUnderFilters` is `allJobs` with the filters run. */
export function countStagesSearchHeldBack(
  allJobs: JobWithDetails[],
  jobsUnderFilters: JobWithDetails[],
  query: string,
  extraJobIds?: ReadonlySet<string> | null,
): number {
  if (query.trim() === '' || jobsUnderFilters.length === allJobs.length) return 0
  const onTheBoard = new Set(jobsUnderFilters.map((j) => j.id))
  const lists = buildJobsStagesBoardLists(
    allJobs.filter((j) => !onTheBoard.has(j.id)),
    query,
    extraJobIds,
  )
  const drawn = new Set<string>()
  for (const j of [...lists.waiting, ...lists.working, ...lists.paid]) drawn.add(j.id)
  for (const r of [...lists.readyToBillRows, ...lists.billedActiveRows, ...lists.collectionsRows, ...lists.uncollectibleRows]) {
    drawn.add(r.job.id)
  }
  return drawn.size
}

/** A dev's ZZ matches while their switch hides them: the lookup's ids that are ZZ jobs. Zero for anyone else. */
export function countStagesZzHeldBack(input: {
  lookupIds: ReadonlySet<string>
  zzJobIds: ReadonlySet<string> | undefined
  devHidesZz: boolean
}): number {
  if (!input.devHidesZz || !input.zzJobIds) return 0
  let n = 0
  for (const id of input.lookupIds) if (input.zzJobIds.has(id)) n += 1
  return n
}

export type StagesSearchHeldBackKind = 'filters' | 'showing' | 'zz'
export type StagesSearchHeldBackLine = { kind: StagesSearchHeldBackKind; main: string; press: string }

const matches = (n: number) => `${n} match${n === 1 ? '' : 'es'}`

export function stagesSearchHeldBackLines(input: {
  searchActive: boolean
  /** `countStagesSearchHeldBack`: the same number whether or not they are showing. */
  heldBackCount: number
  /** The press set the filters aside for this search. */
  showingHeldBack: boolean
  /** `countStagesZzHeldBack`. */
  zzHeldBackCount: number
}): StagesSearchHeldBackLine[] {
  if (!input.searchActive) return []
  const lines: StagesSearchHeldBackLine[] = []
  const n = input.heldBackCount
  if (n > 0) {
    lines.push(
      input.showingHeldBack
        ? { kind: 'showing', main: `Showing ${matches(n)} your filters hide.`, press: n === 1 ? 'Hide it' : 'Hide them' }
        : { kind: 'filters', main: `${matches(n)} ${n === 1 ? 'is' : 'are'} hidden by your filters.`, press: n === 1 ? 'Show it' : 'Show them' },
    )
  }
  const zz = input.zzHeldBackCount
  if (zz > 0) {
    lines.push({ kind: 'zz', main: zz === 1 ? '1 match is a ZZ test job.' : `${zz} matches are ZZ test jobs.`, press: 'Open Hide groups' })
  }
  return lines
}
