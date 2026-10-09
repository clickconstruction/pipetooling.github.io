import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { buildContractSigningEmail, clampContractEmailIntro, clampContractEmailSubject } from '../_shared/contractSigningEmail.ts'
import { personSigningSentCopy, signingDocRefusal, signingRequestRefusal, type SigningRequestBody } from '../_shared/contractSigningSend.ts'
import { sendEmailViaResend as sendTradeEmailViaResend } from '../_shared/resendSendEmail.ts'
import { officeYmd } from '../_shared/bidFollowupReminder.ts'
import {
  buildGcTradeEmail,
  GC_TRADE_EMAIL_FROM_NAME,
  GC_TRADE_EMAIL_ROLES,
  spanishHeld,
  TRADE_EMAIL_ERRORS,
  tradeEmailReach,
  tradeEmailRecipients,
  tradePortalLinkUrl,
  type TradeEmailErrorKey,
  type TradeMailPerson,
} from '../_shared/gcTradeEmail.ts'
import {
  companyPaperMessageKind,
  companySigningEmailInput,
  companySigningSentCopy,
  companyTradeMessageRow,
  parseCompanySigningRequest,
} from '../_shared/companySigningSend.ts'

/** Short portal address root — mirrors `PORTAL_SHORT_ORIGIN` in src/lib/portal/portalShortOrigin.ts. */
const PORTAL_SHORT_ORIGIN = 'https://my.clickplumbing.com/'

async function sha256HexFromString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomUrlToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  textPlain: string,
  htmlBody: string,
  resendApiKey: string,
  fromMailbox: string,
  replyTo: string | null,
): Promise<{ success: boolean; error?: string; resendEmailId?: string | null }> {
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromMailbox,
      to: [to],
      subject,
      html: htmlBody,
      text: textPlain,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })
  if (!resendResponse.ok) {
    const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
    return { success: false, error: errorData.message || `Resend ${resendResponse.status}` }
  }
  const sent = (await resendResponse.json().catch(() => ({}))) as { id?: string }
  await logEmailSendBestEffort({ resendEmailId: sent.id ?? null, to: [to], from: fromMailbox, subject, emailType: 'contract_for_signature' })
  return { success: true, resendEmailId: sent.id ?? null }
}

/**
 * A trade partner company's paper (GC mode, the Board's B6-b-i, call S, A): its master agreement or W-9 goes to the
 * company's 'contracts' people in GC's frame, with the signing link as the email's own step. In order, as gc-trade-email:
 * the caller (a dev until the papers' door, never a training account or a twin), the request, Spanish held, the paper (the
 * company's own, sendable), the key sent once (checked before a token is minted, so a repeat never voids the link already
 * sent), who gets it, the token as the person path mints it, the email, the send, then the `gc_trade_messages` row and the
 * sent copy. A failed send writes no row. The company's portal link is read, never minted here.
 */
async function sendCompanyPaper(rawBody: unknown, ctx: { userId: string; supabaseUrl: string; serviceKey: string }): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  const refuse = (key: TradeEmailErrorKey, detail?: string) => json({ error: key, ...(detail ? { detail } : {}) }, TRADE_EMAIL_ERRORS[key])
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return refuse('failed', 'Email is not configured yet: set RESEND_API_KEY')
  const admin = createClient(ctx.supabaseUrl, ctx.serviceKey)

  const { data: who } = await admin.from('users').select('role, name, email, read_only, is_digital_twin').eq('id', ctx.userId).maybeSingle()
  if (!who || !GC_TRADE_EMAIL_ROLES.includes(String(who.role))) return refuse('officeOnly')
  if (who.read_only || who.is_digital_twin) return refuse('readOnly')

  const parsed = parseCompanySigningRequest(rawBody)
  if (!parsed.ok) return refuse('badRequest')
  const m = parsed.req
  if (spanishHeld(m)) return refuse('spanishHeld')

  const { data: doc } = await admin
    .from('person_contract_documents')
    .select('id, company_id, doc_type, status, signing_body_html, canonical_document_url, url, form_template_id')
    .eq('id', m.documentId)
    .maybeSingle()
  if (!doc || doc.company_id !== m.companyId) return refuse('notFound')
  const docRefusal = signingDocRefusal(doc)
  if (docRefusal) return refuse('badRequest', docRefusal.error)
  const { data: company } = await admin.from('gc_companies').select('id, name, contact_name, email, contact_gets').eq('id', m.companyId).maybeSingle()
  if (!company) return refuse('notFound')

  const sentBefore = async () => (await admin.from('gc_trade_messages').select('id, email_send_log_id, to_names').eq('company_id', m.companyId).eq('msg_key', m.key).maybeSingle()).data
  const before = await sentBefore()
  if (before) return json({ ok: true, companyId: m.companyId, messageId: before.id, emailSendLogId: before.email_send_log_id, to: before.to_names ?? [], already: true })

  const { data: people } = await admin.from('gc_company_people').select('name, email, gets').eq('company_id', m.companyId).is('removed_at', null)
  const reach = tradeEmailReach(tradeEmailRecipients(company, (people ?? []) as TradeMailPerson[], 'contracts'))
  if (reach.length === 0) return refuse('noEmail')

  // The signing link, minted as the person path mints it.
  const origin = m.publicOrigin ?? Deno.env.get('ESTIMATE_PUBLIC_ORIGIN') ?? 'https://pipetooling.github.io'
  const rawToken = randomUrlToken()
  const tokenHash = await sha256HexFromString(rawToken)
  const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
  const acceptUrl = `${origin.replace(/\/$/, '')}/contract/accept?t=${encodeURIComponent(rawToken)}`
  const { data: updatedRows, error: upErr } = await admin
    .from('person_contract_documents')
    .update({ status: 'sent', sent_at: new Date().toISOString(), public_token_hash: tokenHash, public_token_expires_at: expiresAt })
    .eq('id', doc.id)
    .in('status', ['unsent', 'sent'])
    .select('id')
  if (upErr || !updatedRows?.length) return refuse('failed', 'Could not activate signing link')

  const portalToken = (await admin.from('gc_trade_portal_links').select('token').eq('company_id', m.companyId).is('revoked_at', null).maybeSingle()).data?.token as string | null | undefined
  const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
  const names = reach.map((r) => r.name)
  const email = buildGcTradeEmail(
    companySigningEmailInput({
      req: m,
      names,
      company: String(company.name ?? ''),
      portalUrl: portalToken ? tradePortalLinkUrl(appOrigin, portalToken) : null,
      acceptUrl,
      signer: (who.name || GC_TRADE_EMAIL_FROM_NAME).trim(),
      gc: GC_TRADE_EMAIL_FROM_NAME,
    }),
  )
  const from = mailboxWithName(GC_TRADE_EMAIL_FROM_NAME, EMAIL_FROM)
  const [first, ...rest] = reach
  const cc = rest.map((r) => r.email)
  const replyTo = (who.email || '').trim() || undefined
  const sent = await sendTradeEmailViaResend(first!.email, email.subject, email.text, email.html, resendApiKey, {
    from,
    ...(replyTo ? { replyTo } : {}),
    ...(cc.length ? { cc } : {}),
    emailType: 'gc_trade_email',
  })
  if (!sent.success) return json({ ok: true, emailed: false, accept_url: acceptUrl, email_error: sent.error ?? 'Resend said no' })

  const logId = sent.resendEmailId
    ? ((await admin.from('email_send_log').select('id').eq('resend_email_id', sent.resendEmailId).maybeSingle()).data?.id ?? null)
    : null
  const messageId = crypto.randomUUID()
  const { error } = await admin.from('gc_trade_messages').insert(
    companyTradeMessageRow({
      id: messageId,
      req: m,
      kind: companyPaperMessageKind(doc.doc_type),
      subject: email.subject,
      names,
      sentOn: officeYmd(new Date().toISOString()),
      sentBy: ctx.userId,
      emailSendLogId: logId,
    }),
  )
  // Two presses at once: the other one's row stands, and this answers with its ids.
  const raced = error?.code === '23505' ? await sentBefore() : null
  const [filing, copy] = companySigningSentCopy({
    company: String(company.name ?? ''),
    messageId: error ? null : messageId,
    sentBy: ctx.userId,
    to: first!.email,
    cc,
    from,
    subject: email.subject,
    html: email.html,
    resendEmailId: sent.resendEmailId ?? null,
  })
  await fileSentEmailBestEffort(filing, copy)
  if (raced) return json({ ok: true, companyId: m.companyId, messageId: raced.id, emailSendLogId: raced.email_send_log_id, to: raced.to_names ?? [], already: true })
  if (error) return refuse('failed', `Sent, but not recorded: ${error.message}`)
  return json({ ok: true, emailed: true, accept_url: acceptUrl, companyId: m.companyId, messageId, emailSendLogId: logId, to: names })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as SigningRequestBody & { trade_email?: unknown }
    // A trade partner company's paper takes its own path (sendCompanyPaper, above); the person path below is pinned
    // against main and never sees one.
    if (body.trade_email !== undefined) return await sendCompanyPaper(body, { userId: user.id, supabaseUrl, serviceKey })
    const { person_contract_document_id, signer_email, public_origin } = body
    // The request's own refusals (_shared/contractSigningSend.ts, pinned against main).
    const requestRefusal = signingRequestRefusal(body)
    if (requestRefusal) {
      return new Response(JSON.stringify({ error: requestRefusal.error }), {
        status: requestRefusal.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const signerEmail = signer_email as string

    const { data: row, error: selErr } = await userClient
      .from('person_contract_documents')
      .select('id, person_name, document_name, status, signing_body_html, canonical_document_url, url, form_template_id')
      .eq('id', person_contract_document_id)
      .single()

    if (selErr || !row) {
      return new Response(JSON.stringify({ error: 'Contract document not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const doc = row as {
      id: string
      person_name: string
      document_name: string
      status: string
      signing_body_html: string | null
      canonical_document_url: string | null
      url: string | null
      form_template_id: string | null
    }

    // Signed already, nothing to sign, or a status that is neither unsent nor sent (pinned against main).
    const docRefusal = signingDocRefusal(doc)
    if (docRefusal) {
      return new Response(JSON.stringify({ error: docRefusal.error }), {
        status: docRefusal.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const origin =
      (typeof public_origin === 'string' && public_origin.startsWith('http') ? public_origin : null) ??
        Deno.env.get('ESTIMATE_PUBLIC_ORIGIN') ??
        'https://pipetooling.github.io'

    const rawToken = randomUrlToken()
    const tokenHash = await sha256HexFromString(rawToken)
    const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
    const acceptUrl = `${origin.replace(/\/$/, '')}/contract/accept?t=${encodeURIComponent(rawToken)}`

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: updatedRows, error: upErr } = await admin
      .from('person_contract_documents')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        public_token_hash: tokenHash,
        public_token_expires_at: expiresAt,
      })
      .eq('id', doc.id)
      .in('status', ['unsent', 'sent'])
      .select('id')

    if (upErr || !updatedRows?.length) {
      console.error(upErr)
      return new Response(JSON.stringify({ error: 'Could not activate signing link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // The staff member pressing send: Reply-To and the "reach" line. Best effort — a missing
    // users row (service accounts) just drops the sender from the email.
    const { data: senderRow } = await admin.from('users').select('name, email').eq('id', user.id).maybeSingle()
    const senderName = ((senderRow as { name?: string | null } | null)?.name ?? '').trim()
    const senderEmail = ((senderRow as { email?: string | null } | null)?.email ?? user.email ?? '').trim()
    const sender = senderEmail ? { name: senderName, email: senderEmail } : null

    // The person's live portal address, if they have one: a saved slug AND an unrevoked link.
    // Read-only — nothing is minted to send an email (the portal's no-mint-on-demand rule).
    let portalUrl: string | null = null
    // The one person this document names, when the name finds exactly one: the sent copy is filed under them.
    let sentCopyPersonId: string | null = null
    try {
      const { data: personRows } = await admin
        .from('people')
        .select('id')
        .eq('name', doc.person_name.trim())
        .is('archived_at', null)
        .limit(2)
      const personIds = ((personRows ?? []) as Array<{ id: string }>).map((r) => r.id)
      if (personIds.length === 1) {
        const personId = personIds[0]!
        sentCopyPersonId = personId
        const [{ data: slugRow }, { data: linkRows }] = await Promise.all([
          admin.from('sub_portal_slugs').select('slug').eq('person_id', personId).maybeSingle(),
          admin.from('sub_portal_links').select('id').eq('person_id', personId).is('revoked_at', null).limit(1),
        ])
        const slug = ((slugRow as { slug?: string | null } | null)?.slug ?? '').trim()
        if (slug && (linkRows ?? []).length > 0) portalUrl = `${PORTAL_SHORT_ORIGIN}${slug}`
      }
    } catch (e) {
      console.warn('portal lookup skipped', e)
    }

    const mail = buildContractSigningEmail({
      documentName: doc.document_name,
      personName: doc.person_name,
      acceptUrl,
      expiresYmd: todayYmdInAppTz(new Date(expiresAt)),
      sentYmd: todayYmdInAppTz(),
      subjectOverride: clampContractEmailSubject(body.email_subject),
      introPlain: clampContractEmailIntro(body.email_intro_plain),
      sender,
      portalUrl,
      officePhone: PORTAL_COMPANY.phone || null,
    })
    const subject = mail.subject
    const textPlain = mail.text
    const htmlBody = mail.html
    // From keeps EMAIL_FROM's verified address; only the display name becomes the company the
    // sub knows (they never met "ClickTooling").
    const fromMailbox = mailboxWithName(mail.fromName, EMAIL_FROM)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          ok: true,
          emailed: false,
          accept_url: acceptUrl,
          warning: 'RESEND_API_KEY not set; link not emailed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const sent = await sendEmailViaResend(signerEmail.trim(), subject, textPlain, htmlBody, resendApiKey, fromMailbox, mail.replyTo)
    // Sent copies (docs/SENT_COPIES.md): the email asking them to sign is kept, under the person.
    if (sent.success) {
      const [filing, copy] = personSigningSentCopy({
        doc,
        personId: sentCopyPersonId,
        sentBy: user.id,
        signerEmail,
        from: fromMailbox,
        subject,
        html: htmlBody,
        resendEmailId: sent.resendEmailId ?? null,
      })
      await fileSentEmailBestEffort(filing, copy)
    }
    if (!sent.success) {
      return new Response(
        JSON.stringify({
          ok: true,
          emailed: false,
          accept_url: acceptUrl,
          email_error: sent.error,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ ok: true, emailed: true, accept_url: acceptUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
