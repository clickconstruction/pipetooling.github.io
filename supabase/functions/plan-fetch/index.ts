import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1'

// plan-fetch — the pipeline's plan-bytes door (estimator-twin pipeline, CT-1).
// Streams a bid's plan set (the Drive file behind bids.plans_link) to an authorized
// caller, using the service account's token — so CountTooling's import-takeoff (or any
// robot leg) can pull the PDF without holding a Google credential. Auth mirrors
// drive-intake: X-Twin-Token (assignment-is-the-grant) or staff JWT (estimator+).
// GET ?bid=b403 or POST {"bid":"b403"}. Responds with the raw PDF bytes.
//
// v2.3117: plans_link may also be a Drive FOLDER (what estimators actually file).
// The folder's PDFs (name order) are one plan set: one PDF streams as-is, several
// are merged with pdf-lib into one response; past the merge cap (60 MB summed) the
// largest part streams alone with X-Plan-Parts / X-Plan-Note so the caller can pull
// the rest one at a time with ?part=<n>.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-twin-token',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function googleAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri?: string }
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
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
  if (!res.ok || !body.access_token) throw new Error(`Google token exchange failed (${res.status})`)
  return body.access_token as string
}

function driveFileIdFromUrl(url: string): string | null {
  const m = /drive\.google\.com\/(?:file\/d\/([\w-]{20,})|(?:open|uc)\?(?:[^#]*&)?id=([\w-]{20,}))/.exec(url)
  return m?.[1] ?? m?.[2] ?? null
}

// --- Drive folders (v2.3117) -----------------------------------------------
// https://drive.google.com/drive/folders/<id>  or  /drive/u/N/folders/<id>
// (optional ?usp=… / #… tails). Folder ids are shorter than file ids can be.
function driveFolderIdFromUrl(url: string): string | null {
  const m = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]{10,})/.exec(url)
  return m?.[1] ?? null
}

type DriveFile = { id: string; name: string; size: number | null; modifiedTime: string | null }
type FolderListing = { status: number; files: DriveFile[] }

const MERGE_CAP_BYTES = 60 * 1024 * 1024

// Natural name order: "A-1.2" before "A-1.10", case-insensitive — the order an
// estimator reads a plan set in, and the order ?part=<n> counts in.
function byPlanName(a: DriveFile, b: DriveFile): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id)
}

// Drive v3 files.list, PDFs only (Google-native docs and other mimes are ignored),
// shared drives included, paginated. A folder the service account cannot see
// answers 403/404 here — or an empty list, which the probe tells apart with a
// metadata GET on the folder itself.
async function listFolderPdfs(token: string, folderId: string): Promise<FolderListing> {
  const files: DriveFile[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 10; page++) {
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('q', `'${folderId}' in parents and trashed=false and mimeType='application/pdf'`)
    url.searchParams.set('fields', 'nextPageToken,files(id,name,size,modifiedTime)')
    url.searchParams.set('supportsAllDrives', 'true')
    url.searchParams.set('includeItemsFromAllDrives', 'true')
    url.searchParams.set('orderBy', 'name')
    url.searchParams.set('pageSize', '200')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return { status: res.status, files: [] }
    const body = await res.json().catch(() => ({})) as {
      nextPageToken?: string
      files?: Array<{ id?: string; name?: string; size?: string; modifiedTime?: string }>
    }
    for (const f of body.files ?? []) {
      if (!f.id) continue
      files.push({ id: f.id, name: f.name ?? f.id, size: f.size != null ? Number(f.size) : null, modifiedTime: f.modifiedTime ?? null })
    }
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  files.sort(byPlanName)
  return { status: 200, files }
}

// Is the folder itself visible to the service account? Used to tell "shared but
// empty" from "not shared" when the listing comes back empty.
async function folderVisible(token: string, folderId: string): Promise<number> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,mimeType&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.status
}

// "folder · 3 PDFs, merged on fetch: A-1.pdf, A-2.pdf, A-3.pdf" — names capped so
// the note stays readable in a tooltip; the count is always exact.
function folderProbeNote(files: DriveFile[]): string {
  const n = files.length
  const head = `folder · ${n} PDF${n === 1 ? '' : 's'}, ${n === 1 ? 'streamed' : 'merged'} on fetch: `
  const budget = 200
  const shown: string[] = []
  let used = 0
  for (const f of files) {
    const name = f.name.length > 48 ? `${f.name.slice(0, 45)}…` : f.name
    if (used + name.length + 2 > budget && shown.length) break
    shown.push(name)
    used += name.length + 2
  }
  const rest = n - shown.length
  return head + shown.join(', ') + (rest > 0 ? `, … (+${rest} more)` : '')
}

function safeFilename(project: unknown): string {
  return String(project ?? 'plans').replace(/[^\w .-]/g, '_')
}

function sizeMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

// --- "plans readable by robots" probe (v2.3080) ---------------------------
// A live bid whose plans link the service account cannot read is invisible to
// the shadow program (b480, 2026-09-06). The probe answers that question with a
// metadata GET — no bytes — and records it on the bid (plans_robot_readable /
// _probed_at / _probe_note) so the board can show it and next_shadow can skip it.

type ProbeResult = { readable: boolean; note: string | null; name?: string | null; mime?: string | null; size?: number | null }

const NOT_SHARED_NOTE = 'Drive 404 — the folder is not shared with the intake service account (or was moved/deleted)'
const NO_PERMISSION_NOTE = 'Drive 403 — the intake service account has no permission on this folder'

// Folder probe (v2.3117): readable when the service account can list the folder
// and it holds at least one PDF. Returns the listing too so the fetch path can
// reuse it (one Drive round-trip, one recorded verdict).
async function probeFolder(folderId: string, token: string): Promise<ProbeResult & { files: DriveFile[] }> {
  const listing = await listFolderPdfs(token, folderId)
  if (listing.status === 404) return { readable: false, note: NOT_SHARED_NOTE, files: [] }
  if (listing.status === 403) return { readable: false, note: NO_PERMISSION_NOTE, files: [] }
  if (listing.status !== 200) return { readable: false, note: `Drive ${listing.status} on folder listing`, files: [] }
  if (!listing.files.length) {
    // An unshared folder can list as empty rather than 404 — ask about the folder itself.
    const vis = await folderVisible(token, folderId)
    if (vis === 404) return { readable: false, note: NOT_SHARED_NOTE, files: [] }
    if (vis === 403) return { readable: false, note: NO_PERMISSION_NOTE, files: [] }
    return { readable: false, note: 'folder holds no PDF — upload the plan set', files: [] }
  }
  const total = listing.files.reduce((s, f) => s + (f.size ?? 0), 0)
  return {
    readable: true,
    note: folderProbeNote(listing.files),
    name: listing.files.length === 1 ? listing.files[0].name : `${listing.files.length} PDFs`,
    mime: 'application/pdf',
    size: total || null,
    files: listing.files,
  }
}

async function probePlansLink(plansLink: string | null, token: string | null): Promise<ProbeResult> {
  const link = String(plansLink ?? '').trim()
  if (!link) return { readable: false, note: 'no plans link on the bid' }
  const folderId = driveFolderIdFromUrl(link)
  if (folderId) {
    if (!token) return { readable: false, note: 'service account token unavailable' }
    const { files: _files, ...r } = await probeFolder(folderId, token)
    return r
  }
  const fileId = driveFileIdFromUrl(link)
  if (!fileId) return { readable: false, note: 'plans link is not a Google Drive file link — robots can only fetch Drive files' }
  if (!token) return { readable: false, note: 'service account token unavailable' }
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return { readable: false, note: 'Drive 404 — the file is not shared with the intake service account (or was moved/deleted)' }
  if (res.status === 403) return { readable: false, note: 'Drive 403 — the intake service account has no permission on this file' }
  if (!res.ok) return { readable: false, note: `Drive ${res.status} on metadata read` }
  const meta = await res.json().catch(() => ({})) as { name?: string; mimeType?: string; size?: string }
  const mime = meta.mimeType ?? null
  if (mime && mime !== 'application/pdf' && !mime.startsWith('application/vnd.google-apps.')) {
    return { readable: false, note: `file is ${mime}, not a PDF — robots take PDF plan sets`, name: meta.name ?? null, mime, size: meta.size ? Number(meta.size) : null }
  }
  return { readable: true, note: null, name: meta.name ?? null, mime, size: meta.size ? Number(meta.size) : null }
}

async function recordProbe(admin: ReturnType<typeof createClient>, bidId: string, r: ProbeResult): Promise<void> {
  await admin.from('bids').update({
    plans_robot_readable: r.readable,
    plans_robot_probed_at: new Date().toISOString(),
    plans_robot_probe_note: r.note,
  }).eq('id', bidId).then(() => {}, () => {})
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!serviceRoleKey || !saJson) return json({ error: 'Server not configured' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // --- caller resolution: twin token OR staff JWT (drive-intake's model) ---
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

    const params = new URL(req.url).searchParams
    let bidRef = params.get('bid')?.trim() ?? ''
    let probe = params.get('probe')?.trim() ?? ''
    let probeUrl = params.get('probe_url')?.trim() ?? ''
    let limitRaw = params.get('limit')
    let force = params.get('force') === '1'
    let partRaw = params.get('part')?.trim() ?? ''
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as { bid?: string; probe?: string; limit?: number; force?: boolean; part?: number | string }
      if (!bidRef) bidRef = String(body.bid ?? '').trim()
      if (!probe) probe = String(body.probe ?? '').trim()
      if (limitRaw == null && body.limit != null) limitRaw = String(body.limit)
      if (body.force) force = true
      if (!partRaw && body.part != null) partRaw = String(body.part).trim()
      if (!probeUrl) probeUrl = String((body as { probe_url?: string }).probe_url ?? '').trim()
    }

    // Link probe (v2.3142): the bid form asks "can robots open THIS link?" while
    // the bid is still being typed — no bid row yet, nothing recorded. Staff only
    // (a twin has no business probing arbitrary links).
    if (probeUrl) {
      if (isTwin) return json({ error: 'probe_url is for staff sessions' }, 403)
      const r = await probePlansLink(probeUrl, await googleAccessToken(saJson))
      return json({ readable: r.readable, note: r.note, name: r.name ?? null })
    }

    // Sweep: probe every live bid with a plans link that was never probed or
    // whose probe is older than 24h (force=1 re-probes all). Presence-only
    // answers, so any authorized caller may run it; capped per call.
    if (probe === 'all') {
      const limit = Math.min(Math.max(Number(limitRaw ?? 25) || 25, 1), 100)
      const staleBefore = new Date(Date.now() - 24 * 3600_000).toISOString()
      let lq = admin.from('bids')
        .select('id, bid_number, project_name, plans_link, plans_robot_probed_at')
        .is('bid_date_sent', null).not('plans_link', 'is', null).not('project_name', 'ilike', 'ZZ %')
        .order('plans_robot_probed_at', { ascending: true, nullsFirst: true })
        .limit(limit)
      if (!force) lq = lq.or(`plans_robot_probed_at.is.null,plans_robot_probed_at.lt.${staleBefore}`)
      const { data: live, error: liveErr } = await lq
      if (liveErr) return json({ error: `Sweep lookup failed: ${liveErr.message}` }, 500)
      const token = (live ?? []).length ? await googleAccessToken(saJson) : null
      const unreadable: Array<{ bid: string; project: string | null; note: string | null }> = []
      let readable = 0
      for (const b of live ?? []) {
        const r = await probePlansLink(b.plans_link as string | null, token)
        await recordProbe(admin, b.id as string, r)
        if (r.readable) readable += 1
        else unreadable.push({ bid: `b${b.bid_number}`, project: b.project_name as string | null, note: r.note })
      }
      console.log(`[plan-fetch] probe sweep by ${isTwin ? 'twin' : 'staff'} ${callerId}: ${readable} readable, ${unreadable.length} unreadable of ${(live ?? []).length}`)
      return json({ probed: (live ?? []).length, readable, unreadable })
    }

    if (!bidRef) return json({ error: 'bid required (?bid=b403 or POST {"bid":"b403"})' }, 400)

    const uuidRe = /^[0-9a-f-]{36}$/i
    const q = admin.from('bids').select('id, bid_number, project_name, plans_link, estimator_id, created_by')
    const { data: bid } = await (uuidRe.test(bidRef) ? q.eq('id', bidRef) : q.eq('bid_number', bidRef.replace(/^(bp|b)/i, ''))).maybeSingle()
    if (!bid) return json({ error: `No bid found for "${bidRef}"` }, 404)

    // Single-bid probe: metadata only, recorded on the bid. No assignment fence —
    // the answer is presence-level; the file name is returned to staff only.
    if (probe === '1' || probe === 'true') {
      const r = await probePlansLink(bid.plans_link as string | null, bid.plans_link ? await googleAccessToken(saJson) : null)
      await recordProbe(admin, bid.id, r)
      return json({ bid: `b${bid.bid_number}`, readable: r.readable, note: r.note, ...(isTwin ? {} : { name: r.name ?? null, mime: r.mime ?? null, size: r.size ?? null }) })
    }

    if (isTwin && bid.estimator_id !== callerId && bid.created_by !== callerId) {
      return json({ error: 'Not your bid (assignment is the grant)' }, 403)
    }
    if (!bid.plans_link) return json({ error: `Bid ${bid.bid_number} has no plans_link — file the plans first (drive-intake / file_plans with a plans_url)` }, 404)

    // --- folder link (v2.3117): the folder's PDFs, in name order, are the plan set ---
    const folderId = driveFolderIdFromUrl(String(bid.plans_link))
    if (folderId) {
      const token = await googleAccessToken(saJson)
      const fp = await probeFolder(folderId, token)
      const { files: _files, ...verdict } = fp
      await recordProbe(admin, bid.id, verdict)
      if (!fp.readable) {
        const status = fp.files.length === 0 && /holds no PDF/.test(fp.note ?? '') ? 404 : 502
        return json({ error: `Drive folder: ${fp.note} — folder ${folderId}` }, status)
      }
      const files = fp.files
      const who = `${isTwin ? 'twin' : 'staff'} ${callerId}`
      const project = safeFilename(bid.project_name)
      const folderHeaders = { ...corsHeaders, 'Access-Control-Expose-Headers': 'Content-Disposition, X-Plan-Parts, X-Plan-Note' }

      // Stream one part of the folder as the file path streams a file.
      const streamPart = async (f: DriveFile, filename: string, extra: Record<string, string> = {}): Promise<Response> => {
        const src = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!src.ok || !src.body) {
          await recordProbe(admin, bid.id, { readable: false, note: `Drive ${src.status} on fetch of "${f.name}" — is the folder shared with the intake service account?` })
          return json({ error: `Drive fetch failed (${src.status}) on "${f.name}" — is the folder shared with the service account?` }, 502)
        }
        return new Response(src.body, {
          headers: {
            ...folderHeaders,
            'Content-Type': src.headers.get('content-type') ?? 'application/pdf',
            ...(src.headers.get('content-length') ? { 'Content-Length': src.headers.get('content-length')! } : {}),
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Plan-Parts': String(files.length),
            ...extra,
          },
        })
      }

      // ?part=<n> — one specific PDF, 1-based in name order.
      if (partRaw) {
        const n = Number(partRaw)
        if (!Number.isInteger(n) || n < 1 || n > files.length) {
          return json({ error: `part must be 1..${files.length} (name order): ${files.map((f, i) => `${i + 1}=${f.name}`).join(', ')}` }, 400)
        }
        const f = files[n - 1]
        console.log(`[plan-fetch] ${who} ← bid ${bid.bid_number} folder ${folderId} part ${n}/${files.length} "${f.name}"`)
        return streamPart(f, `${project} - ${safeFilename(f.name.replace(/\.pdf$/i, ''))} (part ${n} of ${files.length}).pdf`)
      }

      if (files.length === 1) {
        console.log(`[plan-fetch] ${who} ← bid ${bid.bid_number} folder ${folderId} single "${files[0].name}"`)
        return streamPart(files[0], `${project}.pdf`)
      }

      // Several PDFs: merge in name order — unless the set is too big to hold, in
      // which case the largest part streams alone and the headers say so.
      const total = files.reduce((s, f) => s + (f.size ?? 0), 0)
      const largest = files.reduce((a, b) => ((b.size ?? 0) > (a.size ?? 0) ? b : a), files[0])
      const capNote = `merged set exceeds 60 MB; streamed largest part only — stage_plan_pdf per part`
      if (total > MERGE_CAP_BYTES) {
        console.log(`[plan-fetch] ${who} ← bid ${bid.bid_number} folder ${folderId} ${files.length} PDFs ${sizeMb(total)} MB > cap; streaming largest "${largest.name}"`)
        return streamPart(largest, `${project} - ${safeFilename(largest.name.replace(/\.pdf$/i, ''))} (largest of ${files.length}).pdf`, { 'X-Plan-Note': capNote })
      }

      try {
        const merged = await PDFDocument.create()
        for (const f of files) {
          const src = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!src.ok) throw new Error(`Drive ${src.status} on "${f.name}"`)
          const part = await PDFDocument.load(new Uint8Array(await src.arrayBuffer()), { ignoreEncryption: true })
          const pages = await merged.copyPages(part, part.getPageIndices())
          for (const p of pages) merged.addPage(p)
        }
        const bytes = await merged.save()
        console.log(`[plan-fetch] ${who} ← bid ${bid.bid_number} folder ${folderId} merged ${files.length} PDFs → ${merged.getPageCount()} pages, ${sizeMb(bytes.byteLength)} MB`)
        return new Response(bytes, {
          headers: {
            ...folderHeaders,
            'Content-Type': 'application/pdf',
            'Content-Length': String(bytes.byteLength),
            'Content-Disposition': `attachment; filename="${project} - plans (merged ${files.length}).pdf"`,
            'X-Plan-Parts': String(files.length),
          },
        })
      } catch (e) {
        // A part that pdf-lib cannot open (or a Drive hiccup mid-merge) must not
        // make the whole set unreachable: stream the largest and say why.
        const why = String(e instanceof Error ? e.message : e).slice(0, 160)
        console.log(`[plan-fetch] ${who} ← bid ${bid.bid_number} folder ${folderId} merge failed (${why}); streaming largest "${largest.name}"`)
        return streamPart(largest, `${project} - ${safeFilename(largest.name.replace(/\.pdf$/i, ''))} (largest of ${files.length}).pdf`, {
          'X-Plan-Note': `merge failed (${why.replace(/[^\x20-\x7e]/g, '?')}); streamed largest part only — stage_plan_pdf per part`,
        })
      }
    }

    const fileId = driveFileIdFromUrl(String(bid.plans_link))
    if (!fileId) return json({ error: `plans_link is not a Drive file link: ${bid.plans_link}` }, 422)

    const token = await googleAccessToken(saJson)
    const src = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!src.ok || !src.body) {
      // A failed byte fetch is a probe result too — record it so the board sees it.
      await recordProbe(admin, bid.id, { readable: false, note: `Drive ${src.status} on fetch — is the file shared with the intake service account?` })
      return json({ error: `Drive fetch failed (${src.status}) — is the file shared with the service account?` }, 502)
    }
    await recordProbe(admin, bid.id, { readable: true, note: null })
    console.log(`[plan-fetch] ${isTwin ? 'twin' : 'staff'} ${callerId} ← bid ${bid.bid_number} file ${fileId}`)
    return new Response(src.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': src.headers.get('content-type') ?? 'application/pdf',
        ...(src.headers.get('content-length') ? { 'Content-Length': src.headers.get('content-length')! } : {}),
        'Content-Disposition': `attachment; filename="${String(bid.project_name ?? 'plans').replace(/[^\w .-]/g, '_')}.pdf"`,
      },
    })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
