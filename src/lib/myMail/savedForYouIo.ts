/**
 * The owner is told (v2.7068): the read behind `savedForYou.ts`. The person's own notices of the last week from
 * `notification_history`, which each person reads only their own rows of. A read that fails is no line.
 */
import { supabase } from '../supabase'
import { MAIL_SAVED_CHANNEL, MAIL_SAVED_TEMPLATE, mailSavedNeed, mailSavedShownSince, type MailSavedNeed, type MailSavedRow } from './savedForYou'

export async function loadMailSaved(userId: string, now: string): Promise<MailSavedNeed | null> {
  try {
    const { data, error } = await supabase
      .from('notification_history')
      .select('id, title, sent_at')
      .eq('recipient_user_id', userId)
      .eq('template_type', MAIL_SAVED_TEMPLATE)
      .eq('channel', MAIL_SAVED_CHANNEL)
      .gte('sent_at', mailSavedShownSince(now))
      .order('sent_at', { ascending: false })
      .limit(20)
    if (error) return null
    const rows: MailSavedRow[] = ((data ?? []) as Array<{ id: string; title: string | null; sent_at: string }>).map((r) => ({ id: r.id, title: r.title ?? '', sentAt: r.sent_at }))
    return mailSavedNeed(rows, now)
  } catch {
    return null
  }
}
