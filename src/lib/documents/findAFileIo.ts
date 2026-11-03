/**
 * The io half of Find a file (v2.6305; the index first since punch list #240's PR 1, v2.6319; by meaning too since PR 4,
 * v2.6338): one call to `drive-link`'s `search_index` as the signed-in person, which answers the rows of our own index
 * by the words, or by the words and the meaning fused once the embeddings key is set (the query is embedded there), and
 * at the same time one call to `drive-link`'s `search`, Drive's own full-text index. The index's hits go to the box as
 * soon as they come (v2.6369), and Drive's follow behind them (ahead of them when the index found hits by meaning alone,
 * which must never hide a file Drive would find by its name) and are the floor when the index has nothing. The index
 * refusing (the migration not pushed yet, the function not deployed yet) costs the index, never the search: the box
 * falls back to Drive and says so. The function's own words come back as the error (`fnProblem`).
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { driveBehindIndex, driveBehindMeaning, FIND_WORDS, findAFileFromAnswer, findAFileFromIndexAnswer, needsDriveBehind, type FindAFileRead } from './findAFile'

export type FindAFileIo = {
  /** `onFirst` hears our index's hits the moment they come; the answer is the whole list once Drive has spoken. */
  search: (words: string, onFirst?: (read: FindAFileRead) => void) => Promise<FindAFileRead>
}

/** Our own index through the function, or null when it refused (logged, so a deploy is one `console` line away from proof). */
export async function searchIndex(words: string): Promise<FindAFileRead | null> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action: 'search_index', words } })) as FnResult
  const problem = await fnProblem(r, FIND_WORDS.failed)
  if (problem) {
    console.warn('search_index refused; falling back to Drive', problem)
    return null
  }
  return findAFileFromIndexAnswer(r.data)
}

/** Drive's own search through `drive-link`, the floor. */
export async function searchDrive(words: string): Promise<FindAFileRead> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action: 'search', words } })) as FnResult
  const problem = await fnProblem(r, FIND_WORDS.failed)
  if (problem) throw new Error(problem)
  return findAFileFromAnswer(r.data)
}

/**
 * Both asked at once: the index answers in a tenth of a second and Drive in seconds, so the box hears the index's hits as
 * soon as they come (`onFirst`) and the answer is them with Drive's behind. Drive refusing costs the floor alone while the
 * index answered.
 */
export async function searchJobFiles(words: string, onFirst?: (read: FindAFileRead) => void): Promise<FindAFileRead> {
  const asked = searchDrive(words).then(
    (read) => ({ ok: true as const, read }),
    (error: unknown) => ({ ok: false as const, error }),
  )
  const index = await searchIndex(words)
  if (index && index.hits.length > 0) onFirst?.(index)
  const drive = await asked
  if (index && index.hits.length > 0) {
    if (!drive.ok) return index
    // Hits by the words lead and Drive fills in behind; hits by meaning alone put Drive's own finds first, since a
    // loose match by meaning must never hide the file Drive found by its name.
    return needsDriveBehind(index) ? driveBehindMeaning(index, drive.read) : driveBehindIndex(index, drive.read)
  }
  if (drive.ok) return drive.read
  if (index) return index
  throw drive.error
}

export const supabaseFindAFileIo: FindAFileIo = { search: searchJobFiles }
