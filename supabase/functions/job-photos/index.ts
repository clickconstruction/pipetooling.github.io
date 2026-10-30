import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, googleAccessToken } from '../_shared/driveUpload.ts'
import { childFolder, driveGet, driveMedia } from '../_shared/driveJobFolder.ts'
import { DRIVE_FOLDER_MIME, driveViewUrl } from '../_shared/driveLink.ts'
import { JOB_FOLDER_TREE } from '../_shared/whereFilesGo.ts'

/**
 * A job's Drive photos in the app (punch list #164, PR 5; the owner, 2026-10-24: photos always live in Google Drive).
 * The job window's gallery reads the customer's folder through the service account and never copies a photo out of
 * it: the strip under the address lists the folder, each thumbnail and each full picture streams through here, and
 * the only lasting copy stays in Drive.
 *
 * The folders are where the photo sweep lands a Pipeline job's photos (`photoLanding`): the job's Customer Pictures
 * folder when `jobs_ledger.job_pictures_link` is plainly a Drive folder, and Team only › Photos under the job's own
 * folder (`google_drive_link`) when it exists; a job with neither answers `folder.kind = 'none'` and the window says so
 * with the door to set it. Nothing is made here: a folder missing stays missing, as the sweep's own reasons say.
 *
 * Who: anyone signed in who may stamp the job's stages, `can_report_stage_progress(job_id)` (the stage progress gate of
 * v2.3192: the office roles, or a field user on the job's team, clocked in on it, or under the sub rule), checked
 * through the caller's own client so RLS and the role table decide. A read, so a training account and a twin read too.
 *
 *   POST { action: 'list', job_id }            → { folder: { kind: 'pictures' | 'photos' | 'none', url: string | null },
 *                                                  photos: [{ id, name, mime, bytes, modified, from }], capped, waiting }
 *                                                  newest first, pictures only, up to 500; `waiting` counts the job's
 *                                                  checklist and box photos still in a bucket on their way to the folder
 *   POST { action: 'thumb', job_id, file_id }   → the file's thumbnail bytes (Drive's, fetched with our token), image/*
 *   POST { action: 'full', job_id, file_id }    → the file's bytes, streamed, up to 25 MB
 *
 * A thumb or a full read is answered only for a file whose parent is one of the job's two photo folders.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_SERVICE_ACCOUNT_JSON. config.toml keeps
 * verify_jwt = false: the JWT is checked here, so the refusal has words.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const LIST_MAX = 500
const FULL_CAP_BYTES = 25 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/

type Ask = { action: 'list'; jobId: string } | { action: 'thumb' | 'full'; jobId: string; fileId: string }

function parseAsk(body: Record<string, unknown> | null): Ask | null {
  if (!body) return null
  const jobId = typeof body.job_id === 'string' && UUID.test(body.job_id) ? body.job_id : null
  if (!jobId) return null
  if (body.action === 'list') return { action: 'list', jobId }
  if (body.action === 'thumb' || body.action === 'full') {
    const fileId = typeof body.file_id === 'string' && DRIVE_ID.test(body.file_id) ? body.file_id : null
    return fileId ? { action: body.action, jobId, fileId } : null
  }
  return null
}

interface JobFolders {
  /** Customer Pictures, when the job's link is plainly a Drive folder. */
  picturesId: string | null
  /** Team only › Photos under the job's folder, when both exist. */
  photosId: string | null
}

async function jobPhotoFolders(admin: SupabaseClient, token: string, jobId: string): Promise<JobFolders> {
  const { data } = await admin.from('jobs_ledger').select('job_pictures_link, google_drive_link').eq('id', jobId).maybeSingle()
  const row = data as { job_pictures_link?: string | null; google_drive_link?: string | null } | null
  const picturesId = driveFolderIdFromUrl(row?.job_pictures_link ?? null)
  const jobFolderId = driveFolderIdFromUrl(row?.google_drive_link ?? null)
  let photosId: string | null = null
  if (jobFolderId) {
    const teamId = await childFolder(token, jobFolderId, JOB_FOLDER_TREE.teamOnly)
    photosId = teamId ? await childFolder(token, teamId, JOB_FOLDER_TREE.photos) : null
  }
  return { picturesId, photosId }
}

interface DriveListed {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
}

/** A folder's pictures, newest first, up to the cap; folders inside are not walked (the sweep files flat). */
async function picturesIn(token: string, folderId: string, from: 'pictures' | 'photos', out: Record<string, unknown>[]): Promise<boolean> {
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`)
    const page = await driveGet<{ files?: DriveListed[]; nextPageToken?: string }>(
      token,
      `${DRIVE}/files?q=${q}&pageSize=200&orderBy=modifiedTime desc&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    )
    for (const f of page.files ?? []) {
      if (f.mimeType === DRIVE_FOLDER_MIME) continue
      if (out.length >= LIST_MAX) return true
      out.push({ id: f.id, name: f.name, mime: f.mimeType, bytes: f.size == null ? null : Number(f.size), modified: f.modifiedTime ?? null, from })
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return false
}

/** How many of the job's photos are still in a bucket on their way to the folder: the checklist's and the boxes'. */
async function waitingCount(admin: SupabaseClient, jobId: string): Promise<number> {
  const [a, b] = await Promise.all([
    admin.from('stage_checklist_answers').select('id', { count: 'exact', head: true }).eq('job_id', jobId).is('photo_filed_at', null).not('photo_storage_path', 'is', null),
    admin.from('job_box_photos').select('id', { count: 'exact', head: true }).eq('job_id', jobId).is('filed_at', null).not('storage_path', 'is', null),
  ])
  return (a.count ?? 0) + (b.count ?? 0)
}

async function fileInside(token: string, folders: JobFolders, fileId: string): Promise<{ mime: string; name: string; thumb: string | null } | null> {
  const meta = await driveGet<{ parents?: string[]; mimeType: string; name: string; thumbnailLink?: string }>(
    token,
    `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=parents,mimeType,name,thumbnailLink&supportsAllDrives=true`,
  )
  const parent = meta.parents?.[0] ?? null
  if (!parent || (parent !== folders.picturesId && parent !== folders.photosId)) return null
  if (!meta.mimeType.startsWith('image/')) return null
  return { mime: meta.mimeType, name: meta.name, thumb: meta.thumbnailLink ?? null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const auth = req.headers.get('Authorization') ?? ''
    const mine = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await mine.auth.getUser()
    if (!u?.user) return json({ error: 'Sign in first.' }, 401)
    const ask = parseAsk((await req.json().catch(() => null)) as Record<string, unknown> | null)
    if (!ask) return json({ error: 'That is not an ask this door takes.' }, 400)
    // The job's own gate, under the caller's sign-in: the office, or a field user the job is visible to.
    const { data: may, error: gateError } = await mine.rpc('can_report_stage_progress', { p_job_id: ask.jobId })
    if (gateError || may !== true) return json({ error: 'This job is not one you can see.' }, 403)

    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!saJson) return json({ error: 'Drive is not set up here yet.' }, 503)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const token = await googleAccessToken(saJson)
    const folders = await jobPhotoFolders(admin, token, ask.jobId)

    if (ask.action === 'list') {
      const out: Record<string, unknown>[] = []
      let capped = false
      if (folders.picturesId) capped = (await picturesIn(token, folders.picturesId, 'pictures', out)) || capped
      if (folders.photosId) capped = (await picturesIn(token, folders.photosId, 'photos', out)) || capped
      out.sort((a, b) => String(b.modified ?? '').localeCompare(String(a.modified ?? '')))
      const folderId = folders.picturesId ?? folders.photosId
      const folder = { kind: folders.picturesId ? 'pictures' : folders.photosId ? 'photos' : 'none', url: folderId ? driveViewUrl(folderId, DRIVE_FOLDER_MIME) : null }
      return json({ folder, photos: out, capped, waiting: await waitingCount(admin, ask.jobId) })
    }

    const file = await fileInside(token, folders, ask.fileId)
    if (!file) return json({ error: 'That photo is not in the job’s folder.' }, 404)

    if (ask.action === 'thumb') {
      if (!file.thumb) return json({ error: 'Drive has no thumbnail for that photo yet.' }, 404)
      // Drive's thumbnail, a little larger than its default, fetched with our token since the folder is not public.
      const url = file.thumb.replace(/=s\d+(-c)?$/, '') + '=s400'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok || !res.body) return json({ error: 'The thumbnail did not read.' }, 502)
      return new Response(res.body, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': res.headers.get('Content-Type') || 'image/jpeg', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' },
      })
    }

    const media = await driveMedia(token, ask.fileId)
    if (!media.ok || !media.body) return json({ error: 'The photo did not read.' }, 502)
    const length = Number(media.headers.get('Content-Length') ?? '')
    if (Number.isFinite(length) && length > FULL_CAP_BYTES) {
      void media.body.cancel().catch(() => {})
      return json({ error: 'That photo is too big to show here. Open it in Drive.' }, 413)
    }
    return new Response(media.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': file.mime || media.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        ...(media.headers.get('Content-Length') ? { 'Content-Length': media.headers.get('Content-Length')! } : {}),
      },
    })
  } catch (e) {
    console.error('job-photos failed', e)
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
})
