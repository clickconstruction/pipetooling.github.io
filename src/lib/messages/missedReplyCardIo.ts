/**
 * Punch list #195 PR 2: the Missed calls card's reads and its one write (`missedReplyCard.ts`). The setting is the
 * `app_settings` row `messages_missed_call_reply_v1` (migration `20261028150000` seeded it), which the owner and a dev
 * may update through `master_or_dev_update_messages_missed_call_reply` and nobody else; the list is the last ten rows
 * of `missed_call_replies`, which the office reads and the functions alone write. Update-only: the row exists, and a
 * write that comes back with no row was refused. One interface, so the card's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { MISSED_REPLY_KEY, parseMissedReply, type MissedReplySettings } from '../quo/missedReply'
import { supabase } from '../supabase'
import { MISSED_CLAIMS_SHOWN, MISSED_REPLY_WORDS, type ClaimRow } from './missedReplyCard'

/**
 * The claims with the caller's name wherever it lives (v2.6036): the contact's own, the person at a customer, the
 * customer, the person at a trade partner, the partner, the roster, the lead, and the number they called from.
 */
export const CLAIM_COLUMNS = [
  'call_quo_id, called_at, outcome, line, reason, words, decided_at',
  'contact:contacts(name, goes_by, customer:customers(name), person:customer_contact_persons(name), company:gc_companies(name, contact_name), gc_person:gc_company_people(name), roster:people(name), prospect:prospects(contact_name, company_name))',
  'number:contact_channels(value)',
].join(', ')

export interface MissedReplyCardIo {
  /** The setting as the webhook reads it, the row's own text (null when the row is missing), and the last texts back. */
  load(): Promise<{ settings: MissedReplySettings; raw: string | null; claims: ClaimRow[] }>
  /** Resolves once the row holds `valueText`. Rejects with words a person can act on when nothing changed. */
  save(valueText: string): Promise<void>
}

export function supabaseMissedReplyCardIo(client: SupabaseClient<Database> = supabase): MissedReplyCardIo {
  return {
    async load() {
      const row = await client.from('app_settings').select('value_text').eq('key', MISSED_REPLY_KEY).maybeSingle()
      checkSupabaseError(row, 'read the missed call lines')
      // The claims table joins the generated types with the types PR after the migration's push; until then the read is untyped.
      const claims = await (client as unknown as SupabaseClient)
        .from('missed_call_replies')
        .select(CLAIM_COLUMNS)
        .order('called_at', { ascending: false })
        .limit(MISSED_CLAIMS_SHOWN)
      checkSupabaseError(claims, 'read the last texts back')
      const raw = row.data?.value_text ?? null
      return { settings: parseMissedReply(raw), raw, claims: (claims.data ?? []) as unknown as ClaimRow[] }
    },
    async save(valueText) {
      const result = await client.from('app_settings').update({ value_text: valueText }).eq('key', MISSED_REPLY_KEY).select('key')
      checkSupabaseError(result, 'save the missed call lines')
      // No row back: the policy refused the update, or the row is not there.
      if (result.data.length === 0) throw new Error(MISSED_REPLY_WORDS.notSaved)
    },
  }
}
