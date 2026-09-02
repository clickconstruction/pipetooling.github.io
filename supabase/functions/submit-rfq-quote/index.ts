/**
 * Supply house quote page, public submit (RFQ Phase 2, v2.2631 —
 * docs/SUPPLY_HOUSE_RFQ_PLAN.md). POST takes the vendor's per-line prices
 * (can't-supply, notes), quote-level validity/freight/rep, writes a
 * `bid_quotes` row (source 'link') + `bid_quote_lines`, flips the RFQ to
 * 'quoted', and feeds the name-keyed per-house price memory. Lines are
 * validated against the RFQ's own scope snapshot — a fixture name the RFQ
 * never asked about is dropped, so the token can't be used to write
 * arbitrary rows. Re-submits are allowed until the RFQ closes (compare
 * shows the latest per house; earlier quotes stay as history). No JWT —
 * the token is the credential; service role behind it.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type SubmitLine = {
  fixture?: string
  unitPriceEachCents?: number | null
  cantSupply?: boolean
  note?: string | null
}

const MAX_LINES = 500
const MAX_NOTE = 500
const MAX_NAME = 200

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as {
      token?: string
      quotedBy?: string
      validUntil?: string
      freightCents?: number
      note?: string
      lines?: SubmitLine[]
    } | null
    const token = body?.token?.trim()
    if (!token) return json({ error: 'Missing token' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: rfq } = await admin
      .from('bid_rfqs')
      .select('id, bid_id, bid_version_id, status, scope, supply_house_id, bids(outcome)')
      .eq('token', token)
      .maybeSingle()
    if (!rfq) return json({ error: 'Not found' }, 404)
    const bid = rfq.bids as unknown as { outcome: string | null } | null
    if (rfq.status === 'closed' || bid?.outcome === 'lost') return json({ error: 'This request is closed' }, 410)

    const scope = (rfq.scope ?? {}) as { lines?: Array<{ fixture?: string }> }
    const allowed = new Set(
      (Array.isArray(scope.lines) ? scope.lines : [])
        .map((l) => (typeof l.fixture === 'string' ? l.fixture.trim().toLowerCase() : ''))
        .filter(Boolean),
    )

    const cleanLines = (Array.isArray(body?.lines) ? body!.lines! : [])
      .slice(0, MAX_LINES)
      .map((l) => {
        const fixture = typeof l.fixture === 'string' ? l.fixture.trim().slice(0, MAX_NAME) : ''
        const cents = Number(l.unitPriceEachCents)
        const priced = Number.isInteger(cents) && cents > 0 && cents < 100_000_000
        const cantSupply = l.cantSupply === true
        return {
          fixture,
          unit_price_each_cents: cantSupply ? null : priced ? cents : null,
          cant_supply: cantSupply,
          alternate_note: typeof l.note === 'string' && l.note.trim() ? l.note.trim().slice(0, MAX_NOTE) : null,
        }
      })
      .filter((l) => l.fixture && allowed.has(l.fixture.toLowerCase()) && (l.cant_supply || l.unit_price_each_cents != null))
    if (cleanLines.length === 0) return json({ error: 'Nothing to save — add a price or mark lines you can’t supply.' }, 400)

    const freight = Number(body?.freightCents)
    const validUntil = typeof body?.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.validUntil) ? body.validUntil : null

    const { data: quote, error: qErr } = await admin
      .from('bid_quotes')
      .insert({
        rfq_id: rfq.id,
        bid_id: rfq.bid_id,
        bid_version_id: rfq.bid_version_id,
        supply_house_id: rfq.supply_house_id,
        quoted_by: typeof body?.quotedBy === 'string' ? body.quotedBy.trim().slice(0, MAX_NAME) || null : null,
        source: 'link',
        valid_until: validUntil,
        freight_cents: Number.isInteger(freight) && freight > 0 && freight < 100_000_000 ? freight : null,
        note: typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, MAX_NOTE) : null,
      })
      .select('id')
      .single()
    if (qErr) throw qErr

    const { error: lErr } = await admin.from('bid_quote_lines').insert(
      cleanLines.map((l) => ({ quote_id: quote.id, ...l, price_basis: 'each', basis_qty: 1, match_confidence: 'manual' })),
    )
    if (lErr) throw lErr

    await admin.from('bid_rfqs').update({ status: 'quoted' }).eq('id', rfq.id)

    if (rfq.supply_house_id) {
      // Dedupe by the generated fixture_key — two lines normalizing to the same
      // key in one upsert batch would error ("cannot affect row a second time").
      const byKey = new Map<string, (typeof cleanLines)[number]>()
      for (const l of cleanLines) {
        if (!l.cant_supply && l.unit_price_each_cents != null) byKey.set(l.fixture.trim().toLowerCase(), l)
      }
      const memory = [...byKey.values()].map((l) => ({
        supply_house_id: rfq.supply_house_id,
        fixture: l.fixture,
        unit_price_each_cents: l.unit_price_each_cents,
        quoted_at: new Date().toISOString(),
        source_bid_id: rfq.bid_id,
      }))
      if (memory.length > 0) {
        const { error: mErr } = await admin
          .from('supply_house_fixture_prices')
          .upsert(memory, { onConflict: 'supply_house_id,fixture_key' })
        if (mErr) console.error('price memory upsert failed', mErr)
      }
    }

    return json({ ok: true, savedLines: cleanLines.length })
  } catch (err) {
    console.error('submit-rfq-quote failed', err)
    return json({ error: 'Something went wrong' }, 500)
  }
})
