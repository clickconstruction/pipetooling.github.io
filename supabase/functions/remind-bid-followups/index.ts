/**
 * remind-bid-followups (v2.4427, punch list #80): the phone reminder for a bid's call-again day.
 *
 * pg_cron calls this hourly with X-Cron-Secret. From 8 AM office time it finds every sent,
 * undecided bid whose own picked day (`bids.next_followup_on`) is here or passed and still
 * stands, and sends ONE push per bid and day to the bid's account manager (else its estimator,
 * else whoever set the day). `bid_followup_reminders` is the ledger: a row per bid and day,
 * written whether or not the person has a device, so nothing is sent twice. A day moved later
 * is a new day and reminds again. Robots' bids remind nobody.
 *
 * Kill switch: app_settings key `bid_followup_reminders_disabled_v1` = '1'.
 * Body: `{}`; `dry_run: true` reports what would be sent and writes nothing.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { formatBidLedgerNumberLabel } from '../_shared/ledgerDisplayPrefixes.ts'
import {
  BID_FOLLOWUP_REMINDER_HOUR,
  bidDueForReminder,
  bidFollowupReminderMessage,
  officeHour,
  reminderKey,
  reminderRecipientId,
  type BidFollowupReminderRow,
} from '../_shared/bidFollowupReminder.ts'

const KILL_SWITCH_KEY = 'bid_followup_reminders_disabled_v1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

type Embed = { name?: string | null } | { name?: string | null }[] | null
const embedName = (e: Embed): string | null => (Array.isArray(e) ? e[0]?.name : e?.name) ?? null

type BidRow = BidFollowupReminderRow & {
  bid_number: string | null
  project_name: string | null
  next_followup_contact_person_id: string | null
  next_followup_entry_id: string | null
  customers: Embed
  bids_gc_builders: Embed
  service_type: { ledger_bid_prefix?: string | null } | { ledger_bid_prefix?: string | null }[] | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret) return json({ error: 'CRON_SECRET not configured' }, 500)
    const body = (await req.json().catch(() => ({}))) as { cron_secret?: string; dry_run?: boolean }
    if (req.headers.get('X-Cron-Secret') !== cronSecret && body.cron_secret !== cronSecret) {
      return json({ error: 'Unauthorized - Invalid or missing cron secret' }, 401)
    }
    const dryRun = body.dry_run === true

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: kill } = await admin.from('app_settings').select('value_text').eq('key', KILL_SWITCH_KEY).maybeSingle()
    if (((kill as { value_text?: string | null } | null)?.value_text ?? '').trim() === '1') {
      return json({ ok: true, skipped: 'disabled', sent: 0 })
    }

    const now = new Date()
    // A morning reminder: the hourly ticks before 8 AM office time do nothing.
    if (officeHour(now) < BID_FOLLOWUP_REMINDER_HOUR && !dryRun) return json({ ok: true, skipped: 'before the morning', sent: 0 })
    const todayYmd = todayYmdInAppTz(now)

    const { data: bidRows, error: bidErr } = await admin
      .from('bids')
      .select(
        'id, bid_number, project_name, bid_date_sent, outcome, last_contact, adopted_into_bid_id, next_followup_on, next_followup_contact_person_id, next_followup_entry_id, account_manager_id, estimator_id, created_by, customers(name), bids_gc_builders(name), service_type:service_types(ledger_bid_prefix)',
      )
      .not('next_followup_on', 'is', null)
      .lte('next_followup_on', todayYmd)
      .is('outcome', null)
      .order('next_followup_on', { ascending: true })
      .limit(200)
    if (bidErr) return json({ error: bidErr.message }, 500)
    const bids = (bidRows ?? []) as unknown as BidRow[]
    if (bids.length === 0) return json({ ok: true, sent: 0, due: 0 })

    const bidIds = bids.map((b) => b.id)
    const [{ data: doneRows }, { data: twinRows }] = await Promise.all([
      admin.from('bid_followup_reminders').select('bid_id, due_on').in('bid_id', bidIds),
      admin.from('users').select('id').eq('is_digital_twin', true),
    ])
    const remindedDays = new Set(((doneRows ?? []) as Array<{ bid_id: string; due_on: string }>).map((r) => reminderKey(r.bid_id, r.due_on)))
    const twinUserIds = new Set(((twinRows ?? []) as Array<{ id: string }>).map((u) => u.id))

    const due = bids.filter((b) => bidDueForReminder(b, todayYmd, { remindedDays, twinUserIds }))
    if (due.length === 0) return json({ ok: true, sent: 0, due: 0 })

    const personIds = [...new Set(due.map((b) => b.next_followup_contact_person_id).filter((v): v is string => !!v))]
    const entryIds = [...new Set(due.map((b) => b.next_followup_entry_id).filter((v): v is string => !!v))]
    const [{ data: personRows }, { data: entryRows }] = await Promise.all([
      personIds.length ? admin.from('customer_contact_persons').select('id, name').in('id', personIds) : Promise.resolve({ data: [] }),
      entryIds.length ? admin.from('bids_submission_entries').select('id, created_by').in('id', entryIds) : Promise.resolve({ data: [] }),
    ])
    const personName = new Map(((personRows ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]))
    const setBy = new Map(((entryRows ?? []) as Array<{ id: string; created_by: string | null }>).map((e) => [e.id, e.created_by]))

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const canPush = Boolean(vapidPublicKey && vapidPrivateKey)
    if (canPush) webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey!, vapidPrivateKey!)

    let sent = 0
    let reminded = 0
    const preview: Array<{ bid: string; to: string | null; title: string; body: string }> = []
    for (const b of due) {
      const dueOn = b.next_followup_on as string
      const recipient = reminderRecipientId(b, b.next_followup_entry_id ? setBy.get(b.next_followup_entry_id) ?? null : null)
      const st = Array.isArray(b.service_type) ? b.service_type[0] : b.service_type
      const { title, body: text } = bidFollowupReminderMessage({
        bidLabel: formatBidLedgerNumberLabel(st?.ledger_bid_prefix ?? null, b.bid_number),
        projectName: b.project_name,
        builderName: embedName(b.customers) ?? embedName(b.bids_gc_builders),
        personName: b.next_followup_contact_person_id ? personName.get(b.next_followup_contact_person_id) ?? null : null,
        dueYmd: dueOn,
        todayYmd,
      })
      preview.push({ bid: b.id, to: recipient, title, body: text })
      if (dryRun) continue

      // The ledger row first: its unique key is what makes a second tick (or a second caller) a no-op.
      const { error: claimErr } = await admin.from('bid_followup_reminders').insert({ bid_id: b.id, due_on: dueOn, recipient_user_id: recipient, push_sent: 0 })
      if (claimErr) continue
      reminded++

      let pushSent = 0
      if (recipient && canPush) {
        const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh_key, auth_key').eq('user_id', recipient)
        const payload = JSON.stringify({ title, body: text, url: '/bids?tab=call-queue', tag: `bid-followup-${b.id}-${dueOn}` })
        for (const sub of (subs ?? []) as Array<{ endpoint: string; p256dh_key: string; auth_key: string }>) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } }, payload, { TTL: 86400 })
            pushSent++
          } catch (pushErr) {
            console.error('remind-bid-followups push error', sub.endpoint?.substring(0, 50), pushErr)
          }
        }
      }
      if (pushSent > 0 && recipient) {
        sent += pushSent
        await admin.from('bid_followup_reminders').update({ push_sent: pushSent }).eq('bid_id', b.id).eq('due_on', dueOn)
        await admin.from('notification_history').insert({
          recipient_user_id: recipient,
          template_type: 'bid_followup',
          title,
          body_preview: text.substring(0, 200),
          channel: 'push',
        })
      }
    }
    return json({ ok: true, due: due.length, reminded, sent, ...(dryRun ? { dry_run: true, preview } : {}) })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
