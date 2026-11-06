/**
 * hours-statement-signing (punch list #212, PR 3, v2.6411): the signed hours statement becomes a Contract Form.
 *
 *   prepare   { statement_id, how }
 *     → draws the statement from the row's snapshot with pdf-lib (`_shared/hoursStatementPdf.ts`), uploads it as the
 *       form's template (`contract-form-templates/hours-statements/<statement id>/statement.pdf`), writes or refreshes
 *       the statement's own `contract_form_templates` row (doc_type hours_statement, the schema recorded as drawn) and
 *       its `person_contract_documents` copy (unsent or sent, the office's stated days as the boxes' seed values), ties
 *       the statement to the copy (`contract_document_id`) and answers the copy's id with the worker's email and phone.
 *       The office then sends it through `send-contract-for-signature` (email, or `mode: 'link'` to text, copy or hand
 *       the phone over), the worker signs on `/contract/accept`, and `accept-contract` files the flattened PDF and marks
 *       the statement signed with the days the worker typed.
 *   file_scan { statement_id, scan { base64, mime, filename }, signed_on_ymd, signer_printed_name, attested: true, stated_days? }
 *     → the paper path: the worker signed the printed paper with a pen. The same template is drawn, the stated rows the
 *       office keys are filled into it with no signature drawn (the ink stays on the scan), the PDF and the scan are
 *       filed in `contract-form-pdfs` as `contract-form-paper-entry` files them, the copy is written signed with
 *       `form_source = 'paper'`, and the statement reads signed with those days.
 *
 * Gate: the caller must read the statement under their own RLS (`can_touch_hours_statement`: a dev or the controller
 * alone since v2.6450 — payroll data, Diane's call of 2026-11-02). A signed statement is never prepared or filed again.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
// @ts-expect-error esm.sh types fontkit with named exports only; the module it serves has just a default, the fontkit object.
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1'
import { buildFillPlan, splitFormValuesForStorage, type FormValues } from '../_shared/formSchema.ts'
import { fillFormPdf, type FormPdfLibLike } from '../_shared/fillFormPdf.ts'
import { formatYmdForContractEmail } from '../_shared/contractSigningEmail.ts'
import type { PdfLibLike } from '../_shared/jobContractPdf.ts'
import { buildHoursStatement, type HoursStatementInput, type HoursStatementStatedDay } from '../_shared/hoursStatement.ts'
import { buildHoursStatementPdf, HS_FORM_KEYS } from '../_shared/hoursStatementPdf.ts'
import {
  HOURS_STATEMENT_DOC_TYPE,
  hoursStatementDocumentName,
  hoursStatementDocumentNote,
  hoursStatementTemplatePath,
  parseStatedDayRows,
  statedByWords,
  statedSeedValues,
  type HoursStatementSendHow,
} from '../_shared/hoursStatementForm.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

const FORM_TEMPLATES_BUCKET = 'contract-form-templates'
const FORM_PDFS_BUCKET = 'contract-form-pdfs'
const MAX_SCAN_BYTES = 8 * 1024 * 1024
const SCAN_MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' }
const UUID_RE = /^[0-9a-f-]{36}$/i
const HOWS: ReadonlySet<string> = new Set(['email', 'text', 'link', 'in_person'])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function decodeBase64(raw: string): Uint8Array | null {
  try {
    const b64 = raw.replace(/^data:[^;]+;base64,/i, '')
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
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

type Snapshot = {
  input: HoursStatementInput
  worker: { name: string; standing: string; company?: string | null }
  job: { number: string; name: string; customer: string | null; site: string; isOfficeJob: boolean }
  approvedBy: string | null
  preparedBy: string
  preparedOn: string
  asOf: string
}
type StatementRow = {
  id: string
  record_id: string
  job_ledger_id: string
  person_id: string | null
  user_id: string
  with_pay: boolean
  stated_days: HoursStatementStatedDay[] | null
  snapshot: Snapshot | null
  contract_document_id: string | null
  state: string
}
type DocRow = { id: string; status: string; form_template_id: string | null }

/** The statement drawn from its snapshot with the stated days given, as the template PDF and its schema. */
async function drawStatement(row: StatementRow, statedDays: HoursStatementStatedDay[]) {
  const snap = row.snapshot as Snapshot
  const statement = buildHoursStatement({ ...snap.input, statedDays })
  return await buildHoursStatementPdf(pdfLib as unknown as PdfLibLike, {
    statement,
    recordId: row.record_id,
    worker: snap.worker,
    job: snap.job,
    approvedBy: snap.approvedBy,
    preparedBy: snap.preparedBy,
    preparedOn: snap.preparedOn,
    asOf: snap.asOf,
  })
}

/**
 * The statement's own form template and person copy, written or refreshed: the drawn PDF uploaded over the old one,
 * the template row's schema and hash brought up to it, the copy's name, seeds and note. Answers both ids. Refuses a
 * copy already signed.
 */
async function ensureTemplateAndCopy(
  admin: SupabaseClient,
  row: StatementRow,
  drawn: { bytes: Uint8Array; schema: unknown; pageCount: number },
  args: { userId: string; byName: string; how: HoursStatementSendHow; seedDays: HoursStatementStatedDay[] },
): Promise<{ templateId: string; docId: string; docStatus: string } | { error: string; status: number }> {
  const snap = row.snapshot as Snapshot
  const documentName = hoursStatementDocumentName(row.record_id)
  const note = hoursStatementDocumentNote({ recordId: row.record_id, jobNumber: snap.job.number, how: args.how, byName: args.byName })
  const templatePath = hoursStatementTemplatePath(row.id)
  const sha = await sha256Hex(drawn.bytes)
  const nowIso = new Date().toISOString()

  let existingDoc: DocRow | null = null
  if (row.contract_document_id) {
    const { data } = await admin.from('person_contract_documents').select('id, status, form_template_id').eq('id', row.contract_document_id).maybeSingle()
    existingDoc = (data as DocRow | null) ?? null
    if (existingDoc?.status === 'signed') return { error: 'This statement is already signed. Open the signed PDF instead.', status: 409 }
  }

  const { error: upErr } = await admin.storage.from(FORM_TEMPLATES_BUCKET).upload(templatePath, drawn.bytes, { contentType: 'application/pdf', upsert: true })
  if (upErr) {
    console.error('statement template upload', upErr)
    return { error: 'Could not store the statement’s PDF.', status: 500 }
  }

  let templateId = existingDoc?.form_template_id ?? null
  if (templateId) {
    const { error } = await admin.from('contract_form_templates').update({ name: documentName, revision_label: row.record_id, schema: drawn.schema, page_count: drawn.pageCount, pdf_sha256: sha, pdf_storage_path: templatePath, updated_at: nowIso }).eq('id', templateId)
    if (error) {
      console.error('statement template update', error)
      return { error: 'Could not update the statement’s form.', status: 500 }
    }
  } else {
    templateId = crypto.randomUUID()
    const { error } = await admin.from('contract_form_templates').insert({
      id: templateId,
      name: documentName,
      revision_label: row.record_id,
      doc_type: HOURS_STATEMENT_DOC_TYPE,
      pdf_storage_path: templatePath,
      pdf_sha256: sha,
      page_count: drawn.pageCount,
      schema: drawn.schema,
      status: 'published',
      published_at: nowIso,
      created_by: args.userId,
    })
    if (error) {
      console.error('statement template insert', error)
      return { error: 'Could not make the statement’s form.', status: 500 }
    }
  }

  const seeds: FormValues = statedSeedValues(args.seedDays)
  let docId = existingDoc?.id ?? null
  let docStatus = existingDoc?.status ?? 'unsent'
  if (docId) {
    const { error } = await admin.from('person_contract_documents').update({ document_name: documentName, person_name: snap.worker.name, person_id: row.person_id, form_template_id: templateId, form_values: seeds, note, updated_at: nowIso }).eq('id', docId)
    if (error) {
      console.error('statement copy update', error)
      return { error: 'Could not update the statement’s copy.', status: 500 }
    }
  } else {
    docId = crypto.randomUUID()
    docStatus = 'unsent'
    const { error } = await admin.from('person_contract_documents').insert({
      id: docId,
      person_name: snap.worker.name,
      person_id: row.person_id,
      document_name: documentName,
      doc_type: HOURS_STATEMENT_DOC_TYPE,
      status: 'unsent',
      signing_body_html: null,
      signing_body_format: 'plain',
      contract_lineage_id: crypto.randomUUID(),
      lineage_version: 1,
      form_template_id: templateId,
      form_values: seeds,
      note,
    })
    if (error) {
      console.error('statement copy insert', error)
      return { error: 'Could not make the statement’s copy.', status: 500 }
    }
  }
  if (row.contract_document_id !== docId) {
    const { error } = await admin.from('hours_statements').update({ contract_document_id: docId, updated_at: nowIso }).eq('id', row.id)
    if (error) {
      console.error('statement link', error)
      return { error: 'Could not tie the statement to its copy.', status: 500 }
    }
  }
  return { templateId, docId, docStatus }
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
    const archivedRefusal = await refuseArchivedCaller(admin, user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = body.action === 'prepare' ? 'prepare' : body.action === 'file_scan' ? 'file_scan' : null
    if (!action) return json({ error: 'action must be prepare or file_scan' }, 400)
    const statementId = typeof body.statement_id === 'string' && UUID_RE.test(body.statement_id) ? body.statement_id : null
    if (!statementId) return json({ error: 'statement_id is required' }, 400)

    // The gate is the row's own policy: whoever may read the statement may send it or file its paper.
    const { data: rowData, error: rowErr } = await userClient
      .from('hours_statements')
      .select('id, record_id, job_ledger_id, person_id, user_id, with_pay, stated_days, snapshot, contract_document_id, state')
      .eq('id', statementId)
      .maybeSingle()
    if (rowErr || !rowData) return json({ error: 'Statement not found or access denied' }, 404)
    const row = rowData as StatementRow
    if (row.state === 'signed') return json({ error: 'This statement is already signed. Open the signed PDF instead.', code: 'already_signed' }, 409)
    if (!row.snapshot?.input || !row.snapshot.job || !row.snapshot.worker) return json({ error: 'This statement kept no snapshot, so there is nothing to draw. Open it, Save, and try again.' }, 400)

    const { data: me } = await admin.from('users').select('name, read_only, is_digital_twin').eq('id', user.id).maybeSingle()
    const who = me as { name?: string | null; read_only?: boolean | null; is_digital_twin?: boolean | null } | null
    if (who?.read_only || who?.is_digital_twin) return json({ error: 'A training account or a twin cannot send a statement for signature.', code: 'read_only' }, 403)
    const byName = (who?.name ?? '').trim()
    const statedDays: HoursStatementStatedDay[] = Array.isArray(row.stated_days) ? row.stated_days : []

    if (action === 'prepare') {
      const how = typeof body.how === 'string' && HOWS.has(body.how) ? (body.how as HoursStatementSendHow) : 'email'
      const drawn = await drawStatement(row, statedDays)
      const made = await ensureTemplateAndCopy(admin, row, drawn, { userId: user.id, byName, how, seedDays: statedDays })
      if ('error' in made) return json({ error: made.error }, made.status)

      // The worker's contact for the channels: the roster row first, then the login.
      let email: string | null = null
      let phone: string | null = null
      if (row.person_id) {
        const { data: p } = await admin.from('people').select('email, phone').eq('id', row.person_id).maybeSingle()
        const pp = p as { email?: string | null; phone?: string | null } | null
        email = (pp?.email ?? '').trim() || null
        phone = (pp?.phone ?? '').trim() || null
      }
      if (!email || !phone) {
        const { data: u } = await admin.from('users').select('email, phone').eq('id', row.user_id).maybeSingle()
        const uu = u as { email?: string | null; phone?: string | null } | null
        email = email ?? ((uu?.email ?? '').trim() || null)
        phone = phone ?? ((uu?.phone ?? '').trim() || null)
      }
      return json({ ok: true, document_id: made.docId, document_status: made.docStatus, record_id: row.record_id, document_name: hoursStatementDocumentName(row.record_id), worker: { name: row.snapshot.worker.name, email, phone }, pages: drawn.pageCount })
    }

    // ── file_scan: the paper path ─────────────────────────────────────────────
    const printedName = typeof body.signer_printed_name === 'string' ? body.signer_printed_name.trim().slice(0, 200) : ''
    if (!printedName) return json({ error: 'Who signed the paper is required.' }, 400)
    const signedOn = typeof body.signed_on_ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.signed_on_ymd) ? body.signed_on_ymd : null
    if (!signedOn) return json({ error: 'The date on the paper is required (YYYY-MM-DD).' }, 400)
    if (body.attested !== true) return json({ error: 'Confirm the days were typed exactly as the worker wrote them.' }, 400)
    const scanIn = body.scan && typeof body.scan === 'object' ? (body.scan as { base64?: unknown; mime?: unknown; filename?: unknown }) : null
    if (!scanIn || typeof scanIn.base64 !== 'string' || scanIn.base64.length === 0) return json({ error: 'Attach the signed paper as a photo or a PDF.' }, 400)
    const scanMime = typeof scanIn.mime === 'string' ? scanIn.mime : ''
    const scanExt = SCAN_MIME_EXT[scanMime] ?? null
    if (!scanExt) return json({ error: 'The scan must be a JPG, PNG, WEBP, HEIC, or PDF.' }, 400)
    const scanBytes = decodeBase64(scanIn.base64)
    if (!scanBytes || scanBytes.length === 0) return json({ error: 'The scan could not be read.' }, 400)
    if (scanBytes.length > MAX_SCAN_BYTES) return json({ error: 'The scan is over 8 MB.' }, 400)
    const yearHint = Number(String(row.snapshot.input.periodStart ?? '').slice(0, 4)) || undefined
    const parsed = parseStatedDayRows(body.stated_days, statedByWords(printedName, signedOn), { yearHint })
    if ('error' in parsed) return json({ error: parsed.error }, 400)
    // The rows the office keys replace the office's own earlier rows: the paper is what the worker signed.
    const keyed: HoursStatementStatedDay[] = parsed.length > 0 ? parsed : statedDays

    const drawn = await drawStatement(row, keyed)
    const made = await ensureTemplateAndCopy(admin, row, drawn, { userId: user.id, byName, how: 'paper', seedDays: keyed })
    if ('error' in made) return json({ error: made.error }, made.status)

    const uploaded: string[] = []
    const fail = async (status: number, error: string) => {
      if (uploaded.length > 0) await admin.storage.from(FORM_PDFS_BUCKET).remove(uploaded)
      return json({ error }, status)
    }
    const values: FormValues = { ...statedSeedValues(keyed), [HS_FORM_KEYS.printedName]: printedName }
    const plan = buildFillPlan(drawn.schema, values, { todayLabel: formatYmdForContractEmail(signedOn) ?? signedOn, signature: null })
    let pdfPath: string
    try {
      const filled = await fillFormPdf(pdfLib as unknown as FormPdfLibLike, drawn.bytes, plan, { cursiveFontBytes: await loadCursiveFont(), fontkit, flatten: true })
      if (filled.skipped.length > 0) console.warn('statement paper fill skipped', made.docId, filled.skipped)
      pdfPath = `${made.docId}/signed.pdf`
      const { error: upErr } = await admin.storage.from(FORM_PDFS_BUCKET).upload(pdfPath, filled.bytes, { contentType: 'application/pdf', upsert: true })
      if (upErr) {
        console.error('statement paper pdf upload', upErr)
        return await fail(500, 'Could not file the statement’s PDF.')
      }
      uploaded.push(pdfPath)
    } catch (e) {
      console.error('statement paper fill failed', e)
      return await fail(500, 'Could not fill the statement.')
    }
    const scanPath = `${made.docId}/source.${scanExt}`
    const { error: scErr } = await admin.storage.from(FORM_PDFS_BUCKET).upload(scanPath, scanBytes, { contentType: scanMime, upsert: true })
    if (scErr) {
      console.error('statement scan upload', scErr)
      return await fail(500, 'Could not file the scan.')
    }
    uploaded.push(scanPath)

    const split = splitFormValuesForStorage(drawn.schema, values)
    const nowIso = new Date().toISOString()
    const { error: docErr } = await admin
      .from('person_contract_documents')
      .update({
        status: 'signed',
        signed_at: signedOn,
        signer_printed_name: printedName,
        signer_consented_at: null,
        signer_signature_storage_path: null,
        public_token_hash: null,
        public_token_expires_at: null,
        form_values: split.values,
        form_hints: split.hints,
        form_pdf_storage_path: pdfPath,
        form_scan_storage_path: scanPath,
        form_source: 'paper',
        form_keyed_by_user_id: user.id,
        updated_at: nowIso,
      })
      .eq('id', made.docId)
      .neq('status', 'signed')
    if (docErr) {
      console.error('statement paper copy update', docErr)
      return await fail(500, 'Could not file the signed copy.')
    }
    const { error: hsErr } = await admin.from('hours_statements').update({ state: 'signed', stated_days: keyed, contract_document_id: made.docId, updated_at: nowIso }).eq('id', row.id)
    if (hsErr) {
      console.error('statement signed update', hsErr)
      return json({ ok: true, document_id: made.docId, warning: 'The copy is filed, but the statement’s state did not update. Open it again.' })
    }
    return json({ ok: true, document_id: made.docId, stated_days: keyed.length })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
