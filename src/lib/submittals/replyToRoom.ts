/**
 * The office answers a question from the review room (Submittals stage 5a).
 * One function for every door (the Submittals tab today; the inbox card later):
 *   1. insert the reply as an office message (the room shows the company, never a name);
 *   2. email the person who asked through send-submittal-reply-email (best effort — the
 *      thread is the record, the email is the courtesy);
 *   3. close the inbox row the ask opened, with the reply as the closing note.
 * Returns what happened so the caller can say it.
 */
import { supabase } from '../supabase'

export type ReplyToRoomInput = {
  roomId: string
  /** The ask being answered (its id, its inbox row if any, its tags and revision). */
  ask: { id: string; submittalId: string | null; tags: string[]; metadata: unknown }
  body: string
  authorUserId: string | null
}

export type ReplyToRoomResult = { messageId: string; emailed: boolean; emailError: string | null; closedRequest: boolean }

/** `{ inbox, request_id }` as the ask's metadata carries it, or null. */
export function inboxRowOf(metadata: unknown): { inbox: 'estimator' | 'dispatch'; requestId: string } | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as Record<string, unknown>
  const inbox = m.inbox === 'estimator' || m.inbox === 'dispatch' ? m.inbox : null
  const requestId = typeof m.request_id === 'string' && m.request_id ? m.request_id : null
  return inbox && requestId ? { inbox, requestId } : null
}

export async function replyToRoom(input: ReplyToRoomInput): Promise<ReplyToRoomResult> {
  const body = input.body.trim()
  if (!body) throw new Error('Write the answer first.')
  const { data, error } = await supabase
    .from('bid_submittal_messages')
    .insert({
      room_id: input.roomId,
      submittal_id: input.ask.submittalId,
      person_id: null,
      author_kind: 'office',
      author_user_id: input.authorUserId,
      body,
      kind: 'reply',
      tags: input.ask.tags,
      metadata: { answers_message_id: input.ask.id },
    })
    .select('id')
    .single()
  if (error) throw error
  const messageId = (data as { id: string }).id

  let emailed = false
  let emailError: string | null = null
  try {
    const { data: sent, error: fnErr } = await supabase.functions.invoke('send-submittal-reply-email', { body: { message_id: messageId, public_origin: window.location.origin } })
    const res = (sent ?? {}) as { ok?: boolean; error?: string }
    if (fnErr || !res.ok) emailError = res.error ?? fnErr?.message ?? 'The email did not go.'
    else emailed = true
  } catch (e) {
    emailError = e instanceof Error ? e.message : 'The email did not go.'
  }

  let closedRequest = false
  const row = inboxRowOf(input.ask.metadata)
  if (row) {
    const { error: closeErr } = await supabase
      .from(row.inbox === 'estimator' ? 'estimator_requests' : 'dispatch_requests')
      .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by_user_id: input.authorUserId, closed_note: body })
      .eq('id', row.requestId)
      .eq('status', 'open')
    closedRequest = !closeErr
  }
  return { messageId, emailed, emailError, closedRequest }
}
