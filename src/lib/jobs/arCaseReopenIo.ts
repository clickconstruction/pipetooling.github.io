/**
 * Reopening a closed test case (punch list #443, row 5): the fresh read and the call. The rule is `arCaseReopen.ts`.
 *
 * It runs as the signed-in person. Each of the three functions checks the caller's role itself and refuses a case it
 * does not reopen, and its refusal is passed on in its own words.
 */
import { supabase } from '../supabase'
import type { ArReturnCaseRow } from './arReturnCase'
import { arCaseReopenCall, arCaseReopenProblem } from './arCaseReopen'

/** Every case, closed too, as the page reads them: `list_ar_return_cases` with the closed ones. Throws when the read fails. */
export async function readArCasesWithClosed(): Promise<ArReturnCaseRow[]> {
  const { data, error } = await supabase.rpc('list_ar_return_cases' as never, { p_include_closed: true } as never)
  if (error) throw error
  return ((data ?? []) as unknown as ArReturnCaseRow[]).filter((r) => r && typeof r.mercury_transaction_id === 'string')
}

/**
 * Reopen one closed test case. The cases are read again here and the rule is run on the case as the database holds
 * it now, so a case that changed since the list was drawn is refused with its reason. The call is sent once.
 */
export async function reopenArTestCase(caseId: string): Promise<void> {
  const fresh = (await readArCasesWithClosed()).find((r) => r.mercury_transaction_id === caseId) ?? null
  const problem = arCaseReopenProblem(fresh)
  if (problem || !fresh) throw new Error(problem)
  const call = arCaseReopenCall(fresh)
  const { data, error } = await supabase.rpc(call.fn as never, call.args as never)
  if (error) throw error
  const answer = (data ?? null) as Record<string, unknown> | null
  if (answer && typeof answer.error === 'string') throw new Error(answer.error)
}
