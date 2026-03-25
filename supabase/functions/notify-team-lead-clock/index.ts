/**
 * Invoked by Database Webhook on public.clock_sessions INSERT/UPDATE (or manually with service role).
 * Sends Web Push to team leads who opted in when a member clocks in or clocks out.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

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

  const { data: assigns, error: assignErr } = await adminClient
    .from('team_leader_assignments')
    .select('id, leader_user_id')
    .eq('member_user_id', record.user_id)

  if (assignErr || !assigns?.length) {
    return new Response(
      JSON.stringify({ success: true, push_sent: 0, reason: 'no_assignments' }),
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
      JSON.stringify({ success: true, push_sent: 0, reason: 'no_opted_in_leaders' }),
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
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
