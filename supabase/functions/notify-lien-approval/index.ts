// notify-lien-approval (v2.4872): the leader's phone buzzes when the office sends a lien notice for
// his approval. Before this, Send for approval moved the item to the Awaiting approval pile and told
// nobody; he learned of it only by opening the Dashboard.
//
// The body is the item id and, optionally, the mail-by day. The function reads the item with the
// service role, refuses unless the caller is the drafter and the item is awaiting approval, and
// writes the words itself (_shared/lienApprovalPush.ts), so a caller can never push arbitrary text
// to the leader. One push per device of the job's master (else every leader); with no device
// registered the same words go by email. Logged to notification_history.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { lienApprovalPush } from '../_shared/lienApprovalPush.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const LEADER_ROLES = ['dev', 'master_technician']

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!authHeader || !token) return json({ error: 'Unauthorized' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { item_id, due_ymd } = (await req.json().catch(() => ({}))) as { item_id?: string; due_ymd?: string }
    if (!item_id) return json({ error: 'Missing item_id' }, 400)
    const dueYmd = typeof due_ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(due_ymd) ? due_ymd : null

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: item } = await admin
      .from('job_lien_desk_items')
      .select('id, job_id, status, drafted_by, fields')
      .eq('id', item_id)
      .maybeSingle()
    if (!item || item.drafted_by !== user.id) return json({ error: 'Not your draft' }, 403)
    if (item.status !== 'awaiting_approval') return json({ success: true, push_sent: 0, email_sent: false, message: 'Not awaiting approval' })

    const { data: job } = await admin.from('jobs_ledger').select('id, job_name, hcp_number, click_number, master_user_id, gc_customer_id').eq('id', item.job_id).maybeSingle()
    if (!job) return json({ error: 'Job not found' }, 404)

    // The leader: the job's master when he is one, else every leader on the roster.
    const [{ data: master }, { data: sender }, { data: gc }] = await Promise.all([
      job.master_user_id ? admin.from('users').select('id, name, email, role, archived_at').match(REAL_ACCOUNT).eq('id', job.master_user_id).maybeSingle() : Promise.resolve({ data: null }),
      admin.from('users').select('name').eq('id', user.id).maybeSingle(),
      job.gc_customer_id ? admin.from('customers').select('name').eq('id', job.gc_customer_id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    let leaders: Array<{ id: string; name: string | null; email: string | null }> = []
    if (master && !master.archived_at && LEADER_ROLES.includes(String(master.role))) leaders = [master]
    else {
      const { data: all } = await admin.from('users').select('id, name, email, role, archived_at').match(REAL_ACCOUNT).in('role', LEADER_ROLES).is('archived_at', null)
      leaders = (all ?? []).filter((u) => u.id !== user.id)
    }
    if (leaders.length === 0) return json({ success: true, push_sent: 0, email_sent: false, message: 'No leader to tell' })

    const number = String(job.hcp_number ?? '').trim() || String(job.click_number ?? '').trim()
    const name = String(job.job_name ?? '').trim()
    const jobLabel = [number, name].filter(Boolean).join(' · ') || 'A job'
    const draft = (item.fields ?? {}) as { notice?: { claimAmount?: unknown } }
    const claimRaw = Number(draft.notice?.claimAmount)
    const words = lienApprovalPush({
      jobLabel,
      jobId: item.job_id,
      claim: Number.isFinite(claimRaw) ? claimRaw : null,
      gcName: (gc?.name ?? '').trim() || null,
      dueYmd,
      todayYmd: todayYmdInAppTz(new Date()),
      senderName: sender?.name ?? null,
    })

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const canPush = Boolean(vapidPublicKey && vapidPrivateKey)
    if (canPush) webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey!, vapidPrivateKey!)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')

    let pushSent = 0
    let emailSent = 0
    const payload = JSON.stringify({ title: words.title, body: words.body, url: words.url, tag: words.tag })
    for (const leader of leaders) {
      let sentToThisOne = 0
      if (canPush) {
        const { data: subscriptions } = await admin.from('push_subscriptions').select('endpoint, p256dh_key, auth_key').eq('user_id', leader.id)
        for (const sub of subscriptions ?? []) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } }, payload, { TTL: 86400 })
            sentToThisOne++
          } catch (pushErr) {
            console.error('notify-lien-approval push error', String(sub.endpoint ?? '').substring(0, 50), pushErr)
          }
        }
      }
      let channel: 'push' | 'email' | null = sentToThisOne > 0 ? 'push' : null
      // No device registered: the same words by email, to our own leader (no sent copy — not a paper, not outside).
      if (sentToThisOne === 0 && resendApiKey && (leader.email ?? '').trim()) {
        const link = `${appOrigin}${words.url}`
        const html = `<p>${escapeHtml(words.emailText).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p><p><a href="${link}">Open the Lien desk</a></p>`
        const mail = await sendEmailViaResend(leader.email!.trim(), words.subject, `${words.emailText}\n\n${link}`, html, resendApiKey, { emailType: 'lien_approval_ask' })
        if (mail.success) {
          emailSent++
          channel = 'email'
        } else console.error('notify-lien-approval email error', mail.error)
      }
      pushSent += sentToThisOne
      if (channel) {
        await admin.from('notification_history').insert({
          recipient_user_id: leader.id,
          template_type: 'lien_approval_ask',
          title: words.title,
          body_preview: words.body.substring(0, 200),
          channel,
        })
      }
    }

    return json({ success: true, push_sent: pushSent, email_sent: emailSent > 0, leader_name: leaders.length === 1 ? leaders[0]!.name : null })
  } catch (error) {
    console.error('Error in notify-lien-approval:', error)
    return json({ error: (error as Error)?.message || 'Internal server error' }, 500)
  }
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
