/**
 * The switch behind the typed-hours hold (v2.4242): whoever typed hours cannot approve them, and
 * nobody approves their own. `typed_hours_rule_applies()` reads this one row, so what Settings
 * saves is what the database enforces. The ledger (who typed what) runs whatever this says.
 */
import { supabase } from '../supabase'
import { APP_SETTINGS_KEY_TYPED_HOURS_SECOND_LOOK_V1 } from '../appSettingsKeys'

export type TypedHoursMode = 'off' | 'test' | 'on'

export const TYPED_HOURS_MODE_CHOICES: ReadonlyArray<{ mode: TypedHoursMode; label: string; detail: string }> = [
  { mode: 'on', label: 'On for everyone', detail: 'Whoever typed hours cannot approve them, and nobody approves their own. Someone else does.' },
  { mode: 'test', label: 'Test accounts only', detail: 'The rule holds for sample accounts and ZZ-named people. Everyone else approves as before; typed hours still wear the pencil.' },
  { mode: 'off', label: 'Off', detail: 'Nobody is held. Typed hours still wear the pencil and still show in Needs You.' },
]

/** Anything the database would not read as `on` or `test` is `off` — the same fall-through as typed_hours_rule_applies(). */
export function parseTypedHoursMode(valueText: string | null | undefined): TypedHoursMode {
  const v = (valueText ?? '').trim()
  return v === 'on' || v === 'test' ? v : 'off'
}

export async function fetchTypedHoursMode(): Promise<TypedHoursMode> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value_text')
    .eq('key', APP_SETTINGS_KEY_TYPED_HOURS_SECOND_LOOK_V1)
    .maybeSingle()
  if (error) throw error
  return parseTypedHoursMode((data as { value_text: string | null } | null)?.value_text)
}

export async function saveTypedHoursMode(mode: TypedHoursMode): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert([{ key: APP_SETTINGS_KEY_TYPED_HOURS_SECOND_LOOK_V1, value_text: mode }], { onConflict: 'key' })
  if (error) throw error
}
