import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { formatBidLedgerNumberLabel, formatJobLedgerNumberLabel } from '../_shared/ledgerDisplayPrefixes.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_PUSH_BODY_LEN = 220

/**
 * `mode` (v2.2880, journey-map Tier-2 #25):
 * - omitted / 'created' — the original fan-out: the requester just filed the
 *   row; push every `dispatch_group_members` member. Caller must be the author.
 * - 'closed' | 'reopened' — the office answered: push the REQUESTER
 *   (`from_user_id`) with the closing note and write them a
 *   `notification_history` row even when they hold no push subscription, so
 *   the Job Mode "My requests" strip / Settings push log still show the
 *   answer. Caller must be a dispatch group member, a dev, or the row's
 *   `closed_by_user_id`.
 */
type NotifyMode = 'created' | 'closed' | 'reopened'

interface Body {
  dispatch_request_id?: string
  mode?: NotifyMode
  /** Office note for closed/reopened (falls back to the row's closed_note). */
  note?: string | null
}

type DispatchRow = {
  id: string
  from_user_id: string
  title: string
  reference_summary: string | null
  job_ledger_id: string | null
  bid_id: string | null
  location_lat: number | null
  location_lng: number | null
  status: string | null
  closed_note: string | null
  closed_by_user_id: string | null
}

const DISPATCH_ROW_SELECT =
  'id, from_user_id, title, reference_summary, job_ledger_id, bid_id, location_lat, location_lng, status, closed_note, closed_by_user_id'

const CLOSURE_NOTE_MAX = 500

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title
  return `${title.slice(0, Math.max(0, maxLen - 1))}…`
}

/** Mirrors `composeDispatchClosurePush` in src/lib/dispatchRequestClosure.ts — keep the wording in step. */
function composeClosurePush(title: string, note: string | null, mode: 'closed' | 'reopened'): { title: string; body: string } {
  const head = mode === 'closed' ? 'Handled' : 'Reopened'
  const cleanTitle = truncateTitle(title.trim() || 'your request', 160)
  const cleanNote = (note ?? '').trim()
  const raw = cleanNote ? `${head}: ${cleanTitle} — ${cleanNote}` : `${head}: ${cleanTitle}`
  return {
    title: mode === 'closed' ? 'Dispatch answered' : 'Dispatch reopened your request',
    body: raw.length > MAX_PUSH_BODY_LEN ? `${raw.slice(0, MAX_PUSH_BODY_LEN - 1)}…` : raw,
  }
}

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}


/**
 * closed/reopened: one recipient — the requester. Pushes to each of their
 * subscriptions (if any) and ALWAYS writes their `notification_history` row,
 * so the answer is on record even for people who never enabled push. Skips
 * entirely when the closer is the requester (nobody needs a push about their
 * own click).
 */
async function notifyRequester(
  adminClient: ReturnType<typeof createClient>,
  row: DispatchRow,
  mode: 'closed' | 'reopened',
  bodyNote: string | null,
  callerId: string,
): Promise<Response> {
  const recipient_user_id = row.from_user_id
  if (recipient_user_id === callerId) {
    return json(200, {
      success: true,
      mode,
      message: 'Requester acted on their own request; nothing to send',
      push_sent: 0,
      recipients: 0,
      notified: false,
    })
  }

  const noteSource = (bodyNote ?? '').trim() || (mode === 'closed' ? (row.closed_note ?? '').trim() : '')
  const note = noteSource ? (noteSource.length > CLOSURE_NOTE_MAX ? `${noteSource.slice(0, CLOSURE_NOTE_MAX - 1)}…` : noteSource) : null
  const push = composeClosurePush(row.title, note, mode)
  const templateType = mode === 'closed' ? 'dispatch_request_closed' : 'dispatch_request_reopened'

  let pushSent = 0
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)
    const { data: subscriptions } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('user_id', recipient_user_id)
    const pushPayload = JSON.stringify({
      title: push.title,
      body: push.body,
      url: '/job-mode/inbox',
      tag: `dispatch-${row.id}-${mode}`,
    })
    for (const sub of (subscriptions ?? []) as Array<{ endpoint: string; p256dh_key: string; auth_key: string }>) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          pushPayload,
          { TTL: 86400 },
        )
        pushSent++
      } catch (pushErr) {
        console.error('Push send error:', sub.endpoint?.substring(0, 50), pushErr)
      }
    }
  }

  // Always on record for the requester — this is the row Settings → Notifications
  // and the Job Mode inbox can show, subscription or not.
  const { error: histErr } = await adminClient.from('notification_history').insert({
    recipient_user_id,
    template_type: templateType,
    title: push.title,
    body_preview: push.body.substring(0, 200),
    channel: 'push',
  })
  if (histErr) console.error('notification_history insert:', histErr.message)

  return json(200, {
    success: true,
    mode,
    message: pushSent > 0 ? 'Requester notified' : 'Requester has no push subscription; logged only',
    push_sent: pushSent,
    recipients: 1,
    notified: pushSent > 0,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid authorization format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized - Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { dispatch_request_id, mode: rawMode, note: rawNote }: Body = await req.json()
    if (!dispatch_request_id || typeof dispatch_request_id !== 'string') {
      return json(400, { error: 'Missing dispatch_request_id' })
    }
    const mode: NotifyMode = rawMode === 'closed' || rawMode === 'reopened' ? rawMode : 'created'

    // RLS scopes this read: the author, devs, and dispatch group members can see the row.
    const { data: row, error: rowErr } = await userClient
      .from('dispatch_requests')
      .select(DISPATCH_ROW_SELECT)
      .eq('id', dispatch_request_id)
      .maybeSingle()

    if (rowErr) {
      return json(400, { error: rowErr.message })
    }
    const dispatchRow = row as DispatchRow | null
    if (!dispatchRow) {
      return json(403, { error: 'Forbidden or request not found' })
    }
    if (mode === 'created' && dispatchRow.from_user_id !== user.id) {
      return json(403, { error: 'Forbidden or request not found' })
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return json(500, { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    if (mode !== 'created') {
      // Closer authorization: group member, dev, or the user the row says closed it.
      let allowed = dispatchRow.closed_by_user_id === user.id
      if (!allowed) {
        const { data: member } = await adminClient
          .from('dispatch_group_members')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle()
        allowed = !!member
      }
      if (!allowed) {
        const { data: me } = await adminClient.from('users').select('role').eq('id', user.id).maybeSingle()
        allowed = (me as { role?: string | null } | null)?.role === 'dev'
      }
      if (!allowed) {
        return json(403, { error: 'Only Dispatch can notify a requester about a close or reopen' })
      }
      return await notifyRequester(adminClient, dispatchRow, mode, rawNote ?? null, user.id)
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublicKey || !vapidPrivateKey) {
      return json(200, {
        success: true,
        message: 'VAPID keys not configured; no pushes sent',
        push_sent: 0,
        recipients: 0,
      })
    }

    const { data: members, error: memErr } = await adminClient.from('dispatch_group_members').select('user_id')
    if (memErr) {
      return new Response(JSON.stringify({ error: memErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const recipientIds = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))]
    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Dispatch group is empty; no notifications sent',
          push_sent: 0,
          recipients: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: sender } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', dispatchRow.from_user_id)
      .maybeSingle()

    const senderLabel =
      (sender as { name?: string; email?: string } | null)?.name?.trim() ||
      (sender as { name?: string; email?: string } | null)?.email?.trim() ||
      'Someone'

    let refSuffix = ''
    const summ = dispatchRow.reference_summary?.trim()
    if (summ) {
      refSuffix = ` · ${summ}`
    } else if (dispatchRow.job_ledger_id) {
      const { data: job } = await adminClient
        .from('jobs_ledger')
        .select('hcp_number, job_name, job_address, service_types(ledger_job_prefix)')
        .eq('id', dispatchRow.job_ledger_id)
        .maybeSingle()
      const j = job as {
        hcp_number?: string | null
        job_name?: string | null
        job_address?: string | null
        service_types?: { ledger_job_prefix?: string | null } | null
      } | null
      if (j) {
        const prefix = formatJobLedgerNumberLabel(j.service_types?.ledger_job_prefix ?? null, j.hcp_number)
        refSuffix = ` · ${prefix} · ${j.job_name || '—'} - ${j.job_address || '—'}`
      }
    } else if (dispatchRow.bid_id) {
      const { data: bid } = await adminClient
        .from('bids')
        .select('bid_number, project_name, address, customer_name, service_types(ledger_bid_prefix)')
        .eq('id', dispatchRow.bid_id)
        .maybeSingle()
      const b = bid as {
        bid_number?: string | null
        project_name?: string | null
        address?: string | null
        customer_name?: string | null
        service_types?: { ledger_bid_prefix?: string | null } | null
      } | null
      if (b) {
        const prefix = formatBidLedgerNumberLabel(b.service_types?.ledger_bid_prefix ?? null, b.bid_number)
        refSuffix = ` · ${prefix} · ${b.project_name || '—'} - ${b.address || b.customer_name || '—'}`
      }
    }
    if (
      dispatchRow.location_lat != null &&
      dispatchRow.location_lng != null
    ) {
      refSuffix += ' · Location attached'
    }

    const titlePart = truncateTitle(dispatchRow.title, 160)
    let pushBody = `${senderLabel}: ${titlePart}${refSuffix}`
    if (pushBody.length > MAX_PUSH_BODY_LEN) {
      pushBody = `${pushBody.slice(0, MAX_PUSH_BODY_LEN - 1)}…`
    }

    const pushTitle = 'Task Dispatch'

    webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)

    let pushSent = 0
    const tag = `dispatch-${dispatchRow.id}`

    for (const recipient_user_id of recipientIds) {
      const { data: subscriptions } = await adminClient
        .from('push_subscriptions')
        .select('endpoint, p256dh_key, auth_key')
        .eq('user_id', recipient_user_id)

      let sentForRecipient = 0
      if (subscriptions && subscriptions.length > 0) {
        const pushPayload = JSON.stringify({
          title: pushTitle,
          body: pushBody,
          url: '/dashboard',
          tag,
        })
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
            sentForRecipient++
            pushSent++
          } catch (pushErr) {
            console.error('Push send error:', sub.endpoint?.substring(0, 50), pushErr)
          }
        }
      }

      if (sentForRecipient > 0) {
        await adminClient.from('notification_history').insert({
          recipient_user_id,
          template_type: 'dispatch_request',
          title: pushTitle,
          body_preview: pushBody.substring(0, 200),
          channel: 'push',
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dispatch notifications processed',
        push_sent: pushSent,
        recipients: recipientIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('notify-dispatch-request:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
