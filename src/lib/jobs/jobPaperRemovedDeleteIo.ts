/**
 * Deleting a taken-off paper of a test job (punch list #443, row 10): the read and the delete. The rule is
 * `jobPaperRemovedDelete.ts`.
 *
 * Both are functions of the database, `list_test_job_removed_papers` and `delete_test_job_required_paper`, and each
 * holds every rule itself: a developer, a ZZ test job, and for the delete a taken-off paper that nothing points at.
 * `job_required_papers` takes no write from a signed-in person, so a paper goes through the function or not at all.
 * A refusal is passed on in the function's own words, as a `JobPaperDeleteRefused`. Neither function is in the
 * generated types until the types PR after the push, so each is called by name, as the other take-backs call theirs.
 *
 * One interface, so the fold's smoke hands it a fake. One implementation on the app's client.
 */
import { supabase } from '../supabase'
import { DatabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import { parseRemovedPapers, type RemovedPaper } from './jobPaperRemovedDelete'

/**
 * A delete the function turned down on purpose (`P0001`, raised in plain words). Its message is the reason and
 * nothing else, so the screen says it as it stands and not as *Failed to delete…*, as the portal link's delete does
 * (punch list #443, finding 254). Anything else that goes wrong is an ordinary error.
 */
export class JobPaperDeleteRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'JobPaperDeleteRefused'
  }
}

export interface JobPaperRemovedDeleteIo {
  /** A test job's taken-off papers, newest taken off first, each with what points at it. Throws when the read fails. */
  readRemoved(jobId: string): Promise<RemovedPaper[]>
  /** Delete one taken-off paper. Sent once. A refusal of the function's is thrown as a `JobPaperDeleteRefused`. */
  deletePaper(paperId: string): Promise<void>
}

export const supabaseJobPaperRemovedDeleteIo: JobPaperRemovedDeleteIo = {
  async readRemoved(jobId) {
    const answer = await withSupabaseRetry(() => supabase.rpc('list_test_job_removed_papers' as never, { p_job_id: jobId } as never), 'read the taken-off papers')
    return parseRemovedPapers(answer)
  },
  async deletePaper(paperId) {
    let answer: unknown
    try {
      answer = await withSupabaseRetry(
        () => supabase.rpc('delete_test_job_required_paper' as never, { p_paper_id: paperId } as never),
        'delete the paper',
        { maxRetries: 0 },
      )
    } catch (e) {
      if (e instanceof DatabaseError && e.code === 'P0001' && e.serverMessage) throw new JobPaperDeleteRefused(e.serverMessage)
      throw e
    }
    const a = answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, unknown>) : null
    if (!a || a.ok !== true) throw new Error('The paper was not deleted. The database gave no answer.')
  },
}
