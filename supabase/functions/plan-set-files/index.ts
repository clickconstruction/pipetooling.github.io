import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findOrCreateFolder, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { DRIVE_FOLDER_MIME, bytesOfBase64, driveViewUrl } from '../_shared/driveLink.ts'
import { driveGet } from '../_shared/driveJobFolder.ts'
import { driveQueryTerm } from '../_shared/fileIndexKernel.ts'
import { JOB_FOLDER_TREE } from '../_shared/whereFilesGo.ts'
import { parsePlanSetFilesAsk, runPlanSetFiles, type MailAttachmentRow, type PlanSetFileRow, type PlanSetFilesDrive } from '../_shared/planSetFilesRun.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * Plan set files (punch list #239, PR 5). One Drive subfolder per set of plans, under the job's Plans folder, and the
 * files that land in it: the crew's as-built photos or PDF from the phone, a paper's mail attachment, a file from this
 * computer. The register is mirrored: a set with no link yet takes its folder's link the moment the folder is made,
 * so Open ↗ on the set, the job's Open plans (through the mirror) and the site's Plans look all open the same folder.
 *
 *   POST { action: 'folder', set_id }                         → { folderId, url, made }
 *   POST { action: 'put', set_id, name, mime, base64 }         → { driveFileId, url, folderUrl }   (up to 10 MB)
 *   POST { action: 'save_attachment', set_id, attachment_id }  → { driveFileId, url, folderUrl, reused? }   (our copy of a mail's file)
 *
 * The rules are `_shared/planSetFilesRun.ts`, tested with a fake from `src/lib/plans/planSetFilesRun.test.ts`: where
 * the folder is, who may file, what is checked before anything is made, how two sets of one name keep two folders.
 * This file wires them to Supabase and Drive. A read that fails throws with its reason, so a database blip never reads
 * as *no Drive folder* or *not one we kept*.
 *
 * Who: anyone signed in who can see the set (the row is read through the caller's client, so the part's RLS decides),
 * and may write it: the office (`plan_part_can_write`) or the set's own author on a job they are on (a crew member's
 * as-built or paper). A mail's file is read through the caller's client too, so its own RLS holds it to the office.
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

/** A read's row, or null when there is none. A read that failed says so. */
function rowOf<T>(r: { data: unknown; error: { message: string } | null }, what: string): T | null {
  if (r.error) throw new Error(`${what} did not read: ${r.error.message}`)
  return (r.data ?? null) as T | null
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

function driveDoor(token: string): PlanSetFilesDrive {
  return {
    plansFolder: async (jobFolderId) => (await findOrCreateFolder(token, jobFolderId, JOB_FOLDER_TREE.plans)).id,
    isChildOf: (folderId, parentId) => isChildOf(token, folderId, parentId),
    findOrCreateFolder: (parentId, name) => findOrCreateFolder(token, parentId, name),
    filesNamed: async (folderId, name) => {
      const q = encodeURIComponent(`name = '${driveQueryTerm(name)}' and '${folderId}' in parents and mimeType != '${DRIVE_FOLDER_MIME}' and trashed = false`)
      const page = await driveGet<{ files?: Array<{ id: string; size?: string }> }>(token, `${DRIVE}/files?q=${q}&fields=files(id,size)&supportsAllDrives=true&includeItemsFromAllDrives=true`)
      return (page.files ?? []).map((f) => ({ id: f.id, size: f.size == null ? null : Number(f.size) }))
    },
    upload: (folderId, bytes, name, mime) => uploadBytes(token, folderId, bytes, name, mime),
  }
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
    const archivedRefusal = await refuseArchivedCaller(admin, u?.user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal
    const callerId = u?.user?.id
    if (!callerId) return json({ error: 'Sign in first.' }, 401)

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    const ask = parsePlanSetFilesAsk(body)
    if (!ask) return json({ error: 'That is not an ask this door takes.' }, 400)

    const reply = await runPlanSetFiles(ask, callerId, {
      readSet: async (setId) => rowOf<PlanSetFileRow>(await anon.from('plan_sets').select('id, part_id, name, kind, link, job_id, created_by').eq('id', setId).maybeSingle(), 'The set'),
      readAttachment: async (attachmentId) => {
        const row = rowOf<Omit<MailAttachmentRow, 'jobs_ledger_id'> & { messages: { jobs_ledger_id: string | null } | null }>(
          await anon.from('message_attachments').select('id, kind, name, mime, bucket_path, messages(jobs_ledger_id)').eq('id', attachmentId).maybeSingle(),
          'That file',
        )
        return row && { id: row.id, kind: row.kind, name: row.name, mime: row.mime, bucket_path: row.bucket_path, jobs_ledger_id: row.messages?.jobs_ledger_id ?? null }
      },
      canWritePart: async (partId) => {
        const r = await anon.rpc('plan_part_can_write', { p_part_id: partId })
        return rowOf<boolean>(r, 'Who may write this part') === true
      },
      readMe: async () => rowOf(await admin.from('users').select('read_only, is_digital_twin').eq('id', callerId).maybeSingle(), 'Your account'),
      isOnJobTeam: async (jobId) => (rowOf<unknown[]>(await admin.from('jobs_ledger_team_members').select('job_id').eq('job_id', jobId).eq('user_id', callerId).limit(1), 'The job’s team') ?? []).length > 0,
      partOfJob: async (jobId) => rowOf<{ plan_part_id: string | null }>(await admin.from('jobs_ledger').select('plan_part_id').eq('id', jobId).maybeSingle(), 'The job')?.plan_part_id ?? null,
      ownerJobOfPart: async (partId) => rowOf<{ job_id: string | null }>(await admin.from('plan_parts').select('job_id').eq('id', partId).maybeSingle(), 'The part')?.job_id ?? null,
      jobsOnPart: async (partId) => rowOf<Array<{ id: string; google_drive_link: string | null }>>(await admin.from('jobs_ledger').select('id, google_drive_link').eq('plan_part_id', partId).order('created_at').limit(100), 'The part’s jobs') ?? [],
      jobFolderOf: async (jobId) => rowOf(await admin.from('jobs_ledger').select('google_drive_link, drive_folder_hold').eq('id', jobId).maybeSingle(), 'The job'),
      otherSetHolds: async (folderId, setId) => (rowOf<unknown[]>(await admin.from('plan_sets').select('id').like('link', `%${folderId}%`).neq('id', setId).limit(1), 'The sets on that folder') ?? []).length > 0,
      stampLink: async (setId, url) => {
        // The mirror onto job_plans_link is the database's own trigger on plan_sets.link.
        const { error } = await admin.from('plan_sets').update({ link: url }).eq('id', setId).eq('link', '')
        if (error) throw new Error(`The folder is made, but the set did not take its link: ${error.message}`)
      },
      download: async (bucketPath) => {
        const { data, error } = await admin.storage.from('message-attachments').download(bucketPath)
        return error || !data ? null : new Uint8Array(await data.arrayBuffer())
      },
      decodeBase64: bytesOfBase64,
      folderIdFromUrl: driveFolderIdFromUrl,
      folderUrl: (folderId) => driveViewUrl(folderId, DRIVE_FOLDER_MIME),
      fileUrl: driveViewUrl,
      drive: async () => {
        const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
        return saJson ? driveDoor(await googleAccessToken(saJson)) : null
      },
    })
    return json(reply.body, reply.status)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'The files did not land.' }, 500)
  }
})
