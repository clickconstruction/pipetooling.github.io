// send-workflow-notification: a workflow step's or a work order's email, with a push when the recipient is a user.
// A person's hours (punch list #141 PR 5, v2.6217): the push goes through _shared/pushHoursSend.ts, which holds it for
// a person outside their Push me hours, writing the row as `held` and sending nothing; the email goes now as before.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { sendPushHonouringHours } from '../_shared/pushHoursSend.ts'
import { webPushSender } from '../_shared/webPushSend.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  template_type: string
  /** One anchor is required: a workflow step, or (v2.2786) a Sub Labor sheet for sheet work orders. */
  step_id?: string
  labor_job_id?: string
  /** v2.2819: a job-anchored work order (step_commitments.id) — no step, no sheet yet. */
  work_order_id?: string
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
      from: EMAIL_FROM,
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
  await logEmailSendBestEffort({ resendEmailId: resendData.id ?? null, to: [to], from: EMAIL_FROM, subject })
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
      labor_job_id,
      work_order_id,
      recipient_email,
      recipient_name,
      recipient_user_id,
      push_title,
      push_body,
      push_url,
      variables = {},
    }: NotificationRequest = await req.json()

    if (!template_type || (!step_id && !labor_job_id && !work_order_id) || !recipient_email || !recipient_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: template_type, one of step_id / labor_job_id / work_order_id, recipient_email, recipient_name' }),
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

    // Web Push when the recipient is a user, through their hours (#141 PR 5); the record of the email, and the push
    // beside it, is written here, and a held push has the helper's held row.
    let pushSent = 0
    let held = 0
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const adminClient = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null

    if (recipient_user_id && adminClient) {
      let workflowId: string | null = null
      let projectId: string | null = null
      if (step_id) {
        const { data: stepRow } = await adminClient
          .from('project_workflow_steps')
          .select('workflow_id')
          .eq('id', step_id)
          .single()
        if (stepRow?.workflow_id) {
          workflowId = stepRow.workflow_id
          const { data: wfRow } = await adminClient
            .from('project_workflows')
            .select('project_id')
            .eq('id', stepRow.workflow_id)
            .single()
          if (wfRow?.project_id) projectId = wfRow.project_id
        }
      }
      const anchors = { step_id: step_id ?? null, workflow_id: workflowId, project_id: projectId }

      const pushed = await sendPushHonouringHours(
        adminClient,
        {
          userIds: [recipient_user_id],
          title: push_title || subject,
          body: push_body || body.substring(0, 200),
          url: push_url || variables.workflow_link || '/',
          tag: `workflow-${step_id ?? labor_job_id ?? work_order_id}`,
          templateType: template_type,
          extra: anchors,
        },
        webPushSender(adminClient, 'send-workflow-notification'),
        { record: 'none' },
      )
      pushSent = pushed.devices
      held = pushed.held.length

      // The email went either way; the row says whether the push went beside it.
      const channel = pushSent > 0 ? 'both' : 'email'
      await adminClient.from('notification_history').insert({
        recipient_user_id,
        template_type,
        title: subject,
        body_preview: body.substring(0, 200),
        channel,
        ...anchors,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent successfully',
        email_id: result.email_id,
        push_sent: pushSent,
        held,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-workflow-notification function:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
