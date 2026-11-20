/**
 * person-paper-pdf (punch list #376): open the PDF of a signed paper of plain words or clauses. A form's PDF opens
 * through `open-contract-form-pdf`, whose gate is its own; this is the door for a paper that had no PDF at all.
 *
 * The office presses Open the PDF on a signed paper's record. The caller must be one of the four roles that send a
 * paper, and must be able to read the row under its own policy. A paper signed since this shipped has its PDF already.
 * An older one gets it made here, the first time someone opens it, and kept beside the forms'. Nobody is emailed.
 * Answers a short-lived link that downloads under the paper's name.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import type { PdfLibLike } from '../_shared/jobContractPdf.ts'
import { paperMakesAPdf } from '../_shared/personPaperPdf.ts'
import { ensurePaperPdf, PAPER_PDF_BUCKET, paperPdfForWords, SIGNED_PAPER_COLUMNS, type SignedPaperRow } from '../_shared/personPaperSignedCopy.ts'

const LINK_SECONDS = 120
const ROLES = ['dev', 'master_technician', 'assistant', 'controller']

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

    // The four roles that send a paper. An estimator reads some outside companies' rows and opens no file here.
    const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = (me as { role?: string } | null)?.role ?? ''
    if (!ROLES.includes(role)) return json({ error: 'Only the office opens a signed paper’s PDF.', code: 'forbidden' }, 403)

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
