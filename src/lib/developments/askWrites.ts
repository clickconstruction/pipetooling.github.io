/**
 * The one write behind Ask a question (punch list #208 PR 4): the lane's row, then the lane's push
 * (`notify-estimator-request` / `notify-dispatch-request`, the functions the header's modals call),
 * then the inbox's refresh. The row is `askRow`'s; a failure names its reason.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { notifyDispatchRequestsChanged } from '../dispatchRequestHelpers'
import type { AskLane, AskRow } from './ask'

export async function sendAsk(lane: AskLane, row: AskRow): Promise<{ id: string; pushed: boolean; pushError: string | null }> {
  const table = lane === 'dispatch' ? 'dispatch_requests' : 'estimator_requests'
  const inserted = await withSupabaseRetry<{ id: string }>(async () => supabase.from(table).insert(row as never).select('id').single(), `insert ${table}`)
  const id = inserted?.id
  if (!id) throw new Error('The question was not written.')
  if (lane === 'dispatch') notifyDispatchRequestsChanged()
  const fn = lane === 'dispatch' ? 'notify-dispatch-request' : 'notify-estimator-request'
  const body = lane === 'dispatch' ? { dispatch_request_id: id } : { estimator_request_id: id }
  const { error } = await supabase.functions.invoke(fn, { body })
  return { id, pushed: !error, pushError: error ? formatErrorMessage(error) : null }
}
