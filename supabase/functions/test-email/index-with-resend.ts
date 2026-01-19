// Alternative version using Resend email service
// To use this version:
// 1. Get API key from https://resend.com
// 2. Set secret: supabase secrets set RESEND_API_KEY=your_key
// 3. Replace index.ts with this file

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData || userData.role !== 'dev') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only owners can send test emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { to, subject, body, template_type } = await req.json()

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured. Set it via: supabase secrets set RESEND_API_KEY=your_key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert body to HTML (simple conversion)
    const htmlBody = body.replace(/\n/g, '<br>')

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pipetooling <onboarding@resend.dev>', // Change to your verified domain
        to: [to],
        subject,
        html: htmlBody,
        text: body,
      }),
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json()
      throw new Error(errorData.message || 'Failed to send email via Resend')
    }

    const resendData = await resendResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test email sent successfully',
        email_id: resendData.id,
        email_preview: { to, subject, body, template_type },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in test-email function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
