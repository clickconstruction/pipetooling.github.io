// notify-help-feedback: the devs' push when someone writes on a help guide, or sends a went wrong note from the
// wrench (punch list #380, v2.7679). A note that wants something or calls a page confusing lands in the inbox and pushes
// nobody: it waits for the day's read. A person's hours (punch list #141 PR 5,
// v2.6217): the push goes through _shared/pushHoursSend.ts, which holds it for a dev outside their Push me hours,
// writing the row as `held` and sending nothing; the inbox is on Help.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendPushHonouringHours } from '../_shared/pushHoursSend.ts'
import { webPushSender } from '../_shared/webPushSend.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

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
  /** Null for a note written from a page. */
  guide_slug: string | null
  /** `guide`, or the start picked in the wrench's box: `want`, `confusing`, `broken`. */
  kind: string | null
  page_key: string | null
  context: { page_label?: unknown } | null
  body: string
}

/** A note pushes at once when it is a guide's feedback or a fault. The other two wait for the day's read. */
function pushesNow(kind: string | null): boolean {
  return kind == null || kind === 'guide' || kind === 'broken'
}

/** Where a page note was written, in words: the box's own label, else the page key. */
function pageWords(row: HelpFeedbackRow): string {
  const label = row.context && typeof row.context.page_label === 'string' ? row.context.page_label.trim() : ''
  return label || row.page_key || 'a page'
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
      .select('id, from_user_id, guide_slug, kind, page_key, context, body')
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

    if (!pushesNow(feedbackRow.kind)) {
      return new Response(
        JSON.stringify({ success: true, message: 'This kind of note waits for the day\'s read; no pushes sent', push_sent: 0, recipients: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
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
    const archivedRefusal = await refuseArchivedCaller(adminClient, user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal

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

    // A guide's feedback names its guide and opens it. A went wrong note names its page and opens the inbox, where
    // the note sits with its state; it may have no words, and then the page is the news.
    const isPageNote = feedbackRow.guide_slug == null
    const words = feedbackRow.body.trim()
    let pushBody = isPageNote
      ? `${senderLabel} on ${pageWords(feedbackRow)}: ${words ? truncate(words, 160) : 'Something went wrong. No words.'}`
      : `${senderLabel} on “${feedbackRow.guide_slug}”: ${truncate(feedbackRow.body, 160)}`
    if (pushBody.length > MAX_PUSH_BODY_LEN) {
      pushBody = `${pushBody.slice(0, MAX_PUSH_BODY_LEN - 1)}…`
    }

    const pushTitle = isPageNote ? 'Tell the dev: something went wrong' : 'Help Feedback'

    const tag = `help-feedback-${feedbackRow.id}`
    const url = isPageNote ? '/dashboard' : `/help?g=${encodeURIComponent(feedbackRow.guide_slug ?? '')}`

    // Through each dev's hours (#141 PR 5): the devs on are pushed, a dev off is held with a row and no push.
    const result = await sendPushHonouringHours(
      adminClient,
      { userIds: recipientIds, title: pushTitle, body: pushBody, url, tag, templateType: 'help_feedback' },
      webPushSender(adminClient, 'notify-help-feedback'),
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Help feedback notifications processed',
        push_sent: result.devices,
        recipients: recipientIds.length,
        held: result.held.length,
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
