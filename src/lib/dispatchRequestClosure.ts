/**
 * Closing (or reopening) a dispatch request tells the requester (journey-map
 * Tier-2 #25, J19-F2). Before this, "Add & Close" was a bare status update:
 * `notify-dispatch-request` fired on create only, so the note the office wrote
 * *to* the tech ("job done and billed 8/11") reached no one.
 *
 * The pure part lives here: the edge-function payload, the push wording (the
 * Deno function composes the same text — tests pin the client copy), and the
 * telemetry target. `notifyDispatchRequestClosure` is the thin I/O wrapper.
 */
import { supabase } from './supabase'
import { recordNavClick } from './navClickTelemetry'

export type DispatchClosureMode = 'closed' | 'reopened'

/** The push body ceiling `notify-dispatch-request` already enforces. */
export const DISPATCH_PUSH_BODY_MAX = 220
/** Office notes can run to 2000 chars; the push carries the head of it. */
export const DISPATCH_CLOSURE_NOTE_MAX = 500

export type DispatchClosureRequest = {
  id: string
  from_user_id: string
  title: string
}

export type DispatchClosureNotification = {
  /** Body for `supabase.functions.invoke('notify-dispatch-request', { body })`. */
  body: { dispatch_request_id: string; mode: DispatchClosureMode; note: string | null }
  /** Who the function pushes to — the requester, never the group. */
  recipientUserId: string
  pushTitle: string
  pushBody: string
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`
}

/** Push wording shared (by convention) with the edge function's closed/reopened branch. */
export function composeDispatchClosurePush(
  title: string,
  note: string | null,
  mode: DispatchClosureMode,
): { title: string; body: string } {
  const head = mode === 'closed' ? 'Handled' : 'Reopened'
  const cleanTitle = truncate(title.trim() || 'your request', 160)
  const cleanNote = (note ?? '').trim()
  const body = truncate(cleanNote ? `${head}: ${cleanTitle} — ${cleanNote}` : `${head}: ${cleanTitle}`, DISPATCH_PUSH_BODY_MAX)
  return {
    title: mode === 'closed' ? 'Dispatch answered' : 'Dispatch reopened your request',
    body,
  }
}

/** Pure: everything a close/reopen needs to tell the requester. */
export function requestClosureNotification(
  request: DispatchClosureRequest,
  note: string | null | undefined,
  mode: DispatchClosureMode,
): DispatchClosureNotification {
  const trimmed = (note ?? '').trim()
  const cappedNote = trimmed ? truncate(trimmed, DISPATCH_CLOSURE_NOTE_MAX) : null
  const push = composeDispatchClosurePush(request.title, cappedNote, mode)
  return {
    body: { dispatch_request_id: request.id, mode, note: cappedNote },
    recipientUserId: request.from_user_id,
    pushTitle: push.title,
    pushBody: push.body,
  }
}

/** `ui_nav_clicks.control` for `dispatch_request_closed{notified}`. */
export const DISPATCH_REQUEST_CLOSED_CONTROL = 'dispatch_request_closed'

/** Pure: `#<mode>?notified=<0|1>` — one row per close/reopen, whether the push landed. */
export function dispatchRequestClosedTarget(mode: DispatchClosureMode, notified: boolean): string {
  return `#${mode}?notified=${notified ? 1 : 0}`
}

type NotifyFnResult = { push_sent?: number; notified?: boolean } | null

/**
 * Fire the requester's push + `notification_history` row and record the
 * telemetry. Never throws and never blocks the caller's UI — the status update
 * has already happened; this is the message about it. Resolves to whether at
 * least one push was delivered.
 */
export async function notifyDispatchRequestClosure(args: {
  request: DispatchClosureRequest
  note: string | null | undefined
  mode: DispatchClosureMode
  userId: string | null | undefined
  role: string | null | undefined
}): Promise<boolean> {
  const notification = requestClosureNotification(args.request, args.note, args.mode)
  let notified = false
  try {
    const { data, error } = await supabase.functions.invoke('notify-dispatch-request', {
      body: notification.body,
    })
    if (!error) {
      const res = data as NotifyFnResult
      notified = Boolean(res?.notified) || (res?.push_sent ?? 0) > 0
    }
  } catch (e) {
    console.warn('notify-dispatch-request (closure) failed', e)
  }
  recordNavClick(args.userId, args.role ?? null, DISPATCH_REQUEST_CLOSED_CONTROL, dispatchRequestClosedTarget(args.mode, notified))
  return notified
}
