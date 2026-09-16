/**
 * The room's "Download the PDF" door (Submittals stage 4a): GET ?t=<room or person
 * token>&r=<submittal id> → a five-minute signed link to the revision's stored package,
 * as a redirect (the open-test-report-pdf pattern). No auth: the token is the capability;
 * the revision must belong to the token's bid and have been shared. The bucket has no
 * outsider policy — this is the only customer-facing way to the file.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const BUCKET = 'bid-submittals'
const LINK_SECONDS = 300

function textResponse(message: string, status: number): Response {
  return new Response(message, { status, headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return textResponse('Method not allowed', 405)
  try {
    const url = new URL(req.url)
    const raw = url.searchParams.get('t')?.trim() ?? ''
    const revId = url.searchParams.get('r')?.trim() ?? ''
    if (!raw || !revId) return textResponse('Missing link details.', 400)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })

    let bidId: string | null = null
    {
      const { data: room } = await admin.from('bid_submittal_rooms').select('bid_id, status').eq('token', raw).maybeSingle()
      const r = room as { bid_id: string; status: string } | null
      if (r) bidId = r.bid_id
      else {
        const { data: p } = await admin.from('bid_submittal_people').select('room_id, closed_at').eq('token', raw).maybeSingle()
        const person = p as { room_id: string; closed_at: string | null } | null
        if (person && !person.closed_at) {
          const { data: r2 } = await admin.from('bid_submittal_rooms').select('bid_id').eq('id', person.room_id).maybeSingle()
          bidId = (r2 as { bid_id: string } | null)?.bid_id ?? null
        }
      }
    }
    if (!bidId) return textResponse('This link is no longer active. Please contact our office for a new one.', 404)

    const { data: rev } = await admin.from('bid_submittals').select('id, bid_id, rev_number, shared_at, package_path').eq('id', revId).maybeSingle()
    const s = rev as { id: string; bid_id: string; rev_number: number; shared_at: string | null; package_path: string | null } | null
    if (!s || s.bid_id !== bidId || !s.shared_at || !s.package_path) return textResponse('This package is not available.', 404)

    const { data: bid } = await admin.from('bids').select('bid_number, project_name').eq('id', bidId).maybeSingle()
    const b = bid as { bid_number: string | null; project_name: string | null } | null
    const download = `Submittal Rev ${s.rev_number} - ${[b?.bid_number ? `B${b.bid_number}` : '', b?.project_name ?? ''].filter(Boolean).join(' ')}.pdf`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
    const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(s.package_path, LINK_SECONDS, { download })
    if (error || !signed?.signedUrl) {
      console.error('submittal package signed url', error)
      return textResponse('Could not open the package right now. Please try again.', 500)
    }
    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: signed.signedUrl, 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('open-submittal-pdf', e)
    return textResponse('Something went wrong. Please try again.', 500)
  }
})
