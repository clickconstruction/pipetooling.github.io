/**
 * Punch list #207 PR 1: the signed-in person's row as a signature reads it, and the card's save. The read is fail-soft on
 * the columns that arrive by migration: with `signature_lines` (20261028230000) and `title` (cut 3's SQL), then without
 * the lines, then without the title, so a client deployed before the push still reads a name and a cell. The untyped
 * client is on purpose: the column joins `types/database.ts` with the regenerate after the push, as `title` did.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { ComposeSender } from './compose'
import { freeLinesOf, type SignatureKept } from './signature'

export interface SenderRow {
  name?: string | null
  phone?: string | null
  title?: string | null
  signature_lines?: unknown
}

/** The row read, and whether the lines' column answered: false before the migration is pushed. */
export interface SenderRead {
  row: SenderRow | null
  linesOn: boolean
}

const SELECTS = ['name, phone, title, signature_lines', 'name, phone, title', 'name, phone'] as const

/** The person's row for a signature. A column not there yet drops out of the read; any other refusal is thrown in words. */
export async function readSenderRow(db: SupabaseClient, userId: string): Promise<SenderRead> {
  for (const columns of SELECTS) {
    const read = await db.from('users').select(columns).eq('id', userId).maybeSingle()
    if (!read.error) return { row: (read.data as SenderRow | null) ?? null, linesOn: columns === SELECTS[0] }
    if (columns === SELECTS[SELECTS.length - 1]) checkSupabaseError(read, 'read your signature')
  }
  return { row: null, linesOn: false }
}

/** The sender as an email signs, from the row: the name trimmed, the title, the cell and the free lines. */
export function senderOf(row: SenderRow | null): ComposeSender {
  return { name: row?.name?.trim() ?? '', title: row?.title ?? null, cell: row?.phone ?? null, lines: freeLinesOf(row?.signature_lines) }
}

export interface SignatureLoad {
  sender: ComposeSender
  kept: SignatureKept
  /** The lines' column is there. False: the card saves the title alone and says the lines wait. */
  linesOn: boolean
}

export interface SignatureIo {
  /** The person's signature as kept, with the account's name and cell beside it. */
  load(userId: string): Promise<SignatureLoad>
  /** The title and the lines written on the person's own row; the lines only while their column is there. */
  save(userId: string, kept: SignatureKept, linesOn: boolean): Promise<void>
}

export function supabaseSignatureIo(client: unknown = supabase): SignatureIo {
  const db = client as SupabaseClient
  return {
    async load(userId) {
      const { row, linesOn } = await readSenderRow(db, userId)
      const sender = senderOf(row)
      return { sender, kept: { title: sender.title?.trim() || null, lines: sender.lines ?? [] }, linesOn }
    },
    async save(userId, kept, linesOn) {
      const result = await db
        .from('users')
        .update({ title: kept.title, ...(linesOn ? { signature_lines: kept.lines.length ? kept.lines : null } : {}) })
        .eq('id', userId)
      checkSupabaseError(result, 'save your signature')
    },
  }
}
