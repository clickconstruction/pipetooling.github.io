import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { readDriveSettings } from '../_shared/driveSettings.ts'
import { NO_COMPANY_FOLDER_WORDS } from '../_shared/whereFilesGo.ts'
import { driveGet, driveMedia, freeName, halfInside, jobFolder, landingFolder, makeDriveLink, photoFolderFor, type Half, type JobFolder } from '../_shared/driveJobFolder.ts'
import { photoDriveName, photoNameInputOf, type PhotoAttachmentRow } from '../_shared/gcKernels/index.ts'
import { driveFolderMeta, jobsRootFolderId, NO_ROOT_WORDS } from '../_shared/driveSettings.ts'
import { JOB_FOLDER_TREE } from '../_shared/whereFilesGo.ts'
import { excerptOf, type Excerpt } from '../_shared/excerpt.ts'
import { fileTextWithin } from '../_shared/fileText.ts'
import { folderHomes, folderMetaReader } from '../_shared/fileHomes.ts'
import { heldRowsFor, indexContext, indexFiles, fileMeta, jobFilesToIndex } from '../_shared/fileIndex.ts'
import { OCR_PROBE_PNG, ocrSetup, ocrText } from '../_shared/ocr.ts'
import { OCR_PROCESSOR_SECRET, ocrStateWords } from '../_shared/ocrKernel.ts'
import { embeddingsSetup, embedTexts } from '../_shared/embeddings.ts'
import { EMBED_KEY_SECRET, MEANING_MAX_DISTANCE, embedStateWords } from '../_shared/embeddingsKernel.ts'
import { type DriveFileMeta, EXCERPT_PDF_LIMITS, EXCERPT_READ_MS, type FileHome, INDEX_JOB_MAX_FILES, newPassSpend, type PassSpend, walkUp } from '../_shared/fileIndexKernel.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { sha256Hex } from '../_shared/gcTradeLink.ts'
import { indexCheck } from '../_shared/fileIndexCheck.ts'
import { rehomeFiles } from '../_shared/fileIndexRehome.ts'
import {
  DRIVE_FOLDER_MIME,
  STREAM_CAP_BYTES,
  bytesOfBase64,
  contentDisposition,
  driveViewUrl,
  isImageFile,
  landingPath,
  linkTokenShape,
  openAnswer,
  parseOfficeAsk,
  streamUrl,
  type JobRef,
  type LinkRow,
  type PutWhere,
  twinRefusalWords,
} from '../_shared/driveLink.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * Messages, cut 7b (v2.5383): our own link to one Drive file of one job, and the office's door to a job's Drive folder.
 * `MESSAGES_PLAN.md` → *Documents, for files going out*, the handler; the mock-up is `files-out-mockups.html` on spike/gc-mode.
 *
 * The open door, no sign-in: the link is the key, found by its SHA-256 (`drive_links.token_hash`, cut 7a).
 *
 *   GET ?t=<link>          → { kind: 'drive', url, name } for a Plans file, whose half is open to anyone with its link;
 *                            { kind: 'stream', name, url } for a Team only file, whose bytes come through here;
 *                            { kind: 'off', why } for a link cut off, ended, unknown or too big to stream.
 *                            Counts one open (public_page_views, surface drive_link); a staff look or a preview is stamped
 *                            and not counted, as the portals do.
 *   GET ?t=<link>&raw=1    → the Team only file's bytes, streamed from Drive and never held whole, capped at 50 MB.
 *
 * The office's door, a signed-in member of the office team (dev, master_technician, assistant, controller, estimator),
 * never a digital twin, as gc-drive-access checks. A training account lists and opens, the reads, and changes nothing.
 * verify_jwt is off and the check is here.
 *
 *   POST { action: 'list', job }                       → the job's folder in its two halves (`DriveFileRow`s)
 *   POST { action: 'put', job, name, mime, where, base64 } → a file from this computer into Team only → Sent by us, or a
 *                                                        photo into Team only → Photos, up to 10 MB → { driveFileId, url };
 *                                                        since v2.6303 `where` also takes 'top' (the job's folder itself),
 *                                                        'plans' (its Plans folder) and 'pictures' (its photo folder), the
 *                                                        Documents tab's Add a file
 *   POST { action: 'search', words }                    → Find a file (v2.6305): Drive's own full-text index over the jobs Shared
 *                                                        Drive, folders left out, at most 30 hits, each walked up to the job or
 *                                                        bid whose folder holds it → { hits: [{ id, name, mime, bytes, modified,
 *                                                        url, home, path, excerpt, excerptWhy }], more, noRoot }; a read a training
 *                                                        account may run; since v2.6306 the first ten hits carry the line around
 *                                                        the words (`excerpt`), or why there is none (`excerptWhy`)
 *   POST { action: 'index', driveFileId }                → one file into our own text index, file_index (punch list #240, PR 1,
 *                                                        v2.6319): walked up to its job or bid, its text read by _shared/fileText.ts,
 *                                                        one row upserted → { indexed, held: [{ id, name, why }], remaining }; a
 *                                                        write of our table, never of Drive, so a training account may not
 *   POST { action: 'index_job', job, retry? }           → every file under the job's folder tree (its plans and pictures links too)
 *                                                        into the index, one at a time inside the request's budget, up to 40 a
 *                                                        call → { indexed, held, remaining, total }; the Documents tab's Index
 *                                                        this job's files presses it until remaining is 0; `retry` takes the
 *                                                        held rows again
 *   POST { action: 'index_check', max?, sample? }    → every file in the Shared Drive against every file_index row (v2.6364):
 *                                                        counts of files with no row, files changed since their row, rows the
 *                                                        listing did not show, rows with and without text by reason, and the
 *                                                        first `sample` files with no row → IndexCheck; a read, a dev's door
 *   POST { action: 'index_home', driveFileIds }      → these files' rows walked up to their job or bid again, up to 40 a call, nothing
 *                                                        read out of the files (v2.6403) → { homed, none, unanswered, failed }; a dev's door
 *   POST { action: 'search_index', words }              → Find a file's first answer (PR 4, v2.6338): the rows of search_file_index, or
 *                                                        once GEMINI_API_KEY is set the query embedded here and the rows of
 *                                                        search_file_index_meaning (words and meaning fused) → { rows, meaning, note }
 *   POST { action: 'embed_probe' }                      → a dev's one made-up call through the embeddings provider (PR 4): one sentence
 *                                                        embedded → { configured, secret, words, answer }; answer null while unset
 *   POST { action: 'ocr_probe' }                        → a dev's one made-up call through the OCR provider (PR 3, v2.6336): a
 *                                                        one-pixel PNG to the Document AI processor the secret names →
 *                                                        { configured, secret, words, answer }; answer null while unset
 *   POST { action: 'link', job, driveFileId, messageId } → our link to a file inside the job's folder → { linkId, url }
 *   POST { action: 'save', attachmentId, half }          → a file that came in, from our bucket into the job's folder →
 *                                                        { driveFileId, url }; the row keeps drive_file_id. A photo goes
 *                                                        to the job's photos named by day, sender and caption (cut 10)
 *   POST { action: 'open', job, driveFileId }            → Drive's own viewer for a file inside the job's folder, for
 *                                                        the office's /files/drive/<id> page → { url }
 *   POST { action: 'list_company' }                      → the company papers folder's files (the office's setting
 *                                                        `drive_company_folder_id`, Documents → Where files go) → { files,
 *                                                        capped, folder: { id, url } }; 409 while no folder is set
 *   POST { action: 'put_company', name, mime, base64 }   → a file from this computer into the company folder, up to 10 MB,
 *                                                        for the four office roles without the estimator → { driveFileId, url }
 *
 * A job is one of the spine's three: a GC project (gc_projects.drive_folder_url, with its Plans and Team only halves), a
 * bid (bids.drive_link) or a Pipeline job (jobs_ledger.google_drive_link). A bid's or a Pipeline job's folder has no
 * halves: every file in it is Team only. A link or an open is made only for a file whose parents reach the job's folder.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_SERVICE_ACCOUNT_JSON, APP_ORIGIN.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const OFFICE_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']
/** Who puts a paper in the company folder: the office, not the estimators (the owner's word, 2026-11-01). */
const COMPANY_PUT_ROLES = ['dev', 'master_technician', 'assistant', 'controller']
/** A file from this computer comes in as base64, up to the trade portal's cap. */
const PUT_MAX_BYTES = 10 * 1024 * 1024
/** How many of a job's files a list reads, and how deep into its folders. */
const LIST_MAX_FILES = 500
const LIST_MAX_DEPTH = 3

interface DriveListed {
  id: string
  name: string
  mimeType: string
  size?: string
  webViewLink?: string
  modifiedTime?: string
}

/** A folder's files, its subfolders' too, newest first, up to the caps. */
async function filesUnder(token: string, folderId: string, half: Half, out: Record<string, unknown>[], depth = 0, skip: Set<string> = new Set()): Promise<void> {
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
    const page = await driveGet<{ files?: DriveListed[]; nextPageToken?: string }>(
      token,
      `${DRIVE}/files?q=${q}&pageSize=200&orderBy=modifiedTime desc&fields=nextPageToken,files(id,name,mimeType,size,webViewLink,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    )
    for (const f of page.files ?? []) {
      if (out.length >= LIST_MAX_FILES) return
      if (f.mimeType === DRIVE_FOLDER_MIME) {
        if (depth + 1 < LIST_MAX_DEPTH && !skip.has(f.id)) await filesUnder(token, f.id, half, out, depth + 1, skip)
        continue
      }
      out.push({ id: f.id, name: f.name, bytes: f.size == null ? null : Number(f.size), mime: f.mimeType, half, url: f.webViewLink ?? driveViewUrl(f.id), modified: f.modifiedTime ?? null })
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken && out.length < LIST_MAX_FILES)
}

async function openDoor(req: Request, admin: SupabaseClient, url: URL): Promise<Response> {
  const token = url.searchParams.get('t')?.trim() ?? ''
  if (!linkTokenShape(token)) return json({ kind: 'off', why: 'unknown' }, 404)
  const { data } = await admin
    .from('drive_links')
    .select('id, half, drive_file_id, name, mime, size_bytes, ends_at, cut_at')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle()
  const row = data as LinkRow | null
  const answer = openAnswer(row, new Date())
  const raw = url.searchParams.get('raw') === '1'
  if (answer.kind === 'off') return json(answer, answer.why === 'unknown' ? 404 : 410)

  if (!raw) {
    // Who looked: outside counts; a signed-in teammate or a preview is stamped, never counted.
    const decision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    void admin
      .from('public_page_views')
      .insert({ surface: 'drive_link', entity_id: row!.id, via: 'token', viewer: decision.viewer, viewer_user_id: decision.staffUserId })
      .then(() => {}, () => {})
    if (answer.kind === 'drive') return json(answer)
    return json({ ...answer, url: streamUrl(Deno.env.get('SUPABASE_URL') ?? url.origin, token) })
  }

  // A Plans file asked for raw goes to Drive's own viewer.
  if (answer.kind !== 'stream') return Response.redirect(answer.url, 302)
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) return json({ error: 'failed' }, 500)
  const google = await googleAccessToken(saJson)
  const file = await driveMedia(google, row!.drive_file_id)
  if (!file.ok || !file.body) return json({ kind: 'off', why: 'unknown' }, 404)
  // The size kept on the row is the size the day the link was made; a file grown past the cap since is not streamed.
  const length = Number(file.headers.get('Content-Length') ?? '')
  if (Number.isFinite(length) && length > STREAM_CAP_BYTES) {
    void file.body.cancel().catch(() => {})
    return json({ kind: 'off', why: 'tooBig' }, 410)
  }
  // Passed through as it comes, never held whole.
  return new Response(file.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': row!.mime || file.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Disposition': contentDisposition(row!.name, row!.mime),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(file.headers.get('Content-Length') ? { 'Content-Length': file.headers.get('Content-Length')! } : {}),
    },
  })
}

/**
 * Where a `put` lands (v2.6303, the Documents tab's Add a file): 'sent' and 'photos' as before, under Team only; 'top'
 * is the job's folder itself; 'plans' is a Pipeline job's own Plans folder when its link is set, else Plans made under
 * the folder (a GC project's Plans half the same way); 'pictures' is the job's photo folder, Customer Pictures made as
 * needed, as the photo sweep lands them. Null when the job has no folder for it.
 */
async function putFolderFor(admin: SupabaseClient, google: string, job: JobRef, folder: JobFolder, where: PutWhere): Promise<string | null> {
  if (where === 'sent' || where === 'photos') return landingFolder(google, folder, landingPath(where))
  if (where === 'top') return folder.folderId
  if (where === 'pictures') return photoFolderFor(admin, google, job)
  if ('jobs_ledger_id' in job) {
    const { data } = await admin.from('jobs_ledger').select('job_plans_link').eq('id', job.jobs_ledger_id).maybeSingle()
    const linked = driveFolderIdFromUrl((data as { job_plans_link?: string | null } | null)?.job_plans_link ?? null)
    if (linked) return linked
  }
  return folder.plansId ?? landingFolder(google, folder, ['Plans'])
}

/** A hit of Find a file, as Drive lists it. */
type SearchListed = DriveFileMeta

/** The home as the box names it: the index's shape without the customer the row keeps. */
function boxHome(h: FileHome): Record<string, unknown> {
  const { customerId: _customer, ...rest } = h
  return rest
}

/** How many hits Find a file answers. */
const SEARCH_MAX = 30

type ExcerptWhy = 'scan' | 'kind' | 'big' | 'slow'
/** How many of a search's hits get their text read for an excerpt (v2.6306). */
const EXCERPT_MAX_HITS = 10

/**
 * The excerpt for a hit (v2.6306): the shared reader (`_shared/fileText.ts`, the index's too) raced against the timer; a
 * read that fails or finds no words costs the excerpt, never the search.
 */
async function excerptFor(google: string, f: SearchListed, words: string, spend: PassSpend): Promise<{ excerpt: Excerpt | null; excerptWhy: ExcerptWhy | null }> {
  const r = await fileTextWithin(google, f, EXCERPT_READ_MS, { limits: EXCERPT_PDF_LIMITS, spend })
  if ('why' in r) return { excerpt: null, excerptWhy: r.why === 'error' ? 'kind' : r.why }
  const excerpt = excerptOf(r.text, words)
  if (excerpt) return { excerpt, excerptWhy: null }
  // The words sit past the pages this read had time for: too big to show, never a kind we do not read.
  const partly = r.pages != null && r.pagesRead != null && r.pagesRead < r.pages
  return { excerpt: null, excerptWhy: partly ? 'big' : 'kind' }
}

/**
 * Find a file (v2.6305): Drive's own full-text index, which already reads the words inside PDFs and OCR'd scans, asked
 * over the jobs root's Shared Drive (the whole of every Shared Drive when the root is not in one), folders left out.
 * Each hit is walked up to the job or bid whose folder holds it, in parallel over one shared cache of folder lookups.
 */
async function searchFiles(admin: SupabaseClient, google: string, words: string): Promise<Record<string, unknown>> {
  const rootId = await jobsRootFolderId(admin)
  if (!rootId) return { hits: [], more: false, noRoot: true }
  const root = await driveFolderMeta(google, rootId)
  const driveId = root.body.driveId ?? null
  const term = words.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const q = encodeURIComponent(`fullText contains '${term}' and trashed = false and mimeType != '${DRIVE_FOLDER_MIME}'`)
  const scope = driveId ? `&corpora=drive&driveId=${encodeURIComponent(driveId)}` : '&corpora=allDrives'
  const page = await driveGet<{ files?: SearchListed[]; nextPageToken?: string }>(
    google,
    `${DRIVE}/files?q=${q}${scope}&pageSize=${SEARCH_MAX}&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  )
  const files = page.files ?? []
  if (files.length === 0) return { hits: [], more: false, noRoot: false }
  const homes = await folderHomes(admin)
  const metaOf = folderMetaReader(google)
  // One clock for the ten excerpts: they read at once in one worker, and the platform counts their CPU as one request's.
  const spend = newPassSpend()
  const hits = await Promise.all(
    files.map(async (f, i) => {
      const [{ home, path }, ex] = await Promise.all([
        walkUp(f.parents?.[0] ?? null, homes, rootId, metaOf).then((w) => ({ home: w.home ? boxHome(w.home) : null, path: w.path })),
        i < EXCERPT_MAX_HITS ? excerptFor(google, f, words, spend) : Promise.resolve({ excerpt: null, excerptWhy: null }),
      ])
      return { id: f.id, name: f.name, mime: f.mimeType, bytes: f.size == null ? null : Number(f.size), modified: f.modifiedTime ?? null, url: f.webViewLink ?? driveViewUrl(f.id, f.mimeType), home, path, ...ex }
    }),
  )
  return { hits, more: Boolean(page.nextPageToken), noRoot: false }
}

async function officeDoor(req: Request, admin: SupabaseClient): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: u } = await anon.auth.getUser()
  const archivedRefusal = await refuseArchivedCaller(admin, u?.user?.id, corsHeaders)
  if (archivedRefusal) return archivedRefusal
  if (!u?.user) return json({ error: 'Sign in first.' }, 401)
  const { data: who } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
  if (!who || !OFFICE_ROLES.includes(String(who.role))) return json({ error: 'Office only.' }, 403)

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  // A twin is refused whatever it asks, in words true to the ask (v2.6488): a search is not a change.
  if (who.is_digital_twin) return json({ error: twinRefusalWords(body?.action) }, 403)
  const ask = parseOfficeAsk(body)
  if (!ask) return json({ error: 'That is not an ask this door takes.' }, 400)
  // Training mode reads everything and writes nothing: a list and an open are reads.
  if (who.read_only && ask.action !== 'list' && ask.action !== 'open' && ask.action !== 'search' && ask.action !== 'search_index' && ask.action !== 'list_company' && ask.action !== 'ocr_probe' && ask.action !== 'embed_probe') return json({ error: 'A training account cannot change Drive.' }, 403)
  if (ask.action === 'put_company' && !COMPANY_PUT_ROLES.includes(String(who.role))) return json({ error: 'The office puts papers in the company folder.' }, 403)
  // The index answers from our own table: no Drive token for it, so a search costs no token exchange and Google being
  // down costs the floor alone, never the index.
  if (ask.action === 'search_index') {
    const embed = embeddingsSetup()
    let meaning = false
    let rows: unknown = null
    let error: string | null = null
    if (embed) {
      const q = await embedTexts(embed, [ask.words], 'RETRIEVAL_QUERY')
      if (q.ok) {
        const r = await admin.rpc('search_file_index_meaning', { query_embedding: q.vectors[0], words: ask.words, max_hits: SEARCH_MAX, max_distance: MEANING_MAX_DISTANCE })
        if (r.error) error = r.error.message
        else {
          rows = r.data
          meaning = true
        }
      } else console.warn('query embedding refused; the words alone answer', q.error)
    }
    if (rows == null) {
      const r = await admin.rpc('search_file_index', { words: ask.words, max_hits: SEARCH_MAX })
      if (r.error) return json({ error: `The index did not answer: ${r.error.message}` }, 500)
      rows = r.data
    }
    return json({ rows: Array.isArray(rows) ? rows : [], meaning, note: error })
  }

  if (ask.action === 'embed_probe') {
    if (who.role !== 'dev') return json({ error: 'A dev runs the embeddings probe.' }, 403)
    const setup = embeddingsSetup()
    const answer = setup ? await embedTexts(setup, ['A made-up sentence about a rock clause in a plumbing contract.'], 'RETRIEVAL_QUERY') : null
    return json({ configured: Boolean(setup), secret: EMBED_KEY_SECRET, words: embedStateWords(Boolean(setup)), answer: answer ? (answer.ok ? { ok: true, dimensions: answer.vectors[0]?.length ?? 0 } : answer) : null })
  }

  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) return json({ error: 'Drive is not set up here yet.' }, 500)
  const google = await googleAccessToken(saJson)

  if (ask.action === 'save') {
    const { data: att } = await admin
      .from('message_attachments')
      .select('id, sort_order, kind, name, mime, bucket_path, drive_file_id, sent_as, message_id, messages(direction, at, bid_id, project_id, jobs_ledger_id, who_text, subject, body)')
      .eq('id', ask.attachmentId)
      .maybeSingle()
    const a = att as (PhotoAttachmentRow & { messages: { bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null } | null }) | null
    if (!a || a.kind !== 'file' || !a.bucket_path) return json({ error: 'That file is not one we kept.' }, 404)
    // Saved already, by a second press or a second person: the one copy in Drive, never another.
    if (a.drive_file_id) return json({ driveFileId: a.drive_file_id, url: driveViewUrl(a.drive_file_id) })
    const m = a.messages
    const job: JobRef | null = m?.project_id ? { project_id: m.project_id } : m?.bid_id ? { bid_id: m.bid_id } : m?.jobs_ledger_id ? { jobs_ledger_id: m.jobs_ledger_id } : null
    if (!job) return json({ error: 'Tie the message to a job first.' }, 409)
    // A photo goes to the job's photos (Team only › Photos, or a Pipeline job's own Customer Pictures folder), named by
    // day, sender and caption, the way the photo-save sweep files it (Messages, cut 10).
    const photo = isImageFile(a) ? photoNameInputOf(a) : null
    let into: string | null
    if (photo) {
      into = await photoFolderFor(admin, google, job)
    } else {
      const folder = await jobFolder(admin, google, job)
      const path = folder && (folder.plansId || folder.teamId) ? landingPath('saved', ask.half) : []
      into = folder ? (path.length ? await landingFolder(google, folder, path) : folder.folderId) : null
    }
    if (!into) return json({ error: 'That job has no Drive folder yet.' }, 409)
    const { data: blob, error } = await admin.storage.from('message-attachments').download(a.bucket_path)
    if (error || !blob) return json({ error: 'Our copy of that file did not read.' }, 500)
    const name = photo ? await freeName(google, into, (taken) => photoDriveName(photo, taken)) : a.name
    const put = await uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, a.mime || 'application/octet-stream')
    const { error: kept } = await admin.from('message_attachments').update({ drive_file_id: put.id }).eq('id', ask.attachmentId)
    if (kept) return json({ error: 'Saved to Drive, but the row did not keep it.' }, 500)
    return json({ driveFileId: put.id, url: driveViewUrl(put.id) })
  }

  if (ask.action === 'search') return json(await searchFiles(admin, google, ask.words))

  // Find a file's first answer (PR 4): our own index, by the words alone (search_file_index) or, once GEMINI_API_KEY is
  // set, by the words and the meaning fused (search_file_index_meaning, the query embedded here). The RPC runs as the
  // service role: the door checked the office role above, and the office reads every row of the table anyway.
  if (ask.action === 'list_company' || ask.action === 'put_company') {
    const companyId = (await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))).companyFolderId
    if (!companyId) return json({ error: NO_COMPANY_FOLDER_WORDS, why: 'no_company_folder' }, 409)
    if (ask.action === 'list_company') {
      const out: Record<string, unknown>[] = []
      await filesUnder(google, companyId, 'team_only', out)
      return json({ files: out, capped: out.length >= LIST_MAX_FILES, folder: { id: companyId, url: driveViewUrl(companyId, DRIVE_FOLDER_MIME) } })
    }
    const raw = typeof body?.base64 === 'string' ? body.base64 : ''
    if (raw.length > Math.ceil((PUT_MAX_BYTES * 4) / 3) + 200) return json({ error: 'Over 10 MB. Put it in the company folder in Drive instead.' }, 413)
    const bytes = bytesOfBase64(raw)
    if (!bytes || bytes.length === 0) return json({ error: 'That file did not come through.' }, 400)
    if (bytes.length > PUT_MAX_BYTES) return json({ error: 'Over 10 MB. Put it in the company folder in Drive instead.' }, 413)
    const put = await uploadBytes(google, companyId, bytes, ask.name, ask.mime)
    return json({ driveFileId: put.id, url: driveViewUrl(put.id) })
  }

  // The index (punch list #240, PR 1): one file by its id, or a job's folder tree, into file_index through the one
  // pass every indexer runs (`_shared/fileIndex.ts`). Writes our table, never Drive; a training account was refused above.
  // The index check (punch list #240, v2.6364): every file in the Shared Drive against every row, counts and the first
  // files with no row; a read of Drive and of our table, a dev's door (the training-account line above stays as it is).
  if (ask.action === 'index_check') {
    if (String(who.role) !== 'dev') return json({ error: 'The index check is a dev’s door.' }, 403)
    const ctx = await indexContext(admin, google)
    if ('noRoot' in ctx) return json({ error: NO_ROOT_WORDS }, 409)
    return json(await indexCheck(ctx, { max: ask.max, sample: ask.sample }))
  }

  // A row's home again (punch list #240, v2.6403): walked up from the folders as they stand, written on the row, nothing
  // read out of the file and nothing written to Drive; a dev's door.
  if (ask.action === 'index_home') {
    if (String(who.role) !== 'dev') return json({ error: 'Setting a row’s home again is a dev’s door.' }, 403)
    const ctx = await indexContext(admin, google)
    if ('noRoot' in ctx) return json({ error: NO_ROOT_WORDS }, 409)
    return json(await rehomeFiles(ctx, ask.driveFileIds))
  }

  // The dev's one made-up call through the OCR provider (PR 3): a one-pixel PNG to the processor, the provider's own
  // words back, so "it is set up" is proven by an answer and never by a secret's presence alone.
  if (ask.action === 'ocr_probe') {
    if (who.role !== 'dev') return json({ error: 'A dev runs the OCR probe.' }, 403)
    const setup = ocrSetup(saJson)
    const answer = setup ? await ocrText(setup, OCR_PROBE_PNG, 'image/png', { maxPages: 1 }) : null
    return json({ configured: Boolean(setup), secret: OCR_PROCESSOR_SECRET, words: ocrStateWords(Boolean(setup)), answer })
  }

  if (ask.action === 'index') {
    const ctx = await indexContext(admin, google, saJson)
    if ('noRoot' in ctx) return json({ error: NO_ROOT_WORDS }, 409)
    const meta = await fileMeta(google, ask.driveFileId)
    if (!meta) return json({ error: 'Drive did not answer for that file.' }, 404)
    const pass = await indexFiles(ctx, [meta], { retry: true, max: 1 })
    return json({ indexed: pass.indexed, held: pass.held, remaining: pass.remaining })
  }

  const folder = await jobFolder(admin, google, ask.job)
  if (!folder) return json({ error: 'That job has no Drive folder yet.' }, 409)

  if (ask.action === 'index_job') {
    const ctx = await indexContext(admin, google, saJson)
    if ('noRoot' in ctx) return json({ error: NO_ROOT_WORDS }, 409)
    const listed = (await jobFilesToIndex(admin, google, ask.job)) ?? []
    const pass = await indexFiles(ctx, listed, { retry: ask.retry, max: INDEX_JOB_MAX_FILES })
    // Once the job is done, the held list is every held row of the job, not this call's alone: a second press reports the standing.
    const held = pass.remaining === 0 ? await heldRowsFor(admin, listed.map((f) => f.id)) : pass.held
    return json({ indexed: pass.indexed, held, remaining: pass.remaining, total: listed.length })
  }

  if (ask.action === 'list') {
    const out: Record<string, unknown>[] = []
    if (folder.plansId || folder.teamId) {
      if (folder.plansId) await filesUnder(google, folder.plansId, 'plans', out)
      if (folder.teamId) await filesUnder(google, folder.teamId, 'team_only', out)
    } else {
      await filesUnder(google, folder.folderId, 'team_only', out)
    }
    return json({ files: out, capped: out.length >= LIST_MAX_FILES })
  }

  if (ask.action === 'put') {
    const raw = typeof body?.base64 === 'string' ? body.base64 : ''
    if (raw.length > Math.ceil((PUT_MAX_BYTES * 4) / 3) + 200) return json({ error: 'Over 10 MB. Put it in the job’s Drive folder, then pick it from the job’s files.' }, 413)
    const bytes = bytesOfBase64(raw)
    if (!bytes || bytes.length === 0) return json({ error: 'That file did not come through.' }, 400)
    if (bytes.length > PUT_MAX_BYTES) return json({ error: 'Over 10 MB. Put it in the job’s Drive folder, then pick it from the job’s files.' }, 413)
    const into = await putFolderFor(admin, google, ask.job, folder, ask.where)
    if (!into) return json({ error: 'That job has no folder for that yet.' }, 409)
    const put = await uploadBytes(google, into, bytes, ask.name, ask.mime)
    return json({ driveFileId: put.id, url: driveViewUrl(put.id) })
  }

  if (ask.action === 'open') {
    if (!(await halfInside(google, folder, ask.driveFileId))) return json({ error: 'That file is not in the job’s Drive folder.' }, 403)
    return json({ url: driveViewUrl(ask.driveFileId) })
  }

  // ask.action === 'link'
  const made = await makeDriveLink(admin, google, {
    job: ask.job,
    folder,
    driveFileId: ask.driveFileId,
    messageId: ask.messageId,
    madeBy: u.user.id,
    origin: Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com',
  })
  if (made.ok) return json({ linkId: made.linkId, url: made.url })
  if (made.why === 'notInFolder') return json({ error: 'That file is not in the job’s Drive folder.' }, 403)
  if (made.why === 'teamOnlyFolder') return json({ error: 'Only a folder in Plans can go as our link.' }, 400)
  return json({ error: 'The link was not made.' }, 500)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    if (req.method === 'GET') return await openDoor(req, admin, new URL(req.url))
    if (req.method === 'POST') return await officeDoor(req, admin)
    return json({ error: 'GET or POST only.' }, 405)
  } catch (e) {
    console.error('drive-link failed', e)
    return json({ error: 'failed' }, 500)
  }
})
