/**
 * The receipt's state on many charges (punch list #299, PR 3): the live ticket on each and its request, read under the
 * reader's own policies. The office reads every ticket and request; a card's holder reads their own; anyone else reads
 * none and sees no chip. Never throws: the state is a layer on a table, and a read that fails leaves the table as it
 * was. Browser io, not pure.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { ReceiptStateFacts } from './receiptState'
import { listReceiptRequestsByCharge } from './receiptTextsIo'

const db = supabase as unknown as SupabaseClient

type TicketRow = { mercury_transaction_id: string | null; source: string | null }

async function liveTicketsByCharge(chargeIds: readonly string[], client: SupabaseClient): Promise<Map<string, TicketRow>> {
  const out = new Map<string, TicketRow>()
  for (let i = 0; i < chargeIds.length; i += 150) {
    const { data, error } = await client
      .from('counter_tickets')
      .select('mercury_transaction_id, source')
      .in('mercury_transaction_id', chargeIds.slice(i, i + 150))
      .is('removed_at', null)
      .not('added_at', 'is', null)
    if (error) return out
    for (const t of (data ?? []) as TicketRow[]) if (t.mercury_transaction_id) out.set(t.mercury_transaction_id, t)
  }
  return out
}

/** What is known about each of these charges. A charge with neither a ticket nor a request is left out. */
export async function loadReceiptStateFacts(chargeIds: readonly string[], client: SupabaseClient = db): Promise<Map<string, ReceiptStateFacts>> {
  const ids = [...new Set(chargeIds)].filter(Boolean)
  const out = new Map<string, ReceiptStateFacts>()
  if (ids.length === 0) return out
  try {
    const [tickets, requests] = await Promise.all([liveTicketsByCharge(ids, client), listReceiptRequestsByCharge(ids, client)])
    for (const id of ids) {
      const ticket = tickets.get(id) ?? null
      const request = requests.get(id) ?? null
      if (ticket || request) out.set(id, { ticket: ticket ? { source: ticket.source } : null, request })
    }
  } catch {
    // A read that throws leaves the table with no chips.
  }
  return out
}
