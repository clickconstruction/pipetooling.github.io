import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { googleAccessToken } from '../_shared/driveUpload.ts'
import { checkFolderWrite, DRIVE_SETTINGS_KEYS, NO_ROOT_WORDS, readDriveSettings, type DriveFolderFacts } from '../_shared/driveSettings.ts'
import { FolderTree, JOB_FOLDER_COLUMNS, folderUrl, type FolderHold, type JobFolderRow, type PlaceAct } from '../_shared/jobFolders.ts'
import {
  BID_FOLDER_PIECES,
  DRIVE_BID_FOLDER_PATTERN_KEY,
  DRIVE_FOLDERS_MADE_KEY,
  DRIVE_JOB_FOLDER_PATTERN_KEY,
  DRIVE_JOBS_ROOT_FOLDER_ID_KEY,
  driveFolderIdFromLinkOrId,
  folderPatternJson,
  JOB_FOLDER_PIECES,
  parseFolderPattern,
  parseFoldersMade,
  type DriveSettings,
  tidyOutcomeWords,
  type TidyCounts,
} from '../_shared/whereFilesGo.ts'

/**
 * job-drive-folders — Materials on site (punch list #209), the owner's ask of 2026-10-29: a tool of ours makes a
 * Pipeline job's Google Drive folders, so the office never makes them by hand and the app's service account can
 * always write there (the first box photo stopped at a Drive 403 on a hand-made pictures folder). Since Where files
 * go (punch list #211) the office sets the root and the name's pattern on Documents → Where files go, and the same
 * function carries that tab's three verbs. Since v2.6284 (the owner's rule of 2026-11-01) the tree is root › <customer> ›
 * <job pattern> › the five, one implementation in `_shared/jobFolders.ts` (`FolderTree.placeJob`) under the press, the
 * sweep below and the photo sweep's first photo on a job with no folder. Five bodies:
 *
 *   POST { job_id }                                                      — the press
 *     Places the job's folder in the tree: finds or makes the customer's folder under the jobs root (the setting
 *     `drive_jobs_root_folder_id`, the DRIVE_JOBS_FOLDER_ID env while it is empty: the Jobs folder in the "PipeTooling
 *     Jobs" Shared Drive, so every folder inherits its sharing; a job with no customer goes under *No customer yet*),
 *     then the job's own folder under it, named by the office's pattern (`folderName`, `<job number> · <job name>` as it
 *     ships): kept and moved or renamed into place when the job already has one in the Shared Drive, its bid's folder
 *     (bids.drive_link, made by drive-intake) the same way, a flat one under the root from before the tree moved under
 *     the customer, else made. Under it Customer Pictures, Plans and Team only, with Photos and Sent by us inside Team
 *     only; as-needed (`drive_folders_made`) leaves the folders inside for the sweeps as before. Writes
 *     jobs_ledger.google_drive_link (when the folder changed), job_pictures_link and job_plans_link where they are
 *     empty, drive_folder_tidied_at always and drive_folder_hold (null, or why the folder could not be placed). A
 *     folder in a My Drive is never moved: the service account can make folders there but cannot own a file, so the
 *     job is held (409 `outside_drive`) with the words every surface shares. The answer carries `placed` (`act`,
 *     `path`, `customer_folder`, `hold`). Idempotent: a second press finds what is there.
 *
 *   POST { sweep: { limit?, all?, offset? } }                           — the folder sweep (X-Cron-Secret, or the office)
 *     The same rule over many jobs: by default the live jobs never placed or placed more than seven days ago, oldest
 *     first, `limit` (25) at a time — the cron every 10 minutes (20261101163412) calls it only while such a job exists;
 *     with `all` the live jobs by number from `offset`, so the tab's press walks every one. Answers the counts
 *     (`looked`, `made`, `moved`, `renamed`, `in_place`, `held`, `left`), the held jobs with their reasons, and the line.
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

    const body = (await req.json().catch(() => ({}))) as {
      job_id?: string
      check?: { folder?: string }
      settings?: boolean
      set?: { root?: string | null; job_pattern?: unknown; bid_pattern?: unknown; folders_made?: unknown }
      sweep?: { limit?: unknown; all?: unknown; offset?: unknown }
    }

    // --- the caller: the cron's secret for the sweep, else a staff session with an office role, never a training account or a twin ---
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const byCron = Boolean(body.sweep) && Boolean(cronSecret) && headerSecret === cronSecret
    let who: { role: string | null; read_only: boolean | null; is_digital_twin: boolean | null } | null = null
    if (!byCron) {
      const auth = req.headers.get('Authorization') ?? ''
      const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
      const { data: u } = await anon.auth.getUser()
      if (!u?.user) return json({ error: 'Sign in first.' }, 401)
      const { data: row } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
      who = (row as typeof who) ?? null
      if (!who || !OFFICE_ROLES.includes(String(who.role))) return json({ error: 'Office only.' }, 403)
      if (who.read_only) return json({ error: 'A training account cannot change Drive or the job.' }, 403)
      if (who.is_digital_twin) return json({ error: 'A digital twin cannot change Drive or the job.' }, 403)
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
      if (!who || !SETTINGS_ROLES.includes(String(who.role))) return json({ error: 'The office sets where files go.' }, 403)
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

    // --- the tree: the root's name for the path words, once ---
    const rootId = settings.rootFolderId
    if (!rootId) return json({ error: NO_ROOT_WORDS, why: 'no_root' }, 503)
    const rootFacts = await checkFolderWrite(token, rootId, appEmail)
    const rootName = rootFacts.folder?.name || 'Jobs'
    const tree = new FolderTree(admin, token, settings, rootId, appEmail, rootName)
    const label = (job: JobFolderRow) => [String(job.hcp_number ?? '').trim(), String(job.job_name ?? '').trim()].filter(Boolean).join(' · ') || `job ${job.id.slice(0, 8)}`

    // --- the sweep: many jobs through the rule, counted ---
    if (body.sweep) {
      const limit = Math.min(50, Math.max(1, Number(body.sweep.limit ?? 25) || 25))
      const all = body.sweep.all === true
      const offset = Math.max(0, Number(body.sweep.offset ?? 0) || 0)
      let rows: JobFolderRow[] = []
      let total = 0
      if (all) {
        const { data, count, error } = await admin
          .from('jobs_ledger')
          .select(JOB_FOLDER_COLUMNS, { count: 'exact' })
          .or('status.is.null,status.neq.paid')
          .order('hcp_number', { ascending: false })
          .order('id', { ascending: true })
          .range(offset, offset + limit - 1)
        if (error) return json({ error: `The jobs did not read: ${error.message}` }, 500)
        rows = (data ?? []) as JobFolderRow[]
        total = count ?? rows.length
      } else {
        const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
        const { data, count, error } = await admin
          .from('jobs_ledger')
          .select(JOB_FOLDER_COLUMNS, { count: 'exact' })
          .or('status.is.null,status.neq.paid')
          .or(`drive_folder_tidied_at.is.null,drive_folder_tidied_at.lt.${since}`)
          .order('drive_folder_tidied_at', { ascending: true, nullsFirst: true })
          .order('created_at', { ascending: true })
          .limit(limit)
        if (error) return json({ error: `The jobs did not read: ${error.message}` }, 500)
        rows = (data ?? []) as JobFolderRow[]
        total = count ?? rows.length
      }
      const counts: TidyCounts = { looked: 0, made: 0, moved: 0, renamed: 0, inPlace: 0, held: 0, left: 0 }
      const held: { job_id: string; label: string; why: string; kind: FolderHold['kind'] | 'failed' }[] = []
      const tally: Record<PlaceAct, () => void> = {
        made: () => {
          counts.made += 1
        },
        moved: () => {
          counts.moved += 1
        },
        renamed: () => {
          counts.renamed += 1
        },
        move_rename: () => {
          counts.moved += 1
          counts.renamed += 1
        },
        in_place: () => {
          counts.inPlace += 1
        },
      }
      for (const job of rows) {
        counts.looked += 1
        try {
          const placed = await tree.placeJob(job)
          if (placed.hold) {
            counts.held += 1
            held.push({ job_id: job.id, label: label(job), why: placed.hold.why, kind: placed.hold.kind })
          } else tally[placed.act]()
        } catch (e) {
          // Drive or the row refused this one: its reason goes on the row, unstamped, so the next run tries it again.
          const why = e instanceof Error ? e.message : String(e)
          counts.held += 1
          held.push({ job_id: job.id, label: label(job), why, kind: 'failed' })
          await admin.from('jobs_ledger').update({ drive_folder_hold: why.slice(0, 300) }).eq('id', job.id)
        }
      }
      counts.left = Math.max(0, total - (all ? offset : 0) - rows.length)
      return json({
        success: true,
        by: byCron ? 'cron' : 'office',
        mode: all ? 'all' : 'recent',
        counts: { looked: counts.looked, made: counts.made, moved: counts.moved, renamed: counts.renamed, in_place: counts.inPlace, held: counts.held, left: counts.left },
        held,
        line: tidyOutcomeWords(counts),
        next_offset: all ? offset + rows.length : null,
        total,
      })
    }

    // --- the press: one job's folders ---
    const jobId = String(body.job_id ?? '').trim()
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: 'job_id is required' }, 400)
    const { data: jobData } = await admin.from('jobs_ledger').select(JOB_FOLDER_COLUMNS).eq('id', jobId).maybeSingle()
    const job = jobData as JobFolderRow | null
    if (!job) return json({ error: 'No job with that id.' }, 404)

    const placed = await tree.placeJob(job)
    const placedOut = { act: placed.act, path: placed.path, customer_folder: placed.customerFolder, hold: placed.hold }
    if (placed.hold) return json({ error: placed.hold.why, why: placed.hold.kind, app_email: appEmail, placed: placedOut }, 409)
    return json({
      success: true,
      app_email: appEmail,
      folders_made: settings.foldersMade,
      folder: placed.folder,
      pictures: placed.pictures,
      plans: placed.plans,
      team_url: placed.teamUrl,
      photos_url: placed.photosUrl,
      sent_url: placed.sentUrl,
      stamped: placed.stamped,
      placed: placedOut,
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
