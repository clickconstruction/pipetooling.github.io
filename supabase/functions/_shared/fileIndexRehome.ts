/**
 * A row's home again (punch list #240, v2.6403): the job or bid a file belongs to, walked up from its folders as they
 * stand now, written on its `file_index` row with the folders between, and nothing read out of the file. For a row written
 * before its home could be reached: a walk that ran out of climb, or a folder linked to a job since. A pass skips a row
 * that is current, so without this a row keeps the home it was first given. Under `drive-link`'s `index_home`.
 */
import { fileMeta, type IndexContext } from './fileIndex.ts'
import { folderKindOf, homeColumns, walkUp } from './fileIndexKernel.ts'

/** What one call did: rows now on a job or bid, rows still on nothing, files Drive did not answer for, rows the write failed on. */
export interface RehomeAnswer {
  homed: number
  none: number
  unanswered: number
  failed: number
}

export async function rehomeFiles(ctx: IndexContext, ids: readonly string[]): Promise<RehomeAnswer> {
  const answer: RehomeAnswer = { homed: 0, none: 0, unanswered: 0, failed: 0 }
  for (const id of ids) {
    const f = await fileMeta(ctx.google, id)
    if (!f) {
      answer.unanswered += 1
      continue
    }
    const walk = await walkUp(f.parents?.[0] ?? null, ctx.homes, ctx.rootId, ctx.metaOf)
    const { error } = await ctx.admin
      .from('file_index')
      .update({ ...homeColumns(walk.home), folder_kind: folderKindOf(walk.home, walk.via, walk.names), path: walk.path.slice(0, 2000) })
      .eq('drive_file_id', id)
    if (error) {
      console.warn('file index rehome failed', id, error.message)
      answer.failed += 1
      continue
    }
    if (walk.home) answer.homed += 1
    else answer.none += 1
  }
  return answer
}
