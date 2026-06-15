import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

import type { ActivityScopeMode, CrewFilterMode } from '../_shared/recurringJobReportCore.ts'
import {
  buildRecurringJobReportHtml,
  buildRecurringJobReportPayload,
  buildRecurringJobReportTextFallback,
  recurringJobReportEmailSubject,
  sendResendHtmlEmail,
  getReportingWindowForActivityScope,
} from '../_shared/recurringJobReportCore.ts'

import {
  calendarYmdForInstantInZone,
  scheduleMatchesNowWallQuarter,
  weekdayIndexSun0InZone,
} from '../_shared/recurringJobReportTimezone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const MAX_RECIPIENTS_PER_SCHEDULE = 50

type ScheduleRow = {
  id: string
  name: string
  enabled: boolean
  time_local: string
  days_of_week: number[]
  timezone: string
  scope_master_user_id: string
}

type RecipientRow = {
  recipient_user_id: string
  activity_scope: ActivityScopeMode
  crew_filter: CrewFilterMode
  include_costs?: boolean | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret) {
      return new Response(JSON.stringify({ error: 'CRON_SECRET not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    let bodyJson: Record<string, unknown> = {}
    try {
      bodyJson = (await req.json().catch(() => ({}))) as Record<string, unknown>
    } catch {
      bodyJson = {}
    }
    const headerSecret = req.headers.get('X-Cron-Secret')
    const bodySecret = typeof bodyJson.cron_secret === 'string' ? bodyJson.cron_secret : undefined
    if (headerSecret !== cronSecret && bodySecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    if (!serviceRole) {
      return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const admin = createClient(supabaseUrl, serviceRole)

    const now = new Date()
    const { data: schedules, error: schedErr } = await admin
      .from('recurring_job_report_schedules')
      .select('id,name,enabled,time_local,days_of_week,timezone,scope_master_user_id')
      .eq('enabled', true)

    if (schedErr) {
      console.error('schedules', schedErr)
      return new Response(JSON.stringify({ error: schedErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const raw of (schedules ?? []) as ScheduleRow[]) {
      const zone = (raw.timezone ?? APP_CALENDAR_TZ).trim() || APP_CALENDAR_TZ
      const wd = weekdayIndexSun0InZone(zone, now)
      const dows = Array.isArray(raw.days_of_week) ? raw.days_of_week : []
      if (!dows.includes(wd)) continue
      if (!scheduleMatchesNowWallQuarter(raw.time_local, zone, now)) continue

      const anchorToday = calendarYmdForInstantInZone(zone, now)

      const { data: recipients, error: recErr } = await admin
        .from('recurring_job_report_schedule_recipients')
        .select('recipient_user_id, activity_scope, crew_filter, include_costs')
        .eq('schedule_id', raw.id)
        .limit(MAX_RECIPIENTS_PER_SCHEDULE)

      if (recErr) {
        errors.push(`${raw.id}: ${recErr.message}`)
        continue
      }

      for (const r of (recipients ?? []) as RecipientRow[]) {
        const recipientId = r.recipient_user_id as string

        const window = await getReportingWindowForActivityScope(admin, {
          timezone: zone,
          activityScope: r.activity_scope,
          anchorDateLocal: anchorToday,
        })
        if (!window) {
          skipped += 1
          continue
        }

        const { data: dup } = await admin
          .from('recurring_job_report_dispatch_log')
          .select('id')
          .eq('schedule_id', raw.id)
          .eq('recipient_user_id', recipientId)
          .eq('reporting_date', window.reportingDate)
          .maybeSingle()
        if (dup) {
          skipped += 1
          continue
        }

        const { data: u } = await admin
          .from('users')
          .select('email,archived_at')
          .eq('id', recipientId)
          .maybeSingle()

        const emailTo = ((u?.email as string | undefined) ?? '').trim()
        if (!emailTo || u?.archived_at) {
          skipped += 1
          continue
        }

        try {
          const includeCosts = r.include_costs === true

          const payload = await buildRecurringJobReportPayload(admin, {
            scopeMasterUserId: raw.scope_master_user_id,
            recipientUserId: recipientId,
            crewFilter: r.crew_filter,
            window,
            includeCosts,
          })
          const html = buildRecurringJobReportHtml(payload, undefined, includeCosts)
          const subject = recurringJobReportEmailSubject(payload)

          const textFallback = buildRecurringJobReportTextFallback(payload, includeCosts)

          const send = await sendResendHtmlEmail({
            to: emailTo,
            subject,
            html,
            textFallback: textFallback || 'Job activity summary (see HTML)',
            resendApiKey,
          })
          if (!send.ok) {
            errors.push(`${recipientId}: ${send.error ?? 'send'}`)
            continue
          }

          const { error: logErr } = await admin.from('recurring_job_report_dispatch_log').insert({
            schedule_id: raw.id,
            recipient_user_id: recipientId,
            reporting_date: window.reportingDate,
          })
          if (logErr) {
            if (logErr.code === '23505') skipped += 1
            else errors.push(`${recipientId} log: ${logErr.message}`)
          } else sent += 1
        } catch (e) {
          errors.push(`${recipientId}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent, skipped, errors }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('recurring-job-report-dispatch', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
