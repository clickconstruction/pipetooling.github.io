import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// Get current time in America/Chicago, rounded to 15-minute boundary (e.g. 9:07 -> 9:00)
function getCstTimeRounded(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const hour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10)
  const minute = parseInt(parts.find((p) => p.type === 'minute')!.value, 10)
  const roundedMinute = Math.floor(minute / 15) * 15
  return `${String(hour).padStart(2, '0')}:${String(roundedMinute).padStart(2, '0')}:00`
}

// Get today's date in America/Chicago as YYYY-MM-DD
function getTodayCst(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const str = formatter.format(new Date())
  return str // "YYYY-MM-DD" for en-CA
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret) {
      return new Response(
        JSON.stringify({ error: 'CRON_SECRET not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const headerSecret = req.headers.get('X-Cron-Secret')
    let bodySecret: string | undefined
    try {
      const body = await req.json().catch(() => ({}))
      bodySecret = body?.cron_secret
    } catch {
      // ignore
    }
    if (headerSecret !== cronSecret && bodySecret !== cronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or missing cron secret' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const targetTime = getCstTimeRounded()
    const todayCst = getTodayCst()

    const { data: items } = await adminClient
      .from('checklist_items')
      .select('id, title, assigned_to_user_id, reminder_time, reminder_scope')
      .not('reminder_time', 'is', null)

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No items with reminder_time', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const targetHHMM = targetTime.slice(0, 5)
    const matchingItems = items.filter((item) => {
      const rt = String(item.reminder_time ?? '')
      const itemHHMM = rt.length >= 5 ? rt.slice(0, 5) : rt
      return itemHHMM === targetHHMM
    })

    if (matchingItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No items matching current time', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userToInstances = new Map<string, Array<{ title: string }>>()

    for (const item of matchingItems) {
      const scope = item.reminder_scope as string
      let query = adminClient
        .from('checklist_instances')
        .select('id')
        .eq('checklist_item_id', item.id)
        .is('completed_at', null)
        .eq('assigned_to_user_id', item.assigned_to_user_id)

      if (scope === 'today_only') {
        query = query.eq('scheduled_date', todayCst)
      } else if (scope === 'today_and_overdue') {
        query = query.lte('scheduled_date', todayCst)
      } else {
        continue
      }

      const { data: instances } = await query
      if (!instances || instances.length === 0) continue

      const title = (item as { title: string }).title
      const userId = item.assigned_to_user_id
      const list = userToInstances.get(userId) ?? []
      for (let i = 0; i < instances.length; i++) list.push({ title })
      userToInstances.set(userId, list)
    }

    let totalSent = 0
    webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)

    for (const [userId, instances] of userToInstances) {
      const titles = [...new Set(instances.map((i) => i.title))]
      const n = titles.length
      const body =
        n === 1
          ? `You have 1 outstanding task: ${titles[0]}`
          : n <= 3
            ? `You have ${n} outstanding tasks: ${titles.join(', ')}`
            : `You have ${n} outstanding tasks: ${titles.slice(0, 3).join(', ')} and ${n - 3} more`

      const { data: subscriptions } = await adminClient
        .from('push_subscriptions')
        .select('endpoint, p256dh_key, auth_key')
        .eq('user_id', userId)

      if (!subscriptions || subscriptions.length === 0) continue

      const pushPayload = JSON.stringify({
        title: 'Task reminder',
        body,
        url: '/checklist',
        tag: 'scheduled-reminder',
      })

      let sentForUser = 0
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
          sentForUser++
          totalSent++
        } catch (pushErr) {
          console.error('Push send error:', sub.endpoint?.substring(0, 50), pushErr)
        }
      }

      if (sentForUser > 0) {
        try {
          await adminClient.from('notification_history').insert({
            recipient_user_id: userId,
            template_type: 'scheduled_reminder',
            title: 'Task reminder',
            body_preview: body.substring(0, 200),
            channel: 'push',
            checklist_instance_id: null,
          })
        } catch {
          // best-effort
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scheduled reminders sent',
        sent: totalSent,
        users_notified: userToInstances.size,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-scheduled-reminders:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
