import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIpFromEdgeRequest } from '../_shared/clientIpFromEdgeRequest.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { parseEsignConsent, recordEsignConsent } from '../_shared/esignConsent.ts'
import { resolveTradeLink, type TradeLinkRow } from '../_shared/gcTradeLink.ts'
import { FREE_TEXT_KINDS, isHoneypot, overHourlyCap, parseTradeSubmit, spanishHeld, TRADE_FUNCTION_ERRORS, tradeErrorOf, waiverHeld } from '../_shared/gcTradeSubmit.ts'

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
 *
 * A signature (`sign_sow`, P2c-ii, plan to-dos/gc-mode/mockups/portal-p2c.md) does what `accept-contract` does around the
 * write: no consent is consentNeeded before any write; a drawn image goes to the signatures bucket first and is deleted
 * if the verb refuses; the verb gets the IP and the browser; and after it the e-sign ledger row takes the consent time the
 * verb wrote, so the two match. The unconditional waiver and a change signed (P5c-3b, plan
 * to-dos/gc-mode/mockups/portal-p5.md) are typed and keep no image; their verbs return no time, so their ledger rows
 * (`gc_draw` keyed by the draw, `gc_trade_change` keyed by the change order) take the function's. The waiver is refused as
 * badRequest while `WAIVER_SIGN_LIVE` holds it for the owner's call.
 */

/** Where a trade's drawn signature on its statement of work is kept: `gc-sows/<sow id>/<uuid>.png`. */
const SIGNATURE_BUCKET = 'contract-signer-signatures'

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

/**
 * The company's free-text writes in the last hour: its questions, the people it added, its quotes, its quote days and the
 * changes it asked for, and since P5c-2 its questions while we build and the submittal rounds it sent. A round carries no
 * company of its own, so it is counted on the submittals of the trades its statements of work are for.
 */
async function freeTextCounts(admin: SupabaseClient, companyId: string): Promise<(number | null)[]> {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString()
  const invites = ((await admin.from('gc_invites').select('id').eq('company_id', companyId)).data ?? []) as { id: string }[]
  const head = { count: 'exact' as const, head: true }
  const sowPackages = ((await admin.from('gc_sows').select('package_id').eq('company_id', companyId)).data ?? []) as { package_id: string }[]
  const submittals = sowPackages.length
    ? (((await admin.from('gc_submittals').select('id').in('package_id', sowPackages.map((s) => s.package_id))).data ?? []) as { id: string }[])
    : []
  const [questions, people, contacts, quotes, changes, rfis, rounds] = await Promise.all([
    admin.from('gc_plan_questions').select('id', head).eq('company_id', companyId).gte('created_at', hourAgo),
    admin.from('gc_company_people').select('id', head).eq('company_id', companyId).eq('added_by', 'trade').gte('created_at', hourAgo),
    admin.from('gc_company_contacts').select('id', head).eq('company_id', companyId).eq('how', 'portal').gte('created_at', hourAgo),
    invites.length
      ? admin.from('gc_quotes').select('id', head).in('invite_id', invites.map((i) => i.id)).eq('source', 'trade').gte('created_at', hourAgo)
      : Promise.resolve({ count: 0 } as Count),
    admin.from('gc_trade_change_requests').select('id', head).eq('company_id', companyId).gte('created_at', hourAgo),
    admin.from('gc_rfis').select('id', head).eq('asked_by_company_id', companyId).gte('created_at', hourAgo),
    submittals.length
      ? admin.from('gc_submittal_rounds').select('id', head).in('submittal_id', submittals.map((x) => x.id)).eq('sent_by', 'trade').gte('created_at', hourAgo)
      : Promise.resolve({ count: 0 } as Count),
  ])
  return [questions, people, contacts, quotes, changes, rfis, rounds].map((r) => (r as Count).count)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'badRequest' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as unknown
    if (isHoneypot(body)) return jsonResponse({ ok: true })
    const parsed = parseTradeSubmit(body)
    if (!parsed.ok) return refuse(parsed.key ?? 'badRequest')
    // The unconditional waiver waits on the owner's call (WAIVER_SIGN_LIVE): until then the page sends no such press.
    if (waiverHeld(parsed.kind)) return refuse('badRequest')
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

    // A signature: the consent words as the ledger keeps them, then the drawn image, before the verb.
    const sign = parsed.sign
    const consent = sign ? parseEsignConsent(sign.consent) : null
    if (sign && !consent) return refuse('consentNeeded')
    const ip = sign ? clientIpFromEdgeRequest(req) : null
    const userAgent = sign ? req.headers.get('user-agent') : null
    let signaturePath: string | null = null
    if (sign?.png) {
      signaturePath = `gc-sows/${String(parsed.call.params.p_sow_id)}/${crypto.randomUUID()}.png`
      const { error: upErr } = await admin.storage.from(SIGNATURE_BUCKET).upload(signaturePath, sign.png, { contentType: 'image/png', upsert: false })
      if (upErr) {
        console.error('submit-gc-trade-portal: the signature was not stored', upErr)
        return refuse('failed')
      }
    }
    const params = sign ? { ...parsed.call.params, p_signature_path: signaturePath, p_ip: ip, p_user_agent: userAgent } : parsed.call.params

    const { data, error } = await admin.rpc(parsed.call.rpc, { p_company_id: link.company_id, ...params })
    if (error) {
      if (signaturePath) await admin.storage.from(SIGNATURE_BUCKET).remove([signaturePath])
      const refusal = tradeErrorOf(error)
      if (refusal.key === 'failed') console.error('submit-gc-trade-portal: the verb failed', parsed.kind, error)
      return jsonResponse({ error: refusal.key }, refusal.status)
    }
    if (sign && consent) {
      // Best-effort, as every signing function keeps it: the row's own stamp is the act, this row is the words.
      await recordEsignConsent(admin, {
        recordType: sign.record.type,
        recordId: sign.record.id,
        consent,
        printedName: sign.printedName,
        method: sign.png ? 'draw' : 'type',
        consentedAt: sign.record.type === 'gc_sow' ? String(data) : new Date().toISOString(),
        ip,
        userAgent,
      })
    }
    return jsonResponse({ ok: true, ...(data === null || data === undefined || data === '' ? {} : { value: data }) })
  } catch (e) {
    console.error('submit-gc-trade-portal failed', e)
    return refuse('failed')
  }
})
