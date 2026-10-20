/**
 * The tech's bio (v2.5587, punch list #114): what the desk's block and the Settings block read and write
 * (`bio.ts` is the kernel). One interface, so the smokes hand it a fake; one implementation on the app's client. The
 * office reads any tech's lines and writes through `edit_bio_line`; a tech reads their own and turns a line on or off
 * through `bio_line_say`. A client ahead of the push reads "not there yet" as null, and the blocks draw nothing.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { isNotThereYetError } from '../gcWordAskIo'
import { bioLinesFromRows, type BioLine, type BioLineRow } from './bio'

export interface BioEdit {
  userId: string
  /** The line to change, or null to add one. */
  id: string | null
  text: string
  textEs: string | null
  /** A new place, or null to keep it (a new line takes the end). */
  position?: number | null
}

export interface BioIo {
  /** A tech's lines, removed ones too, in the office's order; null while the push is not in. */
  loadLines(userId: string): Promise<BioLine[] | null>
  /** Adds or changes a line; the id of the line. The server's refusal reads as its words. */
  editLine(edit: BioEdit): Promise<string>
  removeLine(userId: string, id: string): Promise<void>
  /** The tech's own: say the line, or not. */
  say(id: string, say: boolean): Promise<void>
}

const COLUMNS = 'id, user_id, text, text_es, position, added_at, removed_at, off_by_user_at'

export function supabaseBioIo(client: unknown = supabase): BioIo {
  const db = client as SupabaseClient
  return {
    async loadLines(userId) {
      const result = await db.from('user_bio_lines').select(COLUMNS).eq('user_id', userId)
      if (result.error) {
        if (isNotThereYetError(result.error)) return null
        checkSupabaseError(result, 'read the bio')
      }
      return bioLinesFromRows((result.data ?? []) as BioLineRow[])
    },
    async editLine(edit) {
      const result = await db.rpc('edit_bio_line', { p_user_id: edit.userId, p_id: edit.id, p_text: edit.text, p_text_es: edit.textEs, p_position: edit.position ?? null, p_remove: false })
      checkSupabaseError(result, 'save the line')
      return String(result.data)
    },
    async removeLine(userId, id) {
      const result = await db.rpc('edit_bio_line', { p_user_id: userId, p_id: id, p_text: null, p_text_es: null, p_position: null, p_remove: true })
      checkSupabaseError(result, 'remove the line')
    },
    async say(id, say) {
      const result = await db.rpc('bio_line_say', { p_id: id, p_say: say })
      checkSupabaseError(result, 'change your bio')
    },
  }
}
