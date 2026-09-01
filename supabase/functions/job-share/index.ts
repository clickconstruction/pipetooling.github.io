import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * job-share (v2.1453, Share-a-job Phase 2): public resolver for tokenized job
 * share links, so a texted link unfurls as a rich iMessage/OG card.
 *
 * GET ?t=<raw token>          → HTML with OG meta tags (title = job # + name,
 *                               description = address · status, image = the
 *                               &img=1 variant when Street View has coverage)
 *                               plus an instant redirect into the app at
 *                               /jobs?jobDetail=<job id> for human taps.
 * GET ?t=<raw token>&img=1    → Street View JPEG of the job address (og:image).
 *
 * verify_jwt = false (config.toml): link previews are fetched with no auth.
 * The card intentionally exposes ONLY job #, name, address, and status to
 * whoever holds the link; the app itself stays behind login/RLS. Tokens are
 * 128-bit random, stored as sha256 hashes in job_share_links (raw token lives
 * only in the URL — same pattern as estimates.public_token_hash), revocable
 * per link via revoked_at.
 */

const MAX_TOKEN_LEN = 128

async function sha256HexFromString(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlResponse(status: number, body: string, cacheSeconds = 0) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...(cacheSeconds > 0 ? { 'Cache-Control': `public, max-age=${cacheSeconds}` } : { 'Cache-Control': 'no-store' }),
    },
  })
}

function notActivePage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>ClickTooling</title>
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family:-apple-system,sans-serif;padding:2rem;color:#1c2635">
<p>This share link is no longer active.</p>
<p><a href="${(Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '')}">Open ClickTooling</a></p>
</body></html>`
}

function prettyStatus(status: string | null): string {
  const s = (status ?? '').trim()
  if (!s) return ''
  const label = s.replace(/_/g, ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

type SharedJob = {
  id: string
  hcp_number: string | null
  job_name: string | null
  job_address: string | null
  status: string | null
}

async function resolveToken(rawToken: string): Promise<SharedJob | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const tokenHash = await sha256HexFromString(rawToken)
  const { data: link, error: linkErr } = await admin
    .from('job_share_links')
    .select('job_id, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (linkErr || !link || link.revoked_at) return null

  const { data: job, error: jobErr } = await admin
    .from('jobs_ledger')
    .select('id, hcp_number, job_name, job_address, status')
    .eq('id', link.job_id)
    .maybeSingle()
  if (jobErr || !job) return null
  return job as SharedJob
}

function shareTitle(job: SharedJob): string {
  const hcp = job.hcp_number?.trim() ?? ''
  const name = job.job_name?.trim() ?? ''
  const parts = [hcp ? `Job #${hcp}` : null, name || null].filter(Boolean)
  return parts.length > 0 ? parts.join(' — ') : 'Job'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' } })
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(req.url)
  const rawToken = url.searchParams.get('t')?.trim() ?? ''
  if (!rawToken || rawToken.length > MAX_TOKEN_LEN) {
    return htmlResponse(404, notActivePage())
  }

  const job = await resolveToken(rawToken)
  if (!job) {
    return htmlResponse(404, notActivePage())
  }

  const appOrigin = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '')
  const address = job.job_address?.trim() ?? ''
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')?.trim()

  // og:image variant — the Street View JPEG itself.
  if (url.searchParams.get('img') === '1') {
    if (!apiKey || !address) return new Response('Not found', { status: 404 })
    const imageUrl =
      `https://maps.googleapis.com/maps/api/streetview?size=600x314&location=${
        encodeURIComponent(address)
      }&fov=80&pitch=0&key=${encodeURIComponent(apiKey)}`
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return new Response('Not found', { status: 404 })
    return new Response(imgRes.body, {
      status: 200,
      headers: {
        'Content-Type': imgRes.headers.get('Content-Type') ?? 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }

  // HTML variant: OG tags for preview fetchers + instant redirect for humans.
  // Only advertise og:image when Street View actually has coverage, so cards
  // never unfurl with Google's grey "no imagery" placeholder.
  let hasStreetView = false
  if (apiKey && address) {
    try {
      const metaRes = await fetch(
        `https://maps.googleapis.com/maps/api/streetview/metadata?location=${
          encodeURIComponent(address)
        }&key=${encodeURIComponent(apiKey)}`,
      )
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as { status?: string }
        hasStreetView = meta.status === 'OK'
      }
    } catch {
      hasStreetView = false
    }
  }

  const title = shareTitle(job)
  const statusLabel = prettyStatus(job.status)
  const description = [address || null, statusLabel || null].filter(Boolean).join(' · ')
  const redirectUrl = `${appOrigin}/jobs?jobDetail=${encodeURIComponent(job.id)}`
  // Build the public URL from SUPABASE_URL, not req.url — inside the edge
  // runtime req.url is the gateway-internal http origin with /functions/v1
  // stripped, which would hand preview fetchers a broken og:image URL.
  const publicBase = (Deno.env.get('SUPABASE_URL') ?? url.origin).replace(/\/+$/, '')
  const selfUrl = `${publicBase}/functions/v1/job-share?t=${encodeURIComponent(rawToken)}`

  const og = [
    `<meta property="og:site_name" content="ClickTooling">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    description ? `<meta property="og:description" content="${escapeHtml(description)}">` : '',
    `<meta property="og:url" content="${escapeHtml(selfUrl)}">`,
    hasStreetView ? `<meta property="og:image" content="${escapeHtml(`${selfUrl}&img=1`)}">` : '',
    hasStreetView ? `<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`,
  ].filter(Boolean).join('\n')

  const body = `<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
${og}
<meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}">
<script>window.location.replace(${JSON.stringify(redirectUrl)})</script>
</head>
<body style="font-family:-apple-system,sans-serif;padding:2rem;color:#1c2635">
<p>Opening ${escapeHtml(title)}…</p>
<p><a href="${escapeHtml(redirectUrl)}">Tap here if nothing happens</a></p>
</body></html>`

  return htmlResponse(200, body, 300)
})
