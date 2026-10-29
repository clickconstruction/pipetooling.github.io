import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findOrCreateFolder, googleAccessToken } from '../_shared/driveUpload.ts'
import { checkFolderWrite, DRIVE_SETTINGS_KEYS, NO_ROOT_WORDS, readDriveSettings, type DriveFolderFacts } from '../_shared/driveSettings.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import {
  BID_FOLDER_PIECES,
  DRIVE_BID_FOLDER_PATTERN_KEY,
  DRIVE_FOLDERS_MADE_KEY,
  DRIVE_JOB_FOLDER_PATTERN_KEY,
  DRIVE_JOBS_ROOT_FOLDER_ID_KEY,
  driveFolderIdFromLinkOrId,
  folderName,
  folderPatternJson,
  JOB_FOLDER_PIECES,
  JOB_FOLDER_TREE,
  parseFolderPattern,
  parseFoldersMade,
  type DriveSettings,
} from '../_shared/whereFilesGo.ts'

/**
 * job-drive-folders — Materials on site (punch list #209), the owner's ask of 2026-10-29: a tool of ours makes a
 * Pipeline job's Google Drive folders, so the office never makes them by hand and the app's service account can
 * always write there (the first box photo stopped at a Drive 403 on a hand-made pictures folder). Since Where files
 * go (punch list #211) the office sets the root and the name's pattern on Documents → Where files go, and the same
 * function carries that tab's three verbs. Four bodies:
 *
 *   POST { job_id }                                                      — the press
 *     Finds or makes the job's folder, named by the office's pattern (`folderName`, `<job number> · <job name>` as it
 *     ships), under the jobs root (the setting `drive_jobs_root_folder_id`, the DRIVE_JOBS_FOLDER_ID env while it is
 *     empty: the Jobs folder in the "PipeTooling Jobs" Shared Drive, so every new folder inherits its sharing) and
 *     under it Customer Pictures, Plans and Team only, with Photos and Sent by us inside Team only. A job whose bid
 *     already has a folder (bids.drive_link, made by drive-intake) takes that folder as its own, so a bid's folder
 *     and its job's meet. Writes jobs_ledger.google_drive_link, job_pictures_link and job_plans_link where they
 *     are empty; a link already set is kept, and the answer says whether the service account can write there.
 *     Idempotent: a second press finds what is there and makes only what is missing. When the office's choice is
 *     as-needed (`drive_folders_made`, Where files go PR 3), a job that had no folder gets its folder alone and the
 *     link on the job; the folders inside are made as something first lands in them (`photoFolderFor`, `landingFolder`),
 *     and the answer names them `later`. A press on a job that has its folder fills in what is missing either way.
 *
 *   POST { check: { folder } }                                           — the write check (#211)
 *     A folder link or id → whether the service account can add a file there, in the words every surface shares
 *     (`writeCheckWords`): *The app can write here.* or Drive's refusal with the account to share it with; with the
 *     folder's name, path, owner or Shared Drive and the count of folders inside. Nothing is written by the check.
 *
 *   POST { settings: true }                                              — the tab's read (#211)
 *     The four settings, where the root came from (the setting or the env), the root's live check, the pieces a
 *     pattern may hold and the account's address.
 *
 *   POST { set: { root?, job_pattern?, bid_pattern?, folders_made? } }  — the tab's write (#211)
 *     Saves what is given. A new root is checked first and refused (409) when the app cannot write there, so the
 *     root never points where the sweeps would fail. Written with the service role: the office roles write here
 *     without a key-scoped policy on app_settings. A change applies to folders made from then on; nothing is moved.
 *
 * Refusals in words, each with a `why` the page reads: a Drive link on the job that is not a folder
 * (`not_a_folder`), a folder the service account cannot open or write in (`folder_unshared`, with the account's
 * email to share it with), a root the app cannot write in (`root_unwritable`).
 *
 * Auth: a staff JWT, office roles (dev, master_technician, assistant, controller, estimator) for the press, the
 * check and the read; the four office roles without the estimator for `set`; never a training account or a digital
 * twin, as gc-drive-access checks (the service role writes here, so the read-only blocks and the twin fence never
 * see it); verify_jwt = false and validated here. Google auth is the service account (GOOGLE_SERVICE_ACCOUNT_JSON);
 * setup in docs/DRIVE_INTAKE_SETUP.md.
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
/** Who sets where files go: the office, not the estimators. */
const SETTINGS_ROLES = ['dev', 'master_technician', 'assistant', 'controller']
const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`

/** The folder names under a job's folder, as photo-save and drive-link look for them. */
const { pictures: PICTURES, plans: PLANS, teamOnly: TEAM_ONLY, photos: PHOTOS, sentByUs: SENT_BY_US } = JOB_FOLDER_TREE

/** Where a folder came from; `later` is a folder inside that the sweeps make as something first lands in it (as-needed). */
type Source = 'kept' | 'bid' | 'found' | 'made' | 'later'

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

type JobRow = { id: string; hcp_number: string | null; job_name: string | null; customer_name: string | null; job_address: string | null; created_at: string | null }

/** The pieces a job's folder name can be built from, as the office's pattern picks them. */
function jobFacts(job: JobRow) {
  return {
    id: job.id,
    number: job.hcp_number,
    name: job.job_name,
    customer: job.customer_name,
    address: job.job_address,
    year: job.created_at ? todayYmdInAppTz(new Date(job.created_at)).slice(0, 4) : null,
  }
}

/** The tab's answer: the settings, the root's live check and the pieces the trays offer. */
async function settingsAnswer(token: string, appEmail: string, settings: DriveSettings) {
  const root = settings.rootFolderId
  const check = root ? await checkFolderWrite(token, root, appEmail) : null
  return {
    success: true,
    app_email: appEmail,
    root: root ? { id: root, url: folderUrl(root), from: settings.rootFrom, ok: check?.ok ?? false, words: check?.words ?? NO_ROOT_WORDS, folder: check?.folder ?? null } : null,
    job_pattern: settings.jobPattern,
    bid_pattern: settings.bidPattern,
    folders_made: settings.foldersMade,
    pieces: { job: JOB_FOLDER_PIECES, bid: BID_FOLDER_PIECES },
    keys: DRIVE_SETTINGS_KEYS,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' }, 500)
    if (!saJson) return json({ error: 'Drive is not set up for the app yet: set GOOGLE_SERVICE_ACCOUNT_JSON (docs/DRIVE_INTAKE_SETUP.md).' }, 503)
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

    const body = (await req.json().catch(() => ({}))) as {
      job_id?: string
      check?: { folder?: string }
      settings?: boolean
      set?: { root?: string | null; job_pattern?: unknown; bid_pattern?: unknown; folders_made?: unknown }
    }
    const appEmail = String((JSON.parse(saJson) as { client_email?: string }).client_email ?? '')
    const token = await googleAccessToken(saJson)
    const settings = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))

    // --- the write check: a folder link or id → the words, and the folder's facts ---
    if (body.check) {
      const id = driveFolderIdFromLinkOrId(body.check.folder)
      const r = await checkFolderWrite(token, id, appEmail)
      return json({ success: true, ok: r.ok, words: r.words, app_email: appEmail, folder: r.folder, url: id ? folderUrl(id) : null })
    }

    // --- the tab's read ---
    if (body.settings) return json(await settingsAnswer(token, appEmail, settings))

    // --- the tab's write: the root only once the app can write there ---
    if (body.set) {
      if (!SETTINGS_ROLES.includes(String(who.role))) return json({ error: 'The office sets where files go.' }, 403)
      const rows: { key: string; value_text: string }[] = []
      let rootFacts: DriveFolderFacts | null = null
      if (body.set.root !== undefined) {
        const id = driveFolderIdFromLinkOrId(body.set.root)
        if (!id) return json({ error: 'Paste the link of a Drive folder to use as the jobs root.', why: 'not_a_folder' }, 400)
        const r = await checkFolderWrite(token, id, appEmail)
        if (!r.ok) return json({ error: r.words, why: 'root_unwritable', app_email: appEmail, folder: r.folder }, 409)
        rootFacts = r.folder
        rows.push({ key: DRIVE_JOBS_ROOT_FOLDER_ID_KEY, value_text: id })
      }
      if (body.set.job_pattern !== undefined) {
        const pattern = parseFolderPattern(JSON.stringify(body.set.job_pattern), JOB_FOLDER_PIECES, [])
        if (pattern.length === 0) return json({ error: 'A job’s folder name needs at least one piece.' }, 400)
        rows.push({ key: DRIVE_JOB_FOLDER_PATTERN_KEY, value_text: folderPatternJson(pattern) })
      }
      if (body.set.bid_pattern !== undefined) {
        const pattern = parseFolderPattern(JSON.stringify(body.set.bid_pattern), BID_FOLDER_PIECES, [])
        if (pattern.length === 0) return json({ error: 'A bid’s folder name needs at least one piece.' }, 400)
        rows.push({ key: DRIVE_BID_FOLDER_PATTERN_KEY, value_text: folderPatternJson(pattern) })
      }
      if (body.set.folders_made !== undefined) {
        const made = String(body.set.folders_made ?? '')
        if (made !== 'upfront' && made !== 'as-needed') return json({ error: 'folders_made is upfront or as-needed.' }, 400)
        rows.push({ key: DRIVE_FOLDERS_MADE_KEY, value_text: parseFoldersMade(made) })
      }
      if (rows.length === 0) return json({ error: 'Nothing to set.' }, 400)
      const { error } = await admin.from('app_settings').upsert(rows, { onConflict: 'key' })
      if (error) return json({ error: `The setting was not saved: ${error.message}` }, 500)
      const after = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))
      const answer = await settingsAnswer(token, appEmail, after)
      return json({ ...answer, saved: rows.map((r) => r.key), root_folder: rootFacts ?? answer.root?.folder ?? null })
    }

    // --- the press: one job's folders ---
    const jobId = String(body.job_id ?? '').trim()
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: 'job_id is required' }, 400)
    const jobsFolderId = settings.rootFolderId
    if (!jobsFolderId) return json({ error: NO_ROOT_WORDS, why: 'no_root' }, 503)
    const { data: jobData } = await admin
      .from('jobs_ledger')
      .select('id, hcp_number, job_name, customer_name, job_address, created_at, bid_id, google_drive_link, job_pictures_link, job_plans_link')
      .eq('id', jobId)
      .maybeSingle()
    const job = jobData as (JobRow & { bid_id: string | null; google_drive_link: string | null; job_pictures_link: string | null; job_plans_link: string | null }) | null
    if (!job) return json({ error: 'No job with that id.' }, 404)

    // --- the job's folder: kept, its bid's, found under the root, or made there ---
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
      const made = await findOrCreateFolder(token, jobsFolderId, folderName(settings.jobPattern, jobFacts(job)))
      folderId = made.id
      folderSource = made.created ? 'made' : 'found'
    }

    // --- as needed: the job's folder alone, the folders inside as something first lands in them ---
    const picturesLink = String(job.job_pictures_link ?? '').trim()
    const plansLink = String(job.job_plans_link ?? '').trim()
    if (settings.foldersMade === 'as-needed' && folderSource !== 'kept') {
      const patch: Record<string, string> = {}
      if (!ownLink) patch.google_drive_link = folderUrl(folderId)
      if (Object.keys(patch).length > 0) {
        const { error } = await admin.from('jobs_ledger').update(patch).eq('id', job.id)
        if (error) return json({ error: `The folder was made but not recorded on the job: ${error.message}` }, 500)
      }
      const later = { url: '', source: 'later' as Source, writable: null as boolean | null }
      return json({
        success: true,
        app_email: appEmail,
        folders_made: settings.foldersMade,
        folder: { url: folderUrl(folderId), source: folderSource },
        pictures: picturesLink ? await keptLink(token, picturesLink) : later,
        plans: plansLink ? await keptLink(token, plansLink) : later,
        team_url: '',
        photos_url: '',
        sent_url: '',
        stamped: Object.keys(patch),
      })
    }

    // --- the folders inside, each found or made ---
    const pictures = await findOrCreateFolder(token, folderId, PICTURES)
    const plans = await findOrCreateFolder(token, folderId, PLANS)
    const team = await findOrCreateFolder(token, folderId, TEAM_ONLY)
    const photos = await findOrCreateFolder(token, team.id, PHOTOS)
    const sent = await findOrCreateFolder(token, team.id, SENT_BY_US)
    const madeOrFound = (f: { id: string; created: boolean }) => ({ url: folderUrl(f.id), source: (f.created ? 'made' : 'found') as Source, writable: true as boolean | null })

    // --- the links on the job: written where empty, kept where set ---
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
      folders_made: settings.foldersMade,
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
