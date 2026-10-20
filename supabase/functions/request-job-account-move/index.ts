/**
 * The move window's emailed ask (punch list #132 PR 3, v2.5677): the office asks a
 * supply house to move still-current charges onto their jobs' job accounts. One call
 * covers one house — one email to the house's job-accounts rep listing the charges by
 * job — and writes one `supply_house_invoice_move_requests` row per charge, which the
 * aging screen shows as *asked · follow up* until someone attests the house moved it.
 *
 * Body: `{ invoice_ids: string[], include_asked?: boolean, test?: boolean }` (1–20 ids, one
 * house). `test` composes the same email but sends it to the SENDER with [TEST] on the
 * subject and records no ask — the safe end-to-end check.
 * "Do what is ready" (CLAUDE.md): a charge that is paid, a credit, already flagged,
 * past due (the window is the Current bucket), split across jobs, job-less, or already
 * asked (unless `include_asked`) is HELD with its reason; the ready ones send.
 *
 * From COMPANY_EMAIL_FROM with the sender as Reply to; the send is filed as a sent
 * copy (`job_account_move_request`) and logged on email_send_log. Auth: user JWT
 * verified in-handler (config.toml sets verify_jwt = false); office roles only.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { COMPANY_EMAIL_FROM } from '../_shared/emailFrom.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { buildJobAccountMoveEmail } from '../_shared/jobAccountMoveEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
const MAX_INVOICES = 20

type HeldReason = 'paid' | 'credit' | 'already_on_account' | 'past_due' | 'no_due_date' | 'not_one_job' | 'already_asked'
type InvoiceRow = {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string | null
  amount: number
  is_paid: boolean
  on_job_account: boolean
  purchase_order_number: string | null
  supply_house_id: string
}

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const mdY = (ymd: string) => {
  const [y, m, d] = ymd.split('-')
  return `${Number(m)}/${Number(d)}/${y}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!supabaseUrl || !anonKey || !serviceRole) return json({ error: 'Supabase env not configured' }, 500)
    if (!resendApiKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Unauthorized' }, 401)
    const jwtClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await jwtClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceRole)
    const { data: meRow } = await admin.from('users').select('id, name, email, role, archived_at, read_only').eq('id', user.id).match(REAL_ACCOUNT).maybeSingle()
    const me = meRow as { id: string; name: string | null; email: string | null; role: string | null; archived_at: string | null; read_only: boolean | null } | null
    if (!me || me.archived_at || !OFFICE_ROLES.has(String(me.role))) return json({ error: 'Only the office can ask for a job-account move.' }, 403)
    if (me.read_only) return json({ error: 'A training account cannot send email.' }, 403)

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }
    const ids = Array.isArray(body.invoice_ids)
      ? [...new Set(body.invoice_ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0))]
      : []
    if (ids.length === 0) return json({ error: 'Pick at least one invoice.' }, 400)
    if (ids.length > MAX_INVOICES) return json({ error: `One ask covers ${MAX_INVOICES} invoices at most.` }, 400)
    const includeAsked = body.include_asked === true
    const isTest = body.test === true

    const { data: invData, error: invErr } = await admin
      .from('supply_house_invoices')
      .select('id, invoice_number, invoice_date, due_date, amount, is_paid, on_job_account, purchase_order_number, supply_house_id')
      .in('id', ids)
    if (invErr) return json({ error: invErr.message }, 500)
    const invoices = (invData ?? []) as InvoiceRow[]
    if (invoices.length !== ids.length) return json({ error: 'An invoice on the list no longer exists.' }, 400)
    const houseIds = [...new Set(invoices.map((i) => i.supply_house_id))]
    if (houseIds.length !== 1) return json({ error: 'One ask covers one supply house.' }, 400)
    const houseId = houseIds[0]!

    const [houseRes, repRes, allocRes, askRes] = await Promise.all([
      admin.from('supply_houses').select('id, name').eq('id', houseId).maybeSingle(),
      admin.from('supply_house_contacts').select('id, name, email').eq('supply_house_id', houseId).eq('role', 'job_accounts').is('archived_at', null),
      admin.from('supply_house_invoice_job_allocations').select('invoice_id, job_id, pct').in('invoice_id', ids),
      admin.from('supply_house_invoice_move_requests').select('id, invoice_id').in('invoice_id', ids).is('confirmed_at', null),
    ])
    const house = houseRes.data as { id: string; name: string } | null
    if (!house) return json({ error: 'The supply house no longer exists.' }, 400)
    const rep = ((repRes.data ?? []) as Array<{ id: string; name: string | null; email: string | null }>).find(
      (r) => typeof r.email === 'string' && r.email.includes('@'),
    )
    if (!rep) return json({ error: `No job-accounts rep with an email on file for ${house.name} — add one on the house, or call instead.` }, 400)
    const allocationsByInvoice = new Map<string, Array<{ job_id: string; pct: number }>>()
    for (const a of (allocRes.data ?? []) as Array<{ invoice_id: string; job_id: string; pct: number }>) {
      const list = allocationsByInvoice.get(a.invoice_id) ?? []
      list.push({ job_id: a.job_id, pct: Number(a.pct) })
      allocationsByInvoice.set(a.invoice_id, list)
    }
    const openAsks = new Map(((askRes.data ?? []) as Array<{ id: string; invoice_id: string }>).map((r) => [r.invoice_id, r.id]))

    // "Do what is ready": sort each invoice into ready or held-with-reason.
    const today = todayYmdInAppTz()
    const held: Array<{ invoice_id: string; invoice_number: string; reason: HeldReason }> = []
    const ready: Array<InvoiceRow & { jobId: string }> = []
    for (const inv of invoices) {
      const allocations = allocationsByInvoice.get(inv.id) ?? []
      const reason: HeldReason | null = inv.is_paid
        ? 'paid'
        : Number(inv.amount) < 0
          ? 'credit'
          : inv.on_job_account
            ? 'already_on_account'
            : !inv.due_date
              ? 'no_due_date'
              : inv.due_date < today
                ? 'past_due'
                : allocations.length !== 1
                  ? 'not_one_job'
                  : openAsks.has(inv.id) && !includeAsked
                    ? 'already_asked'
                    : null
      if (reason) held.push({ invoice_id: inv.id, invoice_number: inv.invoice_number, reason })
      else ready.push({ ...inv, jobId: allocations[0]!.job_id })
    }
    if (ready.length === 0) return json({ error: 'Nothing on the list is still movable.', held }, 400)

    const jobIds = [...new Set(ready.map((r) => r.jobId))]
    const [jobsRes, acctRes] = await Promise.all([
      admin.from('jobs_ledger').select('id, hcp_number, click_number, job_name').in('id', jobIds),
      admin.from('job_supply_house_accounts').select('job_id, status, account_ref').eq('supply_house_id', houseId).in('job_id', jobIds),
    ])
    const jobs = new Map(((jobsRes.data ?? []) as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }>).map((j) => [j.id, j]))
    const accounts = new Map(((acctRes.data ?? []) as Array<{ job_id: string; status: string; account_ref: string }>).map((a) => [a.job_id, a]))

    // One email, the charges grouped by job — the body lives in _shared/jobAccountMoveEmail.ts
    // so Settings → What customers see renders exactly what this sends (the v2.3512 rule).
    const jobLabel = (jobId: string) => {
      const j = jobs.get(jobId)
      const num = (j?.hcp_number ?? '').trim() || (j?.click_number ?? '').trim() || '—'
      return `${num} · ${(j?.job_name ?? '').trim() || '—'}`
    }
    const { subject, text, html } = buildJobAccountMoveEmail({
      repName: rep.name,
      senderName: (me.name ?? '').trim() || 'The office',
      companyName: PORTAL_COMPANY.name,
      jobs: jobIds.map((jobId) => {
        const acct = accounts.get(jobId)
        return {
          label: jobLabel(jobId),
          accountOpen: acct?.status === 'open',
          accountRef: acct?.status === 'open' ? acct.account_ref || null : null,
          charges: ready
            .filter((r) => r.jobId === jobId)
            .map((r) => ({ number: r.invoice_number, dateMdY: mdY(r.invoice_date), money: money(Number(r.amount)), po: r.purchase_order_number })),
        }
      }),
    })

    const replyTo = typeof me.email === 'string' && me.email.includes('@') ? me.email.trim() : undefined
    if (isTest) {
      if (!replyTo) return json({ error: 'Your account has no email on file for the test send.' }, 400)
      const testSent = await sendEmailViaResend(replyTo, `[TEST] ${subject}`, text, html, resendApiKey, {
        replyTo,
        emailType: 'job_account_move_request',
      })
      if (!testSent.success) return json({ error: testSent.error ?? 'The email did not send.' }, 502)
      return json({ test: true, sent_to: replyTo, would_send_to: `${rep.name?.trim() ? `${rep.name.trim()} · ` : ''}${rep.email!.trim()}`, would_ask: ready.map((r) => r.id), held })
    }
    const sent = await sendEmailViaResend(rep.email!.trim(), subject, text, html, resendApiKey, {
      from: COMPANY_EMAIL_FROM,
      replyTo,
      emailType: 'job_account_move_request',
      file: { kind: 'job_account_move_request', title: subject, recipientName: `${house.name}${rep.name?.trim() ? ` — ${rep.name.trim()}` : ''}`, jobIds, sentBy: me.id },
    })
    if (!sent.success) return json({ error: sent.error ?? 'The email did not send.' }, 502)

    // The record: one open ask per invoice. A re-send refreshes the open ask's stamp.
    const askedIds: string[] = []
    for (const r of ready) {
      const openId = openAsks.get(r.id)
      if (openId) {
        await admin.from('supply_house_invoice_move_requests').update({ requested_at: new Date().toISOString(), sent_to: rep.email!.trim(), via: 'email' }).eq('id', openId)
      } else {
        const { error: insErr } = await admin.from('supply_house_invoice_move_requests').insert({
          invoice_id: r.id,
          job_id: r.jobId,
          supply_house_id: houseId,
          via: 'email',
          sent_to: rep.email!.trim(),
          requested_by: me.id,
        })
        if (insErr) console.error('move request insert failed', r.id, insErr.message)
      }
      askedIds.push(r.id)
    }

    return json({ sent_to: `${rep.name?.trim() ? `${rep.name.trim()} · ` : ''}${rep.email!.trim()}`, asked: askedIds, held })
  } catch (e) {
    console.error('request-job-account-move', e)
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
