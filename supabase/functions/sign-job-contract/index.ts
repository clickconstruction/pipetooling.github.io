/**
 * sign-job-contract (Contract Desk PR 2): the customer signs. Only the
 * CURRENT revision of a contract that is out for signature can be signed —
 * a stale revision gets 409 stale_revision and the page refreshes itself;
 * a second submit gets 409 already_signed. Records the e-signature audit
 * block (name, mode, consent time, IP, UA, drawn PNG in the private bucket),
 * logs the event, and emails both sides: the customer a confirmation with
 * the same durable link, the office a notice.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
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
} from '../_shared/jobContract.ts'

type Body = {
  token?: string
  revision?: number
  printedName?: string
  agreedTerms?: boolean
  signaturePngBase64?: string
  mode?: 'type' | 'draw' | 'in_person'
  public_origin?: string
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
      .select('id, job_id, status, revision, public_token_expires_at, recipient_email, recipient_name, fields, created_by, voided_at, cc_emails')
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

    const ip = clientIp(req)
    const ua = req.headers.get('user-agent')
    const nowIso = new Date().toISOString()
    const mode: 'type' | 'draw' | 'in_person' = body.mode === 'in_person' ? 'in_person' : body.signaturePngBase64 ? 'draw' : 'type'

    let sigPath: string | null = null
    if (body.signaturePngBase64) {
      const bytes = decodeSignaturePng(body.signaturePngBase64)
      if (!bytes) return json({ error: 'The drawn signature could not be read. Try typing your name instead.' }, 400)
      sigPath = `${c.id}/${crypto.randomUUID()}.png`
      const { error: upErr } = await admin.storage.from(JOB_CONTRACT_BUCKET).upload(sigPath, bytes, { contentType: 'image/png', upsert: false })
      if (upErr) {
        console.error(upErr)
        sigPath = null
      }
    }

    const { data: updated, error: updErr } = await admin
      .from('job_contracts')
      .update({
        status: 'signed',
        signed_at: nowIso,
        signer_printed_name: printedName,
        signer_mode: mode,
        signer_consented_at: nowIso,
        signer_ip: ip,
        signer_user_agent: ua,
        signer_signature_storage_path: sigPath,
        next_reminder_at: null,
      })
      .eq('id', c.id)
      .eq('status', 'sent')
      .eq('revision', c.revision)
      .select('id')
    if (updErr || !updated?.length) {
      if (sigPath) await admin.storage.from(JOB_CONTRACT_BUCKET).remove([sigPath])
      return json({ error: 'This agreement was just signed or revised. Reload the page.', code: 'already_signed' }, 409)
    }

    await admin.from('job_contract_events').insert({
      contract_id: c.id,
      event_type: 'signed',
      metadata: { revision: c.revision, printed_name: printedName, mode },
      client_ip: ip,
      user_agent: ua,
    })

    // Emails — best effort, never fail the signature.
    try {
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (resendKey) {
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
        const url = signingUrl(appOrigin(body.public_origin), token)
        const amountLine = amount != null ? ` · ${formatMoney(amount)}` : ''

        if (c.recipient_email && isValidEmail(c.recipient_email)) {
          const subject = `Signed: ${heading} — Job #${jobNo}`
          const text =
            `Thank you, ${printedName}. Your agreement is signed.\n\n${heading}\nJob #${jobNo}${amountLine}\n\n` +
            `Your signed copy stays at this link any time:\n${url}\n`
          const html =
            `<p>Thank you, ${escapeHtml(printedName)}. Your agreement is signed.</p>` +
            `<p><strong>${escapeHtml(heading)}</strong><br>Job #${escapeHtml(jobNo)}${escapeHtml(amountLine)}</p>` +
            `<p>Your signed copy stays at this link any time: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`
          await sendEmailViaResend(c.recipient_email, subject, text, html, resendKey, {
            ...(c.cc_emails && c.cc_emails.length > 0 ? { cc: c.cc_emails.filter(isValidEmail).slice(0, 10) } : {}),
          })
        }

        const ids = [c.created_by, j.master_user_id].filter((x): x is string => !!x)
        if (ids.length > 0) {
          const { data: users } = await admin.from('users').select('email').in('id', [...new Set(ids)])
          const subject = `✍ Contract signed — Job #${jobNo} · ${printedName}`
          const text = `${printedName} signed ${heading} (Job #${jobNo}${amountLine}).\n\nOpen the job in ClickTooling: ${appOrigin(body.public_origin)}/jobs?edit=${c.job_id}\n`
          const html = text.replace(/\n/g, '<br>')
          for (const u of (users ?? []) as { email: string | null }[]) {
            if (u.email && isValidEmail(u.email)) await sendEmailViaResend(u.email, subject, text, html, resendKey)
          }
        }
      }
    } catch (e) {
      console.error('sign-job-contract notify failed', e)
    }

    return json({ ok: true, signed_at: nowIso, mode })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
