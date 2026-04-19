import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'
import {
  anyStripeApiKeyConfigured,
  resolveStripeBillingMode,
  stripeApiKeyForMode,
  type StripeBillingMode,
} from '../_shared/stripeSecrets.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Body {
  job_id: string
  stripe_mode?: StripeBillingMode
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization' }, 401)
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }
    if (!anyStripeApiKeyConfigured()) {
      return jsonResponse({ error: 'Stripe not configured' }, 500)
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser(token)
    if (authErr || !user) {
      return jsonResponse({ error: 'Invalid session' }, 401)
    }

    const body = (await req.json()) as Body
    const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
    if (!jobId) {
      return jsonResponse({ error: 'job_id required' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: roleRow } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
    const role = (roleRow as { role?: string } | null)?.role

    const { data: flow } = await admin
      .from('job_collect_payment_flows')
      .select('id, status, job_id')
      .eq('job_id', jobId)
      .maybeSingle()

    if (role === 'subcontractor') {
      if (!flow || flow.status !== 'approved_for_terminal') {
        return jsonResponse({ error: 'Collect payment not approved for this job' }, 403)
      }
      const { data: team } = await admin
        .from('jobs_ledger_team_members')
        .select('job_id')
        .eq('job_id', jobId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!team) {
        return jsonResponse({ error: 'Forbidden' }, 403)
      }
    } else if (role === 'dev' || role === 'master_technician' || role === 'assistant') {
      // staff may request token when testing; still require an active flow on the job
      if (!flow || flow.status !== 'approved_for_terminal') {
        return jsonResponse({ error: 'No approved collect payment flow for this job' }, 403)
      }
    } else {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const stripeMode = resolveStripeBillingMode(body.stripe_mode)
    const stripeSecret = stripeApiKeyForMode(stripeMode)
    if (!stripeSecret) {
      return jsonResponse({ error: `Stripe ${stripeMode} mode not configured` }, 500)
    }
    const stripe = new Stripe(stripeSecret, { apiVersion: '2024-06-20' })
    const ct = await stripe.terminal.connectionTokens.create()
    return jsonResponse({ secret: ct.secret, stripe_mode: stripeMode })
  } catch (e) {
    console.error('[terminal-connection-token]', e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Unexpected error' },
      500,
    )
  }
})
