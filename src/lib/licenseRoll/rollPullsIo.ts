/**
 * State roll, the Pulls view (punch list #411): the reads and the one press. `license_roll_pulls` for the ledger,
 * `license_roll` for the counts, `license_roll_counties` for the counties kept, and the `license-roll-pull`
 * function for a pull. No person's row is read here: the counts are head requests.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { TsbpeFileKey } from '../../../supabase/functions/_shared/licenseRoll'
import { ROLL_TILES, type PullRow } from './rollPulls'

export type RollPullsRead = {
  pulls: PullRow[]
  /** Rows kept, by the tile's key. */
  kept: Record<string, number>
  /** Of the rows kept, those whose license has lapsed. */
  lapsed: number
  counties: string[]
}

function failed(error: unknown, what: string): never {
  throw new Error(`Could not ${what}: ${formatErrorMessage(error)}`)
}

/** Everything the Pulls view draws, in one go. The newest forty pulls cover every file many times over. */
export async function readRollPulls(): Promise<RollPullsRead> {
  const [pulls, counties, lapsed, ...tiles] = await Promise.all([
    supabase.from('license_roll_pulls').select('id, file, started_at, finished_at, rows_seen, rows_kept, added, changed, gone, error').order('started_at', { ascending: false }).limit(40),
    supabase.from('license_roll_counties').select('county').order('county'),
    supabase.from('license_roll').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
    ...ROLL_TILES.map((t) => supabase.from('license_roll').select('id', { count: 'exact', head: true }).in('license_class', [...t.classes])),
  ])
  if (pulls.error) failed(pulls.error, 'read the pulls')
  if (counties.error) failed(counties.error, 'read the counties')
  if (lapsed.error) failed(lapsed.error, 'count the roll')
  const kept: Record<string, number> = {}
  tiles.forEach((t, i) => {
    if (t.error) failed(t.error, 'count the roll')
    kept[ROLL_TILES[i]!.key] = t.count ?? 0
  })
  return {
    pulls: (pulls.data ?? []) as PullRow[],
    kept,
    lapsed: lapsed.count ?? 0,
    counties: ((counties.data ?? []) as { county: string }[]).map((c) => c.county),
  }
}

export type PullFileOutcome = { ok: true; added: number; changed: number; gone: number; kept: number } | { ok: false; why: string }

/** The reason a function gave with a refusal, which the client keeps inside the error's response. */
async function refusalWords(error: unknown): Promise<string | null> {
  const response = (error as { context?: unknown } | null)?.context
  if (!(response instanceof Response)) return null
  try {
    const body = (await response.clone().json()) as { error?: unknown }
    return typeof body.error === 'string' && body.error.trim() ? body.error : null
  } catch {
    return null
  }
}

/** Pull one state file now, as the signed-in person. A refusal comes back as its reason, never as a throw. */
export async function pullRollFile(file: TsbpeFileKey): Promise<PullFileOutcome> {
  const { data, error } = await supabase.functions.invoke('license-roll-pull', { body: { file } })
  if (error) return { ok: false, why: (await refusalWords(error)) ?? formatErrorMessage(error) }
  const body = (data ?? {}) as { ok?: boolean; error?: string; added?: number; changed?: number; gone?: number; kept?: number }
  if (body.ok !== true) return { ok: false, why: body.error || 'The pull did not say why it stopped.' }
  return { ok: true, added: body.added ?? 0, changed: body.changed ?? 0, gone: body.gone ?? 0, kept: body.kept ?? 0 }
}
