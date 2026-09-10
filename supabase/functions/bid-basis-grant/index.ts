/**
 * bid-basis-grant (v2.3226) — the Cover Letter's door into CountTooling.
 *
 * POST { bid_id } with the caller's session JWT. Returns the bid's CountTooling
 * view link with `export=bid-basis&ref=b<bid_number>` appended and, when the
 * `COUNTTOOLING_VIEW_GRANT_SECRET` is set, a short-lived signed viewer grant
 * (`&g=`, `via: 'pipetooling-bid-basis'`) that names the caller — CountTooling's
 * get-view-project verifies it, skips its email gate, and logs the visit under
 * the caller's name. No secret, or no CountTooling link, degrades to the bare
 * link (`granted: false` + `reason`) so the client can still open the plan.
 *
 * Auth: JWT validated in-handler (verify_jwt = false in config.toml, like the
 * other staff functions); the bid is read through the caller's own client, so
 * bids RLS decides whether they may see it. Roles: the Cover Letter roles.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { countToolingViewToken, mintViewGrant, withViewGrant } from '../_shared/viewGrant.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BID_BASIS_GRANT_SOURCE = 'pipetooling-bid-basis'
const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'])

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** `b409` — the same stamp CountTooling's file name and the twin pipeline use (mirror of src/lib/bids/bidBasis.ts). */
export function bidBasisRef(bidNumber: string | number | null | undefined): string {
  const n = String(bidNumber ?? '').trim()
  if (!n) return 'bid'
  const raw = /^[a-z]/i.test(n) ? n : `b${n}`
  const s = raw.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return s ? s.slice(0, 40) : 'bid'
}

/** The link with the export flag + bid stamp; null when it is not a CountTooling view link. */
export function bidBasisExportUrl(link: string | null | undefined, ref: string): string | null {
  if (!countToolingViewToken(link)) return null
  try {
    const u = new URL((link as string).trim())
    u.searchParams.set('export', 'bid-basis')
    u.searchParams.set('ref', ref)
    return u.toString()
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'Method not allowed' })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse(401, { ok: false, error: 'Unauthorized' })
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return jsonResponse(401, { ok: false, error: 'Unauthorized' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) return jsonResponse(500, { ok: false, error: 'Server misconfigured' })

    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token)
    if (authErr || !user) return jsonResponse(401, { ok: false, error: 'Unauthorized' })

    const body = (await req.json().catch(() => ({}))) as { bid_id?: string }
    const bidId = (body.bid_id ?? '').trim()
    if (!bidId) return jsonResponse(400, { ok: false, error: 'bid_id required' })

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: me, error: meErr } = await admin.from('users').select('id, name, email, role, archived_at').eq('id', user.id).maybeSingle()
    if (meErr || !me) return jsonResponse(403, { ok: false, error: 'User not found' })
    if (me.archived_at) return jsonResponse(403, { ok: false, error: 'User archived' })
    if (!ALLOWED_ROLES.has((me.role as string) ?? '')) return jsonResponse(403, { ok: false, error: 'Role cannot open a bid basis export' })

    // The bid through the caller's client: bids RLS decides visibility.
    const { data: bid, error: bidErr } = await userClient
      .from('bids')
      .select('id, bid_number, project_name, count_tooling_plans_link, count_tooling_link')
      .eq('id', bidId)
      .maybeSingle()
    if (bidErr) return jsonResponse(500, { ok: false, error: bidErr.message })
    if (!bid) return jsonResponse(404, { ok: false, error: 'Bid not found' })

    const link = ((bid.count_tooling_plans_link as string | null) ?? '').trim() || ((bid.count_tooling_link as string | null) ?? '').trim() || null
    const ref = bidBasisRef(bid.bid_number as string | null)
    const exportUrl = bidBasisExportUrl(link, ref)
    if (!exportUrl) return jsonResponse(400, { ok: false, error: 'no_counttooling_link', message: 'This bid has no CountTooling plans link.' })

    const viewToken = countToolingViewToken(link)!
    const secret = Deno.env.get('COUNTTOOLING_VIEW_GRANT_SECRET') ?? ''
    const viewerName = ((me.name as string | null) ?? '').trim() || ((me.email as string | null) ?? '').trim() || 'PipeTooling user'
    if (!secret) return jsonResponse(200, { ok: true, url: exportUrl, granted: false, reason: 'no_secret', ref })

    try {
      const g = await mintViewGrant({ t: viewToken, name: viewerName, email: (me.email as string | null) ?? null, person: null, via: BID_BASIS_GRANT_SOURCE }, secret)
      return jsonResponse(200, { ok: true, url: withViewGrant(exportUrl, g), granted: true, expires_in: 24 * 60 * 60, viewer: viewerName, ref })
    } catch (err) {
      return jsonResponse(200, { ok: true, url: exportUrl, granted: false, reason: 'mint_failed', message: err instanceof Error ? err.message : String(err), ref })
    }
  } catch (err) {
    return jsonResponse(500, { ok: false, error: err instanceof Error ? err.message : String(err) })
  }
})
