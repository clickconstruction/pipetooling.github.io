import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findOrCreateFolder, googleAccessToken } from '../_shared/driveUpload.ts'

/**
 * job-drive-folders — Materials on site (punch list #209), the owner's ask of 2026-10-29: a tool of ours makes a
 * Pipeline job's Google Drive folders, so the office never makes them by hand and the app's service account can
 * always write there (the first box photo stopped at a Drive 403 on a hand-made pictures folder). One press:
 *
 *   POST { job_id }
 *     Finds or makes `<job number> · <job name>` under DRIVE_JOBS_FOLDER_ID (the Jobs folder in the "PipeTooling
 *     Jobs" Shared Drive, so every new folder inherits its sharing: the office sees it and the sweeps write) and
 *     under it Customer Pictures, Plans and Team only, with Photos and Sent by us inside Team only. A job whose bid
 *     already has a folder (bids.drive_link, made by drive-intake) takes that folder as its own, so a bid's folder
 *     and its job's meet. Writes jobs_ledger.google_drive_link, job_pictures_link and job_plans_link where they
 *     are empty; a link already set is kept, and the answer says whether the service account can write there.
 *     Idempotent: a second press finds what is there and makes only what is missing.
 *
 * Refusals in words, each with a `why` the page reads: a Drive link on the job that is not a folder
 * (`not_a_folder`), a folder the service account cannot open or write in (`folder_unshared`, with the account's
 * email to share it with).
 *
 * Auth: a staff JWT, office roles (dev, master_technician, assistant, controller, estimator); never a training
 * account or a digital twin, as gc-drive-access checks (the service role writes here, so the read-only blocks and
 * the twin fence never see it); verify_jwt = false and validated here. Google auth is the service account
 * (GOOGLE_SERVICE_ACCOUNT_JSON); the root is DRIVE_JOBS_FOLDER_ID (docs/DRIVE_INTAKE_SETUP.md).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const OFFICE_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']
const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`

/** The folder names under a job's folder, as photo-save and drive-link look for them. */
const PICTURES = 'Customer Pictures'
const PLANS = 'Plans'
const TEAM_ONLY = 'Team only'
const PHOTOS = 'Photos'
const SENT_BY_US = 'Sent by us'

type Source = 'kept' | 'bid' | 'found' | 'made'

/** Whether the service account can open a folder and put a file in it, as Drive sees its capabilities. */
async function canWrite(token: string, id: string): Promise<boolean> {
  const res = await fetch(`${DRIVE}/files/${encodeURIComponent(id)}?fields=id,capabilities/canAddChildren&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 403 || res.status === 404) return false
  if (!res.ok) throw new Error(`Drive answered ${res.status} when the app looked at the job's folder.`)
  const body = (await res.json().catch(() => ({}))) as { capabilities?: { canAddChildren?: boolean } }
  return body.capabilities?.canAddChildren === true
}

/** A link the job already holds: kept as it is, with whether the app can write there (null for a link that is not a Drive folder). */
async function keptLink(token: string, url: string): Promise<{ url: string; source: 'kept'; writable: boolean | null }> {
  const id = driveFolderIdFromUrl(url)
  return { url, source: 'kept', writable: id ? await canWrite(token, id) : null }
}

/** The folder's name in Drive: the job number, then the name, as the Materials desk labels a job. */
function jobFolderName(job: { id: string; hcp_number: string | null; job_name: string | null }): string {
  const clean = (s: string | null) => String(s ?? '').replace(/\\/g, ' ').replace(/\s+/g, ' ').trim()
  const name = [clean(job.hcp_number), clean(job.job_name)].filter(Boolean).join(' · ')
  return (name || `Job ${job.id.slice(0, 8)}`).slice(0, 120)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const jobsFolderId = Deno.env.get('DRIVE_JOBS_FOLDER_ID')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' }, 500)
    if (!saJson || !jobsFolderId) return json({ error: 'Drive is not set up for the app yet: set GOOGLE_SERVICE_ACCOUNT_JSON and DRIVE_JOBS_FOLDER_ID (docs/DRIVE_INTAKE_SETUP.md).' }, 503)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // --- the caller: a staff session with an office role, never a training account or a twin ---
    const auth = req.headers.get('Authorization') ?? ''
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await anon.auth.getUser()
    if (!u?.user) return json({ error: 'Sign in first.' }, 401)
    const { data: who } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    if (!who || !OFFICE_ROLES.includes(String(who.role))) return json({ error: 'Office only.' }, 403)
    if (who.read_only) return json({ error: 'A training account cannot change Drive or the job.' }, 403)
    if (who.is_digital_twin) return json({ error: 'A digital twin cannot change Drive or the job.' }, 403)

    const body = (await req.json().catch(() => ({}))) as { job_id?: string }
    const jobId = String(body.job_id ?? '').trim()
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: 'job_id is required' }, 400)
    const { data: job } = await admin
      .from('jobs_ledger')
      .select('id, hcp_number, job_name, bid_id, google_drive_link, job_pictures_link, job_plans_link')
      .eq('id', jobId)
      .maybeSingle()
    if (!job) return json({ error: 'No job with that id.' }, 404)

    const appEmail = String((JSON.parse(saJson) as { client_email?: string }).client_email ?? '')
    const token = await googleAccessToken(saJson)

    // --- the job's folder: kept, its bid's, found under Jobs, or made there ---
    let folderId: string | null = null
    let folderSource: Source = 'made'
    const ownLink = String(job.google_drive_link ?? '').trim()
    if (ownLink) {
      const ownId = driveFolderIdFromUrl(ownLink)
      if (!ownId) return json({ error: 'This job’s Drive link is not a folder. Fix the link on the Edit tab, then press again.', why: 'not_a_folder' }, 409)
      if (!(await canWrite(token, ownId))) {
        return json({ error: `The app cannot write in this job’s Drive folder. Share the folder with ${appEmail} as an editor, or clear the link on the Edit tab and press again.`, why: 'folder_unshared', app_email: appEmail }, 409)
      }
      folderId = ownId
      folderSource = 'kept'
    } else if (job.bid_id) {
      const { data: bid } = await admin.from('bids').select('drive_link').eq('id', job.bid_id).maybeSingle()
      const bidId = driveFolderIdFromUrl((bid as { drive_link?: string | null } | null)?.drive_link ?? null)
      if (bidId && (await canWrite(token, bidId))) {
        folderId = bidId
        folderSource = 'bid'
      }
    }
    if (!folderId) {
      const made = await findOrCreateFolder(token, jobsFolderId, jobFolderName(job))
      folderId = made.id
      folderSource = made.created ? 'made' : 'found'
    }

    // --- the folders inside, each found or made ---
    const pictures = await findOrCreateFolder(token, folderId, PICTURES)
    const plans = await findOrCreateFolder(token, folderId, PLANS)
    const team = await findOrCreateFolder(token, folderId, TEAM_ONLY)
    const photos = await findOrCreateFolder(token, team.id, PHOTOS)
    const sent = await findOrCreateFolder(token, team.id, SENT_BY_US)
    const madeOrFound = (f: { id: string; created: boolean }) => ({ url: folderUrl(f.id), source: (f.created ? 'made' : 'found') as Source, writable: true as boolean | null })

    // --- the links on the job: written where empty, kept where set ---
    const picturesLink = String(job.job_pictures_link ?? '').trim()
    const plansLink = String(job.job_plans_link ?? '').trim()
    const picturesOut = picturesLink ? await keptLink(token, picturesLink) : madeOrFound(pictures)
    const plansOut = plansLink ? await keptLink(token, plansLink) : madeOrFound(plans)
    const patch: Record<string, string> = {}
    if (!ownLink) patch.google_drive_link = folderUrl(folderId)
    if (!picturesLink) patch.job_pictures_link = picturesOut.url
    if (!plansLink) patch.job_plans_link = plansOut.url
    if (Object.keys(patch).length > 0) {
      const { error } = await admin.from('jobs_ledger').update(patch).eq('id', job.id)
      if (error) return json({ error: `The folders were made but not recorded on the job: ${error.message}` }, 500)
    }

    return json({
      success: true,
      app_email: appEmail,
      folder: { url: folderUrl(folderId), source: folderSource },
      pictures: picturesOut,
      plans: plansOut,
      team_url: folderUrl(team.id),
      photos_url: folderUrl(photos.id),
      sent_url: folderUrl(sent.id),
      stamped: Object.keys(patch),
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
