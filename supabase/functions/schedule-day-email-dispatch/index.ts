import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { sendResendHtmlEmail } from '../_shared/recurringJobReportCore.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

type BlockRow = {
  id: string
  job_id: string
  assignee_user_id: string
  work_date: string
  time_start: string
  time_end: string
  note: string | null
  assignee_name: string
  job_hcp_number: string | null
  job_name: string | null
  job_address: string | null
}

type RequestRow = {
  id: string
  recipient_user_id: string
  work_date: string
  send_at: string
}

function formatPgTimeHm(pg: string): string {
  const parts = pg.trim().split(':')
  const h = Number(parts[0] ?? '0')
  const min = Number(parts[1] ?? '0')
  let sec = 0
  if (parts[2] != null) {
    const secPart = String(parts[2]).split('.')[0] ?? '0'
    const n = Number(secPart)
    sec = Number.isFinite(n) ? n : 0
  }
  if (!Number.isFinite(h) || !Number.isFinite(min)) return pg
  const d = new Date(Date.UTC(2000, 0, 1, h, min, sec))
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildScheduleEmail(params: {
  workDateYmd: string
  blocks: BlockRow[]
}): { html: string; text: string; subject: string } {
  const { workDateYmd, blocks } = params
  const subject = `Dispatch schedule — ${workDateYmd} (${APP_CALENDAR_TZ})`

  if (blocks.length === 0) {
    const plain = `No scheduled dispatch blocks for ${workDateYmd} (in your visibility).\n`
    const html =
      `<p style="font-family:system-ui,sans-serif;font-size:14px;color:#111">` +
      `No scheduled dispatch blocks for <strong>${escapeHtml(workDateYmd)}</strong> ` +
      `(nothing on file for you at send time).</p>`
    return { subject, html, text: plain }
  }

  const rowsHtml = blocks
    .map((b) => {
      const window = `${formatPgTimeHm(b.time_start)}–${formatPgTimeHm(b.time_end)}`
      const jobLabel = `${(b.job_hcp_number ?? '').trim() || '—'} · ${(b.job_name ?? '').trim() || 'Job'}`
      const addr = (b.job_address ?? '').trim().split('\n').map(escapeHtml).join('<br/>')
      const note = (b.note ?? '').trim()
      return `<tr>
<td style="padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top;white-space:nowrap">${escapeHtml(
        window,
      )}</td>
<td style="padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(
        b.assignee_name || '(assignee)',
      )}</td>
<td style="padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top">${escapeHtml(jobLabel)}${
        addr
          ? `<div style="font-size:12px;color:#6b7280;margin-top:4px">${addr}</div>`
          : ''
      }${note ? `<div style="font-size:12px;color:#374151;margin-top:4px">${escapeHtml(note)}</div>` : ''}</td>
</tr>`
    })
    .join('')

  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">` +
    `<p style="margin:0 0 12px">Dispatch schedule for <strong>${escapeHtml(workDateYmd)}</strong> (${APP_CALENDAR_TZ} times).</p>` +
    `<table style="border-collapse:collapse;width:100%;max-width:720px">` +
    `<thead><tr style="background:#f9fafb">` +
    `<th align="left" style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Window</th>` +
    `<th align="left" style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Person</th>` +
    `<th align="left" style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px">Job</th>` +
    `</tr></thead><tbody>${rowsHtml}</tbody></table></div>`

  const text = [
    `Dispatch schedule for ${workDateYmd} (${APP_CALENDAR_TZ})`,
    '',
    ...blocks.map((b) => {
      const window = `${formatPgTimeHm(b.time_start)}–${formatPgTimeHm(b.time_end)}`
      const jobLabel = `${(b.job_hcp_number ?? '').trim() || '—'} · ${(b.job_name ?? '').trim() || 'Job'}`
      const addr = (b.job_address ?? '').trim()
      const note = (b.note ?? '').trim()
      return [
        `${window}  ${b.assignee_name || ''}  ${jobLabel}`,
        addr ? `  ${addr.split('\n').join('  \n')}` : '',
        note ? `  Note: ${note}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    }),
    '',
  ].join('\n')

  return { subject, html, text }
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
        .select('email, archived_at')
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

      const mail = await sendResendHtmlEmail({
        to: emailTo,
        subject,
        html,
        textFallback: text,
        resendApiKey,
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
