/**
 * open-contract-form-pdf (Contract Forms PR 4): mint a short-lived link to a
 * signed form PDF — the one place a form's sensitive answers exist — for a
 * staff member allowed to see it, and log the open.
 *
 * Gate: dev, controller, or a pay-approved master (the Person Desk pay gate).
 * Assistants and everyone else get 403 even though they can read the row.
 * Every successful mint inserts a `contract_form_pdf_opens` row.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FORM_PDFS_BUCKET = 'contract-form-pdfs'
const LINK_SECONDS = 300

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) return json({ error: 'Server misconfigured' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = (await req.json().catch(() => ({}))) as { person_contract_document_id?: string }
    const docId = typeof body.person_contract_document_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.person_contract_document_id) ? body.person_contract_document_id : null
    if (!docId) return json({ error: 'person_contract_document_id is required' }, 400)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // Gate: dev | controller | pay-approved master.
    const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = (me as { role?: string } | null)?.role ?? ''
    let allowed = role === 'dev' || role === 'controller'
    if (!allowed && role === 'master_technician') {
      const { data: pam } = await admin.from('pay_approved_masters').select('master_id').eq('master_id', user.id).maybeSingle()
      allowed = Boolean(pam)
    }
    if (!allowed) return json({ error: 'Only a dev, controller, or pay-approved master can open a signed form.', code: 'forbidden' }, 403)

    // The caller must also be able to read the row (contracts RLS) — use their client.
    const { data: row, error: rowErr } = await userClient
      .from('person_contract_documents')
      .select('id, status, form_pdf_storage_path, document_name, person_name')
      .eq('id', docId)
      .maybeSingle()
    if (rowErr || !row) return json({ error: 'Document not found or access denied' }, 404)
    const r = row as { id: string; status: string; form_pdf_storage_path: string | null; document_name: string; person_name: string }
    if (r.status !== 'signed' || !r.form_pdf_storage_path?.trim()) return json({ error: 'No signed form PDF on file for this document.' }, 404)

    const { data: signed, error: sErr } = await admin.storage.from(FORM_PDFS_BUCKET).createSignedUrl(r.form_pdf_storage_path, LINK_SECONDS, {
      download: `${r.document_name} - ${r.person_name}.pdf`.replace(/[\\/:*?"<>|]+/g, ' '),
    })
    if (sErr || !signed?.signedUrl) {
      console.error('signed form url', sErr)
      return json({ error: 'Could not open the PDF right now.' }, 500)
    }

    const { error: logErr } = await admin.from('contract_form_pdf_opens').insert({ person_contract_document_id: r.id, opened_by: user.id })
    if (logErr) console.error('form pdf open log', logErr)

    return json({ ok: true, url: signed.signedUrl, expires_in: LINK_SECONDS })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
