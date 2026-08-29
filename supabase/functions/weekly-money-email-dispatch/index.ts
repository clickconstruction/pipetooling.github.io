/**
 * weekly-money-email-dispatch — scheduled Weekly Money Movement report sends
 * (v2.1448, weekly_money Report Subscriptions stream — WEEKLY_MONEY_PLAN.md
 * Phase 5).
 *
 * CRON-ONLY (X-Cron-Secret): scheduling/cancelling are direct RLS-gated
 * writes to weekly_money_email_requests from the client. Per due row the
 * report covers the PREVIOUS complete Central week (payload RPC's NULL
 * default), rebuilt fresh at send time via get_weekly_money_movement_payload
 * — the same RPC the client modal uses, so there is nothing to mirror.
 * Recipients are restricted to dev/controller (wage-derived job costs).
 * A quiet week still sends — "no movement" is information here.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CRON_SECRET.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { logEmailSendBestEffort } from '../_shared/logEmailSend.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import {
  renderWeeklyMoneyHtml,
  renderWeeklyMoneyText,
  weekLabelFromMonday,
  weeklyMoneySubject,
  type WeeklyMoneyPayload,
} from './render.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const FROM = EMAIL_FROM
const RECIPIENT_ROLES = new Set(['dev', 'controller'])
const MAX_QUEUE_BATCH = 10
const MAX_ATTEMPTS = 5

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type RequestRow = {
  id: string
  requested_by: string
  recipient_user_id: string
  send_at: string
  repeat_weekly: boolean
  attempts: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Supabase service env not configured' }, 500)
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const bodySecret = typeof body.cron_secret === 'string' ? body.cron_secret : undefined
    if (!cronSecret || (headerSecret !== cronSecret && bodySecret !== cronSecret)) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceRole)

    const { data: pending, error: qErr } = await admin
      .from('weekly_money_email_requests')
      .select('id, requested_by, recipient_user_id, send_at, repeat_weekly, attempts')
      .is('sent_at', null)
      .lte('send_at', new Date().toISOString())
      .lt('attempts', MAX_ATTEMPTS)
      .order('send_at', { ascending: true })
      .limit(MAX_QUEUE_BATCH)
    if (qErr) return jsonResponse({ error: qErr.message }, 500)

    const rows = (pending ?? []) as RequestRow[]
    if (rows.length === 0) return jsonResponse({ ok: true, processed: 0, sent: 0, errors: [] })

    // One rebuild per batch — every row in a batch reports the same week.
    const { data: payloadRaw, error: rpcErr } = await admin.rpc('get_weekly_money_movement_payload', {
      p_week_monday: null,
    })
    if (rpcErr) return jsonResponse({ error: `payload rpc: ${rpcErr.message}` }, 500)
    const payload = payloadRaw as WeeklyMoneyPayload
    if (!payload || !Array.isArray(payload.jobs)) return jsonResponse({ error: 'empty payload' }, 500)
    const weekLabel = weekLabelFromMonday(payload.week_monday)
    const subject = weeklyMoneySubject(weekLabel)

    let sent = 0
    const errors: string[] = []

    for (const row of rows) {
      try {
        const { data: recipient } = await admin
          .from('users')
          .select('email, name, role, archived_at')
          .eq('id', row.recipient_user_id)
          .maybeSingle()
        const recipientEmail = (recipient?.email ?? '').trim()
        if (!recipient || recipient.archived_at || !recipientEmail || !RECIPIENT_ROLES.has(String(recipient.role))) {
          await admin
            .from('weekly_money_email_requests')
            .update({ sent_at: new Date().toISOString(), error: 'recipient unavailable (archived, role, or no email)' })
            .eq('id', row.id)
          continue
        }
        const { data: requester } = await admin
          .from('users')
          .select('email, name')
          .eq('id', row.requested_by)
          .maybeSingle()
        const replyTo =
          typeof requester?.email === 'string' && requester.email.includes('@') ? requester.email : undefined

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: [recipientEmail],
            subject,
            html: renderWeeklyMoneyHtml(payload, weekLabel, requester?.name ?? undefined),
            text: renderWeeklyMoneyText(payload, weekLabel),
            ...(replyTo ? { reply_to: replyTo } : {}),
          }),
        })
        if (!resendResponse.ok) {
          const errorData = await resendResponse.json().catch(() => ({} as { message?: string }))
          throw new Error(errorData.message || `Resend ${resendResponse.status}`)
        }
        const sentMail = (await resendResponse.json().catch(() => ({}))) as { id?: string }

        await logEmailSendBestEffort({
          resendEmailId: sentMail.id ?? null,
          to: [recipientEmail],
          from: FROM,
          subject,
        })

        await admin
          .from('weekly_money_email_requests')
          .update({ sent_at: new Date().toISOString(), error: null })
          .eq('id', row.id)
        sent += 1

        if (row.repeat_weekly) {
          const nextSendAt = new Date(new Date(row.send_at).getTime() + 7 * 86_400_000).toISOString()
          const { data: existing } = await admin
            .from('weekly_money_email_requests')
            .select('id')
            .eq('recipient_user_id', row.recipient_user_id)
            .eq('send_at', nextSendAt)
            .is('sent_at', null)
            .limit(1)
          if (!existing || existing.length === 0) {
            await admin.from('weekly_money_email_requests').insert({
              requested_by: row.requested_by,
              recipient_user_id: row.recipient_user_id,
              send_at: nextSendAt,
              repeat_weekly: true,
            })
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        await admin
          .from('weekly_money_email_requests')
          .update({ error: msg.slice(0, 900), attempts: row.attempts + 1 })
          .eq('id', row.id)
        errors.push(`${row.id}: ${msg}`)
      }
    }

    return jsonResponse({ ok: true, processed: rows.length, sent, errors })
  } catch (e) {
    console.error('weekly-money-email-dispatch', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
