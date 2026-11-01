// send-report-notification: the push to the people opted in to a report kind when one is filed. A person's hours
// (punch list #141 PR 5, v2.6217): the push goes through _shared/pushHoursSend.ts, which pushes the people on and holds
// a person outside their Push me hours, writing the row as `held` and sending nothing.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendPushHonouringHours } from '../_shared/pushHoursSend.ts'
import { readReportSubject, reportSendSkip } from '../_shared/reportSubject.ts'
import { webPushSender } from '../_shared/webPushSend.ts'
import { reportPhotoCountClause } from '../_shared/reportPhotoEmail.ts'

/** Matches client `reportTemplateDisplayName` legacy alias for notification copy. */
const LEGACY_SUPERINTENDENT_REPORT_TEMPLATE_NAME = 'Superintendent Report'
const STATUS_REPORT_PUSH_LABEL = 'Status Report'

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
      .select('id, template_id, created_by_user_id, job_ledger_id, project_id, bid_id')
      .eq('id', report_id)
      .single()

    if (reportErr || !reportRow) {
      return new Response(
        JSON.stringify({ error: 'Report not found', details: reportErr?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // A report on a ZZ test record reaches no phone (v2.6127): a session's walk stays in the building.
    const subject = await readReportSubject(
      adminClient,
      reportRow as { job_ledger_id: string | null; project_id: string | null; bid_id: string | null },
    )
    const skip = reportSendSkip(subject)
    if (skip) {
      return new Response(
        JSON.stringify({ success: true, message: skip.message, push_sent: 0, skipped: skip.reason }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch template name
    const { data: templateRow } = await adminClient
      .from('report_templates')
      .select('name')
      .eq('id', reportRow.template_id)
      .single()
    let templateName = (templateRow as { name: string } | null)?.name ?? 'Report'
    if (templateName === LEGACY_SUPERINTENDENT_REPORT_TEMPLATE_NAME) {
      templateName = STATUS_REPORT_PUSH_LABEL
    }

    // Fetch creator name
    const { data: creatorRow } = await adminClient
      .from('users')
      .select('name')
      .eq('id', reportRow.created_by_user_id)
      .single()
    const creatorName = (creatorRow as { name: string | null } | null)?.name ?? 'Someone'

    // The job, project or bid the report is about, read once above for the test-job rule; its words as before.
    let jobDisplay = 'Unknown job'
    if (subject.kind === 'job') {
      jobDisplay = subject.jobName ?? jobDisplay
    } else if (subject.kind === 'project') {
      jobDisplay = subject.name ?? jobDisplay
    } else if (subject.kind === 'bid') {
      jobDisplay = subject.projectName?.trim() || subject.gcContactName?.trim() || 'Bid'
    }

    // The report's photos (punch list #229, PR 5): the body counts them, so the phone knows a picture came with it.
    const { count: photoCount } = await adminClient.from('report_photos').select('id', { count: 'exact', head: true }).eq('report_id', report_id)

    const pushTitle = `New ${templateName}`
    const pushBody = `${creatorName} submitted a ${templateName} for ${jobDisplay}${reportPhotoCountClause(photoCount ?? 0)}`
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

    // Through each person's hours (#141 PR 5): the people on are pushed, a person off is held with a row and no push.
    const result = await sendPushHonouringHours(
      adminClient,
      { userIds: recipientIds, title: pushTitle, body: pushBody, url: pushUrl, tag, templateType: 'report_submitted' },
      webPushSender(adminClient, 'send-report-notification'),
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Report notification sent',
        push_sent: result.devices,
        held: result.held.length,
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
