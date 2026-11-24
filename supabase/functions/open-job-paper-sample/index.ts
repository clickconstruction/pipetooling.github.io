import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as pdfLib from 'https://esm.sh/pdf-lib@1.17.1'
import { clausePaperFor, isJobPaperNotReady, type ClauseAdmin } from '../_shared/clausePaper.ts'
import {
  buildJobPaperSamplePdf,
  JOB_PAPER_SAMPLE_MARK,
  SAMPLE_REFUSALS,
  samplePdfFacts,
  samplePdfFilename,
  samplePdfParagraphs,
  samplePdfStamp,
  sampleRefusal,
  type SamplePdfLib,
} from '../_shared/jobPaperSamplePdf.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { gcJobPapersFromSql } from '../_shared/portalJobPapers.ts'

/**
 * The sample a GC downloads (punch list #389, step 5): GET ?t=<portal token>&p=<required paper id> answers a PDF of
 * the paper for that job's settings, with a made-up job and signer and SAMPLE across each page.
 *
 * No auth: the portal link is the capability, resolved as `customer-portal` resolves it (the raw token, then its
 * sha256; revoked answers 404). The link must show the jobs its customer is the GC on, the paper must be one the
 * job requires now and built from settings, and the job's GC must be the link's customer. Anything else answers the
 * same words, so the door says nothing about a paper that is not theirs.
 *
 * The words are the database's own assembly for the job's picks (`job_paper_clauses`), the one a signer reads. The
 * level is read as the GC's page reads it (`job_papers_gc_page`). Nothing is written, stored or sent, and nobody is
 * told: the PDF is drawn and handed back.
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type PortalLinkRow = { customer_id: string; audience: string; revoked_at: string | null }
type RequiredPaperRow = { id: string; job_id: string; paper_name: string; removed_at: string | null; settings: unknown; settings_revision: number | null; book_document_id: string | null }

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function textResponse(message: string, status: number): Response {
  return new Response(message, { status, headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return textResponse('Method not allowed', 405)
  try {
    const url = new URL(req.url)
    const rawToken = url.searchParams.get('t')?.trim() ?? ''
    const paperId = url.searchParams.get('p')?.trim() ?? ''
    if (!rawToken || !paperId) return textResponse(SAMPLE_REFUSALS.missing, 400)
    // The sample statement's own tokens name no real job.
    if (rawToken.startsWith('sample') || !UUID.test(paperId)) return textResponse(SAMPLE_REFUSALS.none, 404)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let link: PortalLinkRow | null = null
    {
      const { data } = await admin.from('customer_portal_links').select('customer_id, audience, revoked_at').eq('token', rawToken).maybeSingle()
      link = (data as PortalLinkRow | null) ?? null
      if (!link) {
        const { data: byHash } = await admin.from('customer_portal_links').select('customer_id, audience, revoked_at').eq('token_hash', await sha256Hex(rawToken)).maybeSingle()
        link = (byHash as PortalLinkRow | null) ?? null
      }
    }
    if (!link || link.revoked_at) return textResponse(SAMPLE_REFUSALS.inactive, 404)

    const { data: rowData } = await admin.from('job_required_papers').select('id, job_id, paper_name, removed_at, settings, settings_revision, book_document_id').eq('id', paperId).maybeSingle()
    const row = (rowData as RequiredPaperRow | null) ?? null
    const { data: jobData } = row ? await admin.from('jobs_ledger').select('id, gc_customer_id').eq('id', row.job_id).maybeSingle() : { data: null }
    const job = (jobData as { id: string; gc_customer_id: string | null } | null) ?? null
    const refusal = sampleRefusal(link, row, job)
    if (refusal || !row || !job) return textResponse(refusal ?? SAMPLE_REFUSALS.none, 404)

    // The words a signer reads for this job's picks. The database refuses a paper that does not go together.
    let paper: Awaited<ReturnType<typeof clausePaperFor>> = null
    try {
      paper = await clausePaperFor(admin as unknown as ClauseAdmin, { applied_contract_template_document_id: row.book_document_id, company_id: null, form_template_id: null, job_required_paper_id: row.id }, 'en')
    } catch (e) {
      if (isJobPaperNotReady(e)) return textResponse(SAMPLE_REFUSALS.notReady, 409)
      throw e
    }
    const paragraphs = samplePdfParagraphs(paper)
    if (!paper || paragraphs.length === 0) return textResponse(SAMPLE_REFUSALS.notReady, 409)

    // The level, as their page says it. A read that fails leaves the stamp to say a mix: the words are still the paper's.
    let level: { label: string; alignedWith: string } | null = null
    {
      const { data: pageData, error: pageError } = await admin.rpc('job_papers_gc_page', { p_job_ids: [job.id] })
      if (pageError) console.error('open-job-paper-sample level', pageError.message)
      else level = gcJobPapersFromSql(pageData, [{ id: job.id, label: '' }])[0]?.papers.find((p) => p.id === row.id)?.level ?? null
    }

    const bytes = await buildJobPaperSamplePdf(pdfLib as unknown as SamplePdfLib, {
      title: row.paper_name,
      company: PORTAL_COMPANY.name,
      facts: samplePdfFacts(),
      paragraphs,
      stamp: samplePdfStamp(level, Math.max(1, row.settings_revision ?? 1)),
      mark: JOB_PAPER_SAMPLE_MARK,
    })
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${samplePdfFilename(row.paper_name).replace(/[^\x20-\x7E]/g, '')}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('open-job-paper-sample', e instanceof Error ? e.message : String(e))
    return textResponse(SAMPLE_REFUSALS.failed, 500)
  }
})
