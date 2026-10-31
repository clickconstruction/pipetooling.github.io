/**
 * The one web-push sender the senders hand `sendPushHonouringHours` (punch list #141 PR 5): every device of one
 * person from `push_subscriptions`, one `web-push` send each with the house's VAPID details, a day's TTL. A device the
 * push service says is gone (404, 410) is deleted, as `paid-job-email` and the bank-return notice pruned theirs; any
 * other failure is logged with the endpoint's head and the next device is tried. Deno only (`npm:web-push`).
 */
// deno-lint-ignore-file no-explicit-any
import webpush from 'npm:web-push@3.6.7'
import type { PushToPerson } from './pushHoursSend.ts'

type SubRow = { id: string; endpoint: string; p256dh_key: string; auth_key: string }

/** Whether the VAPID keys are set; without them no push can go. */
export function vapidReady(): boolean {
  return Boolean(Deno.env.get('VAPID_PUBLIC_KEY') && Deno.env.get('VAPID_PRIVATE_KEY'))
}

/**
 * The sender over the service-role client, or `null` when the VAPID keys are not set. `label` names the function in
 * the log line.
 */
export function webPushSender(admin: any, label: string): PushToPerson | null {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!vapidPublicKey || !vapidPrivateKey) return null
  webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)
  return async (userId: string, payload: string): Promise<number> => {
    const { data, error } = await admin.from('push_subscriptions').select('id, endpoint, p256dh_key, auth_key').eq('user_id', userId)
    if (error) {
      console.error(`${label} push_subscriptions read error`, error.message)
      return 0
    }
    let sent = 0
    for (const sub of (data ?? []) as SubRow[]) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } }, payload, { TTL: 86400 })
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', sub.id)
        else console.error(`${label} push error`, String(sub.endpoint ?? '').substring(0, 50), e instanceof Error ? e.message : String(e))
      }
    }
    return sent
  }
}
