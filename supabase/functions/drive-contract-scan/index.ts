import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// drive-contract-scan — the Contract sweep's Drive pass (v2.3390). Lists the
// contract-looking files in the jobs Shared Drive so the office can file the
// signed copies that already exist instead of emailing customers for new ones.
// Read-only against Drive (scope drive.readonly); nothing is written anywhere —
// the client matches files to jobs (src/lib/jobs/driveContractMatch.ts) and files
// them through the normal paper-record write. Auth: staff JWT validated in-body,
// office roles only. Google auth is the drive-intake SERVICE ACCOUNT (the same
// GOOGLE_SERVICE_ACCOUNT_JSON / DRIVE_JOBS_FOLDER_ID secrets; setup in
// docs/DRIVE_INTAKE_SETUP.md); the SA reads what is shared with it — the Jobs
// folder in the "PipeTooling Jobs" Shared Drive.
//
// Shape: one name-contains query across everything the SA can see (paged),
// then each root's child folders (paged) as the job-folder map — the roots are
// DRIVE_JOBS_FOLDER_ID plus DRIVE_CONTRACT_ROOTS (comma-separated folder ids the
// owner shared with the SA: the tree the signed contracts actually live in). A
// file whose parent is not a job folder is attributed through its parent's
// parent (one level down — a "Contracts" subfolder inside a job folder). A file
// sitting directly in a root has no job folder, so its own name stands in as the
// folder name for matching (the address or job number is usually in it).
//
// v2.3709: a scan takes a minute or more, so the answer is kept in
// drive_contract_scans (one row, service role only) and served from there
// while it is younger than SCAN_FRESH_MS — one scan for the whole office, not
// one per browser tab. `{ force: true }` scans again now. The folder walk runs
// eight files at a time; a folder looked up once is never looked up twice.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Same JWT-bearer grant as drive-intake, read-only scope (kept local so this
// function ships without touching the twins' intake path; converge into
// _shared when a third Drive function appears).
async function googleAccessToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson) as { client_email: string; private_key: string; token_uri?: string }
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive.readonly', aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
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
const FOLDER = 'application/vnd.google-apps.folder'
const CONTRACT_WORDS = ['contract', 'agreement', 'subcontract', 'signed', 'executed', 'proposal', 'terms']
/** How long a kept scan answers for before the next asker triggers a fresh one. */
const SCAN_FRESH_MS = 60 * 60_000
const SCAN_SCOPE = 'contracts'
/** Files attributed at once — Drive's per-user quota is ~1 000 requests per 100 s; eight keeps a 1 500-lookup scan under it. */
const WALK_WIDTH = 8

/** `fn` over `items`, at most `width` in flight, results in order. */
async function mapPool<T, R>(items: readonly T[], width: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string; size?: string; parents?: string[] }

async function listAll(token: string, q: string, fields: string, extra = ''): Promise<DriveFile[]> {
  const out: DriveFile[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 20; page++) {
    const url = `${DRIVE}/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(${fields})&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives${extra}${pageToken ? `&pageToken=${pageToken}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const body = await res.json()
    if (!res.ok) throw new Error(`Drive list failed (${res.status}): ${body.error?.message ?? 'unknown'}`)
    out.push(...((body.files ?? []) as DriveFile[]))
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const jobsFolderId = Deno.env.get('DRIVE_JOBS_FOLDER_ID')
    const extraRoots = (Deno.env.get('DRIVE_CONTRACT_ROOTS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!serviceRoleKey) return json({ error: 'Server not configured' }, 500)
    if (!saJson || (!jobsFolderId && extraRoots.length === 0)) return json({ error: 'Drive is not connected yet: set GOOGLE_SERVICE_ACCOUNT_JSON and DRIVE_JOBS_FOLDER_ID (or DRIVE_CONTRACT_ROOTS) — docs/DRIVE_INTAKE_SETUP.md — then redeploy.' }, 503)
    const roots = [...new Set([jobsFolderId, ...extraRoots].filter((x): x is string => Boolean(x)))]

    const auth = req.headers.get('Authorization') ?? ''
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await anon.auth.getUser()
    if (!u?.user) return json({ error: 'Sign in first' }, 401)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: row } = await admin.from('users').select('role').eq('id', u.user.id).maybeSingle()
    const officeRoles = ['dev', 'master_technician', 'assistant', 'controller']
    if (!row || !officeRoles.includes(row.role as string)) return json({ error: 'Office roles only' }, 403)

    const body = (await req.json().catch(() => ({}))) as { force?: boolean }
    if (!body.force) {
      const { data: kept } = await admin.from('drive_contract_scans').select('files, stats, scanned_at').eq('scope', SCAN_SCOPE).maybeSingle()
      const age = kept ? Date.now() - new Date(kept.scanned_at as string).getTime() : Number.POSITIVE_INFINITY
      if (kept && age >= 0 && age < SCAN_FRESH_MS) {
        return json({ ok: true, files: kept.files, ...(kept.stats as Record<string, unknown>), cached: true, scanned_at: kept.scanned_at })
      }
    }
    const startedAt = Date.now()

    const token = await googleAccessToken(saJson)

    // 1. Every non-folder file whose name carries a contract word (one paged query).
    const nameQ = CONTRACT_WORDS.map((w) => `name contains '${w}'`).join(' or ')
    const files = await listAll(token, `(${nameQ}) and mimeType != '${FOLDER}' and trashed = false`, 'id,name,mimeType,modifiedTime,webViewLink,size,parents')

    // 2. The job folders: each root's direct child folders.
    const jobFolders: DriveFile[] = []
    for (const root of roots) jobFolders.push(...(await listAll(token, `'${root}' in parents and mimeType = '${FOLDER}' and trashed = false`, 'id,name')))
    const folderName = new Map<string, string>(jobFolders.map((f) => [f.id, f.name]))
    const rootSet = new Set(roots)

    // 3. Walk each file's parent chain up to the job folder (≤ 5 levels, one
    // metadata GET per distinct folder, cached). The chain of names below the
    // job folder rides along — "Josh Peterson / 105 Dover Rd / Contracts" — so a
    // subfolder named for the address or the job number still matches.
    type FolderMeta = { name: string; parent: string | null } | null
    // The lookup in flight is what is cached, so eight files under one unknown folder ask Drive once.
    const metaCache = new Map<string, Promise<FolderMeta>>()
    const metaDone = new Map<string, FolderMeta>()
    let lookups = 0
    function folderMeta(id: string): Promise<FolderMeta> {
      const hit = metaCache.get(id)
      if (hit) return hit
      if (lookups >= 1500) return Promise.resolve(null)
      lookups++
      const p: Promise<FolderMeta> = fetch(`${DRIVE}/files/${id}?fields=id,name,parents&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (res) => {
          const meta = res.ok ? ((await res.json()) as { name: string; parents?: string[] }) : null
          return meta ? { name: meta.name, parent: (meta.parents ?? [])[0] ?? null } : null
        })
        .catch(() => null)
        .then((v) => {
          metaDone.set(id, v)
          return v
        })
      metaCache.set(id, p)
      return p
    }
    async function attribute(f: DriveFile): Promise<{ id: string; name: string } | null> {
      let cur = (f.parents ?? [])[0] ?? null
      const chain: string[] = []
      for (let depth = 0; cur && depth < 5; depth++) {
        if (rootSet.has(cur)) return chain.length > 0 ? { id: cur, name: chain.reverse().join(' / ') } : { id: cur, name: f.name }
        if (folderName.has(cur)) return { id: cur, name: [folderName.get(cur)!, ...chain.reverse()].join(' / ') }
        const m = await folderMeta(cur)
        if (!m) return null
        chain.push(m.name)
        cur = m.parent
      }
      return null
    }

    const out: Array<{ id: string; name: string; mimeType: string; modifiedTime: string | null; webViewLink: string | null; size: number | null; folderId: string; folderName: string }> = []
    const unattributed: Array<{ name: string; chain: string }> = []
    const attributed = await mapPool(files, WALK_WIDTH, attribute)
    for (const [i, f] of files.entries()) {
      const job = attributed[i]
      if (!job) {
        if (unattributed.length < 40) {
          const names: string[] = []
          let cur = (f.parents ?? [])[0] ?? null
          for (let d = 0; cur && d < 4; d++) {
            const m = metaDone.get(cur) ?? null
            if (!m) break
            names.push(m.name)
            cur = m.parent
          }
          unattributed.push({ name: f.name, chain: names.reverse().join(' / ') })
        }
        continue
      }
      out.push({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime ?? null, webViewLink: f.webViewLink ?? null, size: f.size != null ? Number(f.size) : null, folderId: job.id, folderName: job.name })
    }

    const stats = { job_folders: jobFolders.length, roots: roots.length, scanned: files.length, unattributed: files.length - out.length, unattributed_samples: unattributed, folder_lookups: lookups, took_ms: Date.now() - startedAt }
    const scannedAt = new Date().toISOString()
    // Remembered for everyone; a write that fails still answers this caller.
    const { error: keepErr } = await admin.from('drive_contract_scans').upsert({ scope: SCAN_SCOPE, files: out, stats, scanned_at: scannedAt, scanned_by: u.user.id }, { onConflict: 'scope' })
    if (keepErr) console.error('drive-contract-scan: could not keep the scan', keepErr.message)
    return json({ ok: true, files: out, ...stats, cached: false, scanned_at: scannedAt })
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500)
  }
})
