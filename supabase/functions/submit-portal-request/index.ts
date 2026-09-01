import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'

/**
 * Portal request intake (portal train PR 2): a customer/GC submits a
 * "request a visit" or "ask us to bid" form from the no-login portal page.
 * Validates + rate-limits per portal link, writes a dispatch_requests row
 * (details in pending_payload, job linked when picked), then triggers the
 * existing notify-dispatch-request fan-out.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const MAX_PER_HOUR = 5

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return jsonResponse({ error: 'Bad request' }, 400)

    // Honeypot: real customers never fill a field their browser hides.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return jsonResponse({ ok: true })
    }

    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const kind = body.kind === 'bid' ? 'bid' : body.kind === 'visit' ? 'visit' : null
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const availability = typeof body.availability === 'string' ? body.availability.trim().slice(0, 300) : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
    const plansLink = typeof body.plansLink === 'string' ? body.plansLink.trim().slice(0, 500) : ''
    const jobId = typeof body.jobId === 'string' && /^[0-9a-f-]{36}$/.test(body.jobId) ? body.jobId : null

    if (!token || token.length < 16 || token.length > 128 || !kind) {
      return jsonResponse({ error: 'Bad request' }, 400)
    }
    if (description.length < 5 || description.length > 2000) {
      return jsonResponse({ error: 'Please tell us a little more about what you need (a sentence or two).' }, 400)
    }
    if (plansLink && !/^https:\/\//.test(plansLink)) {
      return jsonResponse({ error: 'The plans link must start with https://' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    let { data: link } = await admin
      .from('customer_portal_links')
      .select('id, customer_id, audience, created_by, revoked_at')
      .eq('token', token)
      .maybeSingle()
    if (!link) {
      const tokenHash = await sha256Hex(token)
      link = (await admin
        .from('customer_portal_links')
        .select('id, customer_id, audience, created_by, revoked_at')
        .eq('token_hash', tokenHash)
        .maybeSingle()).data
    }
    if (!link || link.revoked_at) {
      return jsonResponse({ error: 'This link is no longer active. Please contact our office.' }, 404)
    }

    // Rate limit per link.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString()
    const { count: recent } = await admin
      .from('dispatch_requests')
      .select('id', { count: 'exact', head: true })
      .eq('pending_payload->>portalLinkId', String(link.id))
      .gte('created_at', hourAgo)
    if ((recent ?? 0) >= MAX_PER_HOUR) {
      return jsonResponse({ error: 'That is a lot of requests at once — please give us an hour, or call the office.' }, 429)
    }

    const { data: customer } = await admin.from('customers').select('name').eq('id', link.customer_id).maybeSingle()
    const customerName = ((customer as { name?: string | null } | null)?.name ?? 'Customer').trim() || 'Customer'

    // Job must belong to this link's audience scope when provided.
    let jobLedgerId: string | null = null
    if (jobId) {
      const col = link.audience === 'gc' ? 'gc_customer_id' : 'customer_id'
      const { data: job } = await admin.from('jobs_ledger').select('id').eq('id', jobId).eq(col, link.customer_id).maybeSingle()
      jobLedgerId = job ? jobId : null
    }

    // Attribution: configured portal inbox user, else whoever minted the link,
    // else the first dev (dispatch_requests.from_user_id is NOT NULL).
    let fromUserId: string | null = null
    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', 'portal_requests_from_user_id').maybeSingle()
    const configured = ((setting as { value_text?: string | null } | null)?.value_text ?? '').trim()
    if (/^[0-9a-f-]{36}$/.test(configured)) fromUserId = configured
    if (!fromUserId && link.created_by) fromUserId = link.created_by
    if (!fromUserId) {
      const { data: dev } = await admin.from('users').select('id').eq('role', 'dev').limit(1).maybeSingle()
      fromUserId = (dev as { id?: string } | null)?.id ?? null
    }
    if (!fromUserId) return jsonResponse({ error: 'Something went wrong. Please call our office.' }, 500)

    const kindLabel = kind === 'visit' ? 'visit request' : 'bid request'
    const title = `Portal ${kindLabel} — ${customerName}: ${description.slice(0, 120)}`

    const { data: inserted, error: insErr } = await admin
      .from('dispatch_requests')
      .insert({
        from_user_id: fromUserId,
        title,
        job_ledger_id: jobLedgerId,
        pending_payload: {
          source: 'portal',
          portalLinkId: link.id,
          audience: link.audience,
          kind,
          customerName,
          description,
          availability: availability || null,
          phone: phone || null,
          plansLink: plansLink || null,
        },
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      console.error('submit-portal-request insert failed', insErr)
      return jsonResponse({ error: 'Something went wrong. Please call our office.' }, 500)
    }

    // Fire-and-forget the existing dispatch fan-out (push to watchers).
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/notify-dispatch-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dispatch_request_id: (inserted as { id: string }).id }),
      })
    } catch (e) {
      console.error('notify-dispatch-request call failed', e)
    }

    // Email the configured "Portal requests" stream (portal train PR 3):
    // app_settings.portal_request_email_recipients_v1 = JSON array of user
    // ids (the paid-stream v1 format). Best-effort — the request is already
    // safely in the dispatch inbox.
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (resendApiKey) {
        const { data: recRow } = await admin
          .from('app_settings')
          .select('value_text')
          .eq('key', 'portal_request_email_recipients_v1')
          .maybeSingle()
        let recipientIds: string[] = []
        try {
          const parsed = JSON.parse(((recRow as { value_text?: string | null } | null)?.value_text ?? '[]'))
          if (Array.isArray(parsed)) recipientIds = parsed.filter((x): x is string => typeof x === 'string')
        } catch {
          recipientIds = []
        }
        if (recipientIds.length > 0) {
          const { data: usersRaw } = await admin.from('users').select('id, email').in('id', recipientIds)
          const emails = ((usersRaw ?? []) as Array<{ email: string | null }>)
            .map((u) => (u.email ?? '').trim())
            .filter((e) => e.includes('@'))
          const lines = [
            `${customerName} sent a ${kindLabel} from their portal.`,
            '',
            `What they wrote: ${description}`,
            availability ? `Best days & times: ${availability}` : null,
            phone ? `Phone: ${phone}` : null,
            plansLink ? `Plans: ${plansLink}` : null,
            jobLedgerId ? 'Linked to one of their jobs (see the dispatch item).' : null,
            '',
            'The request is in the dispatch inbox in ClickTooling.',
          ].filter((l): l is string => l != null)
          const subject = `Portal ${kindLabel} — ${customerName}`
          const html = `<p>${lines.map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('</p><p>')}</p>`
          for (const to of emails) {
            await sendEmailViaResend(to, subject, lines.join('\n'), html, resendApiKey)
          }
        }
      }
    } catch (e) {
      console.error('portal request email failed', e)
    }

    return jsonResponse({ ok: true })
  } catch (e) {
    console.error('submit-portal-request error', e)
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
