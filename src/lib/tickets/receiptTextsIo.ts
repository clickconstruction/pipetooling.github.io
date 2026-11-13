/**
 * The receipt texts' reads and the switch's one write (punch list #299, PR 2). The switch is `app_settings`'s
 * `receipt_texts_v1`, which every signed-in user reads and only the owner and a dev may update. The Team queue reads
 * each charge's request (`receipt_requests`, the office and the holder by its own policy) for the line under a charge.
 * One interface each, so a render smoke hands in a fake. Browser io, not pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { TEXTS_SWITCH_KEY, textsAreOn } from '../quo/textsSwitch'
import { RECEIPT_TEXTS_KEY, RECEIPT_TEXTS_WORDS, parseReceiptTextsSetting, receiptTextsValue, type ReceiptRequestState, type ReceiptTextsSetting } from './receiptText'

// `receipt_requests` is not in the generated types until the types PR, so the client is cast once here.
const db = supabase as unknown as SupabaseClient

export interface ReceiptTextsIo {
  /** The switch as stored. A row not there yet reads off. */
  load(): Promise<ReceiptTextsSetting>
  /** Whether Send texts, the switch every text waits on, is on. */
  sendTextsOn(): Promise<boolean>
  /** Resolves with what the switch now reads. Rejects with words a person can act on when nothing changed. */
  set(next: { on: boolean; only?: readonly string[] }): Promise<ReceiptTextsSetting>
}

export function supabaseReceiptTextsIo(client: SupabaseClient = db, now: () => Date = () => new Date()): ReceiptTextsIo {
  return {
    async load() {
      const result = await client.from('app_settings').select('value_text').eq('key', RECEIPT_TEXTS_KEY).maybeSingle()
      checkSupabaseError(result, 'read the receipt texts switch')
      return parseReceiptTextsSetting((result.data as { value_text: string | null } | null)?.value_text)
    },
    async sendTextsOn() {
      const result = await client.from('app_settings').select('value_text').eq('key', TEXTS_SWITCH_KEY).maybeSingle()
      checkSupabaseError(result, 'read the Send texts switch')
      return textsAreOn((result.data as { value_text: string | null } | null)?.value_text)
    },
    async set(next) {
      const value = receiptTextsValue(next, now().toISOString())
      const result = await client.from('app_settings').update({ value_text: value }).eq('key', RECEIPT_TEXTS_KEY).select('key, value_text')
      checkSupabaseError(result, 'turn receipt texts on or off')
      const rows = (result.data ?? []) as { value_text: string | null }[]
      if (rows.length === 0) throw new Error(RECEIPT_TEXTS_WORDS.notSaved)
      // What the row holds now, not what was sent: the database stamps the day it went on with its own clock.
      return parseReceiptTextsSetting(rows[0]!.value_text)
    },
  }
}

/** A charge's request as the Team queue's line reads it. */
export type ReceiptRequestRow = ReceiptRequestState & { mercury_transaction_id: string }

/**
 * The requests on these charges, by charge. Never throws: the line is a layer on the queue, and a database ahead of
 * the push, or a read that fails, leaves the queue as it was.
 */
export async function listReceiptRequestsByCharge(chargeIds: readonly string[], client: SupabaseClient = db): Promise<Map<string, ReceiptRequestRow>> {
  const out = new Map<string, ReceiptRequestRow>()
  const ids = [...new Set(chargeIds)].filter(Boolean)
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await client
      .from('receipt_requests')
      .select('mercury_transaction_id, holder_name, no_text_why, texted_at, reminded_at, answered_at, closed_at, text_tries')
      .in('mercury_transaction_id', ids.slice(i, i + 150))
    if (error) return out
    for (const r of (data ?? []) as ReceiptRequestRow[]) out.set(r.mercury_transaction_id, r)
  }
  return out
}
