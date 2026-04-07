import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  ESTIMATE_EXPERIENCE_APP_KEY_LIST,
  parseEstimateCustomerExperienceSnapshot,
  resolveEstimateCustomerExperience,
  toClientCustomerExperience,
} from '../_shared/estimateCustomerExperience.ts'
import { clientIpFromRequest } from '../_shared/logEstimateCustomerEvent.ts'
import { parseCustomerAttachmentSent } from '../_shared/estimateCustomerAttachment.ts'

async function sha256HexFromString(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EstRow = {
  id: string
  title: string
  line_items_snapshot: unknown
  terms_snapshot: string
  total_cents: number
  valid_until: string | null
  status: string
  public_token_expires_at: string | null
  sent_at: string | null
  estimate_number: number
  customer_experience_sent: unknown
  customer_experience_overrides: unknown
  for_address: string | null
  customer_id: string | null
  accept_header_brand: string | null
  customer_attachment_sent: unknown
}

async function resolveEstimateForLine(
  admin: SupabaseClient,
  forAddress: string | null,
  customerId: string | null,
): Promise<string | null> {
  const override = String(forAddress ?? '').trim()
  if (override) return override
  if (!customerId) return null
  const { data: cust, error } = await admin.from('customers').select('address').eq('id', customerId).maybeSingle()
  if (error || !cust) return null
  const addr = String((cust as { address?: string | null }).address ?? '').trim()
  return addr || null
}

function buildCustomerExperienceForClient(row: EstRow, appRows: { key: string; value_text: string | null }[]) {
  const snap = parseEstimateCustomerExperienceSnapshot(row.customer_experience_sent)
  if (snap) return toClientCustomerExperience(snap)
  const resolved = resolveEstimateCustomerExperience(appRows, row.customer_experience_overrides, {
    acceptUrl: '',
    title: String(row.title ?? ''),
    estimateNumber: Number(row.estimate_number ?? 0),
  })
  return toClientCustomerExperience(resolved)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const url = new URL(req.url)
    const raw = url.searchParams.get('token')?.trim()
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const tokenHash = await sha256HexFromString(raw)

    const { data: row, error } = await admin
      .from('estimates')
      .select(
        'id, title, line_items_snapshot, terms_snapshot, total_cents, valid_until, status, public_token_expires_at, sent_at, estimate_number, customer_experience_sent, customer_experience_overrides, for_address, customer_id, accept_header_brand, customer_attachment_sent',
      )
      .eq('public_token_hash', tokenHash)
      .maybeSingle()

    if (error || !row) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const est = row as EstRow

    const { data: appRows } = await admin
      .from('app_settings')
      .select('key, value_text')
      .in('key', ESTIMATE_EXPERIENCE_APP_KEY_LIST)
    const appSettingsRows = appRows ?? []

    if (est.status === 'customer_accepted') {
      const customer_experience = buildCustomerExperienceForClient(est, appSettingsRows)
      const ab = est.accept_header_brand
      const accept_header_brand = ab === 'elec' || ab === 'plum' ? ab : null
      return new Response(
        JSON.stringify({
          error: 'Already accepted',
          code: 'already_accepted',
          customer_experience,
          accept_header_brand,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (est.status !== 'sent') {
      return new Response(JSON.stringify({ error: 'Not available' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const exp = est.public_token_expires_at ? Date.parse(String(est.public_token_expires_at)) : NaN
    if (!Number.isNaN(exp) && exp < Date.now()) {
      return new Response(JSON.stringify({ error: 'Link expired', code: 'expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (est.valid_until) {
      const vu = new Date(String(est.valid_until) + 'T23:59:59.999Z').getTime()
      if (vu < Date.now()) {
        return new Response(JSON.stringify({ error: 'Estimate expired', code: 'expired' }), {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const customer_experience = buildCustomerExperienceForClient(est, appSettingsRows)
    const for_line = await resolveEstimateForLine(admin, est.for_address, est.customer_id)
    const ab = est.accept_header_brand
    const accept_header_brand = ab === 'elec' || ab === 'plum' ? ab : null
    const customer_attachment = parseCustomerAttachmentSent(est.customer_attachment_sent)

    const { error: viewErr } = await admin.rpc('record_estimate_public_link_view', {
      p_estimate_id: est.id,
      p_client_ip: clientIpFromRequest(req) ?? '',
      p_user_agent: req.headers.get('user-agent') ?? '',
    })
    if (viewErr) console.error('record_estimate_public_link_view', viewErr)

    return new Response(
      JSON.stringify({
        id: est.id,
        title: est.title,
        line_items_snapshot: est.line_items_snapshot,
        terms_snapshot: est.terms_snapshot,
        total_cents: est.total_cents,
        valid_until: est.valid_until,
        for_line,
        customer_experience,
        accept_header_brand,
        customer_attachment,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
