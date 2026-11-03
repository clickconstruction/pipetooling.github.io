/**
 * The index pass (punch list #240, PR 1, v2.6319): list the files a pass should look at, decide which need indexing
 * (`indexPlan`), and index them one at a time inside one request's budget, each file walked up to its home, its text
 * read by `fileText.ts`, its row upserted into `file_index`. One implementation under `drive-link`'s `index` and
 * `index_job`, the `file-index-sweep` cron and the dev seat's backfill verbs.
 *
 * Why one file at a time with a budget: an edge function has about two seconds of CPU per request and a 40-page PDF
 * can spend it. A row is stamped `reading` before its text is read, so a request the platform stops mid-read leaves a
 * trace the next pass reads as held (`slow`) instead of reading the same file again forever; every answer carries
 * `remaining`, so the caller loops.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl } from './driveUpload.ts'
import { driveGet, jobFolder } from './driveJobFolder.ts'
import type { JobRef } from './driveLink.ts'
import { driveFolderMeta, jobsRootFolderId } from './driveSettings.ts'
import { fileTextWithin } from './fileText.ts'
import { folderHomes, folderMetaReader, type HomeAt } from './fileHomes.ts'
import {
  DRIVE_FOLDER_KIND,
  INDEX_BUDGET_MS,
  INDEX_READ_MS,
  budgetAllows,
  indexPlan,
  indexRowOf,
  newPassSpend,
  passCursor,
  passMayTake,
  readingRowOf,
  settledWhy,
  walkUp,
  type DriveFileMeta,
  type HeldFile,
  type IndexPassResult,
  type KnownRow,
  type PassSpend,
} from './fileIndexKernel.ts'

/** The fields every list of files asks Drive for. */
export const FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,parents,webViewLink'

/** What one request's passes share: the root, the homes and the folder cache, read once. */
export interface IndexContext {
  admin: SupabaseClient
  google: string
  rootId: string
  driveId: string | null
  homes: Map<string, HomeAt>
  metaOf: (id: string) => Promise<{ name: string; parent: string | null }>
  /** What this request has spent parsing PDFs, across every step that reads in it. */
  spend: PassSpend
}

/** The context, or `noRoot` when the jobs root is not set anywhere. */
export async function indexContext(admin: SupabaseClient, google: string): Promise<IndexContext | { noRoot: true }> {
  const rootId = await jobsRootFolderId(admin)
  if (!rootId) return { noRoot: true }
  const root = await driveFolderMeta(google, rootId)
  // The root's drive scopes every listing; without it a sweep would list every drive the account sees and move its
  // stamp on that, so a root Drive does not answer for is this request's failure, never a wider listing.
  if (root.status < 200 || root.status >= 300) throw new Error(`Drive answered ${root.status} for the jobs root folder.`)
  const homes = await folderHomes(admin)
  return { admin, google, rootId, driveId: root.body.driveId ?? null, homes, metaOf: folderMetaReader(google), spend: newPassSpend() }
}

/** The rows the table holds for these ids, in chunks the API takes. */
export async function knownRows(admin: SupabaseClient, ids: readonly string[]): Promise<Map<string, KnownRow>> {
  const known = new Map<string, KnownRow>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from('file_index').select('drive_file_id, modified_at, text_why, text_source, checked_at').in('drive_file_id', ids.slice(i, i + 200))
    for (const r of (data ?? []) as KnownRow[]) known.set(r.drive_file_id, r)
  }
  return known
}

/** One file's meta by its id, as the lists give it, or null when Drive does not answer it. */
export async function fileMeta(google: string, id: string): Promise<DriveFileMeta | null> {
  try {
    return await driveGet<DriveFileMeta>(google, `${DRIVE}/files/${encodeURIComponent(id)}?fields=${FILE_FIELDS}&supportsAllDrives=true`)
  } catch {
    return null
  }
}

/** A folder's files and its subfolders' too, to the depth and cap, folders left out of the answer. */
export async function filesUnder(google: string, folderId: string, out: DriveFileMeta[], opts: { depth?: number; maxDepth?: number; max?: number; seen?: Set<string> } = {}): Promise<void> {
  const depth = opts.depth ?? 0
  const maxDepth = opts.maxDepth ?? 3
  const max = opts.max ?? 2000
  const seen = opts.seen ?? new Set<string>()
  if (seen.has(folderId)) return
  seen.add(folderId)
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const page = await driveGet<{ files?: DriveFileMeta[]; nextPageToken?: string }>(
      google,
      `${DRIVE}/files?q=${q}&pageSize=200&orderBy=modifiedTime desc&fields=nextPageToken,files(${FILE_FIELDS})&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    )
    for (const f of page.files ?? []) {
      if (out.length >= max) return
      if (f.mimeType === DRIVE_FOLDER_KIND) {
        if (depth + 1 < maxDepth) await filesUnder(google, f.id, out, { depth: depth + 1, maxDepth, max, seen })
        continue
      }
      out.push(f)
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken && out.length < max)
}

/**
 * Every file a job's index pass looks at: the job's folder tree three levels deep, and for a Pipeline job its plans and
 * pictures folders by their links when an older job keeps them elsewhere. Null when the job has no Drive folder.
 */
export async function jobFilesToIndex(admin: SupabaseClient, google: string, job: JobRef): Promise<DriveFileMeta[] | null> {
  const folder = await jobFolder(admin, google, job)
  if (!folder) return null
  const roots = [folder.folderId]
  if ('jobs_ledger_id' in job) {
    const { data } = await admin.from('jobs_ledger').select('job_plans_link, job_pictures_link').eq('id', job.jobs_ledger_id).maybeSingle()
    const row = (data ?? {}) as { job_plans_link?: string | null; job_pictures_link?: string | null }
    for (const link of [row.job_plans_link, row.job_pictures_link]) {
      const id = driveFolderIdFromUrl(link ?? null)
      if (id && !roots.includes(id)) roots.push(id)
    }
  }
  const listed: DriveFileMeta[] = []
  const seen = new Set<string>()
  for (const id of roots) await filesUnder(google, id, listed, { seen })
  return listed
}

/** Files changed in the Shared Drive since a time, oldest first, folders left out, up to the cap. */
export async function filesChangedSince(ctx: IndexContext, sinceIso: string, max: number, inclusive = false): Promise<{ files: DriveFileMeta[]; more: boolean }> {
  const q = encodeURIComponent(`modifiedTime ${inclusive ? '>=' : '>'} '${sinceIso}' and trashed = false and mimeType != '${DRIVE_FOLDER_KIND}'`)
  const scope = ctx.driveId ? `&corpora=drive&driveId=${encodeURIComponent(ctx.driveId)}` : '&corpora=allDrives'
  const files: DriveFileMeta[] = []
  let pageToken = ''
  do {
    const page = await driveGet<{ files?: DriveFileMeta[]; nextPageToken?: string }>(
      ctx.google,
      `${DRIVE}/files?q=${q}${scope}&pageSize=${Math.min(200, max)}&orderBy=modifiedTime&fields=nextPageToken,files(${FILE_FIELDS})&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    )
    for (const f of page.files ?? []) {
      if (files.length >= max) return { files, more: true }
      files.push(f)
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken && files.length < max)
  // A page that fills the cap exactly with a next page behind it is more too, else the stamp would jump past that page.
  return { files, more: Boolean(pageToken) }
}

/** One file into the table: walked up to its home, stamped `reading`, its text read, the row written. */
export async function indexOneFile(ctx: IndexContext, f: DriveFileMeta): Promise<{ ok: true; held: HeldFile | null } | { ok: false; error: string }> {
  let walk: Awaited<ReturnType<typeof walkUp>>
  try {
    walk = await walkUp(f.parents?.[0] ?? null, ctx.homes, ctx.rootId, ctx.metaOf)
  } catch (e) {
    // A folder up the tree Drive would not show (a 404 the account cannot open): the row is written held as `error`
    // with no home, so the pass moves on and a retry takes it an hour later, instead of the same file failing first
    // on every call with no row to say so.
    const why = (e as { message?: string } | null)?.message ?? String(e)
    console.warn('file index walk failed', f.id, why)
    const { error } = await ctx.admin.from('file_index').upsert(indexRowOf(f, { home: null, via: null, names: [], path: '' }, { why: 'error' }, new Date()), { onConflict: 'drive_file_id' })
    if (error) return { ok: false, error: error.message }
    return { ok: true, held: { id: f.id, name: f.name, why: 'error' } }
  }
  const stamp = await ctx.admin.from('file_index').upsert(readingRowOf(f, walk, new Date()), { onConflict: 'drive_file_id' })
  if (stamp.error) return { ok: false, error: stamp.error.message }
  const read = await fileTextWithin(ctx.google, f, INDEX_READ_MS, { spend: ctx.spend })
  const row = indexRowOf(f, walk, read, new Date())
  const { error } = await ctx.admin.from('file_index').upsert(row, { onConflict: 'drive_file_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true, held: 'why' in read ? { id: f.id, name: f.name, why: read.why } : null }
}

/**
 * The pass over a list of files: the plan against the table, then one file at a time while the budget allows, the
 * rest counted as remaining. A row the database refused is held as `error` with the reason in the log.
 */
export async function indexFiles(ctx: IndexContext, listed: readonly DriveFileMeta[], opts: { retry?: boolean; max?: number; budgetMs?: number; startedMs?: number } = {}): Promise<IndexPassResult> {
  const known = await knownRows(ctx.admin, listed.map((f) => f.id))
  const plan = indexPlan(listed, known, { retry: opts.retry })
  const started = opts.startedMs ?? Date.now()
  const max = opts.max ?? plan.toIndex.length
  const held: HeldFile[] = []
  let indexed = 0
  let taken = 0
  const takenIds = new Set<string>()
  for (const f of plan.toIndex) {
    // The clock's budget, then what the request has spent parsing: the platform kills a request at about 2 s of CPU.
    if (taken >= max || !budgetAllows(started, Date.now(), opts.budgetMs ?? INDEX_BUDGET_MS) || !passMayTake(f, ctx.spend)) break
    taken += 1
    takenIds.add(f.id)
    const r = await indexOneFile(ctx, f)
    if (!r.ok) {
      console.warn('file index write failed', f.id, r.error)
      held.push({ id: f.id, name: f.name, why: 'error' })
      continue
    }
    indexed += 1
    if (r.held) held.push(r.held)
  }
  return { indexed, held, remaining: plan.toIndex.length - taken, planned: plan.toIndex.length, skipped: plan.skipped.length, cursorModified: passCursor(listed, new Set(plan.toIndex.map((f) => f.id)), takenIds) }
}

/** The held files a job's rows name, for a report: every row with no text and its reason, `reading` read as `slow`. */
export async function heldRowsFor(admin: SupabaseClient, ids: readonly string[]): Promise<HeldFile[]> {
  const out: HeldFile[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from('file_index').select('drive_file_id, name, text_why').in('drive_file_id', ids.slice(i, i + 200)).not('text_why', 'is', null)
    for (const r of (data ?? []) as { drive_file_id: string; name: string; text_why: KnownRow['text_why'] }[]) {
      const why = settledWhy(r.text_why)
      if (why) out.push({ id: r.drive_file_id, name: r.name, why })
    }
  }
  return out
}
