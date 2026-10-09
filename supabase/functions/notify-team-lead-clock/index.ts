/**
 * Invoked by Database Webhook on public.clock_sessions INSERT/UPDATE (or manually with service role).
 *
 * Try-out loop (to-dos/helper-tryout-loop, PR 2): when the member clocking OUT is a trial helper
 * (users.trial_prospect_id), everyone who could run a job the helper worked that day — the
 * Supervision rule, read off the schedule and the clock by trial_helper_supervisors() — is pushed
 * "take them again?", which opens the verdict card on their Dashboard. A leader who already
 * answered today is not pushed again, and a second clock-out the same day replaces the earlier
 * notification (one tag per card and day).
 *
 * That is all it does since v2.4981: the opted-in "Team clock in / out" push read the Team leads
 * list (team_leader_assignments + team_leader_clock_notify_prefs), dropped with it. The function
 * and its webhook stay for the try-out branch.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { trialVerdictPush } from '../_shared/trialVerdictPush.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ClockRecord = {
  id: string
  user_id: string
  clocked_in_at: string | null
  clocked_out_at: string | null
  work_date: string
  job_ledger_id?: string | null
}

type WebhookBody = {
  type?: string
  table?: string
  record?: ClockRecord
  old_record?: Partial<ClockRecord> | null
}

function verifyCaller(authHeader: string | null): boolean {
  if (!authHeader) return false
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return false
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const webhookSecret = Deno.env.get('TEAM_LEAD_CLOCK_WEBHOOK_SECRET')
  if (serviceRole && token === serviceRole) return true
  if (webhookSecret && token === webhookSecret) return true
  return false
}

type AdminClient = ReturnType<typeof createClient>

/** Web Push one payload to every subscription a person has; returns how many were delivered. */
async function pushToUser(adminClient: AdminClient, userId: string, payload: string): Promise<number> {
  const { data: subscriptions } = await adminClient.from('push_subscriptions').select('endpoint, p256dh_key, auth_key').eq('user_id', userId)
  let sent = 0
  for (const sub of (subscriptions ?? []) as { endpoint: string; p256dh_key: string; auth_key: string }[]) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } }, payload, { TTL: 86400 })
      sent++
    } catch (e) {
      console.error('Push send error:', sub.endpoint?.substring(0, 50), e)
    }
  }
  return sent
}

/**
 * The try-out branch: a trial helper clocked out → push whoever could run their job today and has
 * not answered yet. Best-effort: a failure is logged, never thrown at the webhook.
 */
async function notifyTrialHelperLeads(adminClient: AdminClient, record: ClockRecord, canPush: boolean): Promise<{ leads: number; pushed: number }> {
  const { data: helper } = await adminClient.from('users').select('name, trial_prospect_id').eq('id', record.user_id).maybeSingle()
  const prospectId = (helper as { trial_prospect_id?: string | null } | null)?.trial_prospect_id ?? null
  if (!prospectId) return { leads: 0, pushed: 0 }

  const { data: supervisors, error: supErr } = await adminClient.rpc('trial_helper_supervisors', { p_helper_user_id: record.user_id, p_work_date: record.work_date })
  if (supErr) {
    console.error('trial_helper_supervisors failed:', supErr.message)
    return { leads: 0, pushed: 0 }
  }
  const leadIds = [...new Set(((supervisors ?? []) as { leader_user_id: string }[]).map((r) => r.leader_user_id))]
  if (leadIds.length === 0) return { leads: 0, pushed: 0 }

  const { data: answered } = await adminClient
    .from('team_prospect_trial_verdicts')
    .select('leader_user_id')
    .eq('prospect_id', prospectId)
    .eq('work_date', record.work_date)
    .in('leader_user_id', leadIds)
  const done = new Set(((answered ?? []) as { leader_user_id: string }[]).map((r) => r.leader_user_id))
  const toAsk = leadIds.filter((id) => !done.has(id))
  if (toAsk.length === 0 || !canPush) return { leads: toAsk.length, pushed: 0 }

  let jobName: string | null = null
  if (record.job_ledger_id) {
    const { data: job } = await adminClient.from('jobs_ledger').select('job_name').eq('id', record.job_ledger_id).maybeSingle()
    jobName = (job as { job_name?: string | null } | null)?.job_name ?? null
  }
  const words = trialVerdictPush((helper as { name?: string | null } | null)?.name ?? null, jobName)
  const payload = JSON.stringify({ ...words, tag: `trial-verdict-${prospectId}-${record.work_date}` })

  let pushed = 0
  for (const leadId of toAsk) {
    const sent = await pushToUser(adminClient, leadId, payload)
    pushed += sent
    if (sent > 0) {
      try {
        await adminClient.from('notification_history').insert({ recipient_user_id: leadId, template_type: 'trial_helper_verdict', title: words.title, body_preview: words.body.substring(0, 200), channel: 'push' })
      } catch {
        // best-effort
      }
    }
  }
  return { leads: toAsk.length, pushed }
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

  if (!verifyCaller(req.headers.get('Authorization'))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let raw: Record<string, unknown>
  try {
    raw = (await req.json()) as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const nested = raw.payload as WebhookBody | undefined
  const body: WebhookBody = nested ?? (raw as WebhookBody)
  const eventTypeRaw = (body.type ?? (raw.eventType as string | undefined) ?? '').toUpperCase()

  const table = body.table ?? ''
  if (table && table !== 'clock_sessions') {
    return new Response(JSON.stringify({ skipped: true, reason: 'wrong_table' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const record = body.record
  if (!record?.user_id) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no_record' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Only a clock-out matters now: the try-out branch asks after the helper's day.
  const clockedOut =
    eventTypeRaw === 'UPDATE' && body.old_record?.clocked_out_at == null && record.clocked_out_at != null

  if (!clockedOut) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no_notify_event' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const canPush = Boolean(vapidPublicKey && vapidPrivateKey)
  if (canPush) webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey!, vapidPrivateKey!)

  let trial = { leads: 0, pushed: 0 }
  try {
    trial = await notifyTrialHelperLeads(adminClient, record, canPush)
  } catch (e) {
    console.error('trial helper branch failed:', e)
  }

  return new Response(JSON.stringify({ success: true, kind: 'clock_out', trial }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
