/**
 * Punch list #140 PR 1: the Office hours card's read and its one write (`officeHoursCard.ts`). The hours are the
 * `app_settings` row `messages_office_hours_v1` (R5's SQL seeded it), which the owner and a dev may update through
 * `master_or_dev_update_messages_office_hours` and nobody else. Update-only: the row exists, and a write that comes back
 * with no row was refused. One interface, so the card's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { OFFICE_HOURS_KEY, parseOfficeHours, type OfficeHours } from './hasRule'
import { OFFICE_HOURS_WORDS } from './officeHoursCard'

export interface OfficeHoursIo {
  /** The hours as the rule reads them, and the row's own text (null when the row is missing). */
  load(): Promise<{ hours: OfficeHours; raw: string | null }>
  /** Resolves once the row holds `valueText`. Rejects with words a person can act on when nothing changed. */
  save(valueText: string): Promise<void>
}

export function supabaseOfficeHoursIo(client: SupabaseClient<Database> = supabase): OfficeHoursIo {
  return {
    async load() {
      const row = await client.from('app_settings').select('value_text').eq('key', OFFICE_HOURS_KEY).maybeSingle()
      checkSupabaseError(row, 'read the office hours')
      const raw = row.data?.value_text ?? null
      return { hours: parseOfficeHours(raw), raw }
    },
    async save(valueText) {
      const result = await client.from('app_settings').update({ value_text: valueText }).eq('key', OFFICE_HOURS_KEY).select('key')
      checkSupabaseError(result, 'save the office hours')
      // No row back: the policy refused the update, or the row is not there.
      if (result.data.length === 0) throw new Error(OFFICE_HOURS_WORDS.notSaved)
    },
  }
}
