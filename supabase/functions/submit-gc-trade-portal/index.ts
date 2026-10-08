import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { resolveTradeLink, type TradeLinkRow } from '../_shared/gcTradeLink.ts'
import { FREE_TEXT_KINDS, isHoneypot, overHourlyCap, parseTradeSubmit, spanishHeld, TRADE_FUNCTION_ERRORS, tradeErrorOf } from '../_shared/gcTradeSubmit.ts'

/**
 * GC mode, the trade partner portal's writes (P2b-i, to-dos/gc-mode/mockups/portal-p2b.md): everything a company
 * does from its no-password page. The link is the key, as on the sub portal (`submit-sub-portal` is the template).
 *
 *   POST { token, kind, website?, ...fields } → { ok: true, value? } | { error: key }
 *
 * In order: the honeypot answers ok; a shape the portal never sends is badRequest; the sample token answers ok and
 * writes nothing; the link is resolved (`_shared/gcTradeLink.ts`, raw then hash; off → linkOff); Spanish held refuses
 * es; a free-text kind is refused past the hourly cap (tooMany). Then the kind's `gc_trade_<verb>` (P2a) runs with the
 * link's company first, and its refusal key comes back as the page's key (`tradeErrorOf`). Errors are keys the
 * page says in the company's language (decision 11).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const refuse = (key: keyof typeof TRADE_FUNCTION_ERRORS) => jsonResponse({ error: key }, TRADE_FUNCTION_ERRORS[key])

type Count = { count: number | null }

/** The company's free-text writes in the last hour: its questions, the people it added, its quotes and its quote days. */
async function freeTextCounts(admin: SupabaseClient, companyId: string): Promise<(number | null)[]> {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const invites = ((await admin.from('gc_invites').select('id').eq('company_id', companyId)).data ?? []) as { id: string }[]
  const head = { count: 'exact' as const, head: true }
  const [questions, people, contacts, quotes] = await Promise.all([
    admin.from('gc_plan_questions').select('id', head).eq('company_id', companyId).gte('created_at', hourAgo),
    admin.from('gc_company_people').select('id', head).eq('company_id', companyId).eq('added_by', 'trade').gte('created_at', hourAgo),
    admin.from('gc_company_contacts').select('id', head).eq('company_id', companyId).eq('how', 'portal').gte('created_at', hourAgo),
    invites.length
      ? admin.from('gc_quotes').select('id', head).in('invite_id', invites.map((i) => i.id)).eq('source', 'trade').gte('created_at', hourAgo)
      : Promise.resolve({ count: 0 } as Count),
  ])
  return [questions, people, contacts, quotes].map((r) => (r as Count).count)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'badRequest' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as unknown
    if (isHoneypot(body)) return jsonResponse({ ok: true })
    const parsed = parseTradeSubmit(body)
    if (!parsed.ok) return refuse('badRequest')
    // The sample (What customers see) writes nothing and never errors (decision 12).
    if (sampleStateFromToken(parsed.token)) return jsonResponse({ ok: true, sample: true })
    if (parsed.token.length < 16 || parsed.token.length > 128) return refuse('badRequest')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const link = await resolveTradeLink(parsed.token, async (column, value) => {
      const { data } = await admin.from('gc_trade_portal_links').select('company_id, revoked_at').eq(column, value).maybeSingle()
      return data as TradeLinkRow | null
    })
    if (!link) return refuse('linkOff')
    if (spanishHeld(parsed.call)) return refuse('spanishHeld')
    if (FREE_TEXT_KINDS.has(parsed.kind) && overHourlyCap(await freeTextCounts(admin, link.company_id))) return refuse('tooMany')

    const { data, error } = await admin.rpc(parsed.call.rpc, { p_company_id: link.company_id, ...parsed.call.params })
    if (error) {
      const refusal = tradeErrorOf(error)
      if (refusal.key === 'failed') console.error('submit-gc-trade-portal: the verb failed', parsed.kind, error)
      return jsonResponse({ error: refusal.key }, refusal.status)
    }
    return jsonResponse({ ok: true, ...(data === null || data === undefined || data === '' ? {} : { value: data }) })
  } catch (e) {
    console.error('submit-gc-trade-portal failed', e)
    return refuse('failed')
  }
})
