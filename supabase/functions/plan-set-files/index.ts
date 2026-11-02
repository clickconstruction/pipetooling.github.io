import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findOrCreateFolder, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { DRIVE_FOLDER_MIME, bytesOfBase64, driveViewUrl } from '../_shared/driveLink.ts'
import { driveGet } from '../_shared/driveJobFolder.ts'
import { JOB_FOLDER_TREE } from '../_shared/whereFilesGo.ts'

/**
 * Plan set files (punch list #239, PR 5). One Drive subfolder per set of plans, under the job's Plans folder, and the
 * files that land in it: the crew's as-built photos or PDF from the phone, a paper's mail attachment, a file from this
 * computer. The register is mirrored: a set with no link yet takes its folder's link the moment the folder is made,
 * so Open ↗ on the set, the job's Open plans (through the mirror) and the site's Plans look all open the same folder.
 *
 *   POST { action: 'folder', set_id }                         → { folderId, url, made }
 *   POST { action: 'put', set_id, name, mime, base64 }         → { driveFileId, url, folderUrl }   (up to 10 MB)
 *   POST { action: 'save_attachment', set_id, attachment_id }  → { driveFileId, url, folderUrl }   (our copy of a mail's file)
 *
 * Where the folder is: Plans › <set name> under the Drive folder of the set's job — the job that made the set (an
 * as-built's, a paper kept on a job), else the job that owns the part, else the first job naming the part. A set on a
 * site part with no job, or a job with no Drive folder yet, is told so in words and nothing is made. A set whose link
 * already points inside that Plans folder keeps it; a set whose link is somewhere else (the GC's Drive) keeps that
 * link too and still gets its own subfolder here for what we file.
 *
 * Who: anyone signed in who can see the set (the row is read through the caller's client, so the part's RLS decides),
 * and may write it: the office (`plan_part_can_write`) or the set's own author (a crew member's as-built or paper).
 * A training account and a digital twin change nothing. The Drive work runs as the service account.
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

const PUT_MAX_BYTES = 10 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Ask =
  | { action: 'folder'; setId: string }
  | { action: 'put'; setId: string; name: string; mime: string; base64: string }
  | { action: 'save_attachment'; setId: string; attachmentId: string }

function parseAsk(body: Record<string, unknown> | null): Ask | null {
  if (!body) return null
  const setId = typeof body.set_id === 'string' && UUID.test(body.set_id) ? body.set_id : null
  if (!setId) return null
  if (body.action === 'folder') return { action: 'folder', setId }
  if (body.action === 'put') {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
    const mime = typeof body.mime === 'string' && body.mime.trim() ? body.mime.trim().slice(0, 120) : 'application/octet-stream'
    const base64 = typeof body.base64 === 'string' ? body.base64 : ''
    return name ? { action: 'put', setId, name, mime, base64 } : null
  }
  if (body.action === 'save_attachment') {
    const attachmentId = typeof body.attachment_id === 'string' && UUID.test(body.attachment_id) ? body.attachment_id : null
    return attachmentId ? { action: 'save_attachment', setId, attachmentId } : null
  }
  return null
}

type SetRow = { id: string; part_id: string; name: string; kind: string; link: string; job_id: string | null; created_by: string | null }

/** Drive takes most characters in a name; a slash would read as a path, so it becomes a dash. */
function folderNameFor(set: SetRow): string {
  const name = set.name.replace(/[\/\\]/g, '-').replace(/\s+/g, ' ').trim()
  return (name || 'Set').slice(0, 120)
}

/** The job whose Plans folder holds the set's files, or null for a site part no job names. */
async function jobForSet(admin: SupabaseClient, set: SetRow): Promise<string | null> {
  if (set.job_id) return set.job_id
  const { data: part } = await admin.from('plan_parts').select('job_id').eq('id', set.part_id).maybeSingle()
  const own = (part as { job_id?: string | null } | null)?.job_id ?? null
  if (own) return own
  const { data: first } = await admin.from('jobs_ledger').select('id').eq('plan_part_id', set.part_id).order('created_at').limit(1).maybeSingle()
  return (first as { id?: string } | null)?.id ?? null
}

/** Whether the folder sits directly inside the parent given. */
async function isChildOf(token: string, folderId: string, parentId: string): Promise<boolean> {
  try {
    const meta = await driveGet<{ parents?: string[]; mimeType?: string }>(token, `${DRIVE}/files/${folderId}?fields=parents,mimeType&supportsAllDrives=true`)
    return meta.mimeType === DRIVE_FOLDER_MIME && (meta.parents ?? []).includes(parentId)
  } catch {
    return false
  }
}

type SetFolder = { id: string; url: string; made: boolean }

/**
 * The set's folder, made as needed: Plans › <set name> under the job's folder. A set whose link already points at a
 * folder inside that Plans folder keeps it. A set with no link takes the folder's link (the register mirrored).
 */
async function setFolder(admin: SupabaseClient, token: string, set: SetRow): Promise<SetFolder | { why: string; code: string; status: number }> {
  const jobId = await jobForSet(admin, set)
  if (!jobId) return { why: 'No job names this part yet, so there is no job folder to file into. Paste the set’s Drive link by hand, or add the set on a job.', code: 'no_job', status: 409 }
  const { data: job } = await admin.from('jobs_ledger').select('google_drive_link, drive_folder_hold').eq('id', jobId).maybeSingle()
  const row = job as { google_drive_link?: string | null; drive_folder_hold?: string | null } | null
  const jobFolderId = driveFolderIdFromUrl(row?.google_drive_link ?? null)
  if (!jobFolderId) return { why: row?.drive_folder_hold ? `The job’s Drive folder is held: ${row.drive_folder_hold}` : 'That job has no Drive folder yet. The Documents tab says when the sweep makes one; then file the set again.', code: 'no_folder', status: 409 }
  const plans = await findOrCreateFolder(token, jobFolderId, JOB_FOLDER_TREE.plans)
  const linked = driveFolderIdFromUrl(set.link || null)
  if (linked && (await isChildOf(token, linked, plans.id))) return { id: linked, url: driveViewUrl(linked, DRIVE_FOLDER_MIME), made: false }
  const own = await findOrCreateFolder(token, plans.id, folderNameFor(set))
  const url = driveViewUrl(own.id, DRIVE_FOLDER_MIME)
  if (!set.link) {
    // The mirror onto job_plans_link is the database's own trigger on plan_sets.link.
    await admin.from('plan_sets').update({ link: url }).eq('id', set.id).eq('link', '')
  }
  return { id: own.id, url, made: own.created }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const auth = req.headers.get('Authorization') ?? ''
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await anon.auth.getUser()
    if (!u?.user) return json({ error: 'Sign in first.' }, 401)

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const ask = parseAsk(body)
    if (!ask) return json({ error: 'That is not an ask this door takes.' }, 400)

    // The set as the caller may see it: the part's RLS decides.
    const { data: setData, error: setErr } = await anon.from('plan_sets').select('id, part_id, name, kind, link, job_id, created_by').eq('id', ask.setId).maybeSingle()
    if (setErr) return json({ error: setErr.message }, 500)
    const set = setData as SetRow | null
    if (!set) return json({ error: 'That set is not one you can see.' }, 404)

    const { data: who } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    const me = who as { role?: string; read_only?: boolean; is_digital_twin?: boolean } | null
    if (me?.is_digital_twin) return json({ error: 'A digital twin cannot change Drive.' }, 403)
    if (me?.read_only) return json({ error: 'A training account cannot change Drive.' }, 403)
    const { data: canWrite } = await anon.rpc('plan_part_can_write', { p_part_id: set.part_id })
    if (canWrite !== true && set.created_by !== u.user.id) return json({ error: 'Only the office, or whoever added the set, files into it.' }, 403)

    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!saJson) return json({ error: 'Drive is not set up here yet.' }, 503)
    const google = await googleAccessToken(saJson)

    const folder = await setFolder(admin, google, set)
    if ('why' in folder) return json({ error: folder.why, why: folder.code }, folder.status)

    if (ask.action === 'folder') return json({ folderId: folder.id, url: folder.url, made: folder.made })

    if (ask.action === 'put') {
      if (ask.base64.length > Math.ceil((PUT_MAX_BYTES * 4) / 3) + 200) return json({ error: 'Over 10 MB. Put it in the set’s folder in Drive instead.' }, 413)
      const bytes = bytesOfBase64(ask.base64)
      if (!bytes || bytes.length === 0) return json({ error: 'That file did not come through.' }, 400)
      if (bytes.length > PUT_MAX_BYTES) return json({ error: 'Over 10 MB. Put it in the set’s folder in Drive instead.' }, 413)
      const put = await uploadBytes(google, folder.id, bytes, ask.name, ask.mime)
      return json({ driveFileId: put.id, url: driveViewUrl(put.id, ask.mime), folderUrl: folder.url })
    }

    // save_attachment: our copy of a mail's file, from the message-attachments bucket, into the set's folder.
    const { data: att } = await admin
      .from('message_attachments')
      .select('id, kind, name, mime, bucket_path, message_id, messages(jobs_ledger_id)')
      .eq('id', ask.attachmentId)
      .maybeSingle()
    const a = att as { id: string; kind: string; name: string; mime: string | null; bucket_path: string | null; messages: { jobs_ledger_id: string | null } | null } | null
    if (!a || a.kind !== 'file' || !a.bucket_path) return json({ error: 'That file is not one we kept.' }, 404)
    const setJob = await jobForSet(admin, set)
    if (!a.messages?.jobs_ledger_id || a.messages.jobs_ledger_id !== setJob) {
      // The mail may be tagged to another job on the same part: any job naming the part is the same register.
      const { data: onPart } = a.messages?.jobs_ledger_id ? await admin.from('jobs_ledger').select('id').eq('id', a.messages.jobs_ledger_id).eq('plan_part_id', set.part_id).maybeSingle() : { data: null }
      if (!onPart) return json({ error: 'That mail is not tagged to a job on this set’s part.' }, 409)
    }
    const { data: blob, error } = await admin.storage.from('message-attachments').download(a.bucket_path)
    if (error || !blob) return json({ error: 'Our copy of that file did not read.' }, 500)
    const mime = a.mime || 'application/octet-stream'
    const put = await uploadBytes(google, folder.id, new Uint8Array(await blob.arrayBuffer()), a.name, mime)
    return json({ driveFileId: put.id, url: driveViewUrl(put.id, mime), folderUrl: folder.url })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'The files did not land.' }, 500)
  }
})
