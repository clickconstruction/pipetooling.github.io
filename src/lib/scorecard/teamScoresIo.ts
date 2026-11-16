/**
 * The Scores tab's read through the edge function `team-scores` (punch list #360, PR 4). The function makes the
 * scorecard's reads as the service role and answers with the scores alone, so no wage travels to the browser.
 *
 * `missing` is the one answer that is not a failure: the function is not deployed yet (the client reaches prod
 * before a deploy does), and the tab then makes the same reads itself, as it did before, for the people the gate
 * already lets read wages. Every other refusal is the function's own word and is shown.
 */
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/functions-js'
import { supabase } from '../supabase'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import type { ScorecardRead } from './scorecardReads'
import { TEAM_SCORES_FUNCTION, estimatorScoresFromWire, scorecardFromWire, type EstimatorScoresWire } from './scorecardWire'

export type TeamScoresAnswer = { kind: 'scores'; read: ScorecardRead } | { kind: 'missing' }

/**
 * No function by that name is deployed. The gateway answers 404, but with no CORS headers, so a browser is refused the
 * answer and sees a request that could not be made, never the status (found live on 2026-11-15: the fallback did not
 * run until the first deploy). Both read as missing; a function that answered and refused is its own word, and shown.
 */
export function teamScoresIsMissing(err: unknown): boolean {
  if (err instanceof FunctionsFetchError) return true
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

export type EstimatorScoresAnswer = { kind: 'scores'; read: EstimatorScoresWire } | { kind: 'missing' }

/**
 * The estimating score alone (PR 5): `bids` for the scoreboard's gate (everyone's, for the Bid Board's chips), `mine`
 * for anyone (their own row). `missing` while the function is not deployed: the row and the chips then do not draw.
 */
export async function fetchEstimatorScores(windowDays: number, view: 'bids' | 'mine'): Promise<EstimatorScoresAnswer> {
  const { data, error } = await supabase.functions.invoke(TEAM_SCORES_FUNCTION, { body: { windowDays, view } })
  if (error) {
    if (teamScoresIsMissing(error)) return { kind: 'missing' }
    throw new Error((await readEdgeFunctionErrorBody(error)) ?? 'The score could not be read.')
  }
  const read = estimatorScoresFromWire((data as { estimating?: unknown } | null)?.estimating)
  // A function deployed before this view existed answers the whole scorecard to the gate and a refusal to the rest.
  if (!read) return { kind: 'missing' }
  return { kind: 'scores', read }
}
