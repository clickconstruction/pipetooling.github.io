/**
 * The Document builder's reads and writes (punch list #404, step 2). The table `document_builders` holds one row a
 * builder, and a dev alone reads or writes it: row security decides, so any other caller reads an empty list and
 * lands no write. Browser io, not pure; a row's shape and where a builder stands are `standing.ts`.
 *
 * The table is younger than the generated types, so the client is cast once here. The types PR after the push takes
 * the cast away. A database ahead of the push answers a refusal in words.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { DocumentBuilderKind } from './builders'
import { DOCUMENT_BUILDERS_TABLE, DOCUMENT_BUILDER_SELECT, builderRecordFromRow, builderRecordsByKey, type BuilderRecord } from './standing'

const db = supabase as unknown as SupabaseClient

export type Landed<T> = { ok: true; value: T } | { ok: false; error: string }

/** Every builder the caller can read, by its name in the registry. Throws with the reason, for the retry panel. */
export async function readDocumentBuilders(): Promise<Map<string, BuilderRecord>> {
  const rows = await withSupabaseRetry<unknown[]>(() => db.from(DOCUMENT_BUILDERS_TABLE).select(DOCUMENT_BUILDER_SELECT).order('key', { ascending: true }), 'read the builders')
  return builderRecordsByKey(rows ?? [])
}

/**
 * A builder's first draft: its row is made, as a draft on revision 0 with nothing published. The database refuses a
 * second row for one builder, so a builder someone else loaded a moment ago answers with that refusal in words.
 */
export async function loadFirstDraft(key: string, kind: DocumentBuilderKind, draft: unknown): Promise<Landed<BuilderRecord>> {
  try {
    const { data, error } = await db.from(DOCUMENT_BUILDERS_TABLE).insert({ key, kind, draft }).select(DOCUMENT_BUILDER_SELECT).single()
    if (error) return { ok: false, error: formatErrorMessage(error, 'The first draft did not load.') }
    const rec = builderRecordFromRow(data)
    return rec ? { ok: true, value: rec } : { ok: false, error: 'The first draft loaded, and the app could not read it back.' }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, 'The first draft did not load.') }
  }
}
