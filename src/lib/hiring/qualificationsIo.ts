/**
 * Their qualifications, read and written (2026-10-23): the trade levels in `trade_levels`, one row a trade, and the
 * home, its pin and the license on the record itself, a candidate's row on the Team hiring board (`team_prospects`) or
 * a sub's on the roster (`people`). The kernel (`tradeScale.ts`) turns rows into words and back; this file only reads
 * and writes them. The client is untyped until the types regenerate after the migration.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { qualificationsFrom, qualificationsRecord, qualificationsRows, type Qualifications, type QualificationsRecord, type TradeLevelRow } from './tradeScale'

/** Whose qualifications: a candidate on the hiring board, or a sub on the roster. */
export type QualificationsOf = { teamProspectId: string } | { personId: string }

const RECORD_COLUMNS = 'location, location_lat, location_lng, license, license_asked'

const tableOf = (who: QualificationsOf) => ('teamProspectId' in who ? { table: 'team_prospects', id: who.teamProspectId, key: 'team_prospect_id' } : { table: 'people', id: who.personId, key: 'person_id' })

/** Their qualifications as kept; null when nothing was ever noted. */
export async function loadQualifications(who: QualificationsOf, client: unknown = supabase): Promise<Qualifications | null> {
  const db = client as SupabaseClient
  const { table, id, key } = tableOf(who)
  const [levels, record] = await Promise.all([db.from('trade_levels').select('trade, level').eq(key, id), db.from(table).select(RECORD_COLUMNS).eq('id', id).maybeSingle()])
  checkSupabaseError(levels, 'read their trade levels')
  checkSupabaseError(record, 'read their record')
  return qualificationsFrom((levels.data ?? []) as TradeLevelRow[], (record.data ?? null) as QualificationsRecord | null)
}

/** Writes their qualifications: a row a trade with a level (each trade once), and the home, its pin and the license on the record. */
export async function saveQualifications(who: QualificationsOf, q: Qualifications, client: unknown = supabase): Promise<void> {
  const db = client as SupabaseClient
  const { table, id, key } = tableOf(who)
  const rows = qualificationsRows(q).map((r) => ({ ...r, [key]: id }))
  if (rows.length) {
    const up = await db.from('trade_levels').upsert(rows, { onConflict: 'team_prospect_id,person_id,trade' })
    checkSupabaseError(up, 'save their trade levels')
  }
  const rec = await db.from(table).update(qualificationsRecord(q)).eq('id', id)
  checkSupabaseError(rec, 'save their home and license')
}
