/**
 * Tell the dev (punch list #380): one note into `help_feedback`, the table the guides' box
 * already writes. The words are checked first (`canSendNote`), the row is written under the
 * sender's own sign-in, and the dev's inbox on this tab is told to read again.
 */
import { supabase } from '../supabase'
import { DatabaseError, withSupabaseRetry } from '../../utils/errorHandling'
import { notifyHelpFeedbackChanged } from '../helpFeedbackHelpers'
import { canSendNote, type NoteKind } from './starts'
import type { NoteContext } from './noteContext'
import type { Json } from '../../types/database'

/** A note's row, as the wrench writes it. */
type NoteRow = {
  id: string
  from_user_id: string
  kind: NoteKind
  body: string
  page_key: string
  page_path: string
  context: Json
}

export async function sendDevNote(args: {
  fromUserId: string
  kind: NoteKind
  typed: string
  pageKey: string
  pagePath: string
  context: NoteContext
}): Promise<{ id: string }> {
  const checked = canSendNote(args.kind, args.typed)
  if (!checked.ok) throw new Error(checked.reason)

  // The id is made here, so a resend after a lost answer meets its own row and counts once.
  const id = crypto.randomUUID()
  const row: NoteRow = {
    id,
    from_user_id: args.fromUserId,
    kind: args.kind,
    body: checked.body,
    page_key: args.pageKey,
    page_path: args.pagePath,
    context: args.context as unknown as Json,
  }
  try {
    await withSupabaseRetry(
      async () =>
        // `kind`, `page_key`, `page_path` and `context` came with 20261117235000; the generated types name them
        // from the next types refresh, so the row is typed here until then.
        supabase.from('help_feedback').insert(row as never),
      'send a note to the dev',
    )
  } catch (error) {
    if (!(error instanceof DatabaseError && error.code === '23505')) throw error
  }
  notifyHelpFeedbackChanged()
  return { id }
}
