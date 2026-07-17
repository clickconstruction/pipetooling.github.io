import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClaimDevRequest {
  code: string
}

/** Constant-time string comparison to avoid timing attacks */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authorization format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !authUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or expired session. Please sign out and sign in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const promotionCode = Deno.env.get('DEV_PROMOTION_CODE')
    if (!promotionCode) {
      return new Response(
        JSON.stringify({ error: 'DEV_PROMOTION_CODE not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { code }: ClaimDevRequest = await req.json()

    // The code check stays here (this is where the secret lives); the RPC is told only the boolean.
    // We do NOT return early on a bad code — every attempt, good or bad, must reach the audit trail.
    const codeOk = !!code && typeof code === 'string' && secureCompare(code.trim(), promotionCode)

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Break-glass only. claim_dev_attempt() enforces the gate (no usable dev exists; caller not
    // read_only/archived), performs the promotion, and audits EVERY branch to claim_dev_attempts.
    // It is REVOKEd from authenticated and granted only to service_role, so this is its sole caller.
    const { data: result, error: rpcError } = await adminClient.rpc('claim_dev_attempt', {
      p_user_id: authUser.id,
      p_code_ok: codeOk,
    })

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: `Failed to update role: ${rpcError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deliberately opaque: a *correct* code refused because a dev already exists must look identical to
    // a wrong code, or the response becomes an oracle confirming the secret is valid. The real reason is
    // in claim_dev_attempts, which only devs can read.
    const granted = (result as { ok?: boolean } | null)?.ok === true

    return new Response(
      JSON.stringify({ success: granted }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in claim-dev function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
