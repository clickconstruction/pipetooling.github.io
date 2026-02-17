import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  template_type: string
  step_id: string
  recipient_email: string
  recipient_name: string
  recipient_user_id?: string
  push_title?: string
  push_body?: string
  push_url?: string
  variables?: Record<string, string>
}

function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value || '')
  }
  return result
}

async function sendEmailViaResend(
  to: string,
  subject: string,
  body: string,
  resendApiKey: string
): Promise<{ success: boolean; error?: string; email_id?: string }> {
  const htmlBody = body.replace(/\n/g, '<br>')

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'PipeTooling <team@noreply.pipetooling.com>',
      to: [to],
      subject,
      html: htmlBody,
      text: body,
    }),
  })

  if (!resendResponse.ok) {
    const errorData = await resendResponse.json().catch(() => ({}))
    return {
      success: false,
      error: errorData.message || `Failed to send email (${resendResponse.status})`,
    }
  }

  const resendData = await resendResponse.json()
  return {
    success: true,
    email_id: resendData.id,
  }
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

    // Extract JWT token
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

    // Verify user is authenticated
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

    // Parse request body
    const {
      template_type,
      step_id,
      recipient_email,
      recipient_name,
      recipient_user_id,
      push_title,
      push_body,
      push_url,
      variables = {},
    }: NotificationRequest = await req.json()

    if (!template_type || !step_id || !recipient_email || !recipient_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: template_type, step_id, recipient_email, recipient_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipient_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid recipient email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch email template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('template_type', template_type)
      .single()

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: `Email template not found for type: ${template_type}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Replace variables in subject and body
    const subject = replaceVariables(template.subject, variables)
    const body = replaceVariables(template.body, variables)

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          error: 'RESEND_API_KEY not configured. Set it via: supabase secrets set RESEND_API_KEY=your_key',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send email
    const result = await sendEmailViaResend(recipient_email, subject, body, resendApiKey)

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send Web Push if recipient_user_id provided and VAPID keys configured
    let pushSent = 0
    if (recipient_user_id) {
      const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
      if (vapidPublicKey && vapidPrivateKey) {
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (serviceRoleKey) {
          const adminClient = createClient(supabaseUrl, serviceRoleKey)
          const { data: subscriptions } = await adminClient
            .from('push_subscriptions')
            .select('endpoint, p256dh_key, auth_key')
            .eq('user_id', recipient_user_id)

          if (subscriptions && subscriptions.length > 0) {
            const pushPayload = JSON.stringify({
              title: push_title || subject,
              body: push_body || body.substring(0, 200),
              url: push_url || variables.workflow_link || '/',
              tag: `workflow-${step_id}`,
            })

            webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)

            for (const sub of subscriptions) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
                  },
                  pushPayload,
                  { TTL: 86400 }
                )
                pushSent++
              } catch (pushErr) {
                console.error('Push send error for subscription:', sub.endpoint?.substring(0, 50), pushErr)
                // If subscription is invalid (410 Gone), we could delete it - for now just log
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        email_id: result.email_id,
        push_sent: pushSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-workflow-notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
