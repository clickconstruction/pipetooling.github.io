import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { sendResendHtmlEmail } from '../_shared/recurringJobReportCore.ts'
import { resolveServerEmailWording } from '../_shared/emailWordingServer.ts'
import { buildScheduleEmail, type ScheduleDayBlockRow } from '../_shared/scheduleDayEmail.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// The email itself is `_shared/scheduleDayEmail.ts` (v2.4177) — What the team sees renders it on sample data.
type BlockRow = ScheduleDayBlockRow

type RequestRow = {
  id: string
  recipient_user_id: string
  work_date: string
  send_at: string
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
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!serviceRole || !supabaseUrl) {
      return new Response(JSON.stringify({ error: 'Supabase service env not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRole)
    const nowIso = new Date().toISOString()

    const { data: dueRows, error: dueErr } = await admin
      .from('schedule_day_email_requests')
      .select('id, recipient_user_id, work_date, send_at')
      .eq('status', 'pending')
      .lte('send_at', nowIso)
      .order('send_at', { ascending: true })
      .limit(30)

    if (dueErr) {
      console.error('schedule_day_email_requests', dueErr)
      return new Response(JSON.stringify({ error: dueErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const requests = (dueRows ?? []) as RequestRow[]
    let sent = 0
    const errors: string[] = []

    for (const reqRow of requests) {
      const { data: u, error: uErr } = await admin
        .from('users')
        .select('email, archived_at').match(REAL_ACCOUNT)
        .eq('id', reqRow.recipient_user_id)
        .maybeSingle()

      if (uErr) {
        await admin
          .from('schedule_day_email_requests')
          .update({
            status: 'failed',
            error: `user lookup: ${uErr.message}`.slice(0, 900),
          })
          .eq('id', reqRow.id)
        errors.push(`${reqRow.id}: user`)
        continue
      }

      const emailTo = (typeof u?.email === 'string' ? u.email : '').trim()
      if (!emailTo || u?.archived_at) {
        await admin
          .from('schedule_day_email_requests')
          .update({ status: 'failed', error: 'Recipient email missing or archived' })
          .eq('id', reqRow.id)
        errors.push(`${reqRow.id}: no email`)
        continue
      }

      const workDateStr =
        typeof reqRow.work_date === 'string' ? reqRow.work_date : String(reqRow.work_date).slice(0, 10)

      const { data: blockData, error: blockErr } = await admin.rpc('list_job_schedule_blocks_for_schedule_email', {
        p_recipient: reqRow.recipient_user_id,
        p_work_date: workDateStr,
      })

      if (blockErr) {
        await admin
          .from('schedule_day_email_requests')
          .update({ status: 'failed', error: `blocks: ${blockErr.message}`.slice(0, 900) })
          .eq('id', reqRow.id)
        errors.push(`${reqRow.id}: rpc`)
        continue
      }

      const blocks = (blockData ?? []) as BlockRow[]
      const { html, text, subject } = buildScheduleEmail({
        workDateYmd: workDateStr,
        blocks,
      })
      // Dev-saved wording (Settings → Email templates, v2.2659).
      const wording = await resolveServerEmailWording('schedule_day', { date: workDateStr }, subject)

      const mail = await sendResendHtmlEmail({
        to: emailTo,
        subject: wording.subject,
        html: (wording.introHtml ?? '') + html,
        textFallback: (wording.introText ? wording.introText + '\n\n' : '') + text,
        resendApiKey,
        emailType: 'schedule_day',
      })

      if (!mail.ok) {
        await admin
          .from('schedule_day_email_requests')
          .update({
            status: 'failed',
            error: (mail.error ?? 'Resend error').slice(0, 900),
          })
          .eq('id', reqRow.id)
        errors.push(`${reqRow.id}: ${mail.error ?? 'resend'}`)
        continue
      }

      const { error: upErr } = await admin
        .from('schedule_day_email_requests')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          error: null,
        })
        .eq('id', reqRow.id)

      if (upErr) {
        errors.push(`${reqRow.id}: final update ${upErr.message}`)
      } else {
        sent += 1
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: requests.length,
        sent,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
