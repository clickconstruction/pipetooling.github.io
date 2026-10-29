import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { freeName, photoFolderFor } from '../_shared/driveJobFolder.ts'
import type { JobRef } from '../_shared/driveLink.ts'
import {
  PHOTO_ROWS_SELECT,
  PHOTO_SAVE_BATCH,
  PHOTO_SWITCHES_SELECT,
  onSwitches,
  photoDriveName,
  photoNameInputOf,
  photoRowOf,
  photosToSave,
  type PhotoAttachmentRow,
  type PhotoRow,
  type PhotoSwitch,
} from '../_shared/gcKernels/index.ts'

/**
 * Messages, cut 10 (photos saved on arrival): the file agent's sweep. Every few minutes, on a cron, it copies each photo
 * that came in on a line tied to a job whose office ticked *Save every photo on this job to Drive as it comes in*
 * (`photo_saves`, `set_photo_save`) into that job's photos: Team only › Photos under the job's Drive folder, or a Pipeline
 * job's own Customer Pictures folder when that link is plainly a Drive folder. Each takes its name by day, sender and
 * caption (`photoDriveName`), and its row keeps `drive_file_id`, so a photo is copied once and a failed copy is tried
 * again on the next run. Only a photo that came in after the tick went on is copied (`photosToSave`); a line tied to its
 * job later is caught then. The design is quo-messages-mockup.html drafts 8 and 9 on branch spike/gc-mode.
 *
 *   POST (X-Cron-Secret) → { ticks, saved, failed: [{ id, why }], boxes: { saved, failed } }
 *
 * Materials on site (punch list #209, v2.6045): a second source after the Messages pass. A photo a crew takes of a box on
 * the On site tab waits in the box-photos bucket with a row in job_box_photos; the sweep files it in the same photo folder
 * under the row's own file_name, keeps drive_file_id, filed_at and status = filed on the row, and deletes the bucket copy.
 * A shot it cannot file gets the reason written on its row as fail_why, whatever the reason (no Drive folder on the job,
 * Drive not set up, a copy that did not read, a Drive refusal), for the office and the dev to read, and is tried again every
 * run until it files; a filed row clears it.
 *
 * A checklist per stage (punch list #164, PR 3): a third source after the boxes. The photo a checklist question asks for
 * waits in the stage-checklist-photos bucket with its name on its stage_checklist_answers row (photo_file_name,
 * photo_storage_path); the sweep files it in the same photo folder, keeps photo_drive_file_id and photo_filed_at on the
 * row, clears photo_fail_why, and deletes the bucket copy, the box photo's rules to the letter (`sweepWaiting`).
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, GOOGLE_SERVICE_ACCOUNT_JSON. config.toml keeps
 * verify_jwt = false: the cron sends no JWT, and the secret is the door.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** The job of a tick or a line, the way the save picks one: a GC project, then a bid, then a Pipeline job. */
function jobRefOf(j: { bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null }): JobRef | null {
  if (j.project_id) return { project_id: j.project_id }
  if (j.bid_id) return { bid_id: j.bid_id }
  if (j.jobs_ledger_id) return { jobs_ledger_id: j.jobs_ledger_id }
  return null
}

/** The column of the line that names a job. */
function jobColumn(job: JobRef): { column: string; id: string } {
  if ('project_id' in job) return { column: 'project_id', id: job.project_id }
  if ('bid_id' in job) return { column: 'bid_id', id: job.bid_id }
  return { column: 'jobs_ledger_id', id: job.jobs_ledger_id }
}

/** The files that may be a ticked job's photos: kept by us, not in Drive yet, on lines that came in since the tick. */
async function candidates(admin: SupabaseClient, tick: PhotoSwitch): Promise<PhotoAttachmentRow[]> {
  const job = jobRefOf(tick)
  if (!job || !tick.on_since) return []
  const { column, id } = jobColumn(job)
  const { data, error } = await admin
    .from('message_attachments')
    .select(PHOTO_ROWS_SELECT)
    .eq('kind', 'file')
    .is('drive_file_id', null)
    .is('sent_as', null)
    .not('bucket_path', 'is', null)
    .eq('messages.direction', 'in')
    .eq(`messages.${column}`, id)
    .gte('messages.at', tick.on_since)
    .order('created_at', { ascending: true })
    .limit(PHOTO_SAVE_BATCH * 5)
  if (error) throw new Error(`the files did not read: ${error.message}`)
  return (data ?? []) as unknown as PhotoAttachmentRow[]
}

async function sweep(admin: SupabaseClient): Promise<Response> {
  const { data: tickRows, error: ticksError } = await admin.from('photo_saves').select(PHOTO_SWITCHES_SELECT).not('on_since', 'is', null)
  if (ticksError) return json({ error: `The ticks did not read: ${ticksError.message}` }, 500)
  const ticks = onSwitches((tickRows ?? []) as PhotoSwitch[])
  if (ticks.length === 0) return json({ ticks: 0, saved: 0, failed: [] })

  const read: PhotoAttachmentRow[] = []
  for (const tick of ticks) read.push(...(await candidates(admin, tick)))
  const byId = new Map(read.map((a) => [a.id, a]))
  const rows = read.map(photoRowOf).filter((r): r is PhotoRow => r !== null)
  const picked = photosToSave(rows, ticks)
  if (picked.length === 0) return json({ ticks: ticks.length, saved: 0, failed: [] })

  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) return json({ error: 'Drive is not set up here yet.' }, 500)
  const google = await googleAccessToken(saJson)

  // One folder a job a run: the first photo makes Team only › Photos when it is not there yet.
  const folders = new Map<string, string | null>()
  let saved = 0
  const failed: { id: string; why: string }[] = []
  for (const row of picked) {
    const a = byId.get(row.id)!
    const job = jobRefOf(row.line)!
    const key = JSON.stringify(job)
    try {
      if (!folders.has(key)) folders.set(key, await photoFolderFor(admin, google, job))
      const into = folders.get(key)
      if (!into) {
        failed.push({ id: row.id, why: 'That job has no Drive folder yet.' })
        continue
      }
      const input = photoNameInputOf(a)!
      const { data: blob, error } = await admin.storage.from('message-attachments').download(a.bucket_path!)
      if (error || !blob) {
        failed.push({ id: row.id, why: 'Our copy of that file did not read.' })
        continue
      }
      const name = await freeName(google, into, (taken) => photoDriveName(input, taken))
      const put = await uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, a.mime || 'application/octet-stream')
      // Kept only where no save got there first, so the row names the one copy.
      const { error: kept } = await admin.from('message_attachments').update({ drive_file_id: put.id }).eq('id', row.id).is('drive_file_id', null)
      if (kept) {
        failed.push({ id: row.id, why: 'Saved to Drive, but the row did not keep it.' })
        continue
      }
      saved += 1
    } catch (e) {
      failed.push({ id: row.id, why: e instanceof Error ? e.message : String(e) })
    }
  }
  if (failed.length) console.warn('photo-save: some photos were not saved', failed)
  return json({ ticks: ticks.length, saved, failed })
}

// ---------------------------------------------------------------------------
// Materials on site (#209): the box photos, and (#164) the checklist photos. Twenty a run each, oldest first; a failure
// is written on the row and tried again next run.
// ---------------------------------------------------------------------------

const BOX_PHOTO_BATCH = 20
const BOX_PHOTOS_BUCKET = 'box-photos'

type BoxPhotoRow = { id: string; job_id: string; file_name: string; storage_path: string }

type WaitingRead = { data: unknown; error: { message: string } | null }

/** A table whose rows hold a photo waiting in a bucket for the sweep: the read, how its columns are named, and what a filed row keeps. */
interface WaitingSource {
  kind: 'boxes' | 'checklist'
  table: string
  bucket: string
  /** The waiting rows under `BoxPhotoRow`'s names: the path set, nothing filed, oldest first, a batch at most. */
  waiting: (admin: SupabaseClient) => PromiseLike<WaitingRead>
  failWhyColumn: string
  filedAtColumn: string
  driveIdColumn: string
  /** What a filed row keeps beside the Drive id, the filed time and the cleared reason. */
  filedExtra: Record<string, unknown>
}

const BOX_SOURCE: WaitingSource = {
  kind: 'boxes',
  table: 'job_box_photos',
  bucket: BOX_PHOTOS_BUCKET,
  waiting: (admin) =>
    admin.from('job_box_photos').select('id, job_id, file_name, storage_path').is('filed_at', null).not('storage_path', 'is', null).order('taken_at', { ascending: true }).limit(BOX_PHOTO_BATCH),
  failWhyColumn: 'fail_why',
  filedAtColumn: 'filed_at',
  driveIdColumn: 'drive_file_id',
  filedExtra: { status: 'filed' },
}

/** The checklist photos (#164): the row's photo columns read under the box row's names, so one sweep serves both. */
const CHECKLIST_SOURCE: WaitingSource = {
  kind: 'checklist',
  table: 'stage_checklist_answers',
  bucket: 'stage-checklist-photos',
  waiting: (admin) =>
    admin
      .from('stage_checklist_answers')
      .select('id, job_id, file_name:photo_file_name, storage_path:photo_storage_path')
      .is('photo_filed_at', null)
      .not('photo_storage_path', 'is', null)
      .order('photo_taken_at', { ascending: true })
      .limit(BOX_PHOTO_BATCH),
  failWhyColumn: 'photo_fail_why',
  filedAtColumn: 'photo_filed_at',
  driveIdColumn: 'photo_drive_file_id',
  filedExtra: {},
}

/** The row's own name, or the next free "(2)", "(3)" when the folder already holds it (any case). */
function nextFreeName(name: string, taken: ReadonlySet<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()))
  if (!lower.has(name.toLowerCase())) return name
  const m = /^(.*?)(\.[a-z0-9]{1,5})?$/i.exec(name)
  const stem = m?.[1] ?? name
  const ext = m?.[2] ?? ''
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
}

async function sweepWaiting(admin: SupabaseClient, source: WaitingSource): Promise<{ saved: number; failed: { id: string; why: string }[] }> {
  const { data, error } = await source.waiting(admin)
  if (error) return { saved: 0, failed: [{ id: '', why: `the ${source.kind === 'boxes' ? 'box' : 'checklist'} photos did not read: ${error.message}` }] }
  const rows = (data ?? []) as BoxPhotoRow[]
  if (rows.length === 0) return { saved: 0, failed: [] }
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  let saved = 0
  const failed: { id: string; why: string }[] = []
  // Every reason lands on the row, so a photo that waits says why without anyone reading this function's log.
  const fail = async (r: BoxPhotoRow, why: string) => {
    failed.push({ id: r.id, why })
    await admin.from(source.table).update({ [source.failWhyColumn]: why.slice(0, 300) }).eq('id', r.id).is(source.filedAtColumn, null)
  }
  if (!saJson) {
    for (const r of rows) await fail(r, 'Drive is not set up here yet.')
    return { saved, failed }
  }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch (e) {
    for (const r of rows) await fail(r, `Drive did not let the app in: ${e instanceof Error ? e.message : String(e)}`)
    return { saved, failed }
  }
  const folders = new Map<string, string | null>()
  for (const r of rows) {
    try {
      const job: JobRef = { jobs_ledger_id: r.job_id }
      if (!folders.has(r.job_id)) folders.set(r.job_id, await photoFolderFor(admin, google, job))
      const into = folders.get(r.job_id)
      if (!into) {
        await fail(r, 'That job has no Drive folder yet.')
        continue
      }
      const { data: blob, error: dl } = await admin.storage.from(source.bucket).download(r.storage_path)
      if (dl || !blob) {
        await fail(r, 'Our copy of that photo did not read.')
        continue
      }
      const name = await freeName(google, into, (taken) => nextFreeName(r.file_name, taken))
      const put = await uploadBytes(google, into, new Uint8Array(await blob.arrayBuffer()), name, blob.type || 'image/jpeg')
      // Kept only where no save got there first, and only while the row still names this copy (a checklist photo taken
      // again mid-run names a new path), so the row names the one copy.
      const { error: kept } = await admin
        .from(source.table)
        .update({ [source.driveIdColumn]: put.id, [source.filedAtColumn]: new Date().toISOString(), [source.failWhyColumn]: null, ...source.filedExtra })
        .eq('id', r.id)
        .is(source.driveIdColumn, null)
      if (kept) {
        await fail(r, 'Saved to Drive, but the row did not keep it.')
        continue
      }
      // No lasting copy in the app: the bucket's is gone once Drive has the file.
      await admin.storage.from(source.bucket).remove([r.storage_path])
      saved += 1
    } catch (e) {
      await fail(r, e instanceof Error ? e.message : String(e))
    }
  }
  if (failed.length) console.warn(`photo-save: some ${source.kind === 'boxes' ? 'box' : 'checklist'} photos were not filed`, failed)
  return { saved, failed }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
  if (!cronSecret || headerSecret !== cronSecret) return json({ error: 'Unauthorized' }, 401)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const messages = await sweep(admin)
    const boxes = await sweepWaiting(admin, BOX_SOURCE)
    const checklists = await sweepWaiting(admin, CHECKLIST_SOURCE)
    const body = (await messages.json()) as Record<string, unknown>
    return json({ ...body, boxes, checklists }, messages.status)
  } catch (e) {
    console.error('photo-save', e)
    return json({ error: e instanceof Error ? e.message : 'The sweep failed.' }, 500)
  }
})
