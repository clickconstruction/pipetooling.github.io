/**
 * Client helpers for /help guide feedback (help_feedback) — the insert +
 * notify-help-feedback push pattern, thinned from dispatchRequestHelpers
 * (no de-dup: multiple feedback rows per guide are fine).
 */

import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

/** help_feedback.body max length (DB check constraint). */
export const HELP_FEEDBACK_BODY_MAX = 2000

/**
 * Same-tab refresh signal for the dev feedback inbox (realtime is intentionally
 * not used for this table — see the migration comment).
 */
export const HELP_FEEDBACK_CHANGED_EVENT = 'pipetooling:help-feedback-changed'

export function notifyHelpFeedbackChanged(): void {
  window.dispatchEvent(new Event(HELP_FEEDBACK_CHANGED_EVENT))
}

export type ValidateHelpFeedbackBodyResult =
  | { ok: true; body: string }
  | { ok: false; error: string }

export function validateHelpFeedbackBody(raw: string): ValidateHelpFeedbackBodyResult {
  const body = raw.trim()
  if (!body) return { ok: false, error: 'Write a little feedback first.' }
  if (body.length > HELP_FEEDBACK_BODY_MAX) {
    return { ok: false, error: `Feedback is limited to ${HELP_FEEDBACK_BODY_MAX} characters.` }
  }
  return { ok: true, body }
}

/** Open rows first (created_at desc), then closed (closed_at ?? created_at desc). */
export function sortHelpFeedbackRows<
  T extends { status: string; created_at: string | null; closed_at: string | null },
>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const aOpen = a.status === 'open' ? 1 : 0
    const bOpen = b.status === 'open' ? 1 : 0
    if (aOpen !== bOpen) return bOpen - aOpen
    const aDate = a.status === 'closed' ? (a.closed_at ?? a.created_at ?? '') : (a.created_at ?? '')
    const bDate = b.status === 'closed' ? (b.closed_at ?? b.created_at ?? '') : (b.created_at ?? '')
    return bDate.localeCompare(aDate)
  })
}

/**
 * Insert a feedback row and fire the dev Web Push (fire-and-forget — the row
 * exists even if the push fails).
 */
export async function submitHelpFeedback(args: {
  fromUserId: string
  guideSlug: string
  body: string
}): Promise<{ id: string }> {
  const validated = validateHelpFeedbackBody(args.body)
  if (!validated.ok) throw new Error(validated.error)

  const row = await withSupabaseRetry<{ id: string }>(
    async () =>
      supabase
        .from('help_feedback')
        .insert({
          from_user_id: args.fromUserId,
          guide_slug: args.guideSlug,
          body: validated.body,
        })
        .select('id')
        .single(),
    'insert help feedback',
  )
  if (!row?.id) throw new Error('Could not submit feedback')

  void supabase.functions.invoke('notify-help-feedback', {
    body: { help_feedback_id: row.id },
  })
  notifyHelpFeedbackChanged()

  return { id: row.id }
}
