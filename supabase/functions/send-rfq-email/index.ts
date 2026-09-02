/**
 * RFQ Desk sender (lane B, v2.2636 — docs/SUPPLY_HOUSE_RFQ_PLAN.md). One
 * authed endpoint, three modes:
 *   send   — mint one bid_rfqs row + token + email PER house (the blast is
 *            N independent requests), scope snapshot {lines, text} stored.
 *   remind — one-tap nudge; server-enforced 24h throttle; the opening line
 *            varies by whether the vendor ever opened the page.
 *   resend — bounce fix: new address on the same request, same token.
 * Emails go from the app address with reply_to = the sender, carry the
 * grouped Division 22 list (names + counts, never prices) and the
 * /q/<token> button. Resend message ids land on the rfq so the existing
 * resend-webhook → email_send_log rail reports delivered/bounced.
 * Auth: caller JWT + Pricing-staff role (send-bid-pricing-package pattern).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])
const REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000
const MAX_HOUSES_PER_BLAST = 10
const APP_ORIGIN = 'https://clicktooling.com'

type ScopeLine = { fixture: string; count: number; unit?: string | null }

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtDate(d: string | null): string {
  if (!d) return ''
  const dt = new Date(`${d}T12:00:00Z`)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
}

function buildEmail(args: {
  kind: 'request' | 'reminder'
  viewed: boolean
  bidLabel: string
  houseName: string
  itemCount: number
  neededBy: string | null
  vendorNote: string | null
  senderName: string | null
  listText: string
  token: string
  plansLink?: string | null
}): { subject: string; text: string; html: string } {
  const link = `${APP_ORIGIN}/q/${args.token}`
  const due = args.neededBy ? ` · needed by ${fmtDate(args.neededBy)}` : ''
  const subject =
    args.kind === 'reminder'
      ? `Reminder — price request · ${args.bidLabel} · ${args.itemCount} items${due}`
      : `Price request · ${args.bidLabel} · ${args.itemCount} items${due}`
  const opener =
    args.kind === 'reminder'
      ? args.viewed
        ? 'Looks like you started on this one — just checking in before we order.'
        : 'Following up in case the first note got buried — did this reach you?'
      : 'Can you price these for us?'
  const noteLine = args.vendorNote?.trim() ? `From ${args.senderName ?? 'the estimator'}: “${args.vendorNote.trim()}”` : ''
  const text = [
    opener,
    '',
    `${args.bidLabel} · ${args.itemCount} items${due}.`,
    noteLine,
    '',
    `Price it here (takes minutes on a phone): ${link}`,
    ...(args.plansLink ? ['', `Job plans (cut sheets, details): ${args.plansLink}`] : []),
    '',
    'Or just reply to this email with your prices — either way works.',
    '',
    args.listText,
    '',
    `Sent by ClickTooling. This link is only for ${args.houseName} and stops working when the job closes.`,
  ]
    .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
    .join('\n')
  const html = `
<div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;color:#1c2434;line-height:1.6">
  <h2 style="font-size:18px;margin:18px 0 4px">${escapeHtml(opener)}</h2>
  <p style="color:#5b6577;font-size:14px;margin:0 0 14px">${escapeHtml(args.bidLabel)} · ${args.itemCount} items${escapeHtml(due)}.${noteLine ? ` ${escapeHtml(noteLine)}` : ''}</p>
  <p style="margin:18px 0 6px"><a href="${link}" style="background:#16a34a;color:#ffffff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block">Price it here — takes minutes on your phone</a></p>
  ${args.plansLink ? `<p style="margin:0 0 12px;font-size:14px"><a href="${args.plansLink}" style="color:#2563eb">Job plans (cut sheets, details) ↗</a></p>` : ''}
  <pre style="background:#eef1f6;border:1px solid #e0e5ee;border-radius:8px;padding:12px 14px;font:12px/1.6 ui-monospace,Menlo,monospace;color:#2a3550;white-space:pre-wrap">${escapeHtml(args.listText)}</pre>
  <p style="font-size:14px">Or just hit <b>Reply</b> with your prices — either way works.</p>
  <p style="color:#8b96ab;font-size:12px;margin-top:18px">Sent by ClickTooling. This link is only for ${escapeHtml(args.houseName)} and stops working when the job closes.</p>
</div>`
  return { subject, text, html }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json({ error: 'Email sending is not configured (RESEND_API_KEY).' }, 500)
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const authHeader = req.headers.get('authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Not signed in' }, 401)
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData, error: authErr } = await userClient.auth.getUser(jwt)
    if (authErr || !userData?.user) return json({ error: 'Not signed in' }, 401)
    const { data: sender } = await admin
      .from('users')
      .select('id, name, email, role, archived_at')
      .eq('id', userData.user.id)
      .maybeSingle()
    if (!sender || sender.archived_at || !ALLOWED_ROLES.has((sender.role as string) ?? '')) {
      return json({ error: 'Your role can’t send price requests.' }, 403)
    }
    const replyTo = (sender.email as string | null) ?? undefined

    const body = (await req.json().catch(() => null)) as
      | {
          mode?: 'send' | 'remind' | 'resend' | 'preview'
          bidId?: string
          bidVersionId?: string | null
          neededBy?: string | null
          vendorNote?: string | null
          plansLink?: string | null
          scope?: { lines?: ScopeLine[]; text?: string; plansLink?: string | null }
          requests?: Array<{ supplyHouseId?: string; email?: string }>
          rfqId?: string
          email?: string
        }
      | null
    if (!body?.mode) return json({ error: 'Missing mode' }, 400)

    const cleanPlansLink = (v: unknown): string | null =>
      typeof v === 'string' && /^https?:\/\//i.test(v.trim()) && v.trim().length <= 500 ? v.trim() : null

    const bidLabelFor = async (bidId: string): Promise<string> => {
      const { data: bid } = await admin.from('bids').select('bid_number, project_name').eq('id', bidId).maybeSingle()
      return [bid?.bid_number, bid?.project_name].filter(Boolean).join(' · ') || 'a job'
    }

    // Preview: the exact email a send would produce — same builder, no writes,
    // nothing sent. For a compose preview the token doesn't exist yet, so the
    // link renders as a placeholder; each house's real link is minted at send.
    if (body.mode === 'preview') {
      if (body.rfqId) {
        const { data: rfq } = await admin
          .from('bid_rfqs')
          .select('bid_id, token, sent_to, needed_by, vendor_note, viewed_at, scope')
          .eq('id', body.rfqId)
          .maybeSingle()
        if (!rfq) return json({ error: 'Request not found' }, 404)
        const scope = (rfq.scope ?? {}) as { lines?: ScopeLine[]; text?: string }
        const mail = buildEmail({
          kind: 'reminder',
          viewed: rfq.viewed_at != null,
          bidLabel: await bidLabelFor(rfq.bid_id),
          houseName: rfq.sent_to ?? 'your team',
          itemCount: Array.isArray(scope.lines) ? scope.lines.length : 0,
          neededBy: rfq.needed_by,
          vendorNote: rfq.vendor_note,
          senderName: (sender.name as string | null) ?? null,
          listText: scope.text ?? '',
          token: rfq.token as string,
          plansLink: cleanPlansLink(scope.plansLink),
        })
        return json({ ok: true, previews: [{ supplyHouseId: null, subject: mail.subject, text: mail.text, html: mail.html }] })
      }
      const bidId = body.bidId
      const lines = (body.scope?.lines ?? []).filter((l) => l && typeof l.fixture === 'string')
      const listText = typeof body.scope?.text === 'string' ? body.scope.text.slice(0, 20_000) : ''
      const requests = (body.requests ?? []).slice(0, MAX_HOUSES_PER_BLAST)
      if (!bidId || !listText || requests.length === 0) return json({ error: 'Nothing to preview' }, 400)
      const bidLabel = await bidLabelFor(bidId)
      const neededBy = typeof body.neededBy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.neededBy) ? body.neededBy : null
      const vendorNote = typeof body.vendorNote === 'string' ? body.vendorNote.trim().slice(0, 300) || null : null
      const previews = []
      for (const r of requests) {
        if (!r.supplyHouseId) continue
        const { data: house } = await admin.from('supply_houses').select('name').eq('id', r.supplyHouseId).maybeSingle()
        const mail = buildEmail({
          kind: 'request',
          viewed: false,
          bidLabel,
          houseName: house?.name ?? 'your team',
          itemCount: lines.length,
          neededBy,
          vendorNote,
          senderName: (sender.name as string | null) ?? null,
          listText,
          token: 'their-own-link-minted-at-send',
          plansLink: cleanPlansLink(body.plansLink),
        })
        previews.push({ supplyHouseId: r.supplyHouseId, houseName: house?.name ?? '—', email: r.email ?? '', subject: mail.subject, text: mail.text, html: mail.html })
      }
      return json({ ok: true, previews, replyTo: replyTo ?? null })
    }

    if (body.mode === 'send') {
      const bidId = body.bidId
      const lines = (body.scope?.lines ?? []).filter((l) => l && typeof l.fixture === 'string' && l.fixture.trim())
      const listText = typeof body.scope?.text === 'string' ? body.scope.text.slice(0, 20_000) : ''
      const requests = (body.requests ?? []).slice(0, MAX_HOUSES_PER_BLAST)
      if (!bidId || lines.length === 0 || !listText || requests.length === 0) {
        return json({ error: 'Missing bid, scope, or recipients' }, 400)
      }
      const neededBy = typeof body.neededBy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.neededBy) ? body.neededBy : null
      const vendorNote = typeof body.vendorNote === 'string' ? body.vendorNote.trim().slice(0, 300) || null : null
      const plansLink = cleanPlansLink(body.plansLink)
      const bidLabel = await bidLabelFor(bidId)

      const results: Array<{ supplyHouseId: string; ok: boolean; error?: string }> = []
      for (const r of requests) {
        const email = (r.email ?? '').trim()
        if (!r.supplyHouseId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          results.push({ supplyHouseId: r.supplyHouseId ?? '?', ok: false, error: 'bad email' })
          continue
        }
        const { data: house } = await admin.from('supply_houses').select('name').eq('id', r.supplyHouseId).maybeSingle()
        const token = crypto.randomUUID().replace(/-/g, '')
        const { data: rfq, error: insErr } = await admin
          .from('bid_rfqs')
          .insert({
            bid_id: bidId,
            bid_version_id: body.bidVersionId ?? null,
            supply_house_id: r.supplyHouseId,
            sent_to: house?.name ?? null,
            sent_email: email,
            scope: { lines, text: listText, plansLink },
            needed_by: neededBy,
            vendor_note: vendorNote,
            token,
            status: 'sent',
            created_by: sender.id,
          })
          .select('id')
          .single()
        if (insErr || !rfq) {
          results.push({ supplyHouseId: r.supplyHouseId, ok: false, error: insErr?.message ?? 'insert failed' })
          continue
        }
        const mail = buildEmail({
          kind: 'request',
          viewed: false,
          bidLabel,
          houseName: house?.name ?? 'your team',
          itemCount: lines.length,
          neededBy,
          vendorNote,
          senderName: (sender.name as string | null) ?? null,
          listText,
          token,
          plansLink,
        })
        const sent = await sendEmailViaResend(email, mail.subject, mail.text, mail.html, resendApiKey, { replyTo })
        if (sent.success) {
          await admin.from('bid_rfqs').update({ resend_email_id: sent.resendEmailId ?? null }).eq('id', rfq.id)
          results.push({ supplyHouseId: r.supplyHouseId, ok: true })
        } else {
          results.push({ supplyHouseId: r.supplyHouseId, ok: false, error: sent.error })
        }
      }
      return json({ ok: results.some((r) => r.ok), results })
    }

    // remind + resend act on one existing request.
    const { data: rfq } = await admin
      .from('bid_rfqs')
      .select('id, bid_id, token, status, sent_email, sent_to, needed_by, vendor_note, viewed_at, scope, created_at, last_reminded_at, reminder_count')
      .eq('id', body.rfqId ?? '')
      .maybeSingle()
    if (!rfq) return json({ error: 'Request not found' }, 404)
    if (rfq.status === 'closed') return json({ error: 'This request is closed.' }, 400)
    const scope = (rfq.scope ?? {}) as { lines?: ScopeLine[]; text?: string }
    const listText = scope.text ?? ''
    const itemCount = Array.isArray(scope.lines) ? scope.lines.length : 0
    const bidLabel = await bidLabelFor(rfq.bid_id)

    if (body.mode === 'remind') {
      const lastSend = rfq.last_reminded_at ?? rfq.created_at
      if (lastSend && Date.now() - new Date(lastSend).getTime() < REMIND_COOLDOWN_MS) {
        return json({ error: 'Already nudged in the last 24 hours — give them a beat.' }, 429)
      }
      if (!rfq.sent_email) return json({ error: 'This request has no email — copy the link instead.' }, 400)
      const mail = buildEmail({
        kind: 'reminder',
        viewed: rfq.viewed_at != null,
        bidLabel,
        houseName: rfq.sent_to ?? 'your team',
        itemCount,
        neededBy: rfq.needed_by,
        vendorNote: rfq.vendor_note,
        senderName: (sender.name as string | null) ?? null,
        listText,
        token: rfq.token as string,
        plansLink: cleanPlansLink(scope.plansLink),
      })
      const sent = await sendEmailViaResend(rfq.sent_email, mail.subject, mail.text, mail.html, resendApiKey, { replyTo })
      if (!sent.success) return json({ error: sent.error ?? 'Send failed' }, 502)
      await admin
        .from('bid_rfqs')
        .update({
          resend_email_id: sent.resendEmailId ?? null,
          last_reminded_at: new Date().toISOString(),
          reminder_count: ((rfq.reminder_count as number) ?? 0) + 1,
        })
        .eq('id', rfq.id)
      return json({ ok: true })
    }

    if (body.mode === 'resend') {
      const email = (body.email ?? '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'That email doesn’t look right.' }, 400)
      const mail = buildEmail({
        kind: 'request',
        viewed: false,
        bidLabel,
        houseName: rfq.sent_to ?? 'your team',
        itemCount,
        neededBy: rfq.needed_by,
        vendorNote: rfq.vendor_note,
        senderName: (sender.name as string | null) ?? null,
        listText,
        token: rfq.token as string,
        plansLink: cleanPlansLink(scope.plansLink),
      })
      const sent = await sendEmailViaResend(email, mail.subject, mail.text, mail.html, resendApiKey, { replyTo })
      if (!sent.success) return json({ error: sent.error ?? 'Send failed' }, 502)
      await admin.from('bid_rfqs').update({ sent_email: email, resend_email_id: sent.resendEmailId ?? null }).eq('id', rfq.id)
      return json({ ok: true })
    }

    return json({ error: 'Unknown mode' }, 400)
  } catch (err) {
    console.error('send-rfq-email failed', err)
    return json({ error: 'Something went wrong' }, 500)
  }
})
