// send-checklist-notification: one person's push for a checklist event, and the Settings test push. A person's hours
// (punch list #141 PR 5, v2.6217): a checklist push goes through _shared/pushHoursSend.ts, which holds it for a person
// outside their Push me hours, writing the row as `held` and sending nothing. The test push (tag `test-notification`)
// never does: the person pressed it to see a push.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pushPayload, sendPushHonouringHours } from '../_shared/pushHoursSend.ts'
import { webPushSender } from '../_shared/webPushSend.ts'

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

    // Skip completed task notifications if recipient has muted this specific task
    if (tag?.startsWith('checklist-')) {
      const checklistInstanceId = tag.slice('checklist-'.length)
      const { data: instance } = await adminClient
        .from('checklist_instances')
        .select('checklist_item_id')
        .eq('id', checklistInstanceId)
        .maybeSingle()
      if (instance?.checklist_item_id) {
        const { data: mutePref } = await adminClient
          .from('user_checklist_item_mute_preferences')
          .select('muted_until')
          .eq('user_id', recipient_user_id)
          .eq('checklist_item_id', instance.checklist_item_id)
          .maybeSingle()
        if (mutePref && new Date(mutePref.muted_until) > new Date()) {
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Checklist notification skipped (recipient muted this task)',
              push_sent: 0,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    const isTest = tag === 'test-notification'
    const templateType = isTest ? 'test_notification' : tag?.startsWith('checklist-') ? 'checklist_completed' : tag || 'checklist'
    const checklistInstanceId = tag?.startsWith('checklist-') ? tag.slice('checklist-'.length) : null
    const push = { userIds: [recipient_user_id], title: push_title, body: push_body, url: push_url || '/checklist', tag: tag || 'checklist', templateType, extra: { checklist_instance_id: checklistInstanceId || null } }
    const sendTo = webPushSender(adminClient, 'send-checklist-notification')!

    let pushSent = 0
    let held = 0
    if (isTest) {
      // The Settings test push skips the hours: the person pressed it to see a push.
      pushSent = await sendTo(recipient_user_id, pushPayload(push))
      if (pushSent > 0) {
        await adminClient.from('notification_history').insert({
          recipient_user_id,
          template_type: templateType,
          title: push_title,
          body_preview: push_body.substring(0, 200),
          channel: 'push',
          checklist_instance_id: null,
        })
      }
    } else {
      // Through the person's hours (#141 PR 5): pushed now with a push row, or held with a held row and no push.
      const result = await sendPushHonouringHours(adminClient, push, sendTo)
      pushSent = result.devices
      held = result.held.length
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: held > 0 ? 'Checklist notification held for the person’s hours' : 'Checklist notification sent',
        push_sent: pushSent,
        held,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-checklist-notification:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
