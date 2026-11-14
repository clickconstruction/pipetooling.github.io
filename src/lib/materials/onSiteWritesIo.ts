/**
 * Materials on site: a press's rows sent to the tables (punch list #344, PR 1, v2.7173). The rules are the tables'
 * own (the gate `on_site_can_touch_job`, the CHECKs, the training and twin blocks); nothing here decides who may
 * write. The rows go one after another in the order the press wrote them, so a new box is there before the part put
 * in it. An insert that meets its own row landed on an earlier try and is passed over; any other answer of no is
 * thrown as the app's `DatabaseError`, which the queue reads for its class.
 *
 * A press whose rows stand alone (`rowsStandAlone`, v2.7267: a delivery's lines) is answered row by row instead: a
 * refused row is kept with its reason and the rows after it still go, so the press's answer says what landed and
 * what did not. A lost signal still stops it, and the same ids come again on the next try.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { databaseErrorFromResult } from '../../utils/errorHandling'
import { insertAlreadyLanded, parseOnSiteWrites, type OnSiteLanding } from './onSiteWrites'

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

export async function landOnSiteWrites(raw: unknown, opts: { rowsStandAlone?: boolean } = {}): Promise<OnSiteLanding> {
  const writes = parseOnSiteWrites(raw)
  if (!writes) throw new OnSiteWritesShapeError()
  const landing: OnSiteLanding = { rows: writes.length, landed: [], refused: [] }
  for (const w of writes) {
    if (w.op === 'insert') {
      const { error, status } = await db.from(w.table).insert(w.row)
      if (error && !insertAlreadyLanded(error, w.table)) {
        const thrown = databaseErrorFromResult(error, 'save the press', status)
        // A refusal of one row alone is kept and the rest still go; a lost signal stops the press, whatever its rows.
        if (opts.rowsStandAlone && thrown.kind !== 'network') {
          landing.refused.push({ id: w.id, message: error.message, code: error.code ?? null })
          continue
        }
        throw thrown
      }
    } else {
      const { error, status } = await db.from(w.table).update(w.row).eq('id', w.id)
      if (error) throw databaseErrorFromResult(error, 'save the press', status)
    }
    landing.landed.push(w.id)
  }
  return landing
}
