import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, googleAccessToken } from '../_shared/driveUpload.ts'
import { driveGet, driveMedia } from '../_shared/driveJobFolder.ts'
import { DRIVE_FOLDER_MIME } from '../_shared/driveLink.ts'
import { readDriveSettings } from '../_shared/driveSettings.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { bidPhotoFolderState, ensureBidPhotoFolder, readBidForFolder, type BidFolderContext } from '../_shared/bidFolder.ts'
import { bidPhotosAskWrites, parseBidPhotosAsk, strayPhotoRows, type ListedBidPhoto } from '../_shared/bidPhotos.ts'

/**
 * A bid's photos in the app (punch list #306, PR 2; the owner, 2026-11-10: a photos icon on the Bid Board, the photos
 * kept in Google Drive and managed in the app as a job's are). The window behind the icon reads through here.
 *
 * A photo added in the app waits in the `bid-photos` bucket with a `bid_photos` row and the photo sweep files it
 * (`photo-save`, its tenth source) into the bid's project folder under Team only › Photos, where a text's photo saved
 * onto a bid already lands. This function says where that is, makes it when asked, lists what the bid has, and streams
 * a filed photo's thumbnail and bytes, since the folder is not public.
 *
 * Who: anyone signed in who can read the bid. The gate is a read of the bid through the caller's own client, so
 * `bids`' policies decide: the six roles that read a bid, a primary only on the bids they estimate, manage or made.
 * A training account and a twin read; `make` is refused to both, and their `list` adopts nothing.
 *
 *   POST { action: 'list', bid_id }           → { folder: { kind: 'none' | 'project' | 'ready', projectName, projectUrl,
 *                                                 photosUrl, hold }, photos: [{ id, name, by_name, by_user_id, taken_at,
 *                                                 added_at, bytes, storage_path, drive_file_id, filed_at, fail_why }],
 *                                                 adopted, capped }
 *                                                 the bid's added photos that stand, newest first. A picture in the
 *                                                 photo folder with no row and none of the app's marks (dragged in
 *                                                 through Drive, saved from a text) is adopted as a row first, up to
 *                                                 500 a call; `adopted` counts them. `hold` says why photos are not
 *                                                 filing (a folder in a personal Drive, one the app cannot open).
 *                                                 Nothing is made in Drive by a list.
 *   POST { action: 'make', bid_id }           → { folder } as above, after the project folder (when the bid has none:
 *                                                 under the jobs root, by the office's bid pattern, its link written
 *                                                 on the bid) and Team only › Photos are made. 409 with the hold's
 *                                                 words when the app cannot make them.
 *   POST { action: 'thumb', bid_id, file_id } → the file's thumbnail bytes (Drive's, fetched with our token), image/*
 *   POST { action: 'full', bid_id, file_id }  → the file's bytes, streamed, up to 25 MB
 *
 * A thumb or a full read is answered only for a picture whose parent is the bid's photo folder.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_SERVICE_ACCOUNT_JSON; DRIVE_JOBS_FOLDER_ID
 * (the root's fallback) and DRIVE_IMPERSONATE_USER (optional, read only to say whether a personal Drive holds photos up).
 * config.toml keeps verify_jwt = false: the JWT is checked here, so the refusal has words.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const ADOPT_MAX = 500
const FULL_CAP_BYTES = 25 * 1024 * 1024
const PHOTO_COLUMNS = 'id, name, by_name, by_user_id, taken_at, added_at, bytes, storage_path, drive_file_id, filed_at, fail_why'

interface DriveListed {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  lastModifyingUser?: { displayName?: string }
  appProperties?: Record<string, string>
}

/** The folder's pictures that carry none of the app's marks, up to the cap; `capped` when the folder holds more. */
async function unmarkedPictures(token: string, folderId: string): Promise<{ files: ListedBidPhoto[]; capped: boolean }> {
  const files: ListedBidPhoto[] = []
  let pageToken = ''
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`)
    const page = await driveGet<{ files?: DriveListed[]; nextPageToken?: string }>(
      token,
      `${DRIVE}/files?q=${q}&pageSize=200&orderBy=createdTime desc&fields=nextPageToken,files(id,name,mimeType,size,createdTime,lastModifyingUser(displayName),appProperties)&supportsAllDrives=true&includeItemsFromAllDrives=true${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    )
    for (const f of page.files ?? []) {
      if (f.mimeType === DRIVE_FOLDER_MIME) continue
      // A file the sweep put there carries its row's id: it has a row, or is about to, and is never adopted.
      if (f.appProperties?.bid_photo_id) continue
      if (files.length >= ADOPT_MAX) return { files, capped: true }
      files.push({ id: f.id, name: f.name, mime: f.mimeType ?? null, bytes: f.size == null ? null : Number(f.size), created: f.createdTime ?? null, by: f.lastModifyingUser?.displayName ?? null })
    }
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return { files, capped: false }
}

/** Rows for the folder's pictures the table does not hold; how many it made. A row another call made first is skipped. */
async function adoptStrays(admin: SupabaseClient, bidId: string, listed: readonly ListedBidPhoto[]): Promise<number> {
  if (listed.length === 0) return 0
  const { data } = await admin.from('bid_photos').select('drive_file_id').eq('bid_id', bidId).not('drive_file_id', 'is', null)
  const known = new Set(((data ?? []) as { drive_file_id: string }[]).map((r) => r.drive_file_id))
  const rows = strayPhotoRows(bidId, listed, known, new Date().toISOString())
  if (rows.length === 0) return 0
  const { error } = await admin.from('bid_photos').insert(rows)
  if (!error) return rows.length
  // Two windows opened at once: the unique index on drive_file_id refused the batch. One at a time, a taken id skipped.
  let made = 0
  for (const row of rows) {
    const { error: one } = await admin.from('bid_photos').insert(row)
    if (!one) made += 1
  }
  return made
}

/** The picture's type, name and thumbnail when it sits in the bid's photo folder; null when it does not. */
async function pictureInside(token: string, photosId: string, fileId: string): Promise<{ mime: string; thumb: string | null } | null> {
  const meta = await driveGet<{ parents?: string[]; mimeType: string; thumbnailLink?: string }>(
    token,
    `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=parents,mimeType,thumbnailLink&supportsAllDrives=true`,
  )
  if ((meta.parents?.[0] ?? null) !== photosId) return null
  if (!meta.mimeType.startsWith('image/')) return null
  return { mime: meta.mimeType, thumb: meta.thumbnailLink ?? null }
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
    const ask = parseBidPhotosAsk(await req.json().catch(() => null))
    if (!ask) return json({ error: 'That is not an ask this door takes.' }, 400)
    // The bid's own gate, under the caller's sign-in: bids' policies say who reads it.
    const { data: readable, error: gateError } = await mine.from('bids').select('id').eq('id', ask.bidId).maybeSingle()
    if (gateError || !readable) return json({ error: 'This bid is not one you can see.' }, 403)

    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!saJson) return json({ error: 'Drive is not set up here yet.' }, 503)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const archivedRefusal = await refuseArchivedCaller(admin, u?.user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal
    const { data: who } = await admin.from('users').select('read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    const caller = who as { read_only?: boolean | null; is_digital_twin?: boolean | null } | null
    const readsOnly = caller?.read_only === true || caller?.is_digital_twin === true
    if (bidPhotosAskWrites(ask) && readsOnly) {
      return json({ error: caller?.is_digital_twin ? 'A digital twin cannot make a bid’s folders.' : 'A training account cannot make a bid’s folders.' }, 403)
    }

    const bid = await readBidForFolder(admin, ask.bidId)
    if (!bid) return json({ error: 'That bid is gone.' }, 404)
    const token = await googleAccessToken(saJson)
    const ctx: BidFolderContext = {
      admin,
      token,
      settings: await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID')),
      appEmail: String((JSON.parse(saJson) as { client_email?: string }).client_email ?? ''),
      canActAsPerson: !!Deno.env.get('DRIVE_IMPERSONATE_USER')?.trim(),
    }

    if (ask.action === 'make') {
      const made = await ensureBidPhotoFolder(ctx, bid)
      if ('why' in made) return json({ error: made.why }, 409)
      const again = await readBidForFolder(admin, ask.bidId)
      const { photosId: _photosId, seen: _seen, ...folder } = await bidPhotoFolderState(ctx, again ?? bid)
      return json({ folder, made: made.made })
    }

    const state = await bidPhotoFolderState(ctx, bid)

    if (ask.action === 'list') {
      let adopted = 0
      let capped = false
      if (state.photosId && !readsOnly) {
        const listed = await unmarkedPictures(token, state.photosId)
        capped = listed.capped
        adopted = await adoptStrays(admin, ask.bidId, listed.files)
      }
      const { data: rows, error: readError } = await admin
        .from('bid_photos')
        .select(PHOTO_COLUMNS)
        .eq('bid_id', ask.bidId)
        .not('added_at', 'is', null)
        .is('removed_at', null)
        .order('taken_at', { ascending: false })
        .limit(1000)
      if (readError) return json({ error: `The bid’s photos did not read: ${readError.message}` }, 500)
      const { photosId: _photosId, seen: _seen, ...folder } = state
      return json({ folder, photos: rows ?? [], adopted, capped })
    }

    if (!state.photosId) return json({ error: 'This bid has no photo folder yet.' }, 404)
    const file = await pictureInside(token, state.photosId, ask.fileId)
    if (!file) return json({ error: 'That photo is not in the bid’s photo folder.' }, 404)

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
    console.error('bid-photos failed', e)
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
})
