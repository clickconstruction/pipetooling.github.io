import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
// Idempotent: an existing folder with the job's name is reused, never duplicated.

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

// --- Google service-account OAuth (JWT bearer grant, RS256 via WebCrypto) ---
function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function googleAccessToken(saJson: string, impersonate?: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri?: string }
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    // Domain-wide delegation (DRIVE_IMPERSONATE_USER): uploads act as this Workspace
    // user, giving files a real storage quota — SAs have none of their own. Requires
    // the admin-console delegation grant (docs/DRIVE_INTAKE_SETUP.md).
    ...(impersonate ? { sub: impersonate } : {}),
  }))
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)))
  const jwt = `${header}.${claims}.${b64url(sig)}`
  const res = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const body = await res.json()
  if (!res.ok || !body.access_token) throw new Error(`Google token exchange failed (${res.status}): ${body.error_description ?? body.error ?? 'unknown'}`)
  return body.access_token as string
}

const DRIVE = 'https://www.googleapis.com/drive/v3'

async function findOrCreateFolder(token: string, parentId: string, name: string): Promise<{ id: string; created: boolean }> {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`)
  const found = await fetch(`${DRIVE}/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  if (found.files?.[0]?.id) return { id: found.files[0].id, created: false }
  const res = await fetch(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  const body = await res.json()
  if (!res.ok || !body.id) throw new Error(`Folder create failed (${res.status}): ${body.error?.message ?? 'unknown'}`)
  return { id: body.id as string, created: true }
}

// A plans_url pointing at a Drive file (file/d/<id>, open?id=, uc?id=) is fetched via the
// Drive API with the SA's own token — Drive files are rarely public, but the SA can read
// anything shared with it (the old jobs folder tree included). Non-Drive URLs fetch plain.
function driveFileIdFromUrl(url: string): string | null {
  const m = /drive\.google\.com\/(?:file\/d\/([\w-]{20,})|(?:open|uc)\?(?:[^#]*&)?id=([\w-]{20,}))/.exec(url)
  return m?.[1] ?? m?.[2] ?? null
}

async function uploadFromUrl(token: string, folderId: string, url: string, fileName: string): Promise<{ id: string; name: string }> {
  const driveId = driveFileIdFromUrl(url)
  let src: Response
  let name = fileName
  if (driveId) {
    const metaRes = await fetch(`${DRIVE}/files/${driveId}?fields=name&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (metaRes.ok) {
      const m = await metaRes.json()
      if (m.name && !fileName.trim()) name = String(m.name)
      else if (m.name && fileName.endsWith(' - plans.pdf')) name = String(m.name) // default name → keep the source's
    }
    src = await fetch(`${DRIVE}/files/${driveId}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!src.ok) throw new Error(`Drive source fetch failed (${src.status}) — is the file (or its folder) shared with the service account?`)
  } else {
    src = await fetch(url)
    if (!src.ok || !src.body) throw new Error(`Could not fetch plans_url (${src.status})`)
  }
  const meta = { name, parents: [folderId] }
  const boundary = 'drive-intake-' + crypto.randomUUID()
  // Buffer the file (plan sets are tens of MB — within function memory limits).
  const fileBytes = new Uint8Array(await src.arrayBuffer())
  const pre = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${src.headers.get('content-type') ?? 'application/pdf'}\r\n\r\n`
  )
  const post = new TextEncoder().encode(`\r\n--${boundary}--`)
  const payload = new Uint8Array(pre.length + fileBytes.length + post.length)
  payload.set(pre, 0)
  payload.set(fileBytes, pre.length)
  payload.set(post, pre.length + fileBytes.length)
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: payload,
  })
  const body = await res.json()
  if (!res.ok || !body.id) throw new Error(`Upload failed (${res.status}): ${body.error?.message ?? 'unknown'}`)
  return { id: body.id as string, name }
}

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
    let uploadNote: string | null = null
    if (body.plans_url) {
      const fileName = String(body.plans_file_name ?? `${folderName} - plans.pdf`).slice(0, 140)
      const impersonate = Deno.env.get('DRIVE_IMPERSONATE_USER')?.trim()
      try {
        const upToken = impersonate ? await googleAccessToken(saJson, impersonate) : token
        const up = await uploadFromUrl(upToken, folder.id, String(body.plans_url), fileName)
        plansLink = `https://drive.google.com/file/d/${up.id}/view`
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
        notes: `[pipeline STG-1] Drive filed: folder ${folder.created ? 'created' : 'reused'} (${folderLink})${plansLink ? ` · plans uploaded (${plansLink})` : ''}`,
        created_by: isTwin ? callerId : callerId,
      })
    } catch (_) { /* best-effort */ }

    return json({ success: true, folder_id: folder.id, folder_link: folderLink, folder_created: folder.created, plans_link: plansLink, upload_note: uploadNote, stamped: Object.keys(patch) })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
