import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { askProblem } from '../_shared/stageAsk.ts'
import { gcPortalStages, loadGcStageInputs } from '../_shared/gcStages.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { resolvePortalCustomerPhone } from '../_shared/portalCustomerPhone.ts'
import { owedJobIdsForViewer, PORTAL_OPEN_INVOICE_STATUS } from '../_shared/portalBillMembership.ts'
import { PROMISE_MAX_PER_HOUR, promiseDateProblem } from '../_shared/portalPromise.ts'

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

/**
 * Push fan-out for a freshly inserted request. Best-effort: the row is already
 * in the inbox. Carries the service key so the notify function treats this as
 * an internal caller (there is no customer session to speak of).
 */
async function notifyInbox(inbox: 'dispatch' | 'estimator', requestId: string): Promise<void> {
  const fn = inbox === 'estimator' ? 'notify-estimator-request' : 'notify-dispatch-request'
  const body = inbox === 'estimator' ? { estimator_request_id: requestId } : { dispatch_request_id: requestId }
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')!}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    console.error(`${fn} call failed`, e)
  }
}

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
    const kind =
      body.kind === 'bid' ? 'bid'
      : body.kind === 'visit' ? 'visit'
      : body.kind === 'stage_window' ? 'stage_window'
      : body.kind === 'payment_promise' ? 'payment_promise'
      : null
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const availability = typeof body.availability === 'string' ? body.availability.trim().slice(0, 300) : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim().slice(0, 40) : ''
    const plansLink = typeof body.plansLink === 'string' ? body.plansLink.trim().slice(0, 500) : ''
    const jobId = typeof body.jobId === 'string' && /^[0-9a-f-]{36}$/.test(body.jobId) ? body.jobId : null

    if (!token || token.length < 16 || token.length > 128 || !kind) {
      return jsonResponse({ error: 'Bad request' }, 400)
    }
    if (kind !== 'stage_window' && kind !== 'payment_promise' && (description.length < 5 || description.length > 2000)) {
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

    // ── payment_promise (Their Word PR 2): the customer names their own pay-by date ──
    // One promise event per open-bill job the link can see, source 'customer';
    // the office's chips flip to "✓ Promised … · customer". No inbox row — the
    // Billed row is where the office reads it. Its own rate limit (promises
    // per customer per hour) since nothing lands in dispatch_requests.
    if (kind === 'payment_promise') {
      const date = typeof body.date === 'string' ? body.date.trim() : ''
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
      const todayYmd = todayYmdInAppTz()
      const problem = promiseDateProblem(date, todayYmd)
      if (problem) return jsonResponse({ error: problem }, 400)

      const hourAgoIso = new Date(Date.now() - 3600_000).toISOString()
      const { count: recentPromises } = await admin
        .from('job_payment_promises')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', link.customer_id)
        .eq('source', 'customer')
        .gte('created_at', hourAgoIso)
      if ((recentPromises ?? 0) >= PROMISE_MAX_PER_HOUR) {
        return jsonResponse({ error: 'We have your date — thank you. If it changes again, please call our office.' }, 429)
      }

      // The same job scope the statement shows (customer-portal's rule).
      // Who pays (v2.3346): a promise covers the jobs this viewer actually owes
      // on — the job rule + each open bill's pick, the same test the statement uses.
      const jobSelect = 'id, status, customer_id, gc_customer_id, bill_to_party'
      type ScopeJob = { id: string; status: string | null; customer_id: string | null; gc_customer_id: string | null; bill_to_party: string | null }
      let jobs: ScopeJob[] = []
      if (link.audience === 'all') {
        const { data } = await admin
          .from('jobs_ledger')
          .select(jobSelect)
          .or(`customer_id.eq.${link.customer_id},gc_customer_id.eq.${link.customer_id}`)
          .limit(500)
        jobs = (data ?? []) as ScopeJob[]
      } else {
        const col = link.audience === 'gc' ? 'gc_customer_id' : 'customer_id'
        const { data } = await admin.from('jobs_ledger').select(jobSelect).eq(col, link.customer_id).limit(500)
        jobs = (data ?? []) as ScopeJob[]
      }
      const { data: scopeInvRaw } = jobs.length
        ? await admin
            .from('jobs_ledger_invoices')
            .select('job_id, bill_to_party, bill_to_email')
            .in('job_id', jobs.map((j) => j.id))
            .eq('status', PORTAL_OPEN_INVOICE_STATUS)
        : { data: [] }
      const promiseJobIds = owedJobIdsForViewer(jobs, (scopeInvRaw ?? []) as Array<{ job_id: string; bill_to_party: string | null; bill_to_email: string | null }>, link.customer_id)
      if (promiseJobIds.length === 0) {
        return jsonResponse({ error: 'Nothing is open on your account right now — thank you!' }, 400)
      }

      const { data: result, error: rpcErr } = await admin.rpc('add_customer_payment_promise', {
        p_customer_id: link.customer_id,
        p_job_ids: promiseJobIds,
        p_date: date,
        p_note: note || null,
      })
      if (rpcErr) {
        console.error('add_customer_payment_promise failed', rpcErr)
        return jsonResponse({ error: 'We could not save that date. Please try again, or call our office.' }, 500)
      }
      const jobsPromised = (result as { jobs?: number } | null)?.jobs ?? promiseJobIds.length
      console.log(JSON.stringify({ event: 'portal_payment_promise', customer_id: link.customer_id, jobs: jobsPromised, date }))
      return jsonResponse({ ok: true, promisedYmd: date, jobs: jobsPromised })
    }

    // Rate limit per link.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString()
    // Both inboxes count (v2.3246): bid requests may land in estimator_requests.
    const recentIn = async (table: 'dispatch_requests' | 'estimator_requests') =>
      (await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('pending_payload->>portalLinkId', String(link.id))
        .gte('created_at', hourAgo)).count ?? 0
    const recent = (await recentIn('dispatch_requests')) + (await recentIn('estimator_requests'))
    if (recent >= MAX_PER_HOUR) {
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
    // ── stage_window (v2.2934): the GC asks for other dates on an offered stage ──
    if (kind === 'stage_window') {
      if (link.audience !== 'gc' && link.audience !== 'all') return jsonResponse({ error: 'Not found' }, 404)
      const stageId = typeof body.stageId === 'string' && /^[0-9a-f-]{36}$/.test(body.stageId) ? body.stageId : null
      const start = typeof body.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.start) ? body.start : null
      const end = typeof body.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.end) ? body.end : null
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : ''
      if (!stageId || !start || !end) return jsonResponse({ error: 'Pick both days.' }, 400)
      const todayYmd = todayYmdInAppTz()
      const problem = askProblem(start, end, todayYmd)
      if (problem) return jsonResponse({ error: problem }, 400)
      // The window by id, or every window in the bundle.
      const { data: winRaw } = await admin
        .from('job_stage_windows')
        .select('id, job_id, fixture_id, bundle_id, offered_to_gc, window_start, window_end, fixture:fixture_id(name), job:job_id(hcp_number, gc_customer_id, gc_shares_stage_dates)')
        .or(`id.eq.${stageId},bundle_id.eq.${stageId}`)
      const wins = (winRaw ?? []) as Array<{ id: string; job_id: string; bundle_id: string | null; offered_to_gc: boolean; fixture: { name: string | null } | { name: string | null }[] | null; job: { hcp_number: string | null; gc_customer_id: string | null; gc_shares_stage_dates: boolean } | { hcp_number: string | null; gc_customer_id: string | null; gc_shares_stage_dates: boolean }[] | null }>
      const jobOf = (w: (typeof wins)[number]) => (Array.isArray(w.job) ? w.job[0] ?? null : w.job)
      const mine = wins.filter((w) => jobOf(w)?.gc_customer_id === link.customer_id && jobOf(w)?.gc_shares_stage_dates === true)
      if (mine.length === 0) return jsonResponse({ error: 'Not found' }, 404)
      // Stage Plan PR 5: only the NEXT stage of the sequence can be asked about — the one the
      // portal card carries the link on. Same plan, same rule, server-side.
      {
        const inputs = await loadGcStageInputs(admin, [mine[0]!.job_id])
        const out = gcPortalStages({ ...inputs.byJob(mine[0]!.job_id), todayYmd })
        if (!out.askWindowId || !mine.some((w) => w.id === out.askWindowId)) {
          return jsonResponse({ error: 'Only the next stage can be moved. Call the office about the others.' }, 400)
        }
      }
      const nowIso = new Date().toISOString()
      const { error: askErr } = await admin
        .from('job_stage_windows')
        .update({ asked_start: start, asked_end: end, asked_note: note || null, asked_at: nowIso, answered_at: null, answer: null, answer_note: null })
        .in('id', mine.map((w) => w.id))
      if (askErr) {
        console.error('stage ask write failed', askErr)
        return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
      }
      const names = mine.map((w) => { const f = Array.isArray(w.fixture) ? w.fixture[0] ?? null : w.fixture; return (f?.name ?? '').trim() || 'a stage' }).join(' + ')
      const hcp = (jobOf(mine[0]!)?.hcp_number ?? '').trim()
      const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', 'portal_requests_from_user_id').maybeSingle()
      let fromUserId = ((setting as { value_text?: string | null } | null)?.value_text ?? '').trim() || (link.created_by ?? '')
      if (!fromUserId) {
        const { data: dev } = await admin.from('users').select('id').eq('role', 'dev').order('created_at').limit(1).maybeSingle()
        fromUserId = (dev as { id?: string } | null)?.id ?? ''
      }
      if (fromUserId) {
        const { data: cust } = await admin.from('customers').select('name').eq('id', link.customer_id).maybeSingle()
        const gcName = ((cust as { name?: string | null } | null)?.name ?? '').trim() || 'The GC'
        const { data: inserted } = await admin
          .from('dispatch_requests')
          .insert({
            from_user_id: fromUserId,
            title: `${gcName} asks for ${names} ${start} → ${end}${hcp ? ` on #${hcp}` : ''}${note ? `: ${note.slice(0, 120)}` : ''}`,
            links: [],
            job_ledger_id: mine[0]!.job_id,
            bid_id: null,
            reference_summary: hcp ? `#${hcp} · ${names}` : names,
            pending_action: 'gc_stage_ask',
            // A GC asking for other dates is a customer waiting on an answer (v2.3246).
            priority: 'high',
            pending_payload: { source: 'customer_portal', kind: 'gc_stage_ask', portalLinkId: link.id, audience: link.audience, customerId: link.customer_id, stageWindowIds: mine.map((w) => w.id), start, end, note: note || null, gcName, phone: await resolvePortalCustomerPhone(admin, link.customer_id), phoneSource: 'on_file' },
          })
          .select('id')
          .single()
        const id = (inserted as { id?: string } | null)?.id
        if (id) await notifyInbox('dispatch', id)
      }
      return jsonResponse({ ok: true })
    }

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

    // Customer Waiting (v2.3246): the number the office will call. The typed
    // number wins; otherwise the one on file (contact_info / newest job), so
    // the inbox's Call button never hangs on an optional field.
    const phoneOnFile = await resolvePortalCustomerPhone(admin, link.customer_id)
    const reachPhone = phone || phoneOnFile || null
    const phoneSource: 'typed' | 'on_file' | null = phone ? 'typed' : phoneOnFile ? 'on_file' : null

    const kindLabel = kind === 'visit' ? 'asks for a visit' : 'asks for a bid'
    const title = `Customer waiting — ${customerName} ${kindLabel}: ${description.slice(0, 120)}`
    const pendingPayload = {
      source: 'portal',
      portalLinkId: link.id,
      audience: link.audience,
      kind,
      customerId: link.customer_id,
      customerName,
      description,
      availability: availability || null,
      phone: reachPhone,
      phoneSource,
      plansLink: plansLink || null,
    }

    // Route by kind (v2.3246): a visit is Dispatch's job; a bid is the
    // estimator's — it goes to the Estimator inbox when that group has anyone
    // in it, and falls back to Dispatch (never vanishes) when it is empty.
    let inbox: 'dispatch' | 'estimator' = 'dispatch'
    if (kind === 'bid') {
      const { count: estimators } = await admin
        .from('estimator_group_members')
        .select('user_id', { count: 'exact', head: true })
      if ((estimators ?? 0) > 0) inbox = 'estimator'
    }

    const { data: inserted, error: insErr } = await admin
      .from(inbox === 'estimator' ? 'estimator_requests' : 'dispatch_requests')
      .insert({
        from_user_id: fromUserId,
        title,
        job_ledger_id: jobLedgerId,
        priority: 'high',
        pending_payload: pendingPayload,
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      console.error('submit-portal-request insert failed', insErr)
      return jsonResponse({ error: 'Something went wrong. Please call our office.' }, 500)
    }

    // Fire-and-forget the inbox's push fan-out. The notify functions accept
    // the service key as a trusted internal caller (v2.3246) — before that
    // this call carried no bearer and was refused with 401 every time.
    await notifyInbox(inbox, (inserted as { id: string }).id)

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
