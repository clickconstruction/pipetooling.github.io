/**
 * Supply house quote page, public fetch (RFQ Phase 2, v2.2631 —
 * docs/SUPPLY_HOUSE_RFQ_PLAN.md). GET serves an RFQ's scope lines by its
 * plaintext token (the Bid Room precedent): fixture names + counts, the job
 * label, who it was scoped for, and needed-by. No prices ever leave — the
 * scope snapshot holds names and counts only. Closed RFQs (manual close, or
 * the bid marked lost) return status 'closed' so the page can say so; a
 * bad token is a 404. No JWT — the token is the credential; service role
 * behind it.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type ScopeLine = { fixture: string; count: number; unit?: string | null }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    const token = new URL(req.url).searchParams.get('t')?.trim()
    if (!token) return json({ error: 'Missing token' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: rfq } = await admin
      .from('bid_rfqs')
      .select('id, bid_id, status, needed_by, created_at, scope, supply_house_id, viewed_at, supply_houses(name), bids(bid_number, project_name, outcome)')
      .eq('token', token)
      .maybeSingle()
    if (!rfq) return json({ error: 'Not found' }, 404)

    // Lane B's "Viewed" signal (v2.2636): the vendor opening this page is the
    // real thing — stamp once, fire-and-forget.
    if (!rfq.viewed_at) {
      admin
        .from('bid_rfqs')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', rfq.id)
        .then(() => {}, (e: unknown) => console.error('viewed_at stamp failed', e))
    }

    const bid = rfq.bids as unknown as { bid_number: string | null; project_name: string | null; outcome: string | null } | null
    const house = rfq.supply_houses as unknown as { name: string } | null
    const closed = rfq.status === 'closed' || bid?.outcome === 'lost'
    if (closed) return json({ status: 'closed' })
    const bidName = [bid?.bid_number, bid?.project_name].filter(Boolean).join(' · ')

    const scope = (rfq.scope ?? {}) as { lines?: ScopeLine[]; plansLink?: string | null }
    const lines = Array.isArray(scope.lines)
      ? scope.lines
          .filter((l) => l && typeof l.fixture === 'string' && l.fixture.trim())
          .map((l) => ({ fixture: l.fixture, count: Number(l.count) || 0, unit: l.unit ?? null }))
      : []

    const plansLink =
      typeof scope.plansLink === 'string' && /^https?:\/\//i.test(scope.plansLink) ? scope.plansLink : null

    return json({
      status: rfq.status,
      bidName: bidName || 'a job',
      supplyHouse: house?.name ?? null,
      neededBy: rfq.needed_by,
      sentAt: rfq.created_at,
      plansLink,
      lines,
    })
  } catch (err) {
    console.error('get-rfq-quote-page failed', err)
    return json({ error: 'Something went wrong' }, 500)
  }
})
