/**
 * Invoked by Database Webhook on public.clock_sessions INSERT/UPDATE (or manually with service role).
 * Sends Web Push to team leads who opted in when a member clocks in or clocks out.
 *
 * Try-out loop (to-dos/helper-tryout-loop, PR 2): when the member clocking OUT is a trial helper
 * (users.trial_prospect_id), everyone who could run a job the helper worked that day — the
 * Supervision rule, read off the schedule and the clock by trial_helper_supervisors(), never the
 * Team leads list — is pushed "take them again?", which opens the verdict card on their Dashboard.
 * A leader who already answered today is not pushed again, and a second clock-out the same day
 * replaces the earlier notification (one tag per card and day). This branch is independent of
 * the opted-in leader flow below, which is unchanged.
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

function memberLabel(name: string | null, email: string | null, userId: string): string {
  const n = name?.trim()
  if (n) return n
  const e = email?.trim()
  if (e) return e
  return `User (${userId.slice(-6)})`
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
 * not answered yet. Best-effort: any failure here must not stop the opted-in leader flow.
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

  const eventType = eventTypeRaw
  let kind: 'clock_in' | 'clock_out' | null = null

  if (eventType === 'INSERT') {
    if (record.clocked_in_at) kind = 'clock_in'
  } else if (eventType === 'UPDATE') {
    const oldRec = body.old_record
    const hadOut = oldRec?.clocked_out_at != null
    const hasOut = record.clocked_out_at != null
    if (!hadOut && hasOut) kind = 'clock_out'
  }

  if (!kind) {
    return new Response(JSON.stringify({ skipped: true, reason: 'no_notify_event' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const canPush = Boolean(vapidPublicKey && vapidPrivateKey)
  if (canPush) webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey!, vapidPrivateKey!)

  // Try-out loop: independent of the opted-in leader flow below, and never allowed to break it.
  let trial = { leads: 0, pushed: 0 }
  if (kind === 'clock_out') {
    try {
      trial = await notifyTrialHelperLeads(adminClient, record, canPush)
    } catch (e) {
      console.error('trial helper branch failed:', e)
    }
  }

  const { data: assigns, error: assignErr } = await adminClient
    .from('team_leader_assignments')
    .select('id, leader_user_id')
    .eq('member_user_id', record.user_id)

  if (assignErr || !assigns?.length) {
    return new Response(
      JSON.stringify({ success: true, push_sent: 0, reason: 'no_assignments', trial }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const assignmentIds = assigns.map((a) => a.id)
  const { data: prefs } = await adminClient
    .from('team_leader_clock_notify_prefs')
    .select('team_leader_assignment_id')
    .eq('notify_enabled', true)
    .in('team_leader_assignment_id', assignmentIds)

  const enabledIds = new Set((prefs ?? []).map((p) => p.team_leader_assignment_id))
  const leaderUserIds = [
    ...new Set(assigns.filter((a) => enabledIds.has(a.id)).map((a) => a.leader_user_id)),
  ]

  if (leaderUserIds.length === 0) {
    return new Response(
      JSON.stringify({ success: true, push_sent: 0, reason: 'no_opted_in_leaders', trial }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const { data: memberUser } = await adminClient
    .from('users')
    .select('name, email')
    .eq('id', record.user_id)
    .maybeSingle()

  const label = memberLabel(
    (memberUser as { name?: string | null } | null)?.name ?? null,
    (memberUser as { email?: string | null } | null)?.email ?? null,
    record.user_id,
  )

  const workDateLabel = record.work_date
  const title = kind === 'clock_in' ? 'Team clock in' : 'Team clock out'
  const bodyText =
    kind === 'clock_in'
      ? `${label} clocked in (${workDateLabel}).`
      : `${label} clocked out (${workDateLabel}).`

  let totalPush = 0

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)
    const pushPayload = JSON.stringify({
      title,
      body: bodyText,
      url: '/dashboard',
      tag: `team-lead-clock-${record.id}-${kind}`,
    })

    for (const leaderId of leaderUserIds) {
      const { data: subscriptions } = await adminClient
        .from('push_subscriptions')
        .select('endpoint, p256dh_key, auth_key')
        .eq('user_id', leaderId)

      if (!subscriptions?.length) continue

      let sentForLeader = 0
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
            },
            pushPayload,
            { TTL: 86400 },
          )
          sentForLeader++
          totalPush++
        } catch (e) {
          console.error('Push send error:', sub.endpoint?.substring(0, 50), e)
        }
      }

      if (sentForLeader > 0) {
        try {
          await adminClient.from('notification_history').insert({
            recipient_user_id: leaderId,
            template_type: kind === 'clock_in' ? 'team_member_clock_in' : 'team_member_clock_out',
            title,
            body_preview: bodyText.substring(0, 200),
            channel: 'push',
          })
        } catch {
          // best-effort
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      push_sent: totalPush,
      leaders: leaderUserIds.length,
      kind,
      trial,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
