/**
 * share-job-contract (Signed agreement view PR B, v2.2712): the office
 * shares a signed agreement — the stored signed PDF, byte-identical to the
 * customer's copy — with anyone by email, or asks for a download URL. Works
 * for a signed job_contracts row OR a customer-accepted estimates row (the
 * PDF for an estimate is built once from the frozen option and cached in the
 * job-contract bucket). Staff JWT validated in-body; rows are read through
 * the caller's RLS. Every email logs a `shared` contract event (contracts)
 * and a `contract_shared` job-activity row (both), so "who got the copy?"
 * has an answer.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import { buildJobContractPdf, contractBodyToPlainText, type JobContractPdfInput, type PdfLibLike } from '../_shared/jobContractPdf.ts'
import { amountCentsFromFields, appOrigin, contractHeading, corsHeaders, escapeHtml, formatMoney, isValidEmail, JOB_CONTRACT_BUCKET, jobNumberLabel, json, signingUrl } from '../_shared/jobContract.ts'

type Body = {
  contract_id?: string
  estimate_id?: string
  /** For estimate-sourced shares: the job the agreement covers (bid-room proposals carry no job_ledger_id). */
  job_id?: string
  mode?: 'email' | 'pdf_url'
  to?: string[]
  note?: string
  public_origin?: string
}

type Issuer = { companyName: string; addressText: string; phone: string; email: string; tagline: string; licenseLine: string }
type JobLite = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; customer_name: string | null; master_user_id: string | null }

const stamp = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
const dateOnly = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }) : '')

function parseIssuer(raw: string | null | undefined): Issuer | null {
  try {
    const o = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
    if (!o || typeof o !== 'object') return null
    const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
    return { companyName: s('companyName'), addressText: s('addressText'), phone: s('phone'), email: s('email'), tagline: s('tagline'), licenseLine: s('licenseLine') }
  } catch {
    return null
  }
}

async function fetchBytes(admin: ReturnType<typeof createClient>, path: string): Promise<Uint8Array | null> {
  const { data, error } = await admin.storage.from(JOB_CONTRACT_BUCKET).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) return json({ error: 'Server misconfigured' }, 500)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(jwt)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const body = (await req.json().catch(() => ({}))) as Body
    const mode: 'email' | 'pdf_url' = body.mode === 'pdf_url' ? 'pdf_url' : 'email'
    const to = (Array.isArray(body.to) ? body.to : []).map((e) => String(e ?? '').trim()).filter(isValidEmail).slice(0, 10)
    if (mode === 'email' && to.length === 0) return json({ error: 'Add at least one valid email.' }, 400)
    const note = (body.note ?? '').trim().slice(0, 4000)

    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', 'physical_invoice_issuer_v1').maybeSingle()
    const issuer = parseIssuer((setting as { value_text?: string | null } | null)?.value_text)

    let pdf: Uint8Array | null = null
    let pdfPath = ''
    let filename = 'Signed-agreement.pdf'
    let heading = 'Signed agreement'
    let job: JobLite | null = null
    let contractId: string | null = null
    let signerName = ''
    let signedAt: string | null = null
    let signLink: string | null = null
    /** Link-only filed record (Google Doc): emailed as a link, no attachment. */
    let docLink: string | null = null

    if (body.contract_id) {
      const { data: row } = await userClient.from('job_contracts').select('*').eq('id', body.contract_id).maybeSingle()
      if (!row) return json({ error: 'Contract not found or access denied' }, 403)
      const c = row as {
        id: string
        job_id: string
        status: string
        revision: number
        fields: unknown
        body_html: string | null
        body_format: string
        template_name: string | null
        recipient_name: string | null
        last_sent_at: string | null
        signed_at: string | null
        signer_printed_name: string | null
        signer_mode: string | null
        signer_consented_at: string | null
        signer_ip: string | null
        signer_signature_storage_path: string | null
        signed_pdf_path: string | null
        paper_upload_path: string | null
        public_token: string | null
        signed_document_url: string | null
      }
      if (c.status !== 'signed' || !c.signed_at) return json({ error: 'Only a signed contract can be shared.' }, 409)
      const { data: j } = await userClient.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, customer_name, master_user_id').eq('id', c.job_id).maybeSingle()
      job = (j ?? null) as JobLite | null
      if (!job) return json({ error: 'Job not found' }, 404)
      contractId = c.id
      signerName = (c.signer_printed_name ?? '').trim()
      signedAt = c.signed_at
      heading = contractHeading(job)
      const jobNo = jobNumberLabel(job)
      filename = `Signed-agreement-J${jobNo.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`
      if (c.public_token) signLink = signingUrl(appOrigin(body.public_origin), c.public_token)
      if (c.signer_mode === 'paper') {
        // Filed outside the app: the uploaded copy is the document when there is
        // one; otherwise the filed link (Google Doc) is what gets shared (v2.2744).
        if (c.paper_upload_path) {
          pdf = await fetchBytes(admin, c.paper_upload_path)
          pdfPath = c.paper_upload_path
          const ext = c.paper_upload_path.split('.').pop() ?? 'pdf'
          filename = `Signed-agreement-J${jobNo.replace(/[^a-zA-Z0-9-]/g, '')}.${ext}`
        } else if (c.signed_document_url) {
          docLink = c.signed_document_url
        } else {
          return json({ error: 'This record has no uploaded copy or document link to share.' }, 409)
        }
      } else {
        pdfPath = c.signed_pdf_path ?? `${c.id}/signed.pdf`
        pdf = c.signed_pdf_path ? await fetchBytes(admin, c.signed_pdf_path) : null
        if (!pdf) {
          // Rebuild once from the frozen row (older signatures predate the stored PDF).
          const sigPng = c.signer_signature_storage_path ? await fetchBytes(admin, c.signer_signature_storage_path) : null
          const f = (c.fields && typeof c.fields === 'object' ? c.fields : {}) as Record<string, unknown>
          const amount = amountCentsFromFields(c.fields)
          const key = typeof f.payment_terms_key === 'string' ? f.payment_terms_key : 'half_down'
          const paymentLine =
            key === 'half_down'
              ? amount != null
                ? `50% down (${formatMoney(Math.round(amount / 2))}) to begin work, balance due on completion.`
                : '50% down to begin work, balance due on completion.'
              : key === 'on_completion'
                ? 'Full amount due on completion of the work.'
                : key === 'progress'
                  ? 'Progress billing: invoiced as work completes; each invoice is due on receipt.'
                  : (typeof f.payment_terms_text === 'string' && f.payment_terms_text.trim()) || 'Payment terms as agreed.'
          const how = c.signer_mode === 'draw' ? 'drawn' : c.signer_mode === 'in_person' ? 'in person' : 'typed'
          pdf = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, {
            heading,
            jobNumber: jobNo,
            jobAddress: job.job_address,
            customerName: job.customer_name,
            recipientName: c.recipient_name,
            dateLabel: dateOnly(c.last_sent_at ?? c.signed_at),
            revision: c.revision,
            templateName: c.template_name,
            scopeLines: Array.isArray(f.scope_lines) ? (f.scope_lines as unknown[]).filter((x): x is string => typeof x === 'string') : [],
            exclusions: typeof f.exclusions === 'string' ? f.exclusions : '',
            note: typeof f.note === 'string' ? f.note : '',
            amountCents: amount,
            paymentLine,
            dates: [typeof f.start_date === 'string' && f.start_date ? `Start: ${f.start_date}` : '', typeof f.completion_date === 'string' && f.completion_date ? `Estimated completion: ${f.completion_date}` : ''].filter(Boolean).join('  ·  '),
            termsText: contractBodyToPlainText(c.body_html, c.body_format),
            issuer,
            signature: { printedName: signerName, auditLine: `${c.signer_consented_at ? 'Consent recorded · ' : ''}${how} · ${stamp(c.signed_at)} CT${c.signer_ip ? ` · ${c.signer_ip}` : ''}`, png: sigPng, recordId: signedRecordId('J', jobNo, c.id), whenLabel: `${stamp(c.signed_at)} CT` },
          })
          const { error: upErr } = await admin.storage.from(JOB_CONTRACT_BUCKET).upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: true })
          if (!upErr) await admin.from('job_contracts').update({ signed_pdf_path: pdfPath }).eq('id', c.id)
        }
      }
    } else if (body.estimate_id) {
      const { data: row } = await userClient.from('estimates').select('*').eq('id', body.estimate_id).maybeSingle()
      if (!row) return json({ error: 'Estimate not found or access denied' }, 403)
      const e = row as {
        id: string
        estimate_number: number
        title: string
        status: string
        doc_kind: string
        job_ledger_id: string | null
        for_address: string | null
        line_items_snapshot: unknown
        terms_snapshot: string
        total_cents: number
        options_snapshot: unknown
        accepted_option_key: string | null
        acceptor_printed_name: string | null
        acceptor_consented_at: string | null
        acceptor_ip: string | null
        acceptor_signature_storage_path: string | null
        customer_email: string | null
        sent_at: string | null
      }
      if (e.status !== 'customer_accepted' || !e.acceptor_consented_at) return json({ error: 'Only an accepted estimate can be shared.' }, 409)
      const jobId = body.job_id || e.job_ledger_id
      if (jobId) {
        const { data: j } = await userClient.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, customer_name, master_user_id').eq('id', jobId).maybeSingle()
        job = (j ?? null) as JobLite | null
      }
      signerName = (e.acceptor_printed_name ?? '').trim()
      signedAt = e.acceptor_consented_at
      const kindLabel = e.doc_kind === 'bid_proposal' ? 'Proposal' : 'Estimate'
      heading = e.title?.trim() || `${kindLabel} #${e.estimate_number}`
      filename = `Signed-${kindLabel.toLowerCase()}-${e.estimate_number}.pdf`
      pdfPath = `estimates/${e.id}/signed.pdf`
      pdf = await fetchBytes(admin, pdfPath)
      if (!pdf) {
        const lines = Array.isArray(e.line_items_snapshot) ? (e.line_items_snapshot as Array<Record<string, unknown>>) : []
        const scopeLines = lines.map((l) => {
          const name = typeof l.line_item === 'string' ? l.line_item.trim() : ''
          const desc = typeof l.description === 'string' ? l.description.trim() : ''
          const qty = typeof l.quantity === 'number' ? l.quantity : 1
          const unit = typeof l.unit_price_cents === 'number' ? l.unit_price_cents : typeof l.amount_cents === 'number' ? l.amount_cents : null
          const money = unit != null ? ` — ${formatMoney(unit * (qty || 1))}` : ''
          return `${qty > 1 ? `${qty} × ` : ''}${name || 'Item'}${desc && desc !== name ? ` — ${desc}` : ''}${money}`
        })
        const opts = Array.isArray(e.options_snapshot) ? (e.options_snapshot as Array<Record<string, unknown>>) : []
        const chosen = opts.find((o) => o && o.key === e.accepted_option_key)
        const optionName = chosen && typeof chosen.name === 'string' ? chosen.name : null
        const sigPng = e.acceptor_signature_storage_path ? await (async () => {
          const { data } = await admin.storage.from('estimate-acceptor-signatures').download(e.acceptor_signature_storage_path!)
          return data ? new Uint8Array(await data.arrayBuffer()) : null
        })() : null
        const input: JobContractPdfInput = {
          heading,
          jobNumber: job ? jobNumberLabel(job) : `${kindLabel} ${e.estimate_number}`,
          jobAddress: e.for_address ?? job?.job_address ?? null,
          customerName: job?.customer_name ?? null,
          recipientName: signerName,
          dateLabel: dateOnly(e.sent_at ?? e.acceptor_consented_at),
          revision: 1,
          templateName: `${kindLabel} #${e.estimate_number}${optionName ? ` · option "${optionName}"` : ''}`,
          scopeLines,
          exclusions: '',
          note: '',
          amountCents: e.total_cents,
          paymentLine: 'As accepted on the estimate.',
          dates: '',
          termsText: e.terms_snapshot ?? '',
          issuer,
          signature: { printedName: signerName, auditLine: `Consent recorded · ${sigPng ? 'drawn' : 'typed'} on the estimate page · ${stamp(e.acceptor_consented_at)} CT${e.acceptor_ip ? ` · ${e.acceptor_ip}` : ''}`, png: sigPng, recordId: signedRecordId('E', e.estimate_number, e.id), whenLabel: `${stamp(e.acceptor_consented_at)} CT` },
        }
        pdf = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, input)
        await admin.storage.from(JOB_CONTRACT_BUCKET).upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: true })
      }
    } else {
      return json({ error: 'contract_id or estimate_id required' }, 400)
    }

    if (!pdf && !docLink) return json({ error: 'The signed copy could not be loaded.' }, 500)

    if (mode === 'pdf_url') {
      if (docLink) return json({ ok: true, pdf_url: null, document_url: docLink, filename: null })
      const { data: signed } = await admin.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(pdfPath, 3600)
      return json({ ok: true, pdf_url: signed?.signedUrl ?? null, filename })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return json({ error: 'Email is not configured on the server.' }, 500)
    const { data: senderRow } = await admin.from('users').select('email, name').eq('id', user.id).maybeSingle()
    const senderEmail = (senderRow as { email?: string | null } | null)?.email ?? null
    const senderName = ((senderRow as { name?: string | null } | null)?.name ?? '').trim()
    const jobNo = job ? jobNumberLabel(job) : ''
    const subject = `Signed: ${heading}${jobNo ? ` — Job #${jobNo}` : ''}`
    const intro = docLink
      ? `Here is the signed agreement${signerName ? ` — signed by ${signerName}` : ''}${signedAt ? ` on ${dateOnly(signedAt)}` : ''}:`
      : `Attached is the signed agreement${signerName ? ` — signed by ${signerName}` : ''}${signedAt ? ` on ${dateOnly(signedAt)}` : ''}.`
    const text = `${note ? `${note}\n\n` : ''}${intro}${docLink ? `\n${docLink}` : ''}${signLink ? `\n\nIt also stays at this link any time:\n${signLink}` : ''}${senderName ? `\n\n— ${senderName}` : ''}\n`
    const html =
      `${note ? `<p>${escapeHtml(note).replace(/\n/g, '<br>')}</p>` : ''}<p>${escapeHtml(intro)}</p>` +
      (docLink ? `<p><a href="${escapeHtml(docLink)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open the signed agreement</a></p><p style="color:#6b7280;font-size:13px">${escapeHtml(docLink)}</p>` : '') +
      (signLink ? `<p style="color:#6b7280;font-size:13px">It also stays at this link any time: <a href="${escapeHtml(signLink)}">${escapeHtml(signLink)}</a></p>` : '') +
      (senderName ? `<p>— ${escapeHtml(senderName)}</p>` : '')
    const b64 = pdf ? btoa(String.fromCharCode(...pdf)) : null
    const [first, ...rest] = to
    const sent = await sendEmailViaResend(first!, subject, text, html, resendKey, {
      ...(senderEmail ? { replyTo: senderEmail } : {}),
      ...(rest.length > 0 ? { cc: rest } : {}),
      ...(b64 ? { attachments: [{ filename, content: b64 }] } : {}),
    })
    if (!sent.success) return json({ error: sent.error || 'Email failed' }, 502)

    const nowIso = new Date().toISOString()
    if (contractId) {
      await admin.from('job_contract_events').insert({ contract_id: contractId, event_type: 'shared', metadata: { to, channel: 'email', note: note || null }, actor_user_id: user.id })
    }
    if (job) {
      await admin.from('job_activity_events').insert({
        job_id: job.id,
        event_type: 'contract_shared',
        occurred_at: nowIso,
        actor_user_id: user.id,
        summary: `Signed agreement emailed to ${to.join(', ')}`,
        detail: { source_id: `${contractId ?? body.estimate_id}:shared:${Date.parse(nowIso)}`, contract_id: contractId, estimate_id: body.estimate_id ?? null, to, channel: 'email', document_url: docLink },
        financial: true,
      })
    }
    return json({ ok: true, emailed: true, to })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
