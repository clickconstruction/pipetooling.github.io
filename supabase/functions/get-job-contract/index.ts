/**
 * get-job-contract (Contract Desk PR 2): the customer's page fetches the
 * contract by its durable token. No JWT — the token is the credential;
 * service role behind it. Logs a `viewed` event and bumps the view counters
 * while the contract is out for signature; serves the signed record forever
 * after; voided links get a polite 410.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIp, contractHeading, corsHeaders, JOB_CONTRACT_BUCKET, jobNumberLabel, json } from '../_shared/jobContract.ts'

const ISSUER_KEY = 'physical_invoice_issuer_v1'

function parseIssuer(raw: string | null | undefined) {
  try {
    const o = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
    if (!o || typeof o !== 'object') return null
    const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
    return {
      companyName: s('companyName'),
      addressText: s('addressText'),
      phone: s('phone'),
      email: s('email'),
      tagline: s('tagline'),
      licenseLine: s('licenseLine'),
    }
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
  try {
    const token = new URL(req.url).searchParams.get('t')?.trim()
    if (!token) return json({ error: 'Missing token' }, 400)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: row } = await admin
      .from('job_contracts')
      .select(
        'id, job_id, status, revision, public_token_expires_at, recipient_name, recipient_email, fields, body_html, body_format, template_name, template_version_date, signed_at, signer_printed_name, signer_mode, signer_consented_at, signer_signature_storage_path, signed_pdf_path, voided_at, view_count, first_viewed_at, last_sent_at',
      )
      .eq('public_token', token)
      .maybeSingle()
    if (!row) return json({ error: 'Not found' }, 404)
    const c = row as {
      id: string
      job_id: string
      status: string
      revision: number
      public_token_expires_at: string | null
      recipient_name: string | null
      recipient_email: string | null
      fields: unknown
      body_html: string | null
      body_format: string
      template_name: string | null
      template_version_date: string | null
      signed_at: string | null
      signer_printed_name: string | null
      signer_mode: string | null
      signer_consented_at: string | null
      signer_signature_storage_path: string | null
      signed_pdf_path: string | null
      voided_at: string | null
      view_count: number
      first_viewed_at: string | null
      last_sent_at: string | null
    }
    if (c.voided_at || c.status === 'voided') return json({ error: 'This agreement was withdrawn.', code: 'voided' }, 410)
    if (c.status === 'sent' && c.public_token_expires_at && new Date(c.public_token_expires_at).getTime() < Date.now()) {
      return json({ error: 'This link has expired. Ask us for a fresh one.', code: 'expired' }, 410)
    }
    if (c.status === 'draft') return json({ error: 'Nothing has been sent to this link yet.', code: 'empty' }, 404)

    const { data: job } = await admin
      .from('jobs_ledger')
      .select('hcp_number, click_number, job_name, job_address, customer_name')
      .eq('id', c.job_id)
      .maybeSingle()
    const j = (job ?? { hcp_number: null, click_number: null, job_name: null, job_address: null, customer_name: null }) as {
      hcp_number: string | null
      click_number: string | null
      job_name: string | null
      job_address: string | null
      customer_name: string | null
    }

    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', ISSUER_KEY).maybeSingle()
    const issuer = parseIssuer((setting as { value_text?: string | null } | null)?.value_text)

    let signatureUrl: string | null = null
    if (c.signer_signature_storage_path) {
      const { data: signed } = await admin.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(c.signer_signature_storage_path, 3600)
      signatureUrl = signed?.signedUrl ?? null
    }
    let signedPdfUrl: string | null = null
    if (c.signed_pdf_path) {
      const { data: pdf } = await admin.storage.from(JOB_CONTRACT_BUCKET).createSignedUrl(c.signed_pdf_path, 3600)
      signedPdfUrl = pdf?.signedUrl ?? null
    }

    if (c.status === 'sent') {
      const nowIso = new Date().toISOString()
      await admin
        .from('job_contracts')
        .update({ view_count: (c.view_count ?? 0) + 1, last_viewed_at: nowIso, first_viewed_at: c.first_viewed_at ?? nowIso })
        .eq('id', c.id)
      await admin.from('job_contract_events').insert({
        contract_id: c.id,
        event_type: 'viewed',
        metadata: { revision: c.revision },
        client_ip: clientIp(req),
        user_agent: req.headers.get('user-agent'),
      })
    }

    return json({
      contract: {
        id: c.id,
        status: c.status,
        revision: c.revision,
        heading: contractHeading(j),
        job_number: jobNumberLabel(j),
        job_address: j.job_address,
        customer_name: j.customer_name,
        recipient_name: c.recipient_name,
        fields: c.fields,
        body_html: c.body_html,
        body_format: c.body_format,
        template_name: c.template_name,
        template_version_date: c.template_version_date,
        sent_at: c.last_sent_at,
        signed_at: c.signed_at,
        signer_printed_name: c.signer_printed_name,
        signer_mode: c.signer_mode,
        signer_consented_at: c.signer_consented_at,
        signature_url: signatureUrl,
        signed_pdf_url: signedPdfUrl,
      },
      issuer,
      brand: 'plum',
    })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
