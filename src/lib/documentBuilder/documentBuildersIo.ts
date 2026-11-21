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

/**
 * How a write went. A save or a publish names the draft's number its page read, and one from a page that fell behind
 * lands on no row. Such a refusal carries the row as it now reads in `movedOn`, so the screen can offer it without
 * dropping what the person typed.
 */
export type Landed<T> = { ok: true; value: T } | { ok: false; error: string; movedOn?: T }

/** The words of a write refused because the row moved on. The screen's panel says the rest (`movedOn.ts`). */
export const MOVED_ON_SAVE = 'This was changed somewhere else since you opened it. What you typed here is not saved.'
export const MOVED_ON_PUBLISH = 'This was changed somewhere else since you opened it. Nothing was published.'
export const WRITE_GONE = 'This is no longer there. Read the page again.'

type Answer = { data: unknown; error: unknown }

/**
 * One guarded write. `write` names the number the page read and answers the row it changed, or none when the row
 * moved on. Then the row is read again to say which it was: gone, changed by someone else, or this same write
 * landing twice, as when its first reply was lost on the way back. `mine` says whether the row reads as this write
 * left it.
 */
export async function guardedWrite<T>(opts: {
  write: () => PromiseLike<Answer>
  reread: () => PromiseLike<Answer>
  parse: (row: unknown) => T | null
  mine: (row: T) => boolean
  fallback: string
  moved: string
}): Promise<Landed<T>> {
  const one = (data: unknown) => opts.parse(Array.isArray(data) ? data[0] : data)
  try {
    const wrote = await opts.write()
    if (wrote.error) return { ok: false, error: formatErrorMessage(wrote.error, opts.fallback) }
    const landed = one(wrote.data)
    if (landed) return { ok: true, value: landed }
    const again = await opts.reread()
    if (again.error) return { ok: false, error: formatErrorMessage(again.error, opts.fallback) }
    const now = one(again.data)
    if (!now) return { ok: false, error: WRITE_GONE }
    return opts.mine(now) ? { ok: true, value: now } : { ok: false, error: opts.moved, movedOn: now }
  } catch (e) {
    return { ok: false, error: formatErrorMessage(e, opts.fallback) }
  }
}

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
