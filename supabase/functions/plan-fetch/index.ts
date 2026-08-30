import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// plan-fetch — the pipeline's plan-bytes door (estimator-twin pipeline, CT-1).
// Streams a bid's plan set (the Drive file behind bids.plans_link) to an authorized
// caller, using the service account's token — so CountTooling's import-takeoff (or any
// robot leg) can pull the PDF without holding a Google credential. Auth mirrors
// drive-intake: X-Twin-Token (assignment-is-the-grant) or staff JWT (estimator+).
// GET ?bid=b403 or POST {"bid":"b403"}. Responds with the raw PDF bytes.

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

    let bidRef = new URL(req.url).searchParams.get('bid')?.trim() ?? ''
    if (!bidRef && req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as { bid?: string }
      bidRef = String(body.bid ?? '').trim()
    }
    if (!bidRef) return json({ error: 'bid required (?bid=b403 or POST {"bid":"b403"})' }, 400)

    const uuidRe = /^[0-9a-f-]{36}$/i
    const q = admin.from('bids').select('id, bid_number, project_name, plans_link, estimator_id, created_by')
    const { data: bid } = await (uuidRe.test(bidRef) ? q.eq('id', bidRef) : q.eq('bid_number', bidRef.replace(/^(bp|b)/i, ''))).maybeSingle()
    if (!bid) return json({ error: `No bid found for "${bidRef}"` }, 404)
    if (isTwin && bid.estimator_id !== callerId && bid.created_by !== callerId) {
      return json({ error: 'Not your bid (assignment is the grant)' }, 403)
    }
    if (!bid.plans_link) return json({ error: `Bid ${bid.bid_number} has no plans_link — file the plans first (drive-intake / file_plans with a plans_url)` }, 404)
    const fileId = driveFileIdFromUrl(String(bid.plans_link))
    if (!fileId) return json({ error: `plans_link is not a Drive file link: ${bid.plans_link}` }, 422)

    const token = await googleAccessToken(saJson)
    const src = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!src.ok || !src.body) {
      return json({ error: `Drive fetch failed (${src.status}) — is the file shared with the service account?` }, 502)
    }
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
