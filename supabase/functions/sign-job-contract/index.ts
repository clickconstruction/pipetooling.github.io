/**
 * sign-job-contract (Contract Desk PR 2): the customer signs. Only the
 * CURRENT revision of a contract that is out for signature can be signed —
 * a stale revision gets 409 stale_revision and the page refreshes itself;
 * a second submit gets 409 already_signed. Records the e-signature audit
 * block (name, mode, consent time, IP, UA, drawn PNG in the private bucket),
 * logs the event, and emails both sides: the customer a confirmation with
 * the same durable link, the office a notice.
 *
 * v2.4186 — a second signer: `signer: 'primary' | 'co'` says which frame is being signed. The
 * first frame keeps the signer_* columns, the second has co_signer_*; either may go first; the
 * row reads signed (signed_at, the PDF, the emails) only when every frame is filled. A frame
 * filled while the other waits logs `co_signed` and nudges the other signer by email when known.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import { buildJobContractPdf, contractBodyToPlainText, type PdfLibLike } from '../_shared/jobContractPdf.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import { buildJobContractSignedCopyEmail } from '../_shared/jobContractEmail.ts'
import {
  amountCentsFromFields,
  appOrigin,
  clientIp,
  contractHeading,
  corsHeaders,
  decodeSignaturePng,
  escapeHtml,
  formatMoney,
  isValidEmail,
  JOB_CONTRACT_BUCKET,
  jobNumberLabel,
  json,
  signingUrl,
  signedRecordId,
} from '../_shared/jobContract.ts'
import { parseEsignConsent, recordEsignConsent } from '../_shared/esignConsent.ts'

type Body = {
  token?: string
  revision?: number
  printedName?: string
  agreedTerms?: boolean
  signaturePngBase64?: string
  mode?: 'type' | 'draw' | 'in_person'
  /** v2.4186: which frame — the recipient's (default) or the named second signer's. */
  signer?: 'primary' | 'co'
  public_origin?: string
  /** v2.3100: the ESIGN / Texas UETA consent words the signer saw (stored on esign_consents). */
  esignConsent?: unknown
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    const token = (body.token ?? '').trim()
    const printedName = (body.printedName ?? '').trim().slice(0, 200)
    if (!token) return json({ error: 'Missing token' }, 400)
    if (!printedName) return json({ error: 'Please type your full name.' }, 400)
    if (body.agreedTerms !== true) return json({ error: 'Please confirm you agree to the agreement.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: row } = await admin
      .from('job_contracts')
      .select('id, job_id, status, revision, public_token_expires_at, recipient_email, recipient_name, fields, created_by, voided_at, cc_emails, body_html, body_format, template_name, last_sent_at, signer_printed_name, signer_mode, signer_consented_at, signer_ip, signer_signature_storage_path, co_signer_name, co_signer_email, co_signed_at, co_signer_printed_name, co_signer_mode, co_signer_consented_at, co_signer_ip, co_signer_signature_storage_path')
      .eq('public_token', token)
      .maybeSingle()
    if (!row) return json({ error: 'Not found' }, 404)
    const c = row as {
      id: string
      job_id: string
      status: string
      revision: number
      public_token_expires_at: string | null
      recipient_email: string | null
      recipient_name: string | null
      fields: unknown
      created_by: string | null
      voided_at: string | null
      cc_emails: string[] | null
      body_html: string | null
      body_format: string
      template_name: string | null
      last_sent_at: string | null
      signer_printed_name: string | null
      signer_mode: string | null
      signer_consented_at: string | null
      signer_ip: string | null
      signer_signature_storage_path: string | null
      co_signer_name: string | null
      co_signer_email: string | null
      co_signed_at: string | null
      co_signer_printed_name: string | null
      co_signer_mode: string | null
      co_signer_consented_at: string | null
      co_signer_ip: string | null
      co_signer_signature_storage_path: string | null
    }
    if (c.voided_at || c.status === 'voided') return json({ error: 'This agreement was withdrawn.', code: 'voided' }, 410)
    if (c.status === 'signed') return json({ error: 'This agreement is already signed.', code: 'already_signed' }, 409)
    if (c.status !== 'sent') return json({ error: 'This agreement is not out for signature.', code: 'not_sent' }, 409)
    if (c.public_token_expires_at && new Date(c.public_token_expires_at).getTime() < Date.now()) {
      return json({ error: 'This link has expired. Ask us for a fresh one.', code: 'expired' }, 410)
    }
    if (typeof body.revision === 'number' && body.revision !== c.revision) {
      return json({ error: 'This agreement was just revised.', code: 'stale_revision' }, 409)
    }

    // v2.4186: which frame, and whether this signature completes the agreement.
    const signer: 'primary' | 'co' = body.signer === 'co' ? 'co' : 'primary'
    const coName = (c.co_signer_name ?? '').trim()
    const primaryDone = Boolean(c.signer_printed_name && c.signer_consented_at)
    const coDone = Boolean(coName && c.co_signed_at && c.co_signer_printed_name)
    if (signer === 'co' && !coName) return json({ error: 'This agreement has no second signer.', code: 'no_co_signer' }, 400)
    if (signer === 'primary' && primaryDone) return json({ error: `${c.signer_printed_name} has already signed${coName ? ` — waiting on ${coName}` : ''}.`, code: 'frame_signed' }, 409)
    if (signer === 'co' && coDone) return json({ error: `${c.co_signer_printed_name} has already signed.`, code: 'frame_signed' }, 409)
    const complete = signer === 'primary' ? !coName || coDone : primaryDone
    const otherSigner = signer === 'primary' ? { name: coName, email: c.co_signer_email } : { name: (c.recipient_name ?? '').trim(), email: c.recipient_email }

    const ip = clientIp(req)
    const ua = req.headers.get('user-agent')
    const nowIso = new Date().toISOString()
    const mode: 'type' | 'draw' | 'in_person' = body.mode === 'in_person' ? 'in_person' : body.signaturePngBase64 ? 'draw' : 'type'

    let sigPath: string | null = null
    let sigBytes: Uint8Array | null = null
    if (body.signaturePngBase64) {
      const bytes = decodeSignaturePng(body.signaturePngBase64)
      if (!bytes) return json({ error: 'The drawn signature could not be read. Try typing your name instead.' }, 400)
      sigBytes = bytes
      sigPath = `${c.id}/${crypto.randomUUID()}.png`
      const { error: upErr } = await admin.storage.from(JOB_CONTRACT_BUCKET).upload(sigPath, bytes, { contentType: 'image/png', upsert: false })
      if (upErr) {
        console.error(upErr)
        sigPath = null
      }
    }

    const frameCols =
      signer === 'primary'
        ? { signer_printed_name: printedName, signer_mode: mode, signer_consented_at: nowIso, signer_ip: ip, signer_user_agent: ua, signer_signature_storage_path: sigPath }
        : { co_signed_at: nowIso, co_signer_printed_name: printedName, co_signer_mode: mode, co_signer_consented_at: nowIso, co_signer_ip: ip, co_signer_user_agent: ua, co_signer_signature_storage_path: sigPath }
    const { data: updated, error: updErr } = await admin
      .from('job_contracts')
      .update({
        ...frameCols,
        ...(complete ? { status: 'signed', signed_at: nowIso, next_reminder_at: null } : {}),
      })
      .eq('id', c.id)
      .eq('status', 'sent')
      .eq('revision', c.revision)
      .select('id')
    if (updErr || !updated?.length) {
      if (sigPath) await admin.storage.from(JOB_CONTRACT_BUCKET).remove([sigPath])
      return json({ error: 'This agreement was just signed or revised. Reload the page.', code: 'already_signed' }, 409)
    }

    // v2.3100: the consent words, verbatim, beside the signature (best-effort; the row stamp is the act).
    await recordEsignConsent(admin, {
      recordType: 'job_contract',
      recordId: c.id,
      consent: parseEsignConsent(body.esignConsent),
      printedName,
      method: mode,
      consentedAt: nowIso,
      ip,
      userAgent: ua,
    })

    await admin.from('job_contract_events').insert({
      contract_id: c.id,
      event_type: complete ? 'signed' : 'co_signed',
      metadata: { revision: c.revision, printed_name: printedName, mode, ...(coName ? { signer, waiting_on: complete ? null : otherSigner.name } : {}) },
      client_ip: ip,
      user_agent: ua,
    })

    // The signed PDF + emails — best effort, never fail the signature.
    let pdfBase64: string | null = null
    let pdfFilename = 'Signed-agreement.pdf'
    const { data: job } = await admin
      .from('jobs_ledger')
      .select('hcp_number, click_number, job_name, job_address, customer_name, master_user_id')
      .eq('id', c.job_id)
      .maybeSingle()
    const j = (job ?? {}) as {
      hcp_number?: string | null
      click_number?: string | null
      job_name?: string | null
      job_address?: string | null
      customer_name?: string | null
      master_user_id?: string | null
    }
    const heading = contractHeading({ job_address: j.job_address ?? null, job_name: j.job_name ?? null })
    const jobNo = jobNumberLabel({ hcp_number: j.hcp_number ?? null, click_number: j.click_number ?? null })
    const amount = amountCentsFromFields(c.fields)
    const stampOf = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    const howOf = (m: string | null) => (m === 'draw' ? 'drawn' : m === 'in_person' ? 'in person' : 'typed')
    const fetchPng = async (path: string | null): Promise<Uint8Array | null> => {
      if (!path) return null
      const { data, error } = await admin.storage.from(JOB_CONTRACT_BUCKET).download(path)
      if (error || !data) return null
      return new Uint8Array(await data.arrayBuffer())
    }
    if (!complete) {
      // One frame filled, the other still open: tell the other signer, when we know how.
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY')
        if (resendKey && otherSigner.email && isValidEmail(otherSigner.email)) {
          const url = signingUrl(appOrigin(body.public_origin), token)
          const subject = `✍ ${printedName} signed — your signature is next · Job #${jobNo}`
          const text = `${printedName} has signed ${heading} (Job #${jobNo}). The agreement is complete once you sign too.\n\nReview and sign here: ${url}\n`
          await sendEmailViaResend(otherSigner.email, subject, text, text.replace(/\n/g, '<br>'), resendKey)
        }
      } catch (e) {
        console.error('sign-job-contract nudge failed', e)
      }
      return json({ ok: true, signed_at: null, mode, complete: false, signer, waiting_on: otherSigner.name || 'the other signer' })
    }
    try {
      const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', 'physical_invoice_issuer_v1').maybeSingle()
      let issuer: { companyName: string; addressText: string; phone: string; email: string; tagline: string; licenseLine: string } | null = null
      try {
        const o = JSON.parse((setting as { value_text?: string | null } | null)?.value_text ?? 'null') as Record<string, unknown> | null
        if (o && typeof o === 'object') {
          const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
          issuer = { companyName: str('companyName'), addressText: str('addressText'), phone: str('phone'), email: str('email'), tagline: str('tagline'), licenseLine: str('licenseLine') }
        }
      } catch {
        issuer = null
      }
      const f = (c.fields && typeof c.fields === 'object' ? c.fields : {}) as {
        scope_lines?: unknown
        exclusions?: unknown
        note?: unknown
        payment_terms_key?: unknown
        payment_terms_text?: unknown
        start_date?: unknown
        completion_date?: unknown
      }
      const scopeLines = Array.isArray(f.scope_lines) ? f.scope_lines.filter((x): x is string => typeof x === 'string') : []
      const paymentLine = (() => {
        const key = typeof f.payment_terms_key === 'string' ? f.payment_terms_key : 'half_down'
        if (key === 'half_down') return amount != null ? `50% down (${formatMoney(Math.round(amount / 2))}) to begin work, balance due on completion.` : '50% down to begin work, balance due on completion.'
        if (key === 'on_completion') return 'Full amount due on completion of the work.'
        if (key === 'progress') return 'Progress billing: invoiced as work completes; each invoice is due on receipt.'
        return (typeof f.payment_terms_text === 'string' && f.payment_terms_text.trim()) || 'Payment terms as agreed.'
      })()
      const dates = [
        typeof f.start_date === 'string' && f.start_date ? `Start: ${f.start_date}` : '',
        typeof f.completion_date === 'string' && f.completion_date ? `Estimated completion: ${f.completion_date}` : '',
      ]
        .filter(Boolean)
        .join('  ·  ')
      // v2.4186: both frames — the one just signed from this request, the other from the row.
      const recordId = signedRecordId('J', jobNo, c.id)
      const primaryAt = signer === 'primary' ? nowIso : c.signer_consented_at ?? nowIso
      const primaryMode = signer === 'primary' ? mode : c.signer_mode
      const primaryIp = signer === 'primary' ? ip : c.signer_ip
      const primaryPng = signer === 'primary' ? sigBytes : await fetchPng(c.signer_signature_storage_path)
      const primarySig = {
        printedName: signer === 'primary' ? printedName : (c.signer_printed_name ?? '').trim(),
        auditLine: `Consent recorded · ${howOf(primaryMode)} · ${stampOf(primaryAt)} CT${primaryIp ? ` · ${primaryIp}` : ''}`,
        png: primaryPng,
        recordId,
        whenLabel: `${stampOf(primaryAt)} CT`,
      }
      const coSig = coName
        ? (() => {
            const at = signer === 'co' ? nowIso : c.co_signed_at ?? nowIso
            const m = signer === 'co' ? mode : c.co_signer_mode
            const coIp = signer === 'co' ? ip : c.co_signer_ip
            return { printedName: signer === 'co' ? printedName : (c.co_signer_printed_name ?? '').trim(), auditLine: `Consent recorded · ${howOf(m)} · ${stampOf(at)} CT${coIp ? ` · ${coIp}` : ''}`, recordId, whenLabel: `${stampOf(at)} CT` }
          })()
        : null
      const coPng = coName ? (signer === 'co' ? sigBytes : await fetchPng(c.co_signer_signature_storage_path)) : null
      const pdf = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, {
        heading,
        jobNumber: jobNo,
        jobAddress: j.job_address ?? null,
        customerName: j.customer_name ?? null,
        recipientName: c.recipient_name,
        dateLabel: new Date(c.last_sent_at ?? nowIso).toLocaleDateString('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }),
        revision: c.revision,
        templateName: c.template_name,
        scopeLines,
        exclusions: typeof f.exclusions === 'string' ? f.exclusions : '',
        note: typeof f.note === 'string' ? f.note : '',
        amountCents: amount,
        paymentLine,
        dates,
        termsText: contractBodyToPlainText(c.body_html, c.body_format),
        issuer,
        signature: primarySig,
        coSignerName: coName || null,
        coSignature: coSig ? { ...coSig, png: coPng } : null,
      })
      pdfFilename = `Signed-agreement-J${jobNo.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`
      pdfBase64 = btoa(String.fromCharCode(...pdf))
      const pdfPath = `${c.id}/signed.pdf`
      const { error: pdfErr } = await admin.storage.from(JOB_CONTRACT_BUCKET).upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: true })
      if (!pdfErr) await admin.from('job_contracts').update({ signed_pdf_path: pdfPath }).eq('id', c.id)
      else console.error('signed pdf upload failed', pdfErr)
    } catch (e) {
      console.error('signed pdf build failed', e)
      pdfBase64 = null
    }

    try {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
        const url = signingUrl(appOrigin(body.public_origin), token)
        const amountLine = amount != null ? ` · ${formatMoney(amount)}` : ''

        const signedBy = coName ? `${(signer === 'primary' ? printedName : c.signer_printed_name ?? '').trim()} and ${(signer === 'co' ? printedName : c.co_signer_printed_name ?? '').trim()}` : printedName
        const ccList = [...(c.cc_emails ?? []), ...(coName && c.co_signer_email ? [c.co_signer_email] : [])].filter(isValidEmail).filter((e) => e !== c.recipient_email).slice(0, 10)
        if (c.recipient_email && isValidEmail(c.recipient_email)) {
          // v2.3617: the customer's signed copy comes from the shared builder, so Settings → What customers see renders the same email.
          const { subject, text, html } = buildJobContractSignedCopyEmail({
            printedName: signedBy,
            heading,
            jobNo,
            amountLabel: amount != null ? formatMoney(amount) : null,
            url,
            hasPdf: Boolean(pdfBase64),
          })
          await sendEmailViaResend(c.recipient_email, subject, text, html, resendKey, {
            ...(ccList.length > 0 ? { cc: ccList } : {}),
            ...(pdfBase64 ? { attachments: [{ filename: pdfFilename, content: pdfBase64 }] } : {}),
          })
        }

        const ids = [c.created_by, j.master_user_id].filter((x): x is string => !!x)
        if (ids.length > 0) {
          const { data: users } = await admin.from('users').select('email').in('id', [...new Set(ids)])
          const subject = `✍ Contract signed — Job #${jobNo} · ${signedBy}`
          const text = `${signedBy} signed ${heading} (Job #${jobNo}${amountLine}).\n\nOpen the job in ClickTooling: ${appOrigin(body.public_origin)}/jobs?edit=${c.job_id}\n`
          const html = text.replace(/\n/g, '<br>')
          for (const u of (users ?? []) as { email: string | null }[]) {
            if (u.email && isValidEmail(u.email)) await sendEmailViaResend(u.email, subject, text, html, resendKey)
          }
        }
      }
    } catch (e) {
      console.error('sign-job-contract notify failed', e)
    }

    return json({ ok: true, signed_at: nowIso, mode, complete: true, signer, waiting_on: null })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
