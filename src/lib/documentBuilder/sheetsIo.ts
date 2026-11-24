/**
 * The reads and writes of a filled builder (punch list #404, step 3): the standing sheet's draft and its publish, the
 * read mark, a job's sheet, and the jobs the company runs as the GC. A dev alone reads or writes any of it: row
 * security decides. Browser io, not pure; the rules are `sheet.ts` and `standing.ts`.
 *
 * Every save and every publish is guarded against a page that fell behind. A row has a number that goes up with
 * each change to its draft or its revision (`draft_no`, kept by the database). A write names the number this page
 * read, and lands on no row when the row moved on: a tab left open cannot write an old draft over a newer one, or
 * publish over a newer revision. The row is then read again, and the refusal carries it (`guardedWrite`). The database
 * keeps the other rules (a revision goes up one at a time, a job's sheet goes out only on the usual's published
 * revision).
 *
 * The tables are younger than the generated types, so the client is cast once here.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { MOVED_ON_PUBLISH, MOVED_ON_SAVE, WRITE_GONE, guardedWrite, type Landed } from './documentBuildersIo'
import { layOver, parseJobSheet, pruneJobSheet, usualHeldWords, type JobSheet, type ResolvedSheet, type SheetDef, type UsualPublishRow } from './sheet'
import { gcJobOver, sheetCounts, usualPlanFor, type GcJobOver, type SheetCounts } from './sheetScreen'
import { DOCUMENT_BUILDERS_TABLE, DOCUMENT_BUILDER_SELECT, builderRecordFromRow, sameContents, type BuilderRecord } from './standing'

const db = supabase as unknown as SupabaseClient

export const DOCUMENT_BUILDER_SHEETS_TABLE = 'document_builder_sheets'
const SHEET_SELECT = 'id, builder_key, project_id, draft, published, published_sheet, revision, usual_revision, draft_no, published_at, updated_at'

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
  /** The draft's number: up one with each change to the draft or the revision. A save or a publish names it. */
  draftNo: number
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
    draftNo: typeof r.draft_no === 'number' ? r.draft_no : 0,
    usualRevision: typeof r.usual_revision === 'number' ? r.usual_revision : null,
    publishedAt: typeof r.published_at === 'string' ? r.published_at : null,
  }
}

/**
 * A job the company runs as the GC, with what its sheet's blanks start from. `over` says it was lost or is closed.
 * `billingJobId` is the job it bills through, which is what a filed copy of its sheet is filed under.
 */
export type GcJob = { projectId: string; name: string; place: string; ownerName: string; stage: string; over: GcJobOver | null; billingJobId: string | null }

type ProjectRow = { id: string; name: string | null; address: string | null; customer_id: string | null }
type GcProjectRow = { project_id: string; stage: string | null; customer_role: string | null; property_owner_customer_id: string | null; lost_on: string | null; closed_on: string | null; billing_job_id: string | null }

/**
 * Every GC project by name, each with whether it is over. The screen lists the ones `listedJobs` keeps. A job's owner is its property owner when one is named, else its
 * customer when the customer is the owner. With neither the name is left blank for a person to type.
 */
export async function readGcJobs(): Promise<GcJob[]> {
  const gc = (await withSupabaseRetry<unknown[]>(() => db.from('gc_projects').select('project_id, stage, customer_role, property_owner_customer_id, lost_on, closed_on, billing_job_id'), 'read the jobs')) as GcProjectRow[] | null
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
      return { projectId: r.project_id, name: (p?.name ?? '').trim(), place: (p?.address ?? '').trim(), ownerName: (owner ? (ownerName.get(owner) ?? '') : '').trim(), stage: r.stage ?? '', over: gcJobOver({ stage: r.stage, lostOn: r.lost_on ?? null, closedOn: r.closed_on ?? null }), billingJobId: r.billing_job_id ?? null }
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

/** How many of a builder's listed jobs have a published sheet, for its row on the tab's list. Throws with the reason. */
export async function readSheetCounts(builderKey: string): Promise<SheetCounts> {
  const [jobs, sheets] = await Promise.all([readGcJobs(), readBuilderSheets(builderKey)])
  return sheetCounts(jobs, (projectId) => sheets.get(projectId)?.revision ?? 0)
}

const fail = <T>(e: unknown, fallback: string): Landed<T> => ({ ok: false, error: formatErrorMessage(e, fallback) })

const SOMEONE_ELSE = 'Someone published this since you opened it. Read it again, then publish.'

const builders = () => db.from(DOCUMENT_BUILDERS_TABLE)
const sheets = () => db.from(DOCUMENT_BUILDER_SHEETS_TABLE)
const oneBuilderAgain = (key: string) => () => builders().select(DOCUMENT_BUILDER_SELECT).eq('key', key)
const oneSheetAgain = (id: string) => () => sheets().select(SHEET_SELECT).eq('id', id)

/** One builder as it reads now. Throws with the reason. */
export async function readBuilder(key: string): Promise<BuilderRecord | null> {
  const rows = (await withSupabaseRetry<unknown[]>(oneBuilderAgain(key), 'read the builder')) ?? []
  return builderRecordFromRow(rows[0])
}

/** A builder's draft saved, naming the draft's number this page read. The published copy and its revision stand. */
export function saveBuilderDraft(key: string, draft: unknown, draftNo: number): Promise<Landed<BuilderRecord>> {
  return guardedWrite({
    write: () => builders().update({ draft }).eq('key', key).eq('draft_no', draftNo).select(DOCUMENT_BUILDER_SELECT),
    reread: oneBuilderAgain(key),
    parse: builderRecordFromRow,
    mine: (row) => sameContents(row.draft, draft),
    fallback: 'The draft did not save.',
    moved: MOVED_ON_SAVE,
  })
}

/** A builder published: the draft becomes the copy everyone outside sees, on the next revision. */
export function publishBuilder(key: string, fromRevision: number, contents: unknown, draftNo: number): Promise<Landed<BuilderRecord>> {
  return guardedWrite({
    write: () => builders().update({ draft: contents, published: contents, revision: fromRevision + 1 }).eq('key', key).eq('revision', fromRevision).eq('draft_no', draftNo).select(DOCUMENT_BUILDER_SELECT),
    reread: oneBuilderAgain(key),
    parse: builderRecordFromRow,
    mine: (row) => row.revision === fromRevision + 1 && sameContents(row.published, contents) && sameContents(row.draft, contents),
    fallback: 'The publish did not go through.',
    moved: MOVED_ON_PUBLISH,
  })
}

/** The read mark put on the published revision: who read it, typed, and the day. */
export async function markBuilderRead(key: string, revision: number, byName: string, on: string): Promise<Landed<BuilderRecord>> {
  try {
    const { data, error } = await builders().update({ read_revision: revision, read_by_name: byName.trim(), read_on: on }).eq('key', key).eq('revision', revision).select(DOCUMENT_BUILDER_SELECT)
    if (error) return fail(error, 'The mark did not save.')
    const rec = builderRecordFromRow(Array.isArray(data) ? data[0] : data)
    return rec ? { ok: true, value: rec } : { ok: false, error: SOMEONE_ELSE }
  } catch (e) {
    return fail(e, 'The mark did not save.')
  }
}

/**
 * A job's sheet started: its row is made, as a draft with nothing published. One job has one sheet. When someone
 * else started it a moment ago, the row they made is read: the same draft is this start landing, and another draft
 * is a sheet that moved on.
 */
export async function startSheet(builderKey: string, projectId: string, draft: JobSheet): Promise<Landed<SheetRecord>> {
  const fallback = 'The sheet did not start.'
  try {
    const { data, error } = await sheets().insert({ builder_key: builderKey, project_id: projectId, draft }).select(SHEET_SELECT)
    if (!error) {
      const rec = sheetRecordFromRow(Array.isArray(data) ? data[0] : data)
      return rec ? { ok: true, value: rec } : { ok: false, error: WRITE_GONE }
    }
    // 23505: the one sheet a job has is there already.
    if ((error as { code?: unknown }).code !== '23505') return fail(error, fallback)
    const again = await sheets().select(SHEET_SELECT).eq('builder_key', builderKey).eq('project_id', projectId)
    if (again.error) return fail(again.error, fallback)
    const now = sheetRecordFromRow(Array.isArray(again.data) ? again.data[0] : again.data)
    if (!now) return fail(error, fallback)
    return sameContents(now.draft, draft) ? { ok: true, value: now } : { ok: false, error: MOVED_ON_SAVE, movedOn: now }
  } catch (e) {
    return fail(e, fallback)
  }
}

/** A job's sheet's draft saved, naming the draft's number this page read. */
export function saveSheetDraft(id: string, draft: JobSheet, draftNo: number): Promise<Landed<SheetRecord>> {
  return guardedWrite({
    write: () => sheets().update({ draft }).eq('id', id).eq('draft_no', draftNo).select(SHEET_SELECT),
    reread: oneSheetAgain(id),
    parse: sheetRecordFromRow,
    mine: (row) => sameContents(row.draft, draft),
    fallback: 'The draft did not save.',
    moved: MOVED_ON_SAVE,
  })
}

/** A job's sheet published on the usual's published revision: its own part, and the whole page as it now reads. */
export function publishSheet(id: string, fromRevision: number, own: JobSheet, page: ResolvedSheet, usualRevision: number, draftNo: number): Promise<Landed<SheetRecord>> {
  return guardedWrite({
    write: () =>
      sheets()
        .update({ draft: own, published: own, published_sheet: page, revision: fromRevision + 1, usual_revision: usualRevision })
        .eq('id', id)
        .eq('revision', fromRevision)
        .eq('draft_no', draftNo)
        .select(SHEET_SELECT),
    reread: oneSheetAgain(id),
    parse: sheetRecordFromRow,
    mine: (row) => row.revision === fromRevision + 1 && row.usualRevision === usualRevision && sameContents(row.published, own) && sameContents(row.publishedSheet, page),
    fallback: 'The publish did not go through.',
    moved: MOVED_ON_PUBLISH,
  })
}

/** How the usual's publish to every job went. */
export type UsualToJobs = {
  /** Where the usual went and what was held, from each job's sheet as it was read for this publish. */
  plan: UsualPublishRow[]
  /** How many jobs it was published to. */
  done: number
  /** The jobs it was to go to and did not reach, each with the reason. */
  failed: Array<{ name: string; why: string }>
  /** The jobs it held, each with the reason in words. */
  held: Array<{ name: string; why: string }>
  /** Every job's sheet as it now stands: as read for the publish, and the ones that went as published. */
  sheets: Map<string, SheetRecord>
}

/** What the page holds for a job beyond what the database does: words typed and not saved, or a choice not yet made. */
export type HeldHere = (projectId: string) => 'own-changes' | 'moved' | null

/**
 * Every job's sheet as it stands at this moment, for the usual's publish. It is read before anything is published:
 * the plan made from it is held against what the press said, so the press does what its count says or does nothing.
 */
export async function readSheetsNow(io: { readBuilderSheets: typeof readBuilderSheets }, builderKey: string): Promise<Landed<Map<string, SheetRecord>>> {
  try {
    return { ok: true, value: new Map(await io.readBuilderSheets(builderKey)) }
  } catch (e) {
    return fail(e, "The jobs' sheets did not read.")
  }
}

/** Where the usual goes, from the jobs' sheets as just read and what the page holds beyond them. */
export function usualPlanOfSheets(jobs: ReadonlyArray<{ projectId: string; name: string; over?: GcJobOver | null }>, sheets: ReadonlyMap<string, SheetRecord>, heldHere?: HeldHere): UsualPublishRow[] {
  const states = new Map([...sheets].map(([projectId, s]) => [projectId, { id: s.id, own: s.draft, published: s.published, revision: s.revision, usualRevision: s.usualRevision }]))
  return usualPlanFor(jobs, states, heldHere)
}

/**
 * The usual, just published, sent on to every job that is ready. Each job's sheet is the one read for this publish
 * (`readSheetsNow`), never the page's copy from when it was loaded: a draft a teammate saved since makes the job one
 * with changes of its own waiting, which is held, and a sheet a teammate published since goes out from that newer
 * copy. Each job's publish names the draft's number just read, so a change that lands between the read and the write
 * is refused and named, and the teammate's draft stands.
 *
 * It follows the batch rule: it goes to every job that is ready, holds the rest with the reason, and keeps going past
 * one that fails. The write is handed in, so a screen's smoke can hand in its own.
 */
export async function publishUsualToJobs(
  io: { publishSheet: typeof publishSheet },
  ask: {
    /** The usual as it was just published, and the revision it went out as. */
    def: SheetDef
    usualRevision: number
    jobs: ReadonlyArray<{ projectId: string; name: string }>
    /** The jobs' sheets as read for this publish. */
    sheets: ReadonlyMap<string, SheetRecord>
    heldHere?: HeldHere
  },
): Promise<UsualToJobs> {
  const sheets = new Map(ask.sheets)
  const plan = usualPlanOfSheets(ask.jobs, sheets, ask.heldHere)
  const failed: Array<{ name: string; why: string }> = []
  let done = 0
  for (const row of plan) {
    const s = sheets.get(row.id)
    if (!row.gets || !s?.published) continue
    const own = pruneJobSheet(ask.def, s.published)
    const out = await io.publishSheet(s.id, s.revision, own, layOver(ask.def, own), ask.usualRevision, s.draftNo)
    if (out.ok) {
      done += 1
      sheets.set(row.id, out.value)
    } else {
      failed.push({ name: row.name, why: out.error })
      // A sheet that moved on between the read and the write is the page's to show as it now reads.
      if (out.movedOn) sheets.set(row.id, out.movedOn)
    }
  }
  const held = plan.flatMap((row) => (row.gets ? [] : [{ name: row.name, why: usualHeldWords(row.why) }]))
  return { plan, done, failed, held, sheets }
}
