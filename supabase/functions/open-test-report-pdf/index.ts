import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * The portal's "View report" door (v2.3304): GET ?t=<portal token>&r=<report id>
 * → a five-minute signed link to the stored test-report PDF, as a redirect.
 * No auth: the portal link IS the capability, exactly as customer-portal
 * resolves it (raw token, then the v1 sha256 hash; revoked → 404). The report
 * must be SENT and belong to a job the link's company pays for (owner or GC,
 * per the link's audience). The bucket has no client policies — this is the
 * only customer-facing way to the file. Same LINK_SECONDS as the signed
 * contract copies (open-contract-form-pdf).
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const BUCKET = 'job-test-reports'
const LINK_SECONDS = 300
const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact our office for a new one.'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function textResponse(message: string, status: number): Response {
  return new Response(message, { status, headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return textResponse('Method not allowed', 405)
  try {
    const url = new URL(req.url)
    const rawToken = url.searchParams.get('t')?.trim() ?? ''
    const reportId = url.searchParams.get('r')?.trim() ?? ''
    if (!rawToken || !reportId) return textResponse('Missing link details.', 400)
    if (rawToken.startsWith('sample')) return textResponse('This is a sample statement — sample reports have no file.', 404)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    let link: { customer_id: string; audience: string; revoked_at: string | null } | null = null
    {
      const { data } = await admin.from('customer_portal_links').select('customer_id, audience, revoked_at').eq('token', rawToken).maybeSingle()
      link = (data as typeof link) ?? null
      if (!link) {
        const tokenHash = await sha256Hex(rawToken)
        const { data: byHash } = await admin.from('customer_portal_links').select('customer_id, audience, revoked_at').eq('token_hash', tokenHash).maybeSingle()
        link = (byHash as typeof link) ?? null
      }
    }
    if (!link || link.revoked_at) return textResponse(LINK_INACTIVE_MSG, 404)

    const { data: rep } = await admin
      .from('job_test_reports')
      .select('id, job_id, status, pdf_path, test_type, system, test_date')
      .eq('id', reportId)
      .maybeSingle()
    const r = rep as { id: string; job_id: string; status: string; pdf_path: string | null; test_type: string; system: string | null; test_date: string } | null
    if (!r || r.status !== 'sent' || !r.pdf_path) return textResponse('This report is not available.', 404)

    const { data: job } = await admin.from('jobs_ledger').select('id, customer_id, gc_customer_id, job_address').eq('id', r.job_id).maybeSingle()
    const j = job as { id: string; customer_id: string | null; gc_customer_id: string | null; job_address: string | null } | null
    if (!j) return textResponse('This report is not available.', 404)
    const isOwner = j.customer_id === link.customer_id
    const isGc = j.gc_customer_id === link.customer_id
    const allowed = link.audience === 'gc' ? isGc : link.audience === 'customer' ? isOwner : isOwner || isGc
    if (!allowed) return textResponse('This report is not available.', 404)

    const street = (j.job_address ?? '').split('\n')[0]?.split(',')[0]?.trim() ?? ''
    const kind = r.test_type === 'gas' ? 'Gas Test' : r.test_type === 'pinpoint' ? 'Pinpoint Test' : `${r.system === 'supply' ? 'Supply' : 'Sewer'} ${r.test_type === 'post_test' ? 'Post-Test' : 'Pre-Test'} Hydrostatic`
    const download = `${kind} Report${street ? ` - ${street}` : ''}${r.test_date ? ` - ${r.test_date}` : ''}.pdf`.replace(/[\\/:*?"<>|]+/g, ' ')
    const { data: signed, error: sErr } = await admin.storage.from(BUCKET).createSignedUrl(r.pdf_path, LINK_SECONDS, { download })
    if (sErr || !signed?.signedUrl) {
      console.error('test report signed url', sErr)
      return textResponse('Could not open the report right now. Please try again.', 500)
    }
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: signed.signedUrl, 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('open-test-report-pdf', e)
    return textResponse('Something went wrong. Please try again.', 500)
  }
})
