/**
 * The reads and writes of a filled builder (punch list #404, step 3): the standing sheet's draft and its publish, the
 * read mark, a job's sheet, and the jobs the company runs as the GC. A dev alone reads or writes any of it: row
 * security decides. Browser io, not pure; the rules are `sheet.ts` and `standing.ts`.
 *
 * Every publish is guarded against a stale page: it updates the row only where the revision is still the one this
 * page read, and reads back no row when someone published first. The database keeps the other rules (a revision goes
 * up one at a time, a job's sheet goes out only on the usual's published revision).
 *
 * The tables are younger than the generated types, so the client is cast once here.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import type { Landed } from './documentBuildersIo'
import { parseJobSheet, type JobSheet, type ResolvedSheet } from './sheet'
import { DOCUMENT_BUILDERS_TABLE, DOCUMENT_BUILDER_SELECT, builderRecordFromRow, type BuilderRecord } from './standing'

const db = supabase as unknown as SupabaseClient

export const DOCUMENT_BUILDER_SHEETS_TABLE = 'document_builder_sheets'
const SHEET_SELECT = 'id, builder_key, project_id, draft, published, published_sheet, revision, usual_revision, published_at, updated_at'

/** A job's sheet as the table keeps it. */
export type SheetRecord = {
  id: string
  projectId: string
  /** The job's own part being set up. */
  draft: JobSheet
  /** The job's own part as published. Null until the first publish. */
  published: JobSheet | null
  /** The whole page as it read when published, as stored. `parseResolvedSheet` reads it. */
  publishedSheet: unknown
  revision: number
  /** The usual's revision this sheet went out on. */
  usualRevision: number | null
  publishedAt: string | null
}

export function sheetRecordFromRow(row: unknown): SheetRecord | null {
  if (typeof row !== 'object' || row === null) return null
  const r = row as Record<string, unknown>
  const draft = parseJobSheet(r.draft)
  if (typeof r.id !== 'string' || typeof r.project_id !== 'string' || !draft || typeof r.revision !== 'number') return null
  return {
    id: r.id,
    projectId: r.project_id,
    draft,
    published: parseJobSheet(r.published),
    publishedSheet: r.published_sheet ?? null,
    revision: r.revision,
    usualRevision: typeof r.usual_revision === 'number' ? r.usual_revision : null,
    publishedAt: typeof r.published_at === 'string' ? r.published_at : null,
  }
}

/** A job the company runs as the GC, with what its sheet's blanks start from. */
export type GcJob = { projectId: string; name: string; place: string; ownerName: string; stage: string }

type ProjectRow = { id: string; name: string | null; address: string | null; customer_id: string | null }
type GcProjectRow = { project_id: string; stage: string | null; customer_role: string | null; property_owner_customer_id: string | null }

/**
 * The jobs the company runs as the GC, by name. A job's owner is its property owner when one is named, else its
 * customer when the customer is the owner. With neither the name is left blank for a person to type.
 */
export async function readGcJobs(): Promise<GcJob[]> {
  const gc = (await withSupabaseRetry<unknown[]>(() => db.from('gc_projects').select('project_id, stage, customer_role, property_owner_customer_id'), 'read the jobs')) as GcProjectRow[] | null
  const rows = gc ?? []
  if (rows.length === 0) return []
  const projects = ((await withSupabaseRetry<unknown[]>(() => db.from('projects').select('id, name, address, customer_id').in('id', rows.map((r) => r.project_id)), 'read the jobs')) ?? []) as ProjectRow[]
  const byId = new Map(projects.map((p) => [p.id, p]))
  const ownerIdOf = (r: GcProjectRow) => r.property_owner_customer_id ?? (r.customer_role === 'owner' ? (byId.get(r.project_id)?.customer_id ?? null) : null)
  const ownerIds = [...new Set(rows.map(ownerIdOf).filter((id): id is string => id != null))]
  const owners = ownerIds.length === 0 ? [] : (((await withSupabaseRetry<unknown[]>(() => db.from('customers').select('id, name').in('id', ownerIds), 'read the jobs')) ?? []) as Array<{ id: string; name: string | null }>)
  const ownerName = new Map(owners.map((o) => [o.id, o.name ?? '']))
  return rows
    .map((r): GcJob => {
      const p = byId.get(r.project_id)
      const owner = ownerIdOf(r)
      return { projectId: r.project_id, name: (p?.name ?? '').trim(), place: (p?.address ?? '').trim(), ownerName: (owner ? (ownerName.get(owner) ?? '') : '').trim(), stage: r.stage ?? '' }
    })
    .filter((j) => j.name !== '')
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Every job's sheet of one builder, by job. Throws with the reason, for the retry panel. */
export async function readBuilderSheets(builderKey: string): Promise<Map<string, SheetRecord>> {
  const rows = (await withSupabaseRetry<unknown[]>(() => db.from(DOCUMENT_BUILDER_SHEETS_TABLE).select(SHEET_SELECT).eq('builder_key', builderKey), 'read the sheets')) ?? []
  const out = new Map<string, SheetRecord>()
  for (const row of rows) {
    const rec = sheetRecordFromRow(row)
    if (rec) out.set(rec.projectId, rec)
  }
  return out
}

const fail = <T>(e: unknown, fallback: string): Landed<T> => ({ ok: false, error: formatErrorMessage(e, fallback) })

async function oneBuilder(run: () => PromiseLike<{ data: unknown; error: unknown }>, fallback: string, stale: string): Promise<Landed<BuilderRecord>> {
  try {
    const { data, error } = await run()
    if (error) return fail(error, fallback)
    const rec = builderRecordFromRow(Array.isArray(data) ? data[0] : data)
    return rec ? { ok: true, value: rec } : { ok: false, error: stale }
  } catch (e) {
    return fail(e, fallback)
  }
}

async function oneSheet(run: () => PromiseLike<{ data: unknown; error: unknown }>, fallback: string, stale: string): Promise<Landed<SheetRecord>> {
  try {
    const { data, error } = await run()
    if (error) return fail(error, fallback)
    const rec = sheetRecordFromRow(Array.isArray(data) ? data[0] : data)
    return rec ? { ok: true, value: rec } : { ok: false, error: stale }
  } catch (e) {
    return fail(e, fallback)
  }
}

const SOMEONE_ELSE = 'Someone published this since you opened it. Read it again, then publish.'
const GONE = 'This is no longer there. Read the page again.'

/** A builder's draft saved. The published copy and its revision stand. */
export function saveBuilderDraft(key: string, draft: unknown): Promise<Landed<BuilderRecord>> {
  return oneBuilder(() => db.from(DOCUMENT_BUILDERS_TABLE).update({ draft }).eq('key', key).select(DOCUMENT_BUILDER_SELECT), 'The draft did not save.', GONE)
}

/** A builder published: the draft becomes the copy everyone outside sees, on the next revision. */
export function publishBuilder(key: string, fromRevision: number, contents: unknown): Promise<Landed<BuilderRecord>> {
  return oneBuilder(
    () => db.from(DOCUMENT_BUILDERS_TABLE).update({ draft: contents, published: contents, revision: fromRevision + 1 }).eq('key', key).eq('revision', fromRevision).select(DOCUMENT_BUILDER_SELECT),
    'The publish did not go through.',
    SOMEONE_ELSE,
  )
}

/** The read mark put on the published revision: who read it, typed, and the day. */
export function markBuilderRead(key: string, revision: number, byName: string, on: string): Promise<Landed<BuilderRecord>> {
  return oneBuilder(
    () => db.from(DOCUMENT_BUILDERS_TABLE).update({ read_revision: revision, read_by_name: byName.trim(), read_on: on }).eq('key', key).eq('revision', revision).select(DOCUMENT_BUILDER_SELECT),
    'The mark did not save.',
    SOMEONE_ELSE,
  )
}

/** A job's sheet started: its row is made, as a draft with nothing published. */
export function startSheet(builderKey: string, projectId: string, draft: JobSheet): Promise<Landed<SheetRecord>> {
  return oneSheet(() => db.from(DOCUMENT_BUILDER_SHEETS_TABLE).insert({ builder_key: builderKey, project_id: projectId, draft }).select(SHEET_SELECT), 'The sheet did not start.', GONE)
}

/** A job's sheet's draft saved. */
export function saveSheetDraft(id: string, draft: JobSheet): Promise<Landed<SheetRecord>> {
  return oneSheet(() => db.from(DOCUMENT_BUILDER_SHEETS_TABLE).update({ draft }).eq('id', id).select(SHEET_SELECT), 'The draft did not save.', GONE)
}

/** A job's sheet published on the usual's published revision: its own part, and the whole page as it now reads. */
export function publishSheet(id: string, fromRevision: number, own: JobSheet, page: ResolvedSheet, usualRevision: number): Promise<Landed<SheetRecord>> {
  return oneSheet(
    () =>
      db
        .from(DOCUMENT_BUILDER_SHEETS_TABLE)
        .update({ draft: own, published: own, published_sheet: page, revision: fromRevision + 1, usual_revision: usualRevision })
        .eq('id', id)
        .eq('revision', fromRevision)
        .select(SHEET_SELECT),
    'The publish did not go through.',
    SOMEONE_ELSE,
  )
}

