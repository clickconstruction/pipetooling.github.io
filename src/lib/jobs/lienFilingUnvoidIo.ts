/**
 * Putting a voided lien record back (punch list #443, row 2): the call. The rule is `lienFilingUnvoid.ts`.
 *
 * `unvoid_test_lien_filing` runs as the signed-in person and holds every rule itself: a developer, a voided record
 * on a ZZ test job, and each desk paper the void moved still standing as the void left it. It clears the record's
 * `voided_at` and puts those papers back in one transaction. Its refusal is passed on in its own words, as a
 * `LienUnvoidRefused`. The function is not in the generated types until the types PR after the push, so it is
 * called by name, as the other take-backs call theirs.
 */
import { supabase } from '../supabase'
import { DatabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import { LIEN_UNVOID_WORDS, lienUnvoidAnswer, lienUnvoidProblem, type LienUnvoidAnswer, type LienUnvoidRecord } from './lienFilingUnvoid'

/**
 * A put back the rule turned down on purpose: the client's own rule, or the function's (`P0001`, raised in plain
 * words). Its message is the reason and nothing else, so the screen says it as it stands and not as *Failed to …*.
 * Anything else that goes wrong is an ordinary error.
 */
export class LienUnvoidRefused extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'LienUnvoidRefused'
  }
}

/** Put one voided record back. The rule runs first, then the one call, sent once. Answers what became of its papers. */
export async function unvoidLienFiling(record: Pick<LienUnvoidRecord, 'id' | 'voided_at' | 'applied_from'>): Promise<LienUnvoidAnswer> {
  const problem = lienUnvoidProblem(record)
  if (problem) throw new LienUnvoidRefused(problem)
  let answer: unknown
  try {
    answer = await withSupabaseRetry(
      () => supabase.rpc('unvoid_test_lien_filing' as never, { p_filing_id: record.id } as never),
      'put the record back',
      { maxRetries: 0 },
    )
  } catch (e) {
    if (e instanceof DatabaseError && e.code === 'P0001' && e.serverMessage) throw new LienUnvoidRefused(e.serverMessage)
    throw e
  }
  const done = lienUnvoidAnswer(answer)
  if (!done) throw new Error(LIEN_UNVOID_WORDS.noAnswer)
  return done
}
