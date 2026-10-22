import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { findAuthUserByEmail } from '../_shared/authUserByEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dev-login-secret',
}

interface DevLoginRequest {
  email: string
  redirectTo?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const secret = req.headers.get('X-Dev-Login-Secret')
    const expectedSecret = Deno.env.get('DEV_LOGIN_SECRET')
    if (!expectedSecret || secret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or missing dev login secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { email, redirectTo }: DevLoginRequest = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error: 'SUPABASE_SERVICE_ROLE_KEY not configured. Required for generating magic links.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Every page of accounts, not the first 50 alone (v2.5724): the 51st account would otherwise
    // hide any account past the page, and this would answer "User not found" for it.
    const found = await findAuthUserByEmail(
      (page, perPage) => adminClient.auth.admin.listUsers({ page, perPage }),
      email,
    )
    if (found.error) {
      return new Response(
        JSON.stringify({ error: `Failed to find user: ${found.error}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const user = found.user
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: email.trim(),
      options: {
        redirectTo: redirectTo || undefined,
      },
    })

    if (linkError || !linkData) {
      return new Response(
        JSON.stringify({ error: `Failed to generate magic link: ${linkError?.message || 'Unknown error'}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        action_link: linkData.properties.action_link,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in dev-login function:', error)
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
