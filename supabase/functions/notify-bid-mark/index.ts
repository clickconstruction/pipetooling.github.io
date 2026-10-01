// notify-bid-mark (v2.4297): the one phone notification for a bid marked for a teammate.
//
// Called by "Mark this bid for someone" only when the sender ticks "Also send it to <name>'s
// phone". The body is just the request id: the function reads the request with the service
// role, refuses unless the caller is its sender and it is still open, and writes the words
// itself ("Wendi marked a bid for you" / "B494 SPACEX…: Reprice the trim.") so a caller can
// never push arbitrary text to someone. One push per device, logged to notification_history.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  return n ? n.split(/\s+/)[0] : 'Someone'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!authHeader || !token) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { request_id } = (await req.json().catch(() => ({}))) as { request_id?: string }
    if (!request_id) return json({ error: 'Missing request_id' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: request } = await admin
      .from('bid_mark_requests')
      .select('id, bid_id, for_user_id, from_user_id, note, closed_at')
      .eq('id', request_id)
      .maybeSingle()
    if (!request || request.from_user_id !== user.id) return json({ error: 'Not your request' }, 403)
    if (request.closed_at) return json({ success: true, push_sent: 0, message: 'Request already closed' })

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublicKey || !vapidPrivateKey) return json({ success: true, push_sent: 0, message: 'VAPID keys not configured' })

    const [{ data: sender }, { data: bid }, { data: subscriptions }] = await Promise.all([
      admin.from('users').select('name').eq('id', user.id).maybeSingle(),
      admin.from('bids').select('bid_number, project_name').eq('id', request.bid_id).maybeSingle(),
      admin.from('push_subscriptions').select('endpoint, p256dh_key, auth_key').eq('user_id', request.for_user_id),
    ])

    const title = `${firstName(sender?.name)} marked a bid for you`
    const bidLabel = [bid?.bid_number ? `B${String(bid.bid_number).replace(/^b/i, '')}` : null, bid?.project_name ?? null].filter(Boolean).join(' ')
    const note = String(request.note ?? '').trim()
    const body = note ? `${bidLabel || 'A bid'}: ${note}` : bidLabel || 'Open Bids to see it.'
    const url = `/bids?tab=counts&bidId=${request.bid_id}`

    let pushSent = 0
    if (subscriptions && subscriptions.length > 0) {
      webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)
      const payload = JSON.stringify({ title, body, url, tag: `bid-mark-${request.id}` })
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } }, payload, { TTL: 86400 })
          pushSent++
        } catch (pushErr) {
          console.error('notify-bid-mark push error', sub.endpoint?.substring(0, 50), pushErr)
        }
      }
    }

    if (pushSent > 0) {
      await admin.from('notification_history').insert({
        recipient_user_id: request.for_user_id,
        template_type: 'bid_mark',
        title,
        body_preview: body.substring(0, 200),
        channel: 'push',
      })
    }

    return json({ success: true, push_sent: pushSent })
  } catch (error) {
    console.error('Error in notify-bid-mark:', error)
    return json({ error: (error as Error)?.message || 'Internal server error' }, 500)
  }
})
