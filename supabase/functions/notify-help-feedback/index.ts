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
  help_feedback_id?: string
}

type HelpFeedbackRow = {
  id: string
  from_user_id: string
  guide_slug: string
  body: string
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`
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

    const { help_feedback_id }: Body = await req.json()
    if (!help_feedback_id || typeof help_feedback_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing help_feedback_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: row, error: rowErr } = await userClient
      .from('help_feedback')
      .select('id, from_user_id, guide_slug, body')
      .eq('id', help_feedback_id)
      .maybeSingle()

    if (rowErr) {
      return new Response(JSON.stringify({ error: rowErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const feedbackRow = row as HelpFeedbackRow | null
    if (!feedbackRow || feedbackRow.from_user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden or feedback not found' }), {
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

    // Audience is the dev role (no group-members table for help feedback).
    const { data: devs, error: devErr } = await adminClient.from('users').select('id').eq('role', 'dev')
    if (devErr) {
      return new Response(JSON.stringify({ error: devErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const recipientIds = [...new Set((devs ?? []).map((d: { id: string }) => d.id))]
    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No dev users; no notifications sent',
          push_sent: 0,
          recipients: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: sender } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', feedbackRow.from_user_id)
      .maybeSingle()

    const senderLabel =
      (sender as { name?: string; email?: string } | null)?.name?.trim() ||
      (sender as { name?: string; email?: string } | null)?.email?.trim() ||
      'Someone'

    let pushBody = `${senderLabel} on “${feedbackRow.guide_slug}”: ${truncate(feedbackRow.body, 160)}`
    if (pushBody.length > MAX_PUSH_BODY_LEN) {
      pushBody = `${pushBody.slice(0, MAX_PUSH_BODY_LEN - 1)}…`
    }

    const pushTitle = 'Help Feedback'

    webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)

    let pushSent = 0
    const tag = `help-feedback-${feedbackRow.id}`
    const url = `/help?g=${encodeURIComponent(feedbackRow.guide_slug)}`

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
          url,
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
          template_type: 'help_feedback',
          title: pushTitle,
          body_preview: pushBody.substring(0, 200),
          channel: 'push',
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Help feedback notifications processed',
        push_sent: pushSent,
        recipients: recipientIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('notify-help-feedback:', error)
    const msg = error instanceof Error ? error.message : 'Internal server error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
