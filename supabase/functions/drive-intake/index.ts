import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { findOrCreateFolder, googleAccessToken, uploadFromUrl } from '../_shared/driveUpload.ts'

// drive-intake — estimator-twin pipeline Wave 4.4 (docs/ESTIMATOR_TWIN_PIPELINE_PLAN.md).
// Creates the job folder in the shared Google Drive jobs folder, optionally uploads the
// plan set (fetched from a URL — plan PDFs are too big to push through MCP), and stamps
// the resulting links onto the bid. Auth model:
//   * X-Twin-Token (the per-twin credential, twin_credentials sha256) — the agent path;
//     the bid must be the twin's own/assigned (assignment-is-the-grant, as everywhere).
//   * Authorization: Bearer <staff JWT> — the human path (estimator+), same one-click.
// Google auth is a SERVICE ACCOUNT, never a user password: the GOOGLE_SERVICE_ACCOUNT_JSON
// secret holds the SA key; the SA's email must be shared into the jobs folder
// (Content manager). Folder id via DRIVE_JOBS_FOLDER_ID. Setup: docs/DRIVE_INTAKE_SETUP.md.
// Idempotent: an existing folder with the job's name is reused, never duplicated, and an
// existing same-name file in that folder is reused instead of re-uploading the plan set.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twin-token',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Google helpers live in _shared/driveUpload.ts (lifted for Submittals 6c).

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const jobsFolderId = Deno.env.get('DRIVE_JOBS_FOLDER_ID')
    if (!serviceRoleKey) return json({ error: 'Server not configured' }, 500)
    if (!saJson || !jobsFolderId) {
      return json({ error: 'Drive intake not configured yet: set GOOGLE_SERVICE_ACCOUNT_JSON and DRIVE_JOBS_FOLDER_ID function secrets (see docs/DRIVE_INTAKE_SETUP.md), then redeploy.' }, 503)
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // --- caller resolution: twin token OR staff JWT ---
    let callerId: string | null = null
    let isTwin = false
    const twinToken = req.headers.get('X-Twin-Token')?.trim()
    if (twinToken) {
      const hash = await sha256Hex(twinToken)
      const { data: cred } = await admin.from('twin_credentials').select('twin_user_id, revoked_at').eq('token_hash', hash).maybeSingle()
      if (!cred || cred.revoked_at) return json({ error: 'Unknown or revoked twin token' }, 401)
      callerId = cred.twin_user_id as string
      isTwin = true
    } else {
      const auth = req.headers.get('Authorization') ?? ''
      const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
      const { data: u } = await anon.auth.getUser()
      if (!u?.user) return json({ error: 'Auth required (twin token or staff session)' }, 401)
      const { data: row } = await admin.from('users').select('role').eq('id', u.user.id).maybeSingle()
      const staffRoles = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']
      if (!row || !staffRoles.includes(row.role as string)) return json({ error: 'Estimating staff only' }, 403)
      callerId = u.user.id
    }

    const body = await req.json().catch(() => ({})) as { bid?: string; plans_url?: string; plans_file_name?: string }
    const bidRef = String(body.bid ?? '').trim()
    if (!bidRef) return json({ error: 'bid required (bid number like b403, or uuid)' }, 400)
    const uuidRe = /^[0-9a-f-]{36}$/i
    const q = admin.from('bids').select('id, bid_number, project_name, drive_link, plans_link, estimator_id, created_by')
    const { data: bid } = await (uuidRe.test(bidRef) ? q.eq('id', bidRef) : q.eq('bid_number', bidRef.replace(/^(bp|b)/i, ''))).maybeSingle()
    if (!bid) return json({ error: `No bid found for "${bidRef}"` }, 404)
    if (isTwin && bid.estimator_id !== callerId && bid.created_by !== callerId) {
      return json({ error: 'Not your bid (assignment is the grant)' }, 403)
    }

    const folderName = String(bid.project_name ?? `Bid ${bid.bid_number ?? bid.id}`).trim().slice(0, 120)
    const token = await googleAccessToken(saJson)
    const folder = await findOrCreateFolder(token, jobsFolderId, folderName)
    const folderLink = `https://drive.google.com/drive/folders/${folder.id}`

    // Uploads need a storage quota, which service accounts don't have (Google: "Service
    // Accounts do not have storage quota", found live 2026-08-29). With
    // DRIVE_IMPERSONATE_USER set (domain-wide delegation), uploads act as that Workspace
    // user and gain their quota; without it, the upload leg degrades gracefully — the
    // folder still lands and the caller is told to drop the file in by hand.
    let plansLink: string | null = null
    let plansReused = false
    let uploadNote: string | null = null
    if (body.plans_url) {
      const fileName = String(body.plans_file_name ?? `${folderName} - plans.pdf`).slice(0, 140)
      const impersonate = Deno.env.get('DRIVE_IMPERSONATE_USER')?.trim()
      try {
        const upToken = impersonate ? await googleAccessToken(saJson, impersonate) : token
        const up = await uploadFromUrl(upToken, folder.id, String(body.plans_url), fileName)
        plansLink = `https://drive.google.com/file/d/${up.id}/view`
        plansReused = up.reused
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e)
        if (/storage quota/i.test(msg) && !impersonate) {
          uploadNote = `Folder is ready, but the plans upload needs a storage quota the service account lacks — drop the file into ${folderLink} by hand, or set DRIVE_IMPERSONATE_USER (domain-wide delegation, see docs/DRIVE_INTAKE_SETUP.md).`
        } else {
          uploadNote = `Folder is ready; plans upload failed: ${msg}`
        }
      }
    }

    // Stamp the bid (set-if-empty for drive_link; plans_link only when we uploaded).
    const patch: Record<string, string> = {}
    if (!bid.drive_link) patch.drive_link = folderLink
    if (plansLink && !bid.plans_link) patch.plans_link = plansLink
    if (Object.keys(patch).length > 0) await admin.from('bids').update(patch).eq('id', bid.id)

    // Audit stamp (method-less note — the pipeline's flight recorder).
    try {
      await admin.from('bids_submission_entries').insert({
        bid_id: bid.id,
        occurred_at: new Date().toISOString(),
        notes: `[pipeline STG-1] Drive filed: folder ${folder.created ? 'created' : 'reused'} (${folderLink})${plansLink ? ` · plans ${plansReused ? 'reused' : 'uploaded'} (${plansLink})` : ''}`,
        created_by: isTwin ? callerId : callerId,
      })
    } catch (_) { /* best-effort */ }

    return json({ success: true, folder_id: folder.id, folder_link: folderLink, folder_created: folder.created, plans_link: plansLink, plans_reused: plansReused, upload_note: uploadNote, stamped: Object.keys(patch) })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
