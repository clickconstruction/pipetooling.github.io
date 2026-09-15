import { supabase } from './supabase'
import { APP_SETTINGS_KEY_OWNER_AUTO_CONFIRM_FROM_ROLL_V1 } from './appSettingsKeys'

/**
 * "Save owners from the appraisal roll automatically" (owner of record,
 * decision 5 — v2.3450). One `app_settings` row, `value_text` 'true' |
 * 'false', inserted 'false' by the migration. When it is on, the nightly
 * `owner-confirm-nightly` function writes the roll's answer on every GC job
 * with approved hours and no owner, as *from the roll · unconfirmed*; the
 * Lien desk drafts on it and a person confirms before Record the run.
 * Master and dev may flip it (a key-scoped UPDATE policy); everyone reads.
 */

/** `value_text` → boolean; only the literal 'true' (trimmed, any case) is on. */
export function parseOwnerAutoConfirmFromRoll(valueText: string | null | undefined): boolean {
  return (valueText ?? '').trim().toLowerCase() === 'true'
}

export async function fetchOwnerAutoConfirmFromRoll(): Promise<boolean> {
  const { data, error } = await supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_OWNER_AUTO_CONFIRM_FROM_ROLL_V1).maybeSingle()
  if (error) return false
  return parseOwnerAutoConfirmFromRoll((data as { value_text?: string | null } | null)?.value_text ?? null)
}

/**
 * Flip the switch. An UPDATE, not an upsert: masters hold only the
 * key-scoped UPDATE policy, and the row exists from the migration.
 */
export async function setOwnerAutoConfirmFromRoll(on: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ value_text: on ? 'true' : 'false' })
    .eq('key', APP_SETTINGS_KEY_OWNER_AUTO_CONFIRM_FROM_ROLL_V1)
    .select('key')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('the setting row is missing — apply the v2.3450 migration')
}
