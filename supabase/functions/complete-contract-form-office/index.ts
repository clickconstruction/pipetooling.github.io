/**
 * complete-contract-form-office (Contract Forms PR 7): the office's half of a
 * two-party form (the I-9's Section 2).
 *
 * A signed form whose template has `party: 'office'` boxes is filed by
 * accept-contract / contract-form-paper-entry UNFLATTENED (signer fields read-
 * only) so the office can still fill its fields. Two actions:
 *
 *   prepare  { person_contract_document_id }
 *     → { schema (office boxes only), pdfUrl (15-min signed URL of the current
 *         filed PDF), officeValues, completed: { at, by, printedName } | null,
 *         documentName, personName }
 *   complete { person_contract_document_id, officeValues, office_signer_printed_name }
 *     → fills the office boxes on the filed PDF (office signature typed in
 *       cursive, office dates = today), flattens, overwrites <id>/signed.pdf,
 *       stores office_values (non-sensitive) + who / when. One-shot: once the
 *       PDF is flattened it cannot be re-completed.
 *
 * Gate: dev, master, assistant, controller (the roles that may insert person
 * copies), and the caller must be able to read the row under their own RLS.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { buildFillPlan, hasOfficeBoxes, schemaForParty, splitFormValuesForStorage, validateFormValues, type FormSchema, type FormValues } from '../_shared/formSchema.ts'
import { fillFormPdf, type FormPdfLibLike } from '../_shared/fillFormPdf.ts'
import { formatYmdForContractEmail } from '../_shared/contractSigningEmail.ts'

const FORM_PDFS_BUCKET = 'contract-form-pdfs'
const LINK_SECONDS = 900
const ALLOWED_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

let cursiveFontCache: Uint8Array | null | undefined
async function loadCursiveFont(): Promise<Uint8Array | null> {
  if (cursiveFontCache !== undefined) return cursiveFontCache
  try {
    const origin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
    const res = await fetch(`${origin}/fonts/GreatVibes-Regular.ttf`)
    cursiveFontCache = res.ok ? new Uint8Array(await res.arrayBuffer()) : null
  } catch {
    cursiveFontCache = null
  }
  return cursiveFontCache
}

type Row = {
  id: string
  status: string
  document_name: string
  person_name: string
  form_template_id: string | null
  form_pdf_storage_path: string | null
  office_values: FormValues | null
  office_completed_at: string | null
  office_completed_by_user_id: string | null
  office_signer_printed_name: string | null
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

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: me } = await admin.from('users').select('role, name').eq('id', user.id).maybeSingle()
    const role = (me as { role?: string } | null)?.role ?? ''
    if (!ALLOWED_ROLES.has(role)) return json({ error: 'Only office staff can complete a form’s office section.', code: 'forbidden' }, 403)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = body.action === 'prepare' ? 'prepare' : body.action === 'complete' ? 'complete' : null
    if (!action) return json({ error: 'action must be prepare or complete' }, 400)
    const docId = typeof body.person_contract_document_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.person_contract_document_id) ? body.person_contract_document_id : null
    if (!docId) return json({ error: 'person_contract_document_id is required' }, 400)

    // The caller must be able to read the row under their own policies.
    const { data: rowData, error: rowErr } = await userClient
      .from('person_contract_documents')
      .select('id, status, document_name, person_name, form_template_id, form_pdf_storage_path, office_values, office_completed_at, office_completed_by_user_id, office_signer_printed_name')
      .eq('id', docId)
      .maybeSingle()
    if (rowErr || !rowData) return json({ error: 'Document not found or access denied' }, 404)
    const row = rowData as Row
    if (!row.form_template_id) return json({ error: 'This document is not a form.' }, 400)
    if (row.status !== 'signed' || !row.form_pdf_storage_path) return json({ error: 'The signer has not completed their part yet.' }, 409)

    const { data: tplRow } = await admin.from('contract_form_templates').select('schema').eq('id', row.form_template_id).maybeSingle()
    const schema = (tplRow as { schema?: FormSchema } | null)?.schema
    if (!schema) return json({ error: 'The form template is missing.' }, 404)
    if (!hasOfficeBoxes(schema)) return json({ error: 'This form has no office section.' }, 400)
    const officeSchema = schemaForParty(schema, 'office')

    let completedBy: string | null = null
    if (row.office_completed_by_user_id) {
      const { data: u } = await admin.from('users').select('name').eq('id', row.office_completed_by_user_id).maybeSingle()
      completedBy = (u as { name?: string } | null)?.name ?? null
    }
    const completed = row.office_completed_at ? { at: row.office_completed_at, by: completedBy, printedName: row.office_signer_printed_name } : null

    if (action === 'prepare') {
      const { data: signed, error: sErr } = await admin.storage.from(FORM_PDFS_BUCKET).createSignedUrl(row.form_pdf_storage_path, LINK_SECONDS)
      if (sErr || !signed?.signedUrl) {
        console.error('filed pdf url', sErr)
        return json({ error: 'Could not load the filed PDF.' }, 500)
      }
      return json({ ok: true, schema: officeSchema, pdfUrl: signed.signedUrl, officeValues: row.office_values ?? {}, completed, documentName: row.document_name, personName: row.person_name })
    }

    // ── complete ───────────────────────────────────────────────────────────────
    if (completed) return json({ error: `The office section was already completed${completedBy ? ` by ${completedBy}` : ''}; the PDF is final.`, code: 'already_completed' }, 409)
    const printedName = typeof body.office_signer_printed_name === 'string' ? body.office_signer_printed_name.trim().slice(0, 200) : ''
    if (!printedName) return json({ error: 'Type the name that signs for the office.' }, 400)
    const values: FormValues = body.officeValues && typeof body.officeValues === 'object' && !Array.isArray(body.officeValues) ? (body.officeValues as FormValues) : {}
    const known = new Set(officeSchema.boxes.map((b) => b.key))
    for (const k of Object.keys(values)) {
      const v = values[k]
      if (!known.has(k) || !(typeof v === 'string' || typeof v === 'boolean')) delete values[k]
    }
    const problems = validateFormValues(officeSchema, values)
    if (problems.length > 0) return json({ error: problems[0]!.message, code: 'form_invalid', problems }, 400)

    const { data: file, error: dlErr } = await admin.storage.from(FORM_PDFS_BUCKET).download(row.form_pdf_storage_path)
    if (dlErr || !file) {
      console.error('filed pdf download', dlErr)
      return json({ error: 'Could not load the filed PDF.' }, 500)
    }
    const todayLabel = formatYmdForContractEmail(todayYmdInAppTz()) ?? ''
    const plan = buildFillPlan(officeSchema, values, { todayLabel, signature: null, office: { signature: { mode: 'type', text: printedName }, todayLabel } })
    let bytes: Uint8Array
    try {
      const filled = await fillFormPdf(pdfLib as unknown as FormPdfLibLike, new Uint8Array(await file.arrayBuffer()), plan, { cursiveFontBytes: await loadCursiveFont(), fontkit })
      if (filled.skipped.length > 0) console.warn('office fill skipped', row.id, filled.skipped)
      bytes = filled.bytes
    } catch (e) {
      console.error('office fill failed', e)
      return json({ error: 'Could not fill the office section.' }, 500)
    }
    const { error: upErr } = await admin.storage.from(FORM_PDFS_BUCKET).upload(row.form_pdf_storage_path, bytes, { contentType: 'application/pdf', upsert: true })
    if (upErr) {
      console.error('office pdf upload', upErr)
      return json({ error: 'Could not file the completed form.' }, 500)
    }
    const split = splitFormValuesForStorage(officeSchema, values)
    const { error: updErr } = await admin
      .from('person_contract_documents')
      .update({ office_values: split.values, office_completed_at: new Date().toISOString(), office_completed_by_user_id: user.id, office_signer_printed_name: printedName })
      .eq('id', row.id)
    if (updErr) {
      console.error('office update', updErr)
      return json({ error: 'The PDF was completed but the record could not be updated.' }, 500)
    }
    return json({ ok: true })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
