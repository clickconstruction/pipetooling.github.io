/**
 * open-contract-form-pdf (Contract Forms PR 4): mint a short-lived link to a
 * signed form PDF — the one place a form's sensitive answers exist — for a
 * staff member allowed to see it, and log the open.
 *
 * Gate (`_shared/contractFormPdfGate.ts`): dev, controller, or a pay-approved
 * master (the Person Desk pay gate). Assistants and everyone else get 403 even
 * though they can read the row. The link is handed over only once the open is
 * written to `contract_form_pdf_opens`.
 *
 * `which: 'scan'` (Contract Forms PR 6) opens the paper scan a staff member
 * keyed the answers from instead of the flattened PDF — same gate, same log.
 *
 * A signed hours statement's copy (punch list #212) opens for a dev and the
 * controller alone — payroll data, Diane's call of 2026-11-02 (v2.6450): the
 * pay-approved master who opens every other signed form is refused on that
 * row, and v2.6411's assistant allowance is gone.
 *
 * An estimator (punch list #403, the owner's calls 10 and 11 of 2026-11-20)
 * opens a signed form whose paper is with an outside company, a signed W-9
 * among them, and no other. The database says which papers those are:
 * `estimator_reads_paper`, asked as the caller, the rule the estimator's read
 * policy follows. A digital twin reads as an estimator and is refused here.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { paperForName } from '../_shared/companyPaper.ts'
import { formPdfOpener, formPdfRefusal, type FormPdfCaller, type FormPdfFacts } from '../_shared/contractFormPdfGate.ts'
import { partyFileWords } from '../_shared/paperSigner.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

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

    const body = (await req.json().catch(() => ({}))) as { person_contract_document_id?: string; which?: string }
    const which: 'pdf' | 'scan' = body.which === 'scan' ? 'scan' : 'pdf'
    const docId = typeof body.person_contract_document_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.person_contract_document_id) ? body.person_contract_document_id : null
    if (!docId) return json({ error: 'person_contract_document_id is required' }, 400)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const archivedRefusal = await refuseArchivedCaller(admin, user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal

    // Gate: who the caller is, then the facts their kind of opener needs, each read only when it matters.
    const { data: me } = await admin.from('users').select('role, is_digital_twin').eq('id', user.id).maybeSingle()
    const caller = me as FormPdfCaller | null
    const opener = formPdfOpener(caller)
    const facts: FormPdfFacts = {}
    if (opener === 'master') {
      const { data: pam } = await admin.from('pay_approved_masters').select('master_id').eq('master_id', user.id).maybeSingle()
      facts.payApprovedMaster = Boolean(pam)
    }
    if (opener === 'estimator') {
      // The database's own rule, asked as the caller: the paper is with an outside company (punch list #403). The read
      // policy follows the same function, so the gate and the policy cannot come apart. No answer is a refusal.
      const { data: reads, error: readsErr } = await userClient.rpc('estimator_reads_paper', { p_paper_id: docId })
      if (readsErr) console.error('estimator_reads_paper', readsErr)
      facts.estimatorReads = reads === true
    }
    // A signed hours statement's copy (punch list #212, v2.6450) is payroll data: a dev and the controller alone, the
    // table's own line (`can_touch_hours_statement`), so anyone else who got this far is refused on that row.
    if ((opener === 'master' && facts.payApprovedMaster) || (opener === 'estimator' && facts.estimatorReads)) {
      const { data: hs } = await admin.from('hours_statements').select('id').eq('contract_document_id', docId).maybeSingle()
      facts.hoursStatement = Boolean(hs)
    }
    const refusal = formPdfRefusal(caller, facts)
    if (refusal) return json({ error: refusal.error, code: refusal.code }, refusal.status)

    // The caller must also be able to read the row (contracts RLS) — use their client.
    const { data: row, error: rowErr } = await userClient
      .from('person_contract_documents')
      .select('id, status, form_pdf_storage_path, form_scan_storage_path, document_name, person_name, company_id, party_name, signer_name')
      .eq('id', docId)
      .maybeSingle()
    if (rowErr || !row) return json({ error: 'Document not found or access denied' }, 404)
    const r = row as { id: string; status: string; form_pdf_storage_path: string | null; form_scan_storage_path: string | null; document_name: string; person_name: string; company_id: string | null; party_name: string | null; signer_name: string | null }
    // A trade partner company's paper (GC mode, B6-b-i) downloads under the company's name, never its stored name.
    const companyName = r.company_id
      ? (((await admin.from('gc_companies').select('name').eq('id', r.company_id).maybeSingle()).data as { name?: string | null } | null)?.name ?? null)
      : null
    const path = which === 'scan' ? r.form_scan_storage_path?.trim() : r.form_pdf_storage_path?.trim()
    if (r.status !== 'signed' || !path) return json({ error: which === 'scan' ? 'No scan of the paper is on file for this document.' : 'No signed form PDF on file for this document.' }, 404)
    const ext = path.split('.').pop() ?? 'pdf'

    const { data: signed, error: sErr } = await admin.storage.from(FORM_PDFS_BUCKET).createSignedUrl(path, LINK_SECONDS, {
      // An outside party's paper (punch list #403) downloads under the party's name, never its stored name.
      download: `${r.document_name} - ${partyFileWords(r) || paperForName(r.person_name, companyName)}${which === 'scan' ? ' (paper)' : ''}.${ext}`.replace(/[\\/:*?"<>|]+/g, ' '),
    })
    if (sErr || !signed?.signedUrl) {
      console.error('signed form url', sErr)
      return json({ error: 'Could not open the PDF right now.' }, 500)
    }

    // Every open is written down: who, which paper and when. A link is handed over only once its line is kept.
    const { error: logErr } = await admin.from('contract_form_pdf_opens').insert({ person_contract_document_id: r.id, opened_by: user.id })
    if (logErr) {
      console.error('form pdf open log', logErr)
      return json({ error: 'Could not open the PDF right now.' }, 500)
    }

    return json({ ok: true, url: signed.signedUrl, expires_in: LINK_SECONDS })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
