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
import { driveGet, driveMedia, jobFolder } from './driveJobFolder.ts'
import type { JobRef } from './driveLink.ts'
import { driveFolderMeta, jobsRootFolderId } from './driveSettings.ts'
import { fileTextWithin } from './fileText.ts'
import { folderHomes, folderMetaReader, type HomeAt } from './fileHomes.ts'
import { WALK_MAX } from './fileIndexKernel.ts'
import { ocrSetup, ocrText, type OcrSetup } from './ocr.ts'
import { OCR_KIND_NOTE, OCR_MAX_BYTES, OCR_PER_PASS_MAX, ocrMimeOf, ocrQueueFilter, ocrTakes } from './ocrKernel.ts'
import { embeddingsSetup, embedTexts, type EmbeddingsSetup } from './embeddings.ts'
import { EMBED_CPU_MS_PER_CHUNK, chunkText, chunksCut, chunksCutNote, embedDue, textHasChunks } from './embeddingsKernel.ts'
import {
  DRIVE_FOLDER_KIND,
  INDEX_BUDGET_MS,
  INDEX_READ_MS,
  PASS_READ_BUDGET_MS,
  RETAKE_WHYS,
  RETRY_HOLD_MS,
  budgetAllows,
  indexPlan,
  indexRowOf,
  newPassSpend,
  ocrRefusedColumns,
  passCursor,
  passMayTake,
  readColumns,
  readingRowOf,
  sameInstant,
  settledWhy,
  walkUp,
  type DriveFileMeta,
  type FileTextRead,
  type OcrTry,
  type HeldFile,
  type IndexPassResult,
  type KnownRow,
  type PassSpend,
} from './fileIndexKernel.ts'

/** The fields every list of files asks Drive for. */
export const FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,parents,webViewLink,trashed'

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
  /** OCR (PR 3): the processor and its token when the secret is set, else null and a scan stays `scan`. */
  ocr: OcrSetup | null
  /** Meaning (PR 4): the embeddings endpoint when the key is set, else null and the words alone answer. */
  embed: EmbeddingsSetup | null
}

/** The context, or `noRoot` when the jobs root is not set anywhere. `saJson` is the service account, for OCR. */
export async function indexContext(admin: SupabaseClient, google: string, saJson: string | null = null): Promise<IndexContext | { noRoot: true }> {
  const rootId = await jobsRootFolderId(admin)
  if (!rootId) return { noRoot: true }
  const root = await driveFolderMeta(google, rootId)
  // The root's drive scopes every listing; without it a sweep would list every drive the account sees and move its
  // stamp on that, so a root Drive does not answer for is this request's failure, never a wider listing.
  if (root.status < 200 || root.status >= 300) throw new Error(`Drive answered ${root.status} for the jobs root folder.`)
  const homes = await folderHomes(admin)
  return { admin, google, rootId, driveId: root.body.driveId ?? null, homes, metaOf: folderMetaReader(google), spend: newPassSpend(), ocr: ocrSetup(saJson), embed: embeddingsSetup() }
}

/** The rows the table holds for these ids, in chunks the API takes. */
export async function knownRows(admin: SupabaseClient, ids: readonly string[]): Promise<Map<string, KnownRow>> {
  const known = new Map<string, KnownRow>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from('file_index').select('drive_file_id, modified_at, text_why, text_source, checked_at, ocr_tried_at').in('drive_file_id', ids.slice(i, i + 200))
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
  // As deep as a walk climbs: a plan export sat nine folders down, and a bid's folder outside the Shared Drive has no other way in (v2.6403).
  const maxDepth = opts.maxDepth ?? WALK_MAX
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

/** A scan's bytes through OCR (PR 3): the text as an `ocr` read, or the provider's reason. */
async function ocrScan(ctx: IndexContext, f: DriveFileMeta, mime: string): Promise<{ read: FileTextRead | null; note: string | null }> {
  const size = f.size == null || f.size === '' ? null : Number(f.size)
  if (size != null && size > OCR_MAX_BYTES) return { read: null, note: `The file is ${size} bytes; Document AI takes up to ${OCR_MAX_BYTES} inline.` }
  let bytes: Uint8Array
  try {
    const res = await driveMedia(ctx.google, f.id)
    if (!res.ok) return { read: null, note: `Drive answered ${res.status} for the bytes.` }
    bytes = new Uint8Array(await res.arrayBuffer())
  } catch (e) {
    // A reset mid-download is this scan's refusal for the day, never the whole pass's.
    return { read: null, note: `The bytes did not come down from Drive: ${(e as { message?: string } | null)?.message ?? String(e)}` }
  }
  const answer = await ocrText(ctx.ocr!, bytes, mime, { spend: ctx.spend })
  if (!answer.ok) return { read: null, note: answer.error }
  return { read: { text: answer.text, source: 'ocr', pages: answer.pages }, note: null }
}

/**
 * One file into the table: walked up to its home, stamped `reading`, its text read (a scan through OCR when set up and
 * the pass allows it; past the pass's cap the scan stays due for the next call), the row written. `ocrCalled` says
 * whether the provider was asked, so the pass counts its calls.
 */
export async function indexOneFile(ctx: IndexContext, f: DriveFileMeta, opts: { ocr?: boolean } = {}): Promise<{ ok: true; held: HeldFile | null; ocrCalled: boolean } | { ok: false; error: string }> {
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
    return { ok: true, held: { id: f.id, name: f.name, why: 'error' }, ocrCalled: false }
  }
  const stamp = await ctx.admin.from('file_index').upsert(readingRowOf(f, walk, new Date()), { onConflict: 'drive_file_id' })
  if (stamp.error) return { ok: false, error: stamp.error.message }
  let read = await fileTextWithin(ctx.google, f, INDEX_READ_MS, { spend: ctx.spend })
  let ocr: OcrTry = { tried: false }
  let ocrCalled = false
  if ('why' in read && read.why === 'scan' && ctx.ocr && opts.ocr !== false) {
    const mime = ocrMimeOf(f)
    if (mime) {
      ocrCalled = ocrTakes(f)
      const r = await ocrScan(ctx, f, mime)
      ocr = { tried: true, note: r.note }
      if (r.read) read = r.read
    } else {
      // A kind Document AI does not read (HEIC from a phone, SVG): stamped with the reason, and never due again.
      ocr = { tried: true, note: OCR_KIND_NOTE }
    }
  }
  const row = indexRowOf(f, walk, read, new Date(), ocr)
  const { error } = await ctx.admin.from('file_index').upsert(row, { onConflict: 'drive_file_id' })
  if (error) return { ok: false, error: error.message }
  await settleChunks(ctx, row.drive_file_id, row.text, row.indexed_at)
  return { ok: true, held: 'why' in read ? { id: f.id, name: f.name, why: read.why } : null, ocrCalled }
}

/**
 * After a row's text is written: embedded when meaning is set up and the text has words. A row that lost its words (a
 * revised file read as slow, big, error or scan, or one emptied to whitespace, v2.6491) loses its chunks too, whether
 * or not meaning is set up: stale chunks would find it by wording it no longer has and show that wording as its line.
 */
async function settleChunks(ctx: IndexContext, driveFileId: string, text: string | null, indexedAt: string): Promise<void> {
  if (text && ctx.embed) await embedRow(ctx, driveFileId, text, indexedAt)
  else if (!textHasChunks(text)) await ctx.admin.from('file_index_chunks').delete().eq('drive_file_id', driveFileId)
}

/** The note a row keeps when its embedding was passed over because the row was indexed again meanwhile. */
export const EMBED_STALE_NOTE = 'The file was indexed again while its chunks were made; the next pass takes its new text.'

/**
 * A row's text into chunks with vectors (PR 4): the old chunks go, the new ones land, the row keeps `embedded_at`; a
 * refusal keeps `embed_tried_at` and the provider's reason, and the row is due again a day later. Never throws.
 *
 * `indexedAt` is the stamp of the row whose text this is, and every stamp here lands only while the row still carries
 * it (v2.6491): the provider takes up to twenty seconds, and a press that indexes the file meanwhile writes new text
 * and new chunks. Before the fence, the old text's chunks landed over the new ones and the stamp called the row
 * current for good. Now a stamp that finds the row gone on is not written; the chunks this call put in go (by this
 * call's own stamp, so a newer pass's chunks stay), and the row is left due, so the sweep embeds the text it holds now.
 */
export async function embedRow(ctx: IndexContext, driveFileId: string, text: string, indexedAt: string): Promise<{ ok: true; chunks: number } | { ok: false; error: string }> {
  if (!ctx.embed) return { ok: false, error: 'Search by meaning is not set up.' }
  const now = new Date().toISOString()
  const stamp = async (patch: Record<string, unknown>): Promise<{ landed: boolean; error: string | null }> => {
    const r = await ctx.admin.from('file_index').update(patch).eq('drive_file_id', driveFileId).eq('indexed_at', indexedAt).select('drive_file_id')
    return { landed: !r.error && ((r.data ?? []) as unknown[]).length > 0, error: r.error?.message ?? null }
  }
  const stale = async (): Promise<{ ok: false; error: string }> => {
    await ctx.admin.from('file_index_chunks').delete().eq('drive_file_id', driveFileId).eq('embedded_at', now)
    await ctx.admin.from('file_index').update({ embedded_at: null }).eq('drive_file_id', driveFileId)
    return { ok: false, error: EMBED_STALE_NOTE }
  }
  const chunks = chunkText(text)
  if (chunks.length === 0) {
    // A text with no words keeps no chunks: the old ones would find it by wording it no longer has.
    const gone = await ctx.admin.from('file_index_chunks').delete().eq('drive_file_id', driveFileId)
    if (gone.error) {
      await stamp({ embed_tried_at: now, embed_note: gone.error.message.slice(0, 1000) })
      return { ok: false, error: gone.error.message }
    }
    const s = await stamp({ embedded_at: now, embed_tried_at: now, embed_note: null })
    if (s.error) return { ok: false, error: s.error }
    if (!s.landed) return stale()
    return { ok: true, chunks: 0 }
  }
  const answer = await embedTexts(ctx.embed, chunks.map((c) => c.text), 'RETRIEVAL_DOCUMENT')
  if (!answer.ok) {
    await stamp({ embed_tried_at: now, embed_note: answer.error.slice(0, 1000) })
    return answer
  }
  const rows = chunks.map((c, i) => ({ drive_file_id: driveFileId, chunk_no: c.chunk_no, text: c.text, embedding: answer.vectors[i], embedded_at: now }))
  // Reading the vectors and writing them back is CPU the clock around a parse never sees, so it is charged by the chunk.
  ctx.spend.ms += chunks.length * EMBED_CPU_MS_PER_CHUNK
  const gone = await ctx.admin.from('file_index_chunks').delete().eq('drive_file_id', driveFileId)
  if (gone.error) {
    await stamp({ embed_tried_at: now, embed_note: gone.error.message.slice(0, 1000) })
    return { ok: false, error: gone.error.message }
  }
  const put = await ctx.admin.from('file_index_chunks').insert(rows)
  if (put.error) {
    await stamp({ embed_tried_at: now, embed_note: put.error.message.slice(0, 1000) })
    return { ok: false, error: put.error.message }
  }
  const s = await stamp({ embedded_at: now, embed_tried_at: now, embed_note: chunksCut(text, chunks) ? chunksCutNote(chunks.length) : null })
  if (s.error) return { ok: false, error: s.error }
  if (!s.landed) return stale()
  return { ok: true, chunks: rows.length }
}

/** A row of the embedding pass's queue, as `file_index_embed_due` answers it. */
interface EmbedQueueRow {
  drive_file_id: string
  name: string
  text: string
  indexed_at: string
  embedded_at: string | null
  embed_tried_at: string | null
}

/**
 * The embedding pass (PR 4): rows with text whose chunks are missing or older than the text (`embedded_at` null, or
 * before `indexed_at`), due now, inside the budget. No Drive read: the text is on the row. The queue is the RPC
 * `file_index_embed_due` (migration 20261104160000, v2.6491), the one place the catch-up rule the partial index holds
 * can be asked, since PostgREST cannot compare two columns; a queue the database refuses is logged and the pass does
 * nothing this run.
 */
export async function embedPass(ctx: IndexContext, n: number, opts: { startedMs?: number; budgetMs?: number } = {}): Promise<{ tried: number; embedded: number; chunks: number; refused: { id: string; name: string; error: string }[] }> {
  const out = { tried: 0, embedded: 0, chunks: 0, refused: [] as { id: string; name: string; error: string }[] }
  if (!ctx.embed || n <= 0) return out
  const now = new Date()
  const { data, error } = await ctx.admin.rpc('file_index_embed_due', { max_rows: n * 3 })
  if (error) {
    console.warn('file index embed queue failed', error.message)
    return out
  }
  const started = opts.startedMs ?? Date.now()
  for (const r of (data ?? []) as EmbedQueueRow[]) {
    if (out.tried >= n || !budgetAllows(started, Date.now(), opts.budgetMs ?? INDEX_BUDGET_MS) || ctx.spend.ms >= PASS_READ_BUDGET_MS) break
    if (!embedDue(r, now)) continue
    out.tried += 1
    const e = await embedRow(ctx, r.drive_file_id, r.text, r.indexed_at)
    if (e.ok) {
      out.embedded += 1
      out.chunks += e.chunks
    } else out.refused.push({ id: r.drive_file_id, name: r.name, error: e.error })
  }
  return out
}

/**
 * The pass over a list of files: the plan against the table, then one file at a time while the budget allows, the
 * rest counted as remaining. A row the database refused is held as `error` with the reason in the log.
 */
export async function indexFiles(ctx: IndexContext, listed: readonly DriveFileMeta[], opts: { retry?: boolean; max?: number; budgetMs?: number; startedMs?: number } = {}): Promise<IndexPassResult> {
  const known = await knownRows(ctx.admin, listed.map((f) => f.id))
  const plan = indexPlan(listed, known, { retry: opts.retry, ocr: Boolean(ctx.ocr) })
  const started = opts.startedMs ?? Date.now()
  const max = opts.max ?? plan.toIndex.length
  const held: HeldFile[] = []
  let indexed = 0
  let taken = 0
  let ocrCalls = 0
  const takenIds = new Set<string>()
  for (const f of plan.toIndex) {
    // The clock's budget, then what the request has spent parsing: the platform kills a request at about 2 s of CPU.
    if (taken >= max || !budgetAllows(started, Date.now(), opts.budgetMs ?? INDEX_BUDGET_MS) || !passMayTake(f, ctx.spend)) break
    // Past the pass's OCR cap a scan due for OCR alone is left untaken (remaining, and the sweep's cursor stops at
    // it); a new or changed file is still taken, its scan written due for a later pass.
    const ocrAllowed = ocrCalls < OCR_PER_PASS_MAX
    if (plan.forOcr.has(f.id) && !ocrAllowed) continue
    taken += 1
    takenIds.add(f.id)
    const r = await indexOneFile(ctx, f, { ocr: ocrAllowed })
    if (!r.ok) {
      console.warn('file index write failed', f.id, r.error)
      held.push({ id: f.id, name: f.name, why: 'error' })
      continue
    }
    if (r.ocrCalled) ocrCalls += 1
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

/** A row of the OCR pass's queue: the scan, its file's time (a changed file is read whole) and its index stamp (the fence its patch carries). */
export interface OcrQueueRow {
  drive_file_id: string
  name: string
  modified_at: string | null
  indexed_at: string
}

/**
 * The scans due for OCR, oldest try first: never tried, or tried over a day ago; of a kind Document AI reads by the
 * row's mime or its name (`ocrQueueFilter`, the plan's own rule, v2.6491: a scanned PDF Drive lists as
 * `application/octet-stream` was never queued before), within the inline cap. Empty when OCR is not set up.
 */
export async function ocrPending(ctx: IndexContext, n: number, now: Date = new Date()): Promise<OcrQueueRow[]> {
  if (!ctx.ocr || n <= 0) return []
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  // Drive rows alone (#285): a record's scan has no Drive file to download; its OCR is a follow-up on the card.
  const { data } = await ctx.admin.from('file_index').select('drive_file_id, name, modified_at, indexed_at').eq('source', 'drive').eq('text_why', 'scan').or(ocrQueueFilter()).lte('bytes', OCR_MAX_BYTES).or(`ocr_tried_at.is.null,ocr_tried_at.lt.${cutoff}`).order('ocr_tried_at', { ascending: true, nullsFirst: true }).limit(n)
  return (data ?? []) as OcrQueueRow[]
}

/**
 * A scan the table already holds, through OCR alone (v2.6491): one download, the bytes to the processor, the row
 * patched with the text (`readColumns`, as the index writes it, the index stamp moved so the embedding pass takes it)
 * or the refusal (`ocrRefusedColumns`). Never the `reading` stamp that wiped the text and the try, the parse that
 * spent the sweep's clock and could leave the row `slow` with no way back, or the second download — the whole index
 * the pass ran before. The patch lands only while the row is the one the queue read (`indexed_at`); a row a press
 * indexed again meanwhile is that pass's, and this one's answer is `stale`.
 */
async function ocrKnownScan(ctx: IndexContext, f: DriveFileMeta, row: Pick<OcrQueueRow, 'drive_file_id' | 'indexed_at'>): Promise<{ ok: true; held: HeldFile | null; ocrCalled: boolean; stale: boolean } | { ok: false; error: string }> {
  const now = new Date()
  const mime = ocrMimeOf(f)
  if (!mime) {
    // A kind Document AI does not read (the queue's filter keeps these out; a renamed file is the exception): stamped with the reason, and never due again.
    const { error } = await ctx.admin.from('file_index').update(ocrRefusedColumns(OCR_KIND_NOTE, now)).eq('drive_file_id', f.id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, held: { id: f.id, name: f.name, why: 'scan' }, ocrCalled: false, stale: false }
  }
  const r = await ocrScan(ctx, f, mime)
  const read = r.read ? readColumns(r.read, now, { tried: true, note: null }) : null
  const put = await ctx.admin.from('file_index').update(read ?? ocrRefusedColumns(r.note, now)).eq('drive_file_id', f.id).eq('indexed_at', row.indexed_at).select('drive_file_id')
  if (put.error) return { ok: false, error: put.error.message }
  if (((put.data ?? []) as unknown[]).length === 0) return { ok: true, held: null, ocrCalled: ocrTakes(f), stale: true }
  if (read) await settleChunks(ctx, f.id, read.text, read.indexed_at)
  return { ok: true, held: read ? null : { id: f.id, name: f.name, why: 'scan' }, ocrCalled: ocrTakes(f), stale: false }
}

/**
 * The OCR pass (PR 3): the scans due, each through the processor inside the budget. A scan whose file is as its row
 * says goes straight to OCR (`ocrKnownScan`, one download); one whose file changed since is read whole, as any changed
 * file is, since the parse decides whether it is still a scan.
 */
export async function ocrPass(ctx: IndexContext, n: number, opts: { startedMs?: number; budgetMs?: number } = {}): Promise<{ tried: number; read: number; refused: HeldFile[]; gone: number }> {
  const rows = await ocrPending(ctx, n)
  const started = opts.startedMs ?? Date.now()
  let tried = 0
  let read = 0
  let gone = 0
  const refused: HeldFile[] = []
  for (const row of rows) {
    const id = row.drive_file_id
    if (!budgetAllows(started, Date.now(), opts.budgetMs ?? INDEX_BUDGET_MS) || ctx.spend.ms >= PASS_READ_BUDGET_MS) break
    const meta = await fileMeta(ctx.google, id)
    if (!meta || meta.trashed) {
      // Drive did not answer for it, or it sits in the trash: stamped as tried with the reason, so it leaves the
      // queue's head until the recheck drops its row, instead of holding a slot every run.
      gone += 1
      await ctx.admin.from('file_index').update({ ocr_tried_at: new Date().toISOString(), ocr_note: meta ? 'Trashed in Drive.' : 'Drive did not answer for the file.' }).eq('drive_file_id', id)
      continue
    }
    const changed = !sameInstant(meta.modifiedTime, row.modified_at)
    if (changed && !passMayTake(meta, ctx.spend)) break
    tried += 1
    const r = changed ? await indexOneFile(ctx, meta, { ocr: true }) : await ocrKnownScan(ctx, meta, row)
    if (r.ok && 'stale' in r && r.stale) continue
    if (r.ok && !r.held) read += 1
    else if (r.ok && r.held) refused.push(r.held)
    else refused.push({ id, name: meta.name, why: 'error' })
  }
  return { tried, read, refused, gone }
}

/**
 * The retake (v2.6491): rows held `slow` (the read ran out of time) or `reading` (a request the platform stopped) an
 * hour or more ago (`RETRY_HOLD_MS`, as a press's retry waits), oldest check first, taken again through the one pass
 * with `retry`. The sweep's own pass never retried a held row, so a scan the OCR catch-up once read as `slow` on a
 * spent clock sat held for good. A row slow again waits another hour; a file Drive no longer answers for, or trashed,
 * is checked now so it leaves the head until the recheck drops its row.
 */
export async function retakePass(ctx: IndexContext, n: number, opts: { startedMs?: number; budgetMs?: number } = {}): Promise<{ tried: number; read: number; held: HeldFile[] }> {
  const out = { tried: 0, read: 0, held: [] as HeldFile[] }
  if (n <= 0) return out
  const cutoff = new Date(Date.now() - RETRY_HOLD_MS).toISOString()
  // Drive rows alone (#285): a record's held row is taken again by the records queue (file_index_records_due), an hour on.
  const { data } = await ctx.admin.from('file_index').select('drive_file_id').eq('source', 'drive').in('text_why', [...RETAKE_WHYS]).lt('checked_at', cutoff).order('checked_at', { ascending: true }).limit(n)
  const started = opts.startedMs ?? Date.now()
  for (const { drive_file_id: id } of (data ?? []) as { drive_file_id: string }[]) {
    if (!budgetAllows(started, Date.now(), opts.budgetMs ?? INDEX_BUDGET_MS) || ctx.spend.ms >= PASS_READ_BUDGET_MS) break
    const meta = await fileMeta(ctx.google, id)
    if (!meta || meta.trashed) {
      await ctx.admin.from('file_index').update({ checked_at: new Date().toISOString() }).eq('drive_file_id', id)
      continue
    }
    if (!passMayTake(meta, ctx.spend)) break
    const pass = await indexFiles(ctx, [meta], { retry: true, max: 1, startedMs: started, budgetMs: opts.budgetMs })
    if (pass.remaining > 0) break
    if (pass.planned === 0) continue
    out.tried += 1
    if (pass.held.length === 0) out.read += 1
    else out.held.push(...pass.held)
  }
  return out
}
