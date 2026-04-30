import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import type {
  ActivityScopeMode,
  CrewFilterMode,
  ReportingPeriodKind,
  ReportingWindowUtc,
} from '../_shared/recurringJobReportCore.ts'
import {
  buildRecurringJobReportHtml,
  buildRecurringJobReportPayload,
  getReportingWindowForActivityScope,
  recurringJobReportEmailSubject,
  sendResendHtmlEmail,
} from '../_shared/recurringJobReportCore.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = {
  scope_master_user_id: string
  recipient_user_id?: string
  activity_scope: ActivityScopeMode
  crew_filter: CrewFilterMode
  timezone?: string
  anchor_date: string
  period_kind?: ReportingPeriodKind
  window?: { window_start_utc: string; window_end_utc: string; reporting_date: string }
}

function isActivityScope(s: unknown): s is ActivityScopeMode {
  return (
    s === 'calendar_yesterday' ||
    s === 'calendar_today' ||
    s === 'calendar_week' ||
    s === 'calendar_last_week'
  )
}

function isCrewFilter(s: unknown): s is CrewFilterMode {
  return s === 'all_users' || s === 'my_team'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    const jwtClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const admin = createClient(supabaseUrl, serviceRole)

    const {
      data: { user },
      error: authErr,
    } = await jwtClient.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = (await req.json()) as Body
    if (!body?.scope_master_user_id || !isActivityScope(body.activity_scope) || !isCrewFilter(body.crew_filter)) {
      return new Response(
        JSON.stringify({
          error: 'scope_master_user_id, activity_scope, crew_filter required (valid enums)',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: can } = await jwtClient.rpc('user_can_manage_recurring_job_report_scope', {
      p_scope_master_user_id: body.scope_master_user_id,
    })
    if (can !== true) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    /** Test emails always land on the authenticated user — never arbitrary addresses. */
    const { data: urow } = await admin.from('users').select('email,name').eq('id', user.id).maybeSingle()
    const sendTo = (urow?.email ?? '').trim()
    if (!sendTo) {
      return new Response(JSON.stringify({ error: 'Your account has no email on file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const recipientUserId = body.recipient_user_id?.trim() || user.id
    const tz = (body.timezone ?? 'America/Chicago').trim() || 'America/Chicago'
    const anchor = (body.anchor_date ?? '').trim()

    let window: ReportingWindowUtc | null = null
    if (body.window?.window_start_utc && body.window?.window_end_utc && body.window?.reporting_date) {
      window = {
        windowStartUtc: body.window.window_start_utc,
        windowEndUtc: body.window.window_end_utc,
        reportingDate: body.window.reporting_date,
        periodKind: body.period_kind ?? 'daily',
      }
    } else {
      if (!anchor) {
        return new Response(JSON.stringify({ error: 'anchor_date required (YYYY-MM-DD in schedule TZ)' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      window = await getReportingWindowForActivityScope(admin, {
        timezone: tz,
        activityScope: body.activity_scope,
        anchorDateLocal: anchor,
      })
    }
    if (!window) {
      return new Response(JSON.stringify({ error: 'Could not resolve reporting window' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await buildRecurringJobReportPayload(admin, {
      scopeMasterUserId: body.scope_master_user_id,
      recipientUserId,
      crewFilter: body.crew_filter,
      window,
    })

    const html = buildRecurringJobReportHtml(
      payload,
      '<strong>Test email</strong> — This message was triggered from PipeTooling. Recipients normally receive summaries like this.',
    )
    const subject = `[TEST] ${recurringJobReportEmailSubject(payload)}`

    let textFallback = ''
    for (const j of payload.jobs) {
      textFallback += `${j.job.hcp_number} ${j.job.job_name}\n`
      for (const [, row] of j.byUserId) {
        textFallback += `  ${row.displayName}: ${row.hours.toFixed(2)}h\n`
      }
    }

    const send = await sendResendHtmlEmail({
      to: sendTo,
      subject,
      html,
      textFallback: textFallback || 'Job activity summary (see HTML)',
      resendApiKey,
    })

    if (!send.ok) {
      return new Response(JSON.stringify({ error: send.error ?? 'Send failed' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, email_id: send.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('recurring-job-report-test-send', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
