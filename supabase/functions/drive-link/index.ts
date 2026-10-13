import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { driveGet, freeName, jobFolder, landingFolder, photoFolderFor, type Half, type JobFolder } from '../_shared/driveJobFolder.ts'
import { photoDriveName, photoNameInputOf, type PhotoAttachmentRow } from '../_shared/gcKernels/index.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { sha256Hex } from '../_shared/gcTradeLink.ts'
import {
  DRIVE_FOLDER_MIME,
  LINK_TOKEN_BYTES,
  STREAM_CAP_BYTES,
  contentDisposition,
  driveViewUrl,
  fileLinkUrl,
  isImageFile,
  landingPath,
  linkToken,
  linkTokenShape,
  openAnswer,
  parseOfficeAsk,
  streamUrl,
  type JobRef,
  type LinkRow,
} from '../_shared/driveLink.ts'

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
 *                                                        photo into Team only → Photos, up to 10 MB → { driveFileId, url }
 *   POST { action: 'link', job, driveFileId, messageId } → our link to a file inside the job's folder → { linkId, url }
 *   POST { action: 'save', attachmentId, half }          → a file that came in, from our bucket into the job's folder →
 *                                                        { driveFileId, url }; the row keeps drive_file_id. A photo goes
 *                                                        to the job's photos named by day, sender and caption (cut 10)
 *   POST { action: 'open', job, driveFileId }            → Drive's own viewer for a file inside the job's folder, for
 *                                                        the office's /files/drive/<id> page → { url }
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

/** Whether a Drive file sits inside the job's folder, by its parents, a few levels up; and which half it is in. */
async function halfInside(token: string, folder: JobFolder, fileId: string): Promise<Half | null> {
  let id = fileId
  for (let i = 0; i < 6; i += 1) {
    const meta = await driveGet<{ parents?: string[] }>(token, `${DRIVE}/files/${encodeURIComponent(id)}?fields=parents&supportsAllDrives=true`)
    const parent = meta.parents?.[0]
    if (!parent) return null
    if (folder.plansId && parent === folder.plansId) return 'plans'
    if (folder.teamId && parent === folder.teamId) return 'team_only'
    // A bid's or a Pipeline job's folder has no halves: inside it is Team only.
    if (parent === folder.folderId) return folder.plansId || folder.teamId ? null : 'team_only'
    id = parent
  }
  return null
}

function bytesOfBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64.replace(/^data:[^,]*,/, '').trim())
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
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
  const file = await fetch(`${DRIVE}/files/${encodeURIComponent(row!.drive_file_id)}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${google}` } })
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

async function officeDoor(req: Request, admin: SupabaseClient): Promise<Response> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const auth = req.headers.get('Authorization') ?? ''
  const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: u } = await anon.auth.getUser()
  if (!u?.user) return json({ error: 'Sign in first.' }, 401)
  const { data: who } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
  if (!who || !OFFICE_ROLES.includes(String(who.role))) return json({ error: 'Office only.' }, 403)
  if (who.is_digital_twin) return json({ error: 'A digital twin cannot change Drive.' }, 403)

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const ask = parseOfficeAsk(body)
  if (!ask) return json({ error: 'That is not an ask this door takes.' }, 400)
  // Training mode reads everything and writes nothing: a list and an open are reads.
  if (who.read_only && ask.action !== 'list' && ask.action !== 'open') return json({ error: 'A training account cannot change Drive.' }, 403)
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

  const folder = await jobFolder(admin, google, ask.job)
  if (!folder) return json({ error: 'That job has no Drive folder yet.' }, 409)

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
    const into = await landingFolder(google, folder, landingPath(ask.where))
    const put = await uploadBytes(google, into, bytes, ask.name, ask.mime)
    return json({ driveFileId: put.id, url: driveViewUrl(put.id) })
  }

  const half = await halfInside(google, folder, ask.driveFileId)
  if (!half) return json({ error: 'That file is not in the job’s Drive folder.' }, 403)

  if (ask.action === 'open') return json({ url: driveViewUrl(ask.driveFileId) })

  // ask.action === 'link'
  const meta = await driveGet<{ name: string; mimeType: string; size?: string }>(google, `${DRIVE}/files/${encodeURIComponent(ask.driveFileId)}?fields=name,mimeType,size&supportsAllDrives=true`)
  // A plan set's folder in Plans opens as the folder. A Team only folder has no bytes to hand over.
  if (meta.mimeType === DRIVE_FOLDER_MIME && half !== 'plans') return json({ error: 'Only a folder in Plans can go as our link.' }, 400)
  const token = linkToken(crypto.getRandomValues(new Uint8Array(LINK_TOKEN_BYTES)))
  const { data: made, error } = await admin
    .from('drive_links')
    .insert({
      token_hash: await sha256Hex(token),
      ...ask.job,
      drive_file_id: ask.driveFileId,
      half,
      name: meta.name.slice(0, 300),
      mime: meta.mimeType,
      size_bytes: meta.size == null ? null : Number(meta.size),
      message_id: ask.messageId,
      made_by: u.user.id,
    })
    .select('id')
    .single()
  if (error || !made) return json({ error: 'The link was not made.' }, 500)
  const origin = Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'
  return json({ linkId: (made as { id: string }).id, url: fileLinkUrl(origin, token) })
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
