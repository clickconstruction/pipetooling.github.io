import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReportNotificationRequest {
  report_id: string
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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { report_id }: ReportNotificationRequest = await req.json()

    if (!report_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: report_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Fetch report
    const { data: reportRow, error: reportErr } = await adminClient
      .from('reports')
      .select('id, template_id, created_by_user_id, job_ledger_id, project_id')
      .eq('id', report_id)
      .single()

    if (reportErr || !reportRow) {
      return new Response(
        JSON.stringify({ error: 'Report not found', details: reportErr?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch template name
    const { data: templateRow } = await adminClient
      .from('report_templates')
      .select('name')
      .eq('id', reportRow.template_id)
      .single()
    const templateName = (templateRow as { name: string } | null)?.name ?? 'Report'

    // Fetch creator name
    const { data: creatorRow } = await adminClient
      .from('users')
      .select('name')
      .eq('id', reportRow.created_by_user_id)
      .single()
    const creatorName = (creatorRow as { name: string | null } | null)?.name ?? 'Someone'

    // Fetch job display
    let jobDisplay = 'Unknown job'
    if (reportRow.job_ledger_id) {
      const { data: jl } = await adminClient
        .from('jobs_ledger')
        .select('job_name')
        .eq('id', reportRow.job_ledger_id)
        .single()
      jobDisplay = (jl as { job_name: string | null } | null)?.job_name ?? jobDisplay
    } else if (reportRow.project_id) {
      const { data: proj } = await adminClient
        .from('projects')
        .select('name')
        .eq('id', reportRow.project_id)
        .single()
      jobDisplay = (proj as { name: string | null } | null)?.name ?? jobDisplay
    }

    const pushTitle = `New ${templateName}`
    const pushBody = `${creatorName} submitted a ${templateName} for ${jobDisplay}`
    const pushUrl = '/jobs?tab=reports'
    const tag = `report-${report_id}`

    // Get recipients who opted in for this template (exclude submitter)
    const { data: prefs } = await adminClient
      .from('user_report_notification_preferences')
      .select('user_id')
      .eq('template_id', reportRow.template_id)
      .neq('user_id', reportRow.created_by_user_id)

    const recipientIds = (prefs ?? []).map((p) => p.user_id as string)
    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No recipients', push_sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pushPayload = JSON.stringify({
      title: pushTitle,
      body: pushBody,
      url: pushUrl,
      tag,
    } as { title: string; body: string; url: string; tag: string })

    webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)

    let totalPushSent = 0

    for (const recipientUserId of recipientIds) {
      const { data: subscriptions } = await adminClient
        .from('push_subscriptions')
        .select('endpoint, p256dh_key, auth_key')
        .eq('user_id', recipientUserId)

      if (!subscriptions || subscriptions.length === 0) continue

      let sentForUser = 0
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
          sentForUser++
          totalPushSent++
        } catch (pushErr) {
          console.error('Push send error for subscription:', sub.endpoint?.substring(0, 50), pushErr)
        }
      }

      if (sentForUser > 0) {
        try {
          await adminClient.from('notification_history').insert({
            recipient_user_id: recipientUserId,
            template_type: 'report_submitted',
            title: pushTitle,
            body_preview: pushBody.substring(0, 200),
            channel: 'push',
          })
        } catch {
          // best-effort
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Report notification sent',
        push_sent: totalPushSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-report-notification:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
