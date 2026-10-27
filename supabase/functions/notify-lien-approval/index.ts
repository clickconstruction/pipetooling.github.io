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
import { lienApprovalPush, lienCodeUsedPush, lienPenRecordedPush, lienWaiverCodeUsedPush } from '../_shared/lienApprovalPush.ts'

// v2.5924: the waiver push names the form; the titles mirror lienWaiverTitle (src/lib/jobsDocuments/lienWaiverRelease.ts).
const WAIVER_TITLES: Record<string, string> = {
  conditional_progress: 'Conditional Waiver and Release on Progress Payment',
  unconditional_progress: 'Unconditional Waiver and Release on Progress Payment',
  conditional_final: 'Conditional Waiver and Release on Final Payment',
  unconditional_final: 'Unconditional Waiver and Release on Final Payment',
}

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

    const { item_id, due_ymd, kind, release_id } = (await req.json().catch(() => ({}))) as { item_id?: string; due_ymd?: string; kind?: string; release_id?: string }
    const dueYmd = typeof due_ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(due_ymd) ? due_ymd : null
    // The pen train (PR 3): `kind: 'pen_recorded'` tells the leader the office wrote down his pen signature. The caller is the recorder, the leader is the signer.
    const penRecorded = kind === 'pen_recorded'
    // v2.5791: `kind: 'code_used'` tells the leader his signing code signed a notice on someone else's screen. The caller is that screen's sign-in, the leader is the signer.
    const codeUsed = kind === 'code_used'
    // v2.5924: `kind: 'waiver_code_used'` + release_id — the same sentence for a lien WAIVER signed by code in the Release of Lien window.
    const waiverCodeUsed = kind === 'waiver_code_used'
    if (waiverCodeUsed ? !release_id : !item_id) return json({ error: waiverCodeUsed ? 'Missing release_id' : 'Missing item_id' }, 400)

    const admin = createClient(supabaseUrl, serviceRoleKey)
    let item: { job_id: string; fields?: unknown; signed_by?: string | null; signed_at?: string | null }
    let waiverAmount: number | null = null
    let waiverFormType = ''
    if (waiverCodeUsed) {
      const { data: release } = await admin
        .from('job_lien_releases')
        .select('id, job_id, amount, form_type, signed_at, signer_signature_mode, signer_user_id, signed_on_device_of')
        .eq('id', release_id)
        .maybeSingle()
      if (!release || release.signer_signature_mode !== 'code' || !release.signer_user_id) return json({ error: 'Not a code signature' }, 403)
      if (release.signed_on_device_of !== user.id) return json({ error: release.signed_on_device_of ? 'Not your screen' : 'Signed on his own screen' }, release.signed_on_device_of ? 403 : 200)
      const amt = Number(release.amount)
      waiverAmount = Number.isFinite(amt) ? amt : null
      waiverFormType = String(release.form_type ?? '')
      item = { job_id: release.job_id, signed_by: release.signer_user_id, signed_at: release.signed_at }
    } else {
      const { data: noticeItem } = await admin
        .from('job_lien_desk_items')
        .select('id, job_id, status, drafted_by, fields, signed_by, signed_at, signer_signature_mode, signed_recorded_by, signed_witness_how, signed_on_device_of')
        .eq('id', item_id)
        .maybeSingle()
      if (penRecorded) {
        if (!noticeItem || noticeItem.signed_recorded_by !== user.id || noticeItem.signer_signature_mode !== 'pen') return json({ error: 'Not your record' }, 403)
      } else if (codeUsed) {
        if (!noticeItem || noticeItem.signer_signature_mode !== 'code' || !noticeItem.signed_by) return json({ error: 'Not a code signature' }, 403)
        if (noticeItem.signed_on_device_of !== user.id) return json({ error: noticeItem.signed_on_device_of ? 'Not your screen' : 'Signed on his own screen' }, noticeItem.signed_on_device_of ? 403 : 200)
      } else {
        if (!noticeItem || noticeItem.drafted_by !== user.id) return json({ error: 'Not your draft' }, 403)
        if (noticeItem.status !== 'awaiting_approval') return json({ success: true, push_sent: 0, email_sent: false, message: 'Not awaiting approval' })
      }
      item = noticeItem
    }

    const { data: job } = await admin.from('jobs_ledger').select('id, job_name, hcp_number, click_number, master_user_id, gc_customer_id').eq('id', item.job_id).maybeSingle()
    if (!job) return json({ error: 'Job not found' }, 404)

    // The leader: the job's master when he is one, else every leader on the roster. A pen record goes to its signer only.
    const leaderId = penRecorded || codeUsed || waiverCodeUsed ? (item.signed_by as string | null) : job.master_user_id
    const [{ data: master }, { data: sender }, { data: gc }] = await Promise.all([
      leaderId ? admin.from('users').select('id, name, email, role, archived_at').match(REAL_ACCOUNT).eq('id', leaderId).maybeSingle() : Promise.resolve({ data: null }),
      admin.from('users').select('name').eq('id', user.id).maybeSingle(),
      job.gc_customer_id ? admin.from('customers').select('name').eq('id', job.gc_customer_id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    let leaders: Array<{ id: string; name: string | null; email: string | null }> = []
    if (master && !master.archived_at && LEADER_ROLES.includes(String(master.role))) leaders = [master]
    else if (!penRecorded && !codeUsed && !waiverCodeUsed) {
      const { data: all } = await admin.from('users').select('id, name, email, role, archived_at').match(REAL_ACCOUNT).in('role', LEADER_ROLES).is('archived_at', null)
      leaders = (all ?? []).filter((u) => u.id !== user.id)
    }
    if (leaders.length === 0) return json({ success: true, push_sent: 0, email_sent: false, message: 'No leader to tell' })

    const number = String(job.hcp_number ?? '').trim() || String(job.click_number ?? '').trim()
    const name = String(job.job_name ?? '').trim()
    const jobLabel = [number, name].filter(Boolean).join(' · ') || 'A job'
    const draft = (item.fields ?? {}) as { notice?: { claimAmount?: unknown } }
    const claimRaw = Number(draft.notice?.claimAmount)
    const words = waiverCodeUsed
      ? lienWaiverCodeUsedPush({
          jobLabel,
          jobId: item.job_id,
          amount: waiverAmount,
          formTitle: WAIVER_TITLES[waiverFormType] ?? null,
          signedYmd: typeof item.signed_at === 'string' ? item.signed_at.slice(0, 10) : null,
          deviceName: sender?.name ?? null,
        })
      : codeUsed
      ? lienCodeUsedPush({
          jobLabel,
          jobId: item.job_id,
          claim: Number.isFinite(claimRaw) ? claimRaw : null,
          signedYmd: typeof item.signed_at === 'string' ? item.signed_at.slice(0, 10) : null,
          deviceName: sender?.name ?? null,
        })
      : penRecorded
      ? lienPenRecordedPush({
          jobLabel,
          jobId: item.job_id,
          claim: Number.isFinite(claimRaw) ? claimRaw : null,
          signedYmd: typeof item.signed_at === 'string' ? item.signed_at.slice(0, 10) : null,
          recorderName: sender?.name ?? null,
          how: (item.signed_witness_how as string | null) ?? null,
        })
      : lienApprovalPush({
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
        const html = `<p>${escapeHtml(words.emailText).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p><p><a href="${link}">${waiverCodeUsed ? 'Open the Pipeline' : 'Open the Lien desk'}</a></p>`
        const mail = await sendEmailViaResend(leader.email!.trim(), words.subject, `${words.emailText}\n\n${link}`, html, resendApiKey, { emailType: waiverCodeUsed ? 'lien_waiver_code_used' : codeUsed ? 'lien_code_used' : penRecorded ? 'lien_pen_recorded' : 'lien_approval_ask' })
        if (mail.success) {
          emailSent++
          channel = 'email'
        } else console.error('notify-lien-approval email error', mail.error)
      }
      pushSent += sentToThisOne
      if (channel) {
        await admin.from('notification_history').insert({
          recipient_user_id: leader.id,
          template_type: waiverCodeUsed ? 'lien_waiver_code_used' : codeUsed ? 'lien_code_used' : penRecorded ? 'lien_pen_recorded' : 'lien_approval_ask',
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
