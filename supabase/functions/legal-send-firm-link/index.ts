import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { COMPANY_EMAIL_FROM } from '../_shared/emailFrom.ts'
import { buildLegalWelcomeEmail } from '../_shared/legalEmails.ts'
import { legalFirmLinkAddresses } from '../_shared/legalFirmLink.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { legalPortalAddress } from '../_shared/legalPortalAddress.ts'

/**
 * Send the law firm its portal link (v2.4624, punch list #85 item 21): the desk's link card →
 * one welcome email from the company to the firm's address on file and/or typed addresses
 * (`_shared/legalEmails.ts` `buildLegalWelcomeEmail`: who we are, what the portal is, the link,
 * what to do first). Staff-authenticated like `send-bid-room-link`: the caller's JWT is checked
 * in the handler and the caller must be office (`legal_office_can_read`, the role set that
 * manages the link). Filed in `sent_documents` (kind `legal_firm_link`, source the active
 * `legal_portal_links` row), which is where the card reads *Sent to … on …* back.
 *
 * Body: `{ firmId, linkId?: string, useOnFile?: boolean, typed?: string, note?: string, token?: string }`.
 * `linkId` (v2.4750) names one of the firm's live links — a person's link, sent to that person;
 * without it the firm's own link goes. The key is read from Vault on the server
 * (`legal_portal_link_token_by_id` / `legal_portal_link_token`, service role, punch list #85 item
 * 22); `token`, when the card sends it, must match that link's hash. The address is the one the
 * office's list shows (`_shared/legalPortalAddress.ts`), on `APP_ORIGIN`, never the caller's origin.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const WITH_FIRM = ['referred', 'demand', 'suit', 'judgment']
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } })
    const { data: userData, error: authErr } = await userClient.auth.getUser()
    if (authErr || !userData?.user) return json({ error: 'Not signed in' }, 401)
    const { data: isOffice } = await userClient.rpc('legal_office_can_read')
    if (isOffice !== true) return json({ error: 'Only the office sends the firm its link.' }, 403)

    const body = (await req.json().catch(() => null)) as { firmId?: string; linkId?: string; useOnFile?: boolean; typed?: string; note?: string; token?: string } | null
    const firmId = (body?.firmId ?? '').trim()
    if (!firmId) return json({ error: 'Which firm?' }, 400)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: firmRow } = await admin.from('legal_firms').select('id, name, handling_name, email').eq('id', firmId).maybeSingle()
    const firm = firmRow as { id: string; name: string; handling_name: string; email: string } | null
    if (!firm) return json({ error: 'Firm not found.' }, 404)

    const to = legalFirmLinkAddresses({ onFile: firm.email, useOnFile: body?.useOnFile !== false, typed: body?.typed ?? '' })
    if (to.error) return json({ error: to.error }, 400)

    // The link (v2.4750): the named live link, else the firm's own. Its key sits in Vault, readable by the service role alone.
    const linkId = (body?.linkId ?? '').trim()
    const linkQuery = admin.from('legal_portal_links').select('id, purpose, label, token_hash').eq('firm_id', firm.id).is('revoked_at', null)
    const { data: linkRow } = await (linkId ? linkQuery.eq('id', linkId) : linkQuery.eq('purpose', 'firm')).maybeSingle()
    const link = linkRow as { id: string; purpose: string; label: string | null; token_hash: string | null } | null
    if (!link) return json({ error: linkId ? 'That link is no longer live. Open the list again.' : 'Create the firm’s link first.' }, 409)
    const { data: vaulted, error: vaultErr } = await admin.rpc('legal_portal_link_token_by_id', { p_link_id: link.id })
    if (vaultErr) console.warn('legal-send-firm-link: legal_portal_link_token_by_id', vaultErr.message)
    const token = typeof vaulted === 'string' ? vaulted : ''
    if (!token) return json({ error: 'The stored link cannot be read back. Press Rotate, then send the new link.' }, 409)
    const offered = (body?.token ?? '').trim()
    if (offered && offered !== token) return json({ error: 'That link is no longer the firm’s live link. Close the card and open it again.' }, 409)

    // The address the office's list shows, on the app's origin: a body origin would let a caller mail the firm a look-alike host.
    const origin = Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'
    const portalUrl = legalPortalAddress(origin, token)

    const [{ count: matterCount }, { data: me }] = await Promise.all([
      admin.from('legal_matters').select('id', { count: 'exact', head: true }).eq('firm_id', firm.id).in('stage', WITH_FIRM),
      admin.from('users').select('name, email, phone').eq('id', userData.user.id).maybeSingle(),
    ])
    const sender = me ? { name: String((me as { name?: string | null }).name ?? ''), email: String((me as { email?: string | null }).email ?? ''), phone: String((me as { phone?: string | null }).phone ?? '') } : null
    const mail = buildLegalWelcomeEmail({
      companyName: PORTAL_COMPANY.name,
      companyPhone: PORTAL_COMPANY.phone,
      firmName: firm.name,
      greetName: link.purpose === 'person' && link.label ? link.label : firm.handling_name,
      portalUrl,
      matterCount: matterCount ?? 0,
      note: typeof body?.note === 'string' ? body.note.slice(0, 1000) : null,
      sender,
    })

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return json({ error: 'Email is not set up on the server.' }, 500)
    // Sent copies (docs/SENT_COPIES.md): kept under the link it carries, so the card can say when it went (kind = LEGAL_FIRM_LINK_KIND).
    const res = await sendEmailViaResend(to.emails[0], mail.subject, mail.text, mail.html, resendKey, {
      from: COMPANY_EMAIL_FROM,
      ...(to.emails.length > 1 ? { cc: to.emails.slice(1) } : {}),
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
      emailType: 'legal_firm_link',
      file: { kind: 'legal_firm_link', title: `Portal link for ${firm.name}`, recipientName: firm.name, source: { table: 'legal_portal_links', id: link.id }, sentBy: userData.user.id },
    })
    if (!res.success) return json({ ok: false, error: `The email did not go: ${res.error ?? 'the mail service refused it'}. Try again in a minute.` }, 502)
    return json({ ok: true, sentTo: to.emails, sentAt: new Date().toISOString() })
  } catch (e) {
    console.error(e)
    return json({ error: 'Something went wrong on our side. Try again in a minute.' }, 500)
  }
})
