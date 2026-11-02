/**
 * The io half of Find a file (v2.6305): one call to `drive-link`'s `search` as the signed-in person. The function asks
 * Drive's full-text index over the jobs Shared Drive and walks each hit up to its job; its own words come back as the
 * error (`fnProblem`, as the job's other Drive calls read theirs).
 */
import { supabase } from '../supabase'
import { fnProblem, type FnResult } from '../gc/gcIo'
import { FIND_WORDS, findAFileFromAnswer, type FindAFileRead } from './findAFile'

export type FindAFileIo = {
  search: (words: string) => Promise<FindAFileRead>
}

export async function searchJobFiles(words: string): Promise<FindAFileRead> {
  const r = (await supabase.functions.invoke('drive-link', { body: { action: 'search', words } })) as FnResult
  const problem = await fnProblem(r, FIND_WORDS.failed)
  if (problem) throw new Error(problem)
  return findAFileFromAnswer(r.data)
}

export const supabaseFindAFileIo: FindAFileIo = { search: searchJobFiles }
