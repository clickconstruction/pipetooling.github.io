/**
 * The Scores tab's read through the edge function `team-scores` (punch list #360, PR 4). The function makes the
 * scorecard's reads as the service role and answers with the scores alone, so no wage travels to the browser.
 *
 * `missing` is the one answer that is not a failure: the function is not deployed yet (the client reaches prod
 * before a deploy does), and the tab then makes the same reads itself, as it did before, for the people the gate
 * already lets read wages. Every other refusal is the function's own word and is shown.
 */
import { FunctionsHttpError } from '@supabase/functions-js'
import { supabase } from '../supabase'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import type { ScorecardRead } from './scorecardReads'
import { TEAM_SCORES_FUNCTION, scorecardFromWire } from './scorecardWire'

export type TeamScoresAnswer = { kind: 'scores'; read: ScorecardRead } | { kind: 'missing' }

/** A 404 from the functions gateway: no function by that name is deployed. */
export function teamScoresIsMissing(err: unknown): boolean {
  return err instanceof FunctionsHttpError && err.context instanceof Response && err.context.status === 404
}

export async function fetchTeamScores(windowDays: number): Promise<TeamScoresAnswer> {
  const { data, error } = await supabase.functions.invoke(TEAM_SCORES_FUNCTION, { body: { windowDays } })
  if (error) {
    if (teamScoresIsMissing(error)) return { kind: 'missing' }
    throw new Error((await readEdgeFunctionErrorBody(error)) ?? 'The scores could not be read.')
  }
  const read = scorecardFromWire((data as { scores?: unknown } | null)?.scores)
  if (!read) throw new Error('The scores came back in a shape this page does not read. Reload the page.')
  return { kind: 'scores', read }
}
