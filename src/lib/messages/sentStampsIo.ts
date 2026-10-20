/**
 * Messages, residential R8 · 1: the small print under a sent copy's line, read for one thread's copies through
 * `sent_copy_stamps` (migration `20261014140000`): from, opened and paid, for whoever reads `sent_documents` (the office).
 * One read, and nothing else: the function joins the email log and the bill's payments itself. One interface, so a smoke
 * hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { paidHowWord, type SentCopyStamps } from './appLines'
import { SENT_LINE_PREFIX } from './sentLines'

/** A row as `sent_copy_stamps` answers it. */
export interface SentCopyStampsRow {
  id: string
  from_email: string | null
  opened_at: string | null
  /** The payment's day, 'YYYY-MM-DD'. */
  paid_on: string | null
  paid_how: string | null
}

export interface SentStampsIo {
  /** The stamps of the copies named, by `sent_documents` id. A copy with none still comes back, with nulls. */
  load(copyIds: readonly string[]): Promise<SentCopyStamps[]>
}

/** How many copies one call names. A thread rarely has more; a long one asks again. */
const STAMPS_SLICE = 150

/**
 * A row as the small print reads it. A payment's day is a date, so it stands at noon in Chicago (17:00 UTC is noon in
 * daylight time and 11 AM in standard time), which keeps the day it names whatever the clock.
 */
export function stampsOfRow(row: SentCopyStampsRow): SentCopyStamps {
  return {
    id: row.id,
    fromEmail: row.from_email,
    openedAt: row.opened_at,
    paid: row.paid_on ? { at: `${row.paid_on}T17:00:00.000Z`, how: paidHowWord(row.paid_how) } : null,
  }
}

/** The copy ids behind a thread's sent lines (`sent:<id>`), once each. */
export function copyIdsOf(lineIds: readonly string[]): string[] {
  return [...new Set(lineIds.filter((id) => id.startsWith(SENT_LINE_PREFIX)).map((id) => id.slice(SENT_LINE_PREFIX.length)))]
}

export function supabaseSentStampsIo(client: SupabaseClient<Database> = supabase): SentStampsIo {
  return {
    async load(copyIds) {
      const out: SentCopyStamps[] = []
      for (let i = 0; i < copyIds.length; i += STAMPS_SLICE) {
        // The function is not in the generated types until the types pass that follows its migration.
        const result = (await client.rpc('sent_copy_stamps' as never, { p_ids: copyIds.slice(i, i + STAMPS_SLICE) } as never)) as unknown as {
          data: SentCopyStampsRow[] | null
          error: SupabaseResultError | null
        }
        checkSupabaseError(result, 'read when their emails were opened and paid')
        out.push(...(result.data ?? []).map(stampsOfRow))
      }
      return out
    },
  }
}
