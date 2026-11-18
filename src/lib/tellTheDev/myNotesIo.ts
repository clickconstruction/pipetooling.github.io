/**
 * Tell the dev (punch list #380): a person's own last notes, read under their own sign-in. The
 * filter on the sender is needed for the owner and a dev, whose row security shows every note.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { MY_NOTES_SHOWN, type MyNote } from './myNotes'

export async function loadMyNotes(userId: string): Promise<MyNote[]> {
  const rows = await withSupabaseRetry(
    async () =>
      supabase
        .from('help_feedback')
        .select('id, kind, body, status, created_at, closed_at, closed_note')
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MY_NOTES_SHOWN),
    'read your notes to the dev',
  )
  return (rows ?? []) as unknown as MyNote[]
}
