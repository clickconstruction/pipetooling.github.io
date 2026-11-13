/**
 * Materials on site: a press's rows sent to the tables (punch list #344, PR 1, v2.7173). The rules are the tables'
 * own (the gate `on_site_can_touch_job`, the CHECKs, the training and twin blocks); nothing here decides who may
 * write. The rows go one after another in the order the press wrote them, so a new box is there before the part put
 * in it. An insert that meets its own row landed on an earlier try and is passed over; any other answer of no is
 * thrown as the app's `DatabaseError`, which the queue reads for its class.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { databaseErrorFromResult } from '../../utils/errorHandling'
import { insertAlreadyLanded, parseOnSiteWrites } from './onSiteWrites'

// The tables are younger than the generated types; the next types PR removes this cast.
const db = supabase as unknown as SupabaseClient

/** A press whose rows are not the shape the store writes: said as a refusal, so it is never sent and never retried. */
export class OnSiteWritesShapeError extends Error {
  readonly code = 'on_site_writes_shape'
  constructor() {
    super('This press could not be read back from the phone. Make it again.')
    this.name = 'OnSiteWritesShapeError'
  }
}

export async function landOnSiteWrites(raw: unknown): Promise<{ rows: number }> {
  const writes = parseOnSiteWrites(raw)
  if (!writes) throw new OnSiteWritesShapeError()
  for (const w of writes) {
    if (w.op === 'insert') {
      const { error, status } = await db.from(w.table).insert(w.row)
      if (error && !insertAlreadyLanded(error, w.table)) throw databaseErrorFromResult(error, 'save the press', status)
    } else {
      const { error, status } = await db.from(w.table).update(w.row).eq('id', w.id)
      if (error) throw databaseErrorFromResult(error, 'save the press', status)
    }
  }
  return { rows: writes.length }
}
