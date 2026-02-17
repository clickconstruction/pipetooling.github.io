import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChecklistNotificationRequest {
  recipient_user_id: string
  push_title: string
  push_body: string
  push_url?: string
  tag?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid authorization format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { recipient_user_id, push_title, push_body, push_url, tag }: ChecklistNotificationRequest = await req.json()

    if (!recipient_user_id || !push_title || !push_body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: recipient_user_id, push_title, push_body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: subscriptions } = await adminClient
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key')
      .eq('user_id', recipient_user_id)

    let pushSent = 0
    if (subscriptions && subscriptions.length > 0) {
      const pushPayload = JSON.stringify({
        title: push_title,
        body: push_body,
        url: push_url || '/checklist',
        tag: tag || 'checklist',
      })

      webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
            },
            pushPayload,
            { TTL: 86400 }
          )
          pushSent++
        } catch (pushErr) {
          console.error('Push send error for subscription:', sub.endpoint?.substring(0, 50), pushErr)
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Checklist notification sent',
        push_sent: pushSent,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-checklist-notification:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
