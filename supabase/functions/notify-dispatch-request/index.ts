import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_PUSH_BODY_LEN = 220

interface Body {
  dispatch_request_id?: string
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
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title
  return `${title.slice(0, Math.max(0, maxLen - 1))}…`
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

    const { dispatch_request_id }: Body = await req.json()
    if (!dispatch_request_id || typeof dispatch_request_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing dispatch_request_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: row, error: rowErr } = await userClient
      .from('dispatch_requests')
      .select('id, from_user_id, title, reference_summary, job_ledger_id, bid_id, location_lat, location_lng')
      .eq('id', dispatch_request_id)
      .maybeSingle()

    if (rowErr) {
      return new Response(JSON.stringify({ error: rowErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const dispatchRow = row as DispatchRow | null
    if (!dispatchRow || dispatchRow.from_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden or request not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'VAPID keys not configured; no pushes sent',
          push_sent: 0,
          recipients: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

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
        .select('hcp_number, job_name, job_address')
        .eq('id', dispatchRow.job_ledger_id)
        .maybeSingle()
      const j = job as { hcp_number?: string; job_name?: string; job_address?: string } | null
      if (j) {
        const prefix = `J${(j.hcp_number || '').trim() || '—'}`
        refSuffix = ` · ${prefix} · ${j.job_name || '—'} - ${j.job_address || '—'}`
      }
    } else if (dispatchRow.bid_id) {
      const { data: bid } = await adminClient
        .from('bids')
        .select('bid_number, project_name, address, customer_name')
        .eq('id', dispatchRow.bid_id)
        .maybeSingle()
      const b = bid as {
        bid_number?: string
        project_name?: string
        address?: string
        customer_name?: string
      } | null
      if (b) {
        const prefix = `B${(b.bid_number || '').trim() || '—'}`
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
