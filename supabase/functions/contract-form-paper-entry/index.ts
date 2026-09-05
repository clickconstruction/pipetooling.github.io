/**
 * contract-form-paper-entry (Contract Forms PR 6): "Enter from paper".
 *
 * A staff member keys a sub's handwritten form into the same boxes the sub
 * would have filled on the signing page, attaches the scan, and files it as
 * signed on paper. Two actions:
 *
 *   prepare { book_entry_id }
 *     → { schema, templateUrl (15-min signed URL), documentName, docType, revisionLabel }
 *   file    { book_entry_id, person_name, person_id?, formValues, signer_printed_name,
 *             signed_on_ymd, attested: true, skip_boxes, scan? { base64, mime, filename } }
 *     → fills + flattens the template from the keyed answers (no signature is
 *       drawn — it stays on the scan), files the PDF and the scan in the
 *       private contract-form-pdfs bucket, inserts the signed person copy with
 *       form_source = 'paper' and who keyed it. Missing required boxes never
 *       block (the record lists them).
 *
 * Gate: the contracts roles that may insert person copies — dev, master,
 * assistant, controller (mirrors the person_contract_documents policies).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1'
import { buildFillPlan, hasOfficeBoxes, schemaForParty, splitFormValuesForStorage, type FormSchema, type FormValues } from '../_shared/formSchema.ts'
import { fillFormPdf, type FormPdfLibLike } from '../_shared/fillFormPdf.ts'
import { formatYmdForContractEmail } from '../_shared/contractSigningEmail.ts'

const FORM_TEMPLATES_BUCKET = 'contract-form-templates'
const FORM_PDFS_BUCKET = 'contract-form-pdfs'
const TEMPLATE_LINK_SECONDS = 900
const MAX_SCAN_BYTES = 8 * 1024 * 1024
const SCAN_MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf' }
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

type BookEntry = { id: string; document_name: string; form_template_id: string | null; audience: string | null }
type Template = { id: string; schema: FormSchema; pdf_storage_path: string; revision_label: string; doc_type: string; status: string }

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
    if (!ALLOWED_ROLES.has(role)) return json({ error: 'Only office staff can enter a form from paper.', code: 'forbidden' }, 403)

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = body.action === 'prepare' ? 'prepare' : body.action === 'file' ? 'file' : null
    if (!action) return json({ error: 'action must be prepare or file' }, 400)
    const bookEntryId = typeof body.book_entry_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.book_entry_id) ? body.book_entry_id : null
    if (!bookEntryId) return json({ error: 'book_entry_id is required' }, 400)

    const { data: entryRow } = await admin.from('contract_template_documents').select('id, document_name, form_template_id, audience').eq('id', bookEntryId).maybeSingle()
    const entry = entryRow as BookEntry | null
    if (!entry?.form_template_id) return json({ error: 'That Contract Book entry is not a form.' }, 404)
    const { data: tplRow } = await admin.from('contract_form_templates').select('id, schema, pdf_storage_path, revision_label, doc_type, status').eq('id', entry.form_template_id).maybeSingle()
    const tpl = tplRow as Template | null
    if (!tpl?.schema) return json({ error: 'The form template is missing.' }, 404)

    if (action === 'prepare') {
      const { data: signed, error: sErr } = await admin.storage.from(FORM_TEMPLATES_BUCKET).createSignedUrl(tpl.pdf_storage_path, TEMPLATE_LINK_SECONDS)
      if (sErr || !signed?.signedUrl) {
        console.error('template url', sErr)
        return json({ error: 'Could not load the form.' }, 500)
      }
      return json({ ok: true, schema: tpl.schema, templateUrl: signed.signedUrl, documentName: entry.document_name, docType: tpl.doc_type, revisionLabel: tpl.revision_label })
    }

    // ── file ─────────────────────────────────────────────────────────────────
    const personName = typeof body.person_name === 'string' ? body.person_name.trim() : ''
    if (!personName) return json({ error: 'person_name is required' }, 400)
    const personId = typeof body.person_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.person_id) ? body.person_id : null
    const printedName = typeof body.signer_printed_name === 'string' ? body.signer_printed_name.trim().slice(0, 200) : ''
    if (!printedName) return json({ error: 'Who signed the paper is required.' }, 400)
    const signedOn = typeof body.signed_on_ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.signed_on_ymd) ? body.signed_on_ymd : null
    if (!signedOn) return json({ error: 'The date on the paper is required (YYYY-MM-DD).' }, 400)
    if (body.attested !== true) return json({ error: 'Confirm the answers were typed exactly as written.' }, 400)
    const skipBoxes = body.skip_boxes === true
    const values: FormValues = !skipBoxes && body.formValues && typeof body.formValues === 'object' && !Array.isArray(body.formValues) ? (body.formValues as FormValues) : {}
    // The paper carries the signer's half; the office's half is completed from the record (PR 7).
    const signerSchema = schemaForParty(tpl.schema, 'signer')
    const twoParty = hasOfficeBoxes(tpl.schema)
    // Only keys the signer's schema knows, only strings / booleans.
    const known = new Set(signerSchema.boxes.map((b) => b.key))
    for (const k of Object.keys(values)) {
      const v = values[k]
      if (!known.has(k) || !(typeof v === 'string' || typeof v === 'boolean')) delete values[k]
    }

    const scanIn = body.scan && typeof body.scan === 'object' ? (body.scan as { base64?: unknown; mime?: unknown; filename?: unknown }) : null
    let scanBytes: Uint8Array | null = null
    let scanExt: string | null = null
    let scanMime: string | null = null
    if (scanIn && typeof scanIn.base64 === 'string' && scanIn.base64.length > 0) {
      scanMime = typeof scanIn.mime === 'string' ? scanIn.mime : ''
      scanExt = SCAN_MIME_EXT[scanMime] ?? null
      if (!scanExt) return json({ error: 'The scan must be a JPG, PNG, WEBP, HEIC, or PDF.' }, 400)
      scanBytes = decodeBase64(scanIn.base64)
      if (!scanBytes || scanBytes.length === 0) return json({ error: 'The scan could not be read.' }, 400)
      if (scanBytes.length > MAX_SCAN_BYTES) return json({ error: 'The scan is over 8 MB.' }, 400)
    }
    if (skipBoxes && !scanBytes) return json({ error: 'Attach the scan when skipping the boxes.' }, 400)
    if (!skipBoxes && Object.keys(values).length === 0 && !scanBytes) return json({ error: 'Nothing to file: type at least one answer or attach the scan.' }, 400)

    const docId = crypto.randomUUID()
    const uploaded: string[] = []
    const fail = async (status: number, error: string) => {
      if (uploaded.length > 0) await admin.storage.from(FORM_PDFS_BUCKET).remove(uploaded)
      return json({ error }, status)
    }

    // The filled, flattened PDF from the keyed answers (no signature drawn: it is on the scan).
    let pdfPath: string | null = null
    if (!skipBoxes) {
      const { data: file, error: dlErr } = await admin.storage.from(FORM_TEMPLATES_BUCKET).download(tpl.pdf_storage_path)
      if (dlErr || !file) {
        console.error('template download', dlErr)
        return await fail(500, 'Could not load the form.')
      }
      const plan = buildFillPlan(signerSchema, values, { todayLabel: formatYmdForContractEmail(signedOn) ?? signedOn, signature: null })
      try {
        const filled = await fillFormPdf(pdfLib as unknown as FormPdfLibLike, new Uint8Array(await file.arrayBuffer()), plan, { cursiveFontBytes: await loadCursiveFont(), fontkit, flatten: !twoParty, readOnlyFilled: twoParty })
        if (filled.skipped.length > 0) console.warn('paper entry skipped binds', docId, filled.skipped)
        pdfPath = `${docId}/signed.pdf`
        const { error: upErr } = await admin.storage.from(FORM_PDFS_BUCKET).upload(pdfPath, filled.bytes, { contentType: 'application/pdf', upsert: true })
        if (upErr) {
          console.error('paper pdf upload', upErr)
          return await fail(500, 'Could not file the form PDF.')
        }
        uploaded.push(pdfPath)
      } catch (e) {
        console.error('paper fill failed', e)
        return await fail(500, 'Could not fill the form.')
      }
    }

    let scanPath: string | null = null
    if (scanBytes && scanExt) {
      scanPath = `${docId}/source.${scanExt}`
      const { error: scErr } = await admin.storage.from(FORM_PDFS_BUCKET).upload(scanPath, scanBytes, { contentType: scanMime ?? 'application/octet-stream', upsert: true })
      if (scErr) {
        console.error('scan upload', scErr)
        return await fail(500, 'Could not file the scan.')
      }
      uploaded.push(scanPath)
    }

    const split = splitFormValuesForStorage(signerSchema, values)
    const { data: inserted, error: insErr } = await admin
      .from('person_contract_documents')
      .insert({
        id: docId,
        person_name: personName,
        person_id: personId,
        document_name: entry.document_name,
        status: 'signed',
        signed_at: signedOn,
        signer_printed_name: printedName,
        signer_consented_at: null,
        signing_body_html: null,
        signing_body_format: 'plain',
        applied_contract_template_document_id: entry.id,
        contract_lineage_id: crypto.randomUUID(),
        lineage_version: 1,
        form_template_id: tpl.id,
        form_values: split.values,
        form_hints: split.hints,
        form_pdf_storage_path: pdfPath,
        form_scan_storage_path: scanPath,
        form_source: 'paper',
        form_keyed_by_user_id: user.id,
        note: skipBoxes ? 'Entered from paper: scan filed without keying the boxes.' : null,
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      console.error('paper entry insert', insErr)
      return await fail(500, 'Could not save the document.')
    }

    return json({ ok: true, id: docId, filed_pdf: Boolean(pdfPath), filed_scan: Boolean(scanPath) })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
