/**
 * Messages, cut 3's screens: what the quick replies strip, *Find a reply* and the editor read and press, over cut 3's
 * migration (`20261012190000_quick_replies.sql`). One interface, so a screen's smoke hands it a fake; one
 * implementation on the app's client. The tables are not in the generated types until the lead's types PR, so the
 * client is read untyped here and every row is mapped through `rows.ts`. The tables are read only: every change goes
 * through a function, which keeps its version with who and when, and refuses in words (`pressProblem`).
 *
 * R3 reads the Spanish, the phone's place and its name with each line, and the phone's places with each version. They
 * come with `20261013210000_quick_replies_phone_es.sql`, which is on prod before this reads them. A Save passes them
 * to `edit_quick_reply` only when they changed, so a Save of words and tags alone stays the four named arguments.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { isNotThereYetError } from '../gcWordAskIo'
import type { PhonePress } from './press'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { QuickReply, QuickReplyEdit, QuickReplyTags, QuickReplyVersion } from './kernel'
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
  /**
   * Returns how many versions the save wrote: the words, the tags, the Spanish and the phone apart. R3's parts go only
   * when given: a blank Spanish or name clears it, and a place of 0 or null takes the line off the phone.
   */
  edit(id: string, text: string, tags: QuickReplyTags, r3?: Pick<QuickReplyEdit, 'textEs' | 'phoneOrder' | 'phoneName'>): Promise<number>
  remove(id: string): Promise<void>
  restore(id: string): Promise<void>
  /** v2.5573: points a big button at the line (or clears it with null) through `set_quick_reply_press`. Returns how many lines changed. */
  setPress(id: string, press: PhonePress | null): Promise<number>
  /** Punch list #126: sets the line's `/` word (or clears it with null) through `set_quick_reply_shortcut`. Returns 1, or 0 when nothing changed. */
  setShortcut(id: string, shortcut: string | null): Promise<number>
}

const LINE_COLUMNS = 'id, text, for_kind, step_key, scope, added_by, added_at, removed_at, text_es, phone_order, phone_name'
const USE_COLUMNS = 'quick_reply_id, user_id, contact_id, at'
const VERSION_COLUMNS = 'id, quick_reply_id, kind, from_text, to_text, from_for_kind, from_step_key, to_for_kind, to_step_key, by_user_id, at, from_phone_order, to_phone_order'

/**
 * R3's three arguments, each only when given: `edit_quick_reply` keeps a part whose argument is null, so a clear goes
 * as blank and off the phone as 0.
 */
function r3Args(r3: Pick<QuickReplyEdit, 'textEs' | 'phoneOrder' | 'phoneName'> | undefined): Record<string, unknown> {
  if (!r3) return {}
  return {
    ...(r3.textEs !== undefined ? { p_text_es: r3.textEs ?? '' } : {}),
    ...(r3.phoneOrder !== undefined ? { p_phone_order: r3.phoneOrder ?? 0 } : {}),
    ...(r3.phoneName !== undefined ? { p_phone_name: r3.phoneName ?? '' } : {}),
  }
}

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
      const [lines, uses, presses, words] = await Promise.all([
        db.from('quick_replies').select(LINE_COLUMNS),
        db.from('quick_reply_uses').select(USE_COLUMNS),
        // The press column (v2.5573) and the shortcut (#126) are read apart, so a client ahead of a push still reads the lines.
        db.from('quick_replies').select('id, phone_press'),
        db.from('quick_replies').select('id, shortcut'),
      ])
      checkSupabaseError(lines, 'load the quick replies')
      checkSupabaseError(uses, 'load how often each is used')
      const pressOf = new Map<string, string | null>()
      if (!presses.error) for (const r of (presses.data ?? []) as Array<{ id: string; phone_press: string | null }>) pressOf.set(r.id, r.phone_press)
      else if (!isNotThereYetError(presses.error)) checkSupabaseError(presses, 'load the phone’s big buttons')
      const wordOf = new Map<string, string | null>()
      if (!words.error) for (const r of (words.data ?? []) as Array<{ id: string; shortcut: string | null }>) wordOf.set(r.id, r.shortcut)
      else if (!isNotThereYetError(words.error)) checkSupabaseError(words, 'load the quick replies’ shortcuts')
      const rows = ((lines.data ?? []) as QuickReplyRow[]).map((r) => ({ ...r, phone_press: pressOf.get(r.id) ?? null, shortcut: wordOf.get(r.id) ?? null }))
      return quickRepliesFromRows(rows, (uses.data ?? []) as QuickReplyUseRow[])
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
    async edit(id, text, tags, r3) {
      return call<number>('edit_quick_reply', { p_id: id, p_text: text, ...tagArgs(tags), ...r3Args(r3) }, 'change a quick reply')
    },
    async remove(id) {
      await call('remove_quick_reply', { p_id: id }, 'remove a quick reply')
    },
    async setPress(id, press) {
      return call<number>('set_quick_reply_press', { p_id: id, p_press: press }, 'point the big button at a line')
    },
    async setShortcut(id, shortcut) {
      return call<number>('set_quick_reply_shortcut', { p_id: id, p_shortcut: shortcut ?? '' }, 'set the line’s shortcut')
    },
    async restore(id) {
      await call('restore_quick_reply', { p_id: id }, 'bring a quick reply back')
    },
  }
}
