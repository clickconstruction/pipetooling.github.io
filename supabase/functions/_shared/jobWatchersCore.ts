/**
 * Watchers (v2.2932): who hears when a sub reports on a job. Pure — tested
 * from src/lib/subs/jobWatchersCore.test.ts; the sender lives in jobWatchers.ts.
 *
 * Two sources fold into one list: explicit job_watchers rows, and the job's
 * assigned superintendents (team members with role superintendent), who
 * watch by default. An explicit row for an assigned super overrides the
 * defaults, so "I don't want dates" sticks.
 */

export type WatchKind = 'progress' | 'done' | 'dates'

export type WatcherRow = { user_id: string; hear_progress: boolean; hear_done: boolean; hear_dates: boolean; source?: string | null }

export type WatchRecipient = { userId: string; source: 'manual' | 'assigned'; hears: Record<WatchKind, boolean> }

export const WATCH_DEFAULTS: Record<WatchKind, boolean> = { progress: true, done: true, dates: false }

/** Every watcher with what they hear: explicit rows win, assigned supers fill in with the defaults. */
export function resolveWatchers(explicit: WatcherRow[], assignedSuperintendentIds: readonly string[]): WatchRecipient[] {
  const out = new Map<string, WatchRecipient>()
  for (const uid of assignedSuperintendentIds) {
    if (!uid) continue
    out.set(uid, { userId: uid, source: 'assigned', hears: { ...WATCH_DEFAULTS } })
  }
  for (const r of explicit) {
    if (!r.user_id) continue
    const prior = out.get(r.user_id)
    out.set(r.user_id, { userId: r.user_id, source: prior ? 'assigned' : r.source === 'assigned' ? 'assigned' : 'manual', hears: { progress: !!r.hear_progress, done: !!r.hear_done, dates: !!r.hear_dates } })
  }
  return [...out.values()].sort((a, b) => a.userId.localeCompare(b.userId))
}

/** Who gets THIS kind. */
export function recipientsFor(watchers: WatchRecipient[], kind: WatchKind): WatchRecipient[] {
  return watchers.filter((w) => w.hears[kind])
}

/** Fold rule: one email per (user, job, kind) per hour — a second report inside the hour is logged, not sent. */
export const WATCH_FOLD_MS = 60 * 60 * 1000
export function shouldFold(lastSentAtIso: string | null | undefined, nowMs: number): boolean {
  if (!lastSentAtIso) return false
  const t = Date.parse(lastSentAtIso)
  return Number.isFinite(t) && nowMs - t < WATCH_FOLD_MS
}

export type WatchNotice = { kind: WatchKind; jobLabel: string; jobAddress: string | null; subName: string; line: string; detail: string | null; appOrigin: string; jobNumber: string | null }

/** Subject + plain text + a small HTML card — one template for the three kinds. */
export function buildWatchEmail(n: WatchNotice): { subject: string; text: string; html: string } {
  const tag = n.kind === 'progress' ? 'Sub progress' : n.kind === 'done' ? 'Sub says done' : 'Sub dates'
  const subject = `${n.jobNumber ? `#${n.jobNumber} · ` : ''}${n.line}`
  const link = `${n.appOrigin.replace(/\/$/, '')}/jobs?tab=subs`
  const text = [`${tag} — ${n.jobLabel}`, n.jobAddress ?? '', '', n.line, n.detail ?? '', '', `Open Jobs → Subs: ${link}`, 'You hear about this job because you watch it. Change what you hear on the job (Jobs → Subs → Work → the bell) or in Settings → My email schedule.'].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f8fafc;"><div style="max-width:560px;margin:0 auto;padding:20px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"><div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;"><div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${n.kind === 'done' ? '#b45309' : '#0f766e'};">${esc(tag)}</div><h1 style="margin:4px 0 2px;font-size:17px;color:#0f172a;">${esc(n.line)}</h1><div style="font-size:13px;color:#64748b;">${esc(n.jobLabel)}${n.jobAddress ? ` · ${esc(n.jobAddress)}` : ''}</div>${n.detail ? `<p style="margin:10px 0 0;font-size:13.5px;color:#334155;border-left:3px solid #e2e8f0;padding-left:10px;">${esc(n.detail)}</p>` : ''}<p style="margin:14px 0 0;"><a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;padding:8px 14px;font-size:13px;font-weight:700;">Open Jobs → Subs</a></p></div><p style="font-size:11px;color:#94a3b8;margin:10px 4px;">You hear about this job because you watch it. Change what you hear on the job (the bell on Jobs → Subs → Work) or in Settings → My email schedule.</p></div></body></html>`
  return { subject, text, html }
}
