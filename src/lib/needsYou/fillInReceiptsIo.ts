import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { RECEIPT_CHASE_CHANGED_EVENT, type ReceiptChaseSource } from './fillInReceipts'

/**
 * The receipt kind's read and write (punch list #299, the step after PR 2). The read is the definer function
 * `receipt_requests_to_chase()`, which hands the office each open request the text cannot finish with its charge's
 * store, amount and day. Save is **Got it**, `receipt_requests_set_done`, and Undo takes the mark back. A press that
 * changed no row says so: a row answered or closed meanwhile is no error, but a refusal must not read as saved.
 */
export type ReceiptFillInIo = {
  fetchSources: () => Promise<ReceiptChaseSource[]>
  save: (requestId: string) => Promise<void>
  undo: (requestId: string) => Promise<void>
}

// The two functions are not in the generated types until the types PR, so the client is cast once here.
const db = supabase as unknown as SupabaseClient

function changed(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RECEIPT_CHASE_CHANGED_EVENT))
}

export function receiptFillInIoOver(client: SupabaseClient): ReceiptFillInIo {
  const setDone = async (requestId: string, done: boolean, what: string) => {
    const result = await client.rpc('receipt_requests_set_done', { p_request_ids: [requestId], p_done: done })
    checkSupabaseError(result, what)
    changed()
  }
  return {
    async fetchSources() {
      const result = await client.rpc('receipt_requests_to_chase')
      checkSupabaseError(result, 'fill in: receipts the text could not get')
      return ((result.data ?? []) as ReceiptChaseSource[]).map((r) => ({ ...r, amount: Number(r.amount) }))
    },
    save: (requestId) => setDone(requestId, true, 'mark the receipt request done'),
    undo: (requestId) => setDone(requestId, false, 'put the receipt request back'),
  }
}

export const receiptFillInIo: ReceiptFillInIo = receiptFillInIoOver(db)
