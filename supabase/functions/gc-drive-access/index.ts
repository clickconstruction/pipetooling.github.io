import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFileIdFromUrl, driveFolderIdFromUrl, findOrCreateFolder, googleAccessToken } from '../_shared/driveUpload.ts'
import { officeYmd } from '../_shared/bidFollowupReminder.ts'

/**
 * gc-drive-access — GC mode, the real build, step 5 (to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on
 * spike/gc-mode). The plans live in Google Drive, and the owner's rule (2026-10-04) is that every
 * set's link says whether anyone with the link can open it, "versus this link is only accessible by
 * some, please correct". Two presses, both office-only, both through the intake service account:
 *
 *   POST { make_folders: { project_id } }
 *     Makes the project's folder in the jobs Shared Drive with Plans and Team only inside, shares
 *     Plans with anyone with the link (reader), and records the folder on gc_projects and the Plans
 *     link on set 0 when it has none. Idempotent: a folder already recorded is returned as it is.
 *
 *   POST { check: { url, project_id?, rev? } }
 *     Says who can open a Drive link: 'anyone' when a permission of type anyone is on it,
 *     'restricted' otherwise, null when the service account cannot see it at all (not shared with
 *     it). With project_id and rev it records the verdict on that set (drive_access,
 *     drive_checked_on).
 *
 * Auth: a staff JWT, office roles (dev, master_technician, assistant, controller, estimator);
 * never a training account or a digital twin (door 1, v2.4832: the service role writes here, so the
 * read-only blocks and the twin fence never see it); verify_jwt = false and validated here. Google auth is the service account (GOOGLE_SERVICE_ACCOUNT_JSON),
 * the folder is DRIVE_JOBS_FOLDER_ID (docs/DRIVE_INTAKE_SETUP.md).
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

type Access = 'anyone' | 'restricted' | null
interface Verdict {
  access: Access
  /** Whether the service account could see the file or folder at all. */
  seen: boolean
  note: string | null
}

/** Who can open a Drive file or folder, read as the service account sees its permissions. */
async function driveAccess(url: string, token: string): Promise<Verdict> {
  const id = driveFolderIdFromUrl(url) ?? driveFileIdFromUrl(url)
  if (!id) return { access: null, seen: false, note: 'This is not a Google Drive link.' }
  const meta = await fetch(`${DRIVE}/files/${id}?fields=id&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } })
  if (meta.status === 404 || meta.status === 403) {
    return { access: null, seen: false, note: 'Our helper cannot see this link. Share the folder with the intake service account, or move the plans into the job folder it made.' }
  }
  if (!meta.ok) return { access: null, seen: false, note: `Drive answered ${meta.status} when our helper looked.` }
  const perms = await fetch(`${DRIVE}/files/${id}/permissions?supportsAllDrives=true&fields=permissions(type,role)`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!perms.ok) return { access: null, seen: true, note: `Drive answered ${perms.status} when our helper read who can open it.` }
  const body = (await perms.json().catch(() => ({}))) as { permissions?: { type?: string; role?: string }[] }
  const anyone = (body.permissions ?? []).some((p) => p.type === 'anyone')
  return { access: anyone ? 'anyone' : 'restricted', seen: true, note: null }
}

/** Share a folder with anyone with the link as a reader. A Shared Drive may refuse; the reason comes back in words. */
async function shareWithAnyone(id: string, token: string): Promise<{ ok: boolean; reason: string | null }> {
  const res = await fetch(`${DRIVE}/files/${id}/permissions?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader' }),
  })
  if (res.ok) return { ok: true, reason: null }
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
  return { ok: false, reason: body.error?.message ?? `Drive answered ${res.status}` }
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
    if (!saJson || !jobsFolderId) return json({ error: 'Drive is not configured yet: set GOOGLE_SERVICE_ACCOUNT_JSON and DRIVE_JOBS_FOLDER_ID' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // --- the caller: a staff session with an office role ---
    const auth = req.headers.get('Authorization') ?? ''
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await anon.auth.getUser()
    if (!u?.user) return json({ error: 'Sign in first.' }, 401)
    const { data: who } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    if (!who || !OFFICE_ROLES.includes(String(who.role))) return json({ error: 'Office only.' }, 403)
    if (who.read_only) return json({ error: 'A training account cannot change Drive or the project.' }, 403)
    if (who.is_digital_twin) return json({ error: 'A digital twin cannot change Drive or the project.' }, 403)

    const body = (await req.json().catch(() => ({}))) as {
      make_folders?: { project_id?: string }
      check?: { url?: string; project_id?: string; rev?: number }
    }
    const today = officeYmd(new Date().toISOString())
    const token = await googleAccessToken(saJson)

    if (body.make_folders) {
      const projectId = String(body.make_folders.project_id ?? '').trim()
      if (!projectId) return json({ error: 'project_id is required' }, 400)
      const { data: project } = await admin.from('projects').select('id, name').eq('id', projectId).maybeSingle()
      const { data: gc } = await admin.from('gc_projects').select('project_id, drive_folder_url').eq('project_id', projectId).maybeSingle()
      if (!project || !gc) return json({ error: 'No GC project with that id.' }, 404)
      const folderName = String(project.name).slice(0, 140)
      const folder = await findOrCreateFolder(token, jobsFolderId, folderName)
      const plans = await findOrCreateFolder(token, folder.id, 'Plans')
      const team = await findOrCreateFolder(token, folder.id, 'Team only')
      const shared = await shareWithAnyone(plans.id, token)
      const folderLink = folderUrl(folder.id)
      const plansLink = folderUrl(plans.id)
      if (!gc.drive_folder_url) {
        const { error } = await admin.from('gc_projects').update({ drive_folder_url: folderLink }).eq('project_id', projectId)
        if (error) return json({ error: `The folder was made but not recorded: ${error.message}` }, 500)
      }
      // Set 0 takes the Plans link when it has none, with the check's verdict.
      const { data: set0 } = await admin.from('gc_plan_sets').select('id, drive_url').eq('project_id', projectId).eq('rev', 0).maybeSingle()
      let setPlans = false
      if (set0 && !set0.drive_url) {
        const { error } = await admin
          .from('gc_plan_sets')
          .update({ drive_url: plansLink, drive_access: shared.ok ? 'anyone' : 'restricted', drive_checked_on: today })
          .eq('id', set0.id)
        if (error) return json({ error: `The Plans link was not recorded on the first set: ${error.message}` }, 500)
        setPlans = true
      }
      return json({
        success: true,
        folder_url: folderLink,
        folder_created: folder.created,
        plans_url: plansLink,
        team_url: folderUrl(team.id),
        plans_shared: shared.ok,
        reason: shared.reason,
        set_plans_link: setPlans,
      })
    }

    if (body.check) {
      const url = String(body.check.url ?? '').trim()
      if (!url) return json({ error: 'url is required' }, 400)
      const verdict = await driveAccess(url, token)
      const projectId = String(body.check.project_id ?? '').trim()
      const rev = body.check.rev
      let recorded = false
      if (projectId && typeof rev === 'number') {
        const { error } = await admin
          .from('gc_plan_sets')
          .update({ drive_access: verdict.access, drive_checked_on: today })
          .eq('project_id', projectId)
          .eq('rev', rev)
        if (error) return json({ error: `The check was not recorded: ${error.message}` }, 500)
        recorded = true
      }
      return json({ success: true, ...verdict, checked_on: today, recorded })
    }

    return json({ error: 'Send make_folders or check.' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
