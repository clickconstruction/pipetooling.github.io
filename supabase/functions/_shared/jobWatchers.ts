/**
 * Watchers — the sender (v2.2932). Called by submit-sub-portal after a sub's
 * percent, "done", or picked dates land. Resolves who hears (jobWatchersCore),
 * folds repeats inside the hour, emails through Resend, logs every decision to
 * job_watcher_notices. Best-effort: never throws into the caller.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from './resendSendEmail.ts'
import { buildWatchEmail, recipientsFor, resolveWatchers, shouldFold, type WatchKind, type WatcherRow } from './jobWatchersCore.ts'

export async function notifyJobWatchers(
  admin: SupabaseClient,
  args: { jobId: string; kind: WatchKind; subName: string; line: string; detail?: string | null },
): Promise<void> {
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const appOrigin = (Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com').replace(/\/$/, '')
    const [{ data: job }, { data: rows }, { data: team }] = await Promise.all([
      admin.from('jobs_ledger').select('id, hcp_number, job_name, job_address, customer_name').eq('id', args.jobId).maybeSingle(),
      admin.from('job_watchers').select('user_id, hear_progress, hear_done, hear_dates, source').eq('job_id', args.jobId),
      admin.from('jobs_ledger_team_members').select('user_id').eq('job_id', args.jobId),
    ])
    const j = job as { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null; customer_name: string | null } | null
    const teamIds = ((team ?? []) as Array<{ user_id: string }>).map((t) => t.user_id).filter(Boolean)
    let supers: string[] = []
    if (teamIds.length > 0) {
      const { data: su } = await admin.from('users').select('id').in('id', teamIds).eq('role', 'superintendent')
      supers = ((su ?? []) as Array<{ id: string }>).map((u) => u.id)
    }
    const watchers = recipientsFor(resolveWatchers((rows ?? []) as WatcherRow[], supers), args.kind)
    if (watchers.length === 0) return
    const { data: usersRaw } = await admin.from('users').select('id, email, name, archived_at').in('id', watchers.map((w) => w.userId))
    const users = new Map(((usersRaw ?? []) as Array<{ id: string; email: string | null; name: string | null; archived_at?: string | null }>).map((u) => [u.id, u]))
    const jobNumber = (j?.hcp_number ?? '').trim() || null
    const jobLabel = j ? `${jobNumber ? `#${jobNumber}` : 'Job'}${j.customer_name ? ` · ${j.customer_name}` : j.job_name ? ` · ${j.job_name}` : ''}` : 'Job'
    const email = buildWatchEmail({ kind: args.kind, jobLabel, jobAddress: (j?.job_address ?? '').trim() || null, subName: args.subName, line: args.line, detail: args.detail ?? null, appOrigin, jobNumber })
    const nowMs = Date.now()
    for (const w of watchers) {
      const u = users.get(w.userId)
      if (!u || u.archived_at || !(u.email ?? '').trim()) continue
      const { data: last } = await admin.from('job_watcher_notices').select('created_at').eq('user_id', w.userId).eq('job_id', args.jobId).eq('kind', args.kind).eq('sent', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const fold = shouldFold((last as { created_at?: string } | null)?.created_at ?? null, nowMs)
      let sent = false
      if (!fold && resendKey) {
        try {
          await sendEmailViaResend(u.email!.trim(), email.subject, email.text, email.html, resendKey)
          sent = true
        } catch (e) {
          console.error('watcher email failed', w.userId, e)
        }
      }
      await admin.from('job_watcher_notices').insert({ job_id: args.jobId, user_id: w.userId, kind: args.kind, subject: email.subject, sent })
    }
  } catch (e) {
    console.error('notifyJobWatchers failed', e)
  }
}
