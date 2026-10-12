/**
 * Messages, cut 3's screens: what the quick replies strip, *Find a reply* and the editor read and press, over cut 3's
 * migration (`20261012190000_quick_replies.sql`). One interface, so a screen's smoke hands it a fake; one
 * implementation on the app's client. The tables are not in the generated types until the lead's types PR, so the
 * client is read untyped here and every row is mapped through `rows.ts`. The tables are read only: every change goes
 * through a function, which keeps its version with who and when, and refuses in words (`pressProblem`).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { QuickReply, QuickReplyTags, QuickReplyVersion } from './kernel'
import { quickRepliesFromRows, versionsFromRows, type QuickReplyRow, type QuickReplyUseRow, type QuickReplyVersionRow } from './rows'

export interface QuickRepliesIo {
  /** Every line the signed-in person may read (the team's, and their own), with its presses. */
  loadLines(): Promise<QuickReply[]>
  /** Every line's versions, for the editor's history. */
  loadVersions(): Promise<Record<string, QuickReplyVersion[]>>
  /** A press fills the box and nothing sends; it is counted, so the lines used most come first. */
  press(id: string, contactId: string | null): Promise<void>
  /** Returns the new line. */
  add(text: string, tags: QuickReplyTags, mine: boolean): Promise<string>
  /** Returns how many versions the save wrote: the words and the tags apart. */
  edit(id: string, text: string, tags: QuickReplyTags): Promise<number>
  remove(id: string): Promise<void>
  restore(id: string): Promise<void>
}

const LINE_COLUMNS = 'id, text, for_kind, step_key, scope, added_by, added_at, removed_at'
const USE_COLUMNS = 'quick_reply_id, user_id, contact_id, at'
const VERSION_COLUMNS = 'id, quick_reply_id, kind, from_text, to_text, from_for_kind, from_step_key, to_for_kind, to_step_key, by_user_id, at'

export function supabaseQuickRepliesIo(client: unknown = supabase): QuickRepliesIo {
  // Cut 3's tables join the generated types with the lead's types PR; until then the client is untyped.
  const db = client as SupabaseClient
  const call = async <T>(fn: string, args: Record<string, unknown>, doing: string): Promise<T> => {
    const result = await db.rpc(fn, args)
    checkSupabaseError(result, doing)
    return result.data as T
  }
  const tagArgs = (tags: QuickReplyTags) => ({ p_for: tags.for, p_step: tags.for === 'any' ? null : tags.stepId })
  return {
    async loadLines() {
      const [lines, uses] = await Promise.all([db.from('quick_replies').select(LINE_COLUMNS), db.from('quick_reply_uses').select(USE_COLUMNS)])
      checkSupabaseError(lines, 'load the quick replies')
      checkSupabaseError(uses, 'load how often each is used')
      return quickRepliesFromRows((lines.data ?? []) as QuickReplyRow[], (uses.data ?? []) as QuickReplyUseRow[])
    },
    async loadVersions() {
      const result = await db.from('quick_reply_versions').select(VERSION_COLUMNS).order('id')
      checkSupabaseError(result, 'load the quick replies’ history')
      return versionsFromRows((result.data ?? []) as QuickReplyVersionRow[])
    },
    async press(id, contactId) {
      await call('press_quick_reply', { p_id: id, p_contact_id: contactId }, 'count a quick reply')
    },
    async add(text, tags, mine) {
      return call<string>('add_quick_reply', { p_text: text, ...tagArgs(tags), p_mine: mine }, 'add a quick reply')
    },
    async edit(id, text, tags) {
      return call<number>('edit_quick_reply', { p_id: id, p_text: text, ...tagArgs(tags) }, 'change a quick reply')
    },
    async remove(id) {
      await call('remove_quick_reply', { p_id: id }, 'remove a quick reply')
    },
    async restore(id) {
      await call('restore_quick_reply', { p_id: id }, 'bring a quick reply back')
    },
  }
}
