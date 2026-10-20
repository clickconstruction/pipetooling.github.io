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
 *   POST (X-Cron-Secret) → { ticks, saved, failed: [{ id, why }] }
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
  if (!cronSecret || headerSecret !== cronSecret) return json({ error: 'Unauthorized' }, 401)
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    return await sweep(admin)
  } catch (e) {
    console.error('photo-save', e)
    return json({ error: e instanceof Error ? e.message : 'The sweep failed.' }, 500)
  }
})
