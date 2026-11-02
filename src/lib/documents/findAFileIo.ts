/**
 * The io half of Find a file (v2.6305; the index first since punch list #240's PR 1, v2.6319): one call to the
 * `search_file_index` RPC as the signed-in person, whose rows the box shows when there are any, else one call to
 * `drive-link`'s `search`, Drive's own full-text index as the floor. The RPC refusing (the migration not pushed yet, a
 * role the table's policy does not take) costs the index, never the search: the box falls back to Drive and says so.
 * The function's own words come back as the error (`fnProblem`, as the job's other Drive calls read theirs).
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { driveBehindIndex, FIND_MAX_HITS, FIND_WORDS, findAFileFromAnswer, findAFileFromIndexRows, type FindAFileRead } from './findAFile'

export type FindAFileIo = {
  search: (words: string) => Promise<FindAFileRead>
}

/** Our own index, or null when the RPC refused (logged, so a pushed migration is one `console` line away from proof). */
export async function searchIndex(words: string): Promise<FindAFileRead | null> {
  const { data, error } = await supabase.rpc('search_file_index' as never, { words, max_hits: FIND_MAX_HITS } as never)
  if (error) {
    console.warn('search_file_index refused; falling back to Drive', error.message)
    return null
  }
  return findAFileFromIndexRows(data as unknown)
}

/** Drive's own search through `drive-link`, the floor. */
export async function searchDrive(words: string): Promise<FindAFileRead> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action: 'search', words } })) as FnResult
  const problem = await fnProblem(r, FIND_WORDS.failed)
  if (problem) throw new Error(problem)
  return findAFileFromAnswer(r.data)
}

/** Both at once: the index's hits lead and Drive's fill in behind; Drive refusing costs the floor alone while the index answered. */
export async function searchJobFiles(words: string): Promise<FindAFileRead> {
  const [index, drive] = await Promise.all([
    searchIndex(words),
    searchDrive(words).then(
      (read) => ({ ok: true as const, read }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ])
  if (index && index.hits.length > 0) return drive.ok ? driveBehindIndex(index, drive.read) : index
  if (drive.ok) return drive.read
  if (index) return index
  throw drive.error
}

export const supabaseFindAFileIo: FindAFileIo = { search: searchJobFiles }
