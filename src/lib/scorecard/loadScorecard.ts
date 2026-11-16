/**
 * The scorecard's reads as the app makes them (team scorecard). Since punch list #360 PR 4 the Scores tab asks the
 * edge function `team-scores` first (`teamScoresIo.ts`); this file binds the app's client to the same reads
 * (`scorecardReads.ts`) for the fallback while the function is not deployed, and keeps the one write.
 */
import { supabase } from '../supabase'
import { APP_SETTINGS_KEY_SCORECARD_HURDLE_V1, serializeHurdleSetting, type HurdleSetting } from './hurdle'
import { readScorecard, readScorecardSettings, type ScorecardRead, type ScorecardReadArgs } from './scorecardReads'

export { SCORECARD_WINDOWS, type ScorecardRead } from './scorecardReads'

export function loadScorecardSettings(): Promise<{ burden: number; setting: HurdleSetting }> {
  return readScorecardSettings(supabase)
}

/** The one write: the owner's target profit per paid field hour (his own policy on the key since v2.7361). */
export async function saveHurdleSetting(setting: HurdleSetting): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert({ key: APP_SETTINGS_KEY_SCORECARD_HURDLE_V1, value_text: serializeHurdleSetting(setting) }, { onConflict: 'key' })
  if (error) throw error
}

export function loadScorecard(args: ScorecardReadArgs): Promise<ScorecardRead> {
  return readScorecard(supabase, args)
}
