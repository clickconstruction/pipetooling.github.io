import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// Get current time in America/Chicago, rounded to 15-minute boundary (e.g. 9:07 -> 9:00)
function getCstTimeRounded(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CALENDAR_TZ,
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
    timeZone: APP_CALENDAR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const str = formatter.format(new Date())
  return str // "YYYY-MM-DD" for en-CA
}

// ── Weekly materialization top-up (v2.2056) ──────────────────────────────
// Mirrors src/lib/checklistMaterialize.ts (keep in sync): string-YMD math,
// noon anchor for weekday. Runs on the 03:00 CST slot (or when the request
// body passes materialize: true, for post-deploy verification) and keeps
// every active weekly item stocked MATERIALIZE_HORIZON_DAYS ahead — the
// rolling replacement for the old create-104-weeks-at-save cliff.
const MATERIALIZE_HORIZON_DAYS = 35

function ymdAddDaysStr(ymd: string, days: number): string {
  const d = new Date(ymd + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function dowOfYmdStr(ymd: string): number {
  return new Date(ymd + 'T12:00:00Z').getUTCDay()
}

// deno-lint-ignore no-explicit-any
async function topUpWeeklyInstances(adminClient: any, todayCst: string): Promise<number> {
  const horizonEnd = ymdAddDaysStr(todayCst, MATERIALIZE_HORIZON_DAYS)
  const { data: weeklyItems } = await adminClient
    .from('checklist_items')
    .select('id, start_date, repeat_days_of_week, repeat_end_date')
    .eq('repeat_type', 'day_of_week')
    .or(`repeat_end_date.is.null,repeat_end_date.gte.${todayCst}`)
  let created = 0
  for (const item of (weeklyItems ?? []) as Array<{ id: string; start_date: string; repeat_days_of_week: number[] | null; repeat_end_date: string | null }>) {
    const days = new Set<number>(item.repeat_days_of_week ?? [])
    if (days.size === 0) continue
    const from = item.start_date > todayCst ? item.start_date : todayCst
    const to = item.repeat_end_date && item.repeat_end_date < horizonEnd ? item.repeat_end_date : horizonEnd
    const wanted: string[] = []
    for (let d = from; d <= to; d = ymdAddDaysStr(d, 1)) {
      if (days.has(dowOfYmdStr(d))) wanted.push(d)
    }
    if (wanted.length === 0) continue
    const { data: existing } = await adminClient
      .from('checklist_instances')
      .select('scheduled_date')
      .eq('checklist_item_id', item.id)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
    const have = new Set(((existing ?? []) as Array<{ scheduled_date: string }>).map((r) => r.scheduled_date))
    const missing = wanted.filter((d) => !have.has(d))
    if (missing.length === 0) continue
    const { data: assignees } = await adminClient
      .from('checklist_item_assignees')
      .select('user_id')
      .eq('checklist_item_id', item.id)
    const assigneeIds = ((assignees ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
    for (const scheduledDate of missing) {
      const { data: inst } = await adminClient
        .from('checklist_instances')
        .upsert(
          { checklist_item_id: item.id, scheduled_date: scheduledDate },
          { onConflict: 'checklist_item_id,scheduled_date' },
        )
        .select('id')
        .single()
      if (inst?.id && assigneeIds.length > 0) {
        await adminClient
          .from('checklist_instance_assignees')
          .insert(assigneeIds.map((uid: string) => ({ checklist_instance_id: inst.id, user_id: uid })))
      }
      created++
    }
  }
  return created
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
    let forceMaterialize = false
    try {
      const body = await req.json().catch(() => ({}))
      bodySecret = body?.cron_secret
      forceMaterialize = body?.materialize === true
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

    // Nightly weekly top-up (v2.2056): 03:00 CST slot, or forced via body.
    let materialized: number | null = null
    if (targetTime === '03:00:00' || forceMaterialize) {
      try {
        materialized = await topUpWeeklyInstances(adminClient, todayCst)
        console.log(`materialize top-up: created ${materialized} instances`)
      } catch (e) {
        console.error('materialize top-up failed', e)
      }
    }

    const { data: items } = await adminClient
      .from('checklist_items')
      .select('id, title, reminder_time, reminder_scope')
      .not('reminder_time', 'is', null)

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No items with reminder_time', sent: 0, materialized }),
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
        JSON.stringify({ success: true, message: 'No items matching current time', sent: 0, materialized }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userToInstances = new Map<string, Array<{ title: string }>>()

    for (const item of matchingItems) {
      const scope = item.reminder_scope as string
      let query = adminClient
        .from('checklist_instances')
        .select('id, checklist_instance_assignees(user_id)')
        .eq('checklist_item_id', item.id)
        .is('completed_at', null)

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
      for (const inst of instances) {
        const assignees = (inst as { checklist_instance_assignees?: Array<{ user_id: string }> }).checklist_instance_assignees ?? []
        for (const a of assignees) {
          const list = userToInstances.get(a.user_id) ?? []
          list.push({ title })
          userToInstances.set(a.user_id, list)
        }
      }
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
