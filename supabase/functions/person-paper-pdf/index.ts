/**
 * person-paper-pdf (punch list #376): open the PDF of a signed paper of plain words or clauses. A form's PDF opens
 * through `open-contract-form-pdf`, whose gate is its own; this is the door for a paper that had no PDF at all.
 *
 * The office presses Open the PDF on a signed paper's record. The caller must be one of the four roles that send a
 * paper, or an estimator on a paper with an outside company (Taunya's call of 2026-11-21, as #403's call 10 gives them
 * such a company's signed form), and must be able to read the row under its own policy. The database says which papers
 * are an outside company's: `estimator_reads_paper`, asked as the caller. A digital twin reads as an estimator and is
 * refused, and so is an estimator in training (punch list #403, the owner's second decision). A paper signed since
 * this shipped has its PDF already.
 * An older one gets it made here, the first time someone opens it, and kept beside the forms'. Nobody is emailed.
 * Answers a short-lived link that downloads under the paper's name.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import type { PdfLibLike } from '../_shared/jobContractPdf.ts'
import { paperMakesAPdf, paperPdfOpener, paperPdfRefusal, type PaperPdfCaller } from '../_shared/personPaperPdf.ts'
import { ensurePaperPdf, PAPER_PDF_BUCKET, paperPdfForWords, SIGNED_PAPER_COLUMNS, type SignedPaperRow } from '../_shared/personPaperSignedCopy.ts'

const LINK_SECONDS = 120

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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

    const body = (await req.json().catch(() => ({}))) as { person_contract_document_id?: unknown }
    const docId = typeof body.person_contract_document_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.person_contract_document_id) ? body.person_contract_document_id : null
    if (!docId) return json({ error: 'person_contract_document_id is required' }, 400)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const archivedRefusal = await refuseArchivedCaller(admin, user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal

    // Gate: the four roles that send a paper, or an estimator on a paper the database says is an outside company's.
    // The estimator's read policy follows the same function, so the gate and the policy cannot come apart.
    const { data: me } = await admin.from('users').select('role, is_digital_twin, read_only').eq('id', user.id).maybeSingle()
    const caller = me as PaperPdfCaller | null
    const facts: { estimatorReads?: boolean } = {}
    if (paperPdfOpener(caller) === 'estimator') {
      const { data: reads, error: readsErr } = await userClient.rpc('estimator_reads_paper', { p_paper_id: docId })
      if (readsErr) console.error('estimator_reads_paper', readsErr)
      facts.estimatorReads = reads === true
    }
    const refusal = paperPdfRefusal(caller, facts)
    if (refusal) return json({ error: refusal, code: 'forbidden' }, 403)

    // The caller must also be able to read the row: their own client, so the table's policy answers.
    const { data: seen, error: seenErr } = await userClient.from('person_contract_documents').select('id').eq('id', docId).maybeSingle()
    if (seenErr || !seen) return json({ error: 'Document not found or access denied' }, 404)

    const { data: raw, error: rowErr } = await admin.from('person_contract_documents').select(SIGNED_PAPER_COLUMNS).eq('id', docId).maybeSingle()
    if (rowErr || !raw) return json({ error: 'Document not found or access denied' }, 404)
    const row = raw as unknown as SignedPaperRow
    if (row.status !== 'signed') return json({ error: 'This paper is not signed yet, so it has no PDF.' }, 404)
    if (row.form_template_id) return json({ error: 'This paper is a form. Open its PDF from the form’s own press.' }, 400)
    if (!paperMakesAPdf(row)) return json({ error: 'This paper has no words of its own to print. Open its link instead.' }, 404)

    const pdf = await ensurePaperPdf(admin, pdfLib as unknown as PdfLibLike, row)
    if (!pdf) return json({ error: 'This paper has no PDF.' }, 404)

    const who = paperPdfForWords(row)
    const { data: signed, error: sErr } = await admin.storage.from(PAPER_PDF_BUCKET).createSignedUrl(pdf.path, LINK_SECONDS, {
      download: `${row.document_name}${who ? ` - ${who}` : ''} - signed.pdf`.replace(/[\\/:*?"<>|]+/g, ' '),
    })
    if (sErr || !signed?.signedUrl) {
      console.error('paper pdf url', sErr)
      return json({ error: 'Could not open the PDF right now.' }, 500)
    }
    return json({ ok: true, url: signed.signedUrl, made: pdf.bytes !== null })
  } catch (e) {
    console.error(e)
    return json({ error: 'The PDF could not be made right now.' }, 500)
  }
})
