import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { readEdgeFunctionErrorBody } from '../readEdgeFunctionErrorBody'
import { RECEIPT_CHASE_CHANGED_EVENT, type ReceiptChaseSource } from './fillInReceipts'

/**
 * The receipt kind's read and write (punch list #299, the step after PR 2). The read is the definer function
 * `receipt_requests_to_chase()`, which hands the office each open request the text cannot finish with its charge's
 * store, amount and day. Save is **Got it**, `receipt_requests_set_done`, and Undo takes the mark back. A press that
 * changed no row says so: a row answered or closed meanwhile is no error, but a refusal must not read as saved.
 * **Text again** (v2.8697) asks the `receipt-request` function for one more text on one request; it throws with the
 * function's own words when no text went, so the row stays and says why.
 */
export type ReceiptFillInIo = {
  fetchSources: () => Promise<ReceiptChaseSource[]>
  save: (requestId: string) => Promise<void>
  undo: (requestId: string) => Promise<void>
  /** One more text to the charge's holder. Throws with the reason when no text went. */
  textAgain: (requestId: string) => Promise<void>
}

// The two functions are not in the generated types until the types PR, so the client is cast once here.
const db = supabase as unknown as SupabaseClient

const TEXT_AGAIN_FAILED = 'No text went. The text service did not answer. Try again in a minute.'

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
    async textAgain(requestId) {
      const { data, error } = await client.functions.invoke('receipt-request', { body: { again: requestId } })
      if (error) throw new Error((await readEdgeFunctionErrorBody(error)) ?? TEXT_AGAIN_FAILED)
      const answer = (data ?? {}) as { ok?: unknown; words?: unknown }
      if (answer.ok !== true) throw new Error(typeof answer.words === 'string' && answer.words ? answer.words : TEXT_AGAIN_FAILED)
      changed()
    },
  }
}

export const receiptFillInIo: ReceiptFillInIo = receiptFillInIoOver(db)
