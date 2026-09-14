/**
 * The contract floor (Contract sweep PR 0): the dollar amount under which a
 * live job is not chased for a customer agreement. Org-wide in `app_settings`
 * (any authenticated user reads, devs write — the same policy as every other
 * org switch). Parse and the "is this job under it" rule are pure; the two
 * I/O helpers are thin.
 */
import { supabase } from '../supabase'
import { APP_SETTINGS_KEY_JOB_CONTRACT_FLOOR_CENTS_V1, parseJobContractFloorCents } from '../appSettingsKeys'

/** Read the floor in cents (0 = no floor) — 0 on a missing row or an error. */
export async function fetchJobContractFloorCents(): Promise<number> {
  const { data, error } = await supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_JOB_CONTRACT_FLOOR_CENTS_V1).maybeSingle()
  if (error) return 0
  return parseJobContractFloorCents((data as { value_num?: number | null } | null)?.value_num ?? null)
}

/** Set the floor (dev-only by `app_settings` RLS). Throws on error. */
export async function setJobContractFloorCents(cents: number): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: APP_SETTINGS_KEY_JOB_CONTRACT_FLOOR_CENTS_V1, value_num: parseJobContractFloorCents(cents) }, { onConflict: 'key' })
  if (error) throw error
}

/**
 * A job is under the floor only when it HAS an amount and that amount is
 * below the floor. No amount is not "small" — it is unknown, and unknown
 * stays in the count.
 */
export function isUnderContractFloor(revenue: number | null | undefined, floorCents: number): boolean {
  if (!(floorCents > 0)) return false
  const rev = Number(revenue ?? 0)
  if (!Number.isFinite(rev) || rev <= 0) return false
  return Math.round(rev * 100) < floorCents
}

/** "$2,500" for the card and the sweep header; '' when there is no floor. */
export function formatContractFloor(floorCents: number): string {
  if (!(floorCents > 0)) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: floorCents % 100 === 0 ? 0 : 2 }).format(floorCents / 100)
}

/** Parse what a dev typed into the floor box ("2,500" · "$2500" · "2500.50") to cents; null when it is not a number. */
export function parseTypedFloorToCents(text: string): number | null {
  const n = Number(text.replace(/[$,\s]/g, ''))
  if (!text.trim() || !Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}
