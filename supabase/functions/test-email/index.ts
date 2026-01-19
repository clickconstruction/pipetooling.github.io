import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract JWT token from Authorization header
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authorization format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify user is authenticated and is a dev
    // Pass the token explicitly to getUser
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is dev
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData || userData.role !== 'dev') {
      return new Response(
        JSON.stringify({ error: 'Forbidden - Only devs can send test emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { to, subject, body, template_type } = await req.json()

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
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
        JSON.stringify({ 
          error: 'RESEND_API_KEY not configured. Set it via: supabase secrets set RESEND_API_KEY=your_key' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert body to HTML (simple conversion - preserve line breaks)
    const htmlBody = body.replace(/\n/g, '<br>')

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pipetooling <team@noreply.pipetooling.com>',
        to: [to],
        subject,
        html: htmlBody,
        text: body,
      }),
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({}))
      console.error('Resend API error:', {
        status: resendResponse.status,
        statusText: resendResponse.statusText,
        error: errorData,
      })
      
      // Provide more helpful error messages
      let errorMessage = `Failed to send email via Resend (${resendResponse.status})`
      if (errorData.message) {
        errorMessage = errorData.message
      } else if (errorData.error) {
        errorMessage = errorData.error
      } else if (resendResponse.status === 403) {
        errorMessage = 'Resend API key is invalid or domain is not verified. Check your Resend dashboard.'
      } else if (resendResponse.status === 422) {
        errorMessage = 'Invalid email format or domain not verified. Verify your domain in Resend dashboard.'
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: errorData,
          status: resendResponse.status,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resendData = await resendResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test email sent successfully via Resend',
        email_id: resendData.id,
        email_preview: {
          to,
          subject,
          body,
          template_type,
        },
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
