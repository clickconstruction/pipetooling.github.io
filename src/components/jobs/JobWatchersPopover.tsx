/**
 * Watch this job (v2.2932): the bell on a Subs → Work job group. Lists who
 * hears when the sub reports — assigned superintendents by default, anyone
 * the office adds — with three checkboxes (progress / done / dates), and a
 * picker to subscribe someone. Writes job_watchers; the emails go out from
 * the submit-sub-portal function as the sub reports.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { resolveWatchers, type WatchKind, type WatchRecipient } from '../../../supabase/functions/_shared/jobWatchersCore'

type UserLite = { id: string; name: string; role: string }
const KINDS: Array<{ k: WatchKind; label: string; hint: string }> = [
  { k: 'progress', label: 'progress', hint: 'a percent or a note from the portal' },
  { k: 'done', label: 'done', hint: '"my work here is done"' },
  { k: 'dates', label: 'dates', hint: 'picked or moved their days' },
]
const WATCHER_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent'])

export function JobWatchersPopover({ jobId, authUserId, compact = false }: { jobId: string; authUserId: string | undefined; compact?: boolean }) {
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Array<{ id: string; user_id: string; hear_progress: boolean; hear_done: boolean; hear_dates: boolean; source: string }>>([])
  const [supers, setSupers] = useState<string[]>([])
  const [users, setUsers] = useState<UserLite[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    const [{ data: w }, { data: team }, { data: u }] = await Promise.all([
      supabase.from('job_watchers').select('id, user_id, hear_progress, hear_done, hear_dates, source').eq('job_id', jobId),
      supabase.from('jobs_ledger_team_members').select('user_id').eq('job_id', jobId),
      supabase.from('users').select('id, name, role').is('archived_at', null).order('name').limit(500),
    ])
    const all = ((u ?? []) as UserLite[]).filter((x) => WATCHER_ROLES.has(x.role))
    setUsers(all)
    const teamIds = new Set(((team ?? []) as Array<{ user_id: string }>).map((t) => t.user_id))
    setSupers(all.filter((x) => x.role === 'superintendent' && teamIds.has(x.id)).map((x) => x.id))
    setRows((w ?? []) as typeof rows)
    setLoaded(true)
  }, [jobId])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const watchers: WatchRecipient[] = useMemo(() => resolveWatchers(rows, supers), [rows, supers])
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? 'Someone'
  const roleOf = (id: string) => (users.find((u) => u.id === id)?.role ?? '').replace('_', ' ')

  async function setHear(userId: string, kind: WatchKind, on: boolean) {
    setBusy(true)
    try {
      const existing = rows.find((r) => r.user_id === userId)
      const w = watchers.find((x) => x.userId === userId)
      const next = { hear_progress: w?.hears.progress ?? true, hear_done: w?.hears.done ?? true, hear_dates: w?.hears.dates ?? false, [`hear_${kind}`]: on }
      const { error } = existing
        ? await supabase.from('job_watchers').update(next).eq('id', existing.id)
        : await supabase.from('job_watchers').insert({ job_id: jobId, user_id: userId, ...next, source: supers.includes(userId) ? 'assigned' : 'manual', created_by: authUserId ?? null })
      if (error) throw error
      await load()
    } catch (e) {
      showToast(`Could not save: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  async function subscribe(userId: string) {
    if (!userId) return
    setBusy(true)
    try {
      const { error } = await supabase.from('job_watchers').upsert({ job_id: jobId, user_id: userId, hear_progress: true, hear_done: true, hear_dates: true, source: 'manual', created_by: authUserId ?? null }, { onConflict: 'job_id,user_id' })
      if (error) throw error
      await load()
      showToast(`${nameOf(userId)} now hears about this job`, 'success')
    } catch (e) {
      showToast(`Could not subscribe: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  async function unwatch(userId: string) {
    const existing = rows.find((r) => r.user_id === userId)
    setBusy(true)
    try {
      if (supers.includes(userId)) {
        // An assigned super can't be removed — they turn every kind off instead.
        const patch = { job_id: jobId, user_id: userId, hear_progress: false, hear_done: false, hear_dates: false, source: 'assigned', created_by: authUserId ?? null }
        const { error } = await supabase.from('job_watchers').upsert(patch, { onConflict: 'job_id,user_id' })
        if (error) throw error
      } else if (existing) {
        const { error } = await supabase.from('job_watchers').delete().eq('id', existing.id)
        if (error) throw error
      }
      await load()
    } catch (e) {
      showToast(`Could not change that: ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  const hearing = watchers.filter((w) => w.hears.progress || w.hears.done || w.hears.dates).length
  const candidates = users.filter((u) => !watchers.some((w) => w.userId === u.id))

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={loaded ? `Watch this job · ${hearing === 0 ? 'nobody yet' : `${hearing} watching`} — who hears when the sub reports` : 'Watch this job — who hears when the sub reports'}
        aria-label={loaded ? `Watch this job · ${hearing} watching` : 'Watch this job'}
        aria-expanded={open}
        data-testid="job-watchers-bell"
        style={{ background: hearing > 0 ? 'var(--bg-blue-tint)' : 'none', border: `1px solid ${hearing > 0 ? 'var(--text-blue-700)' : 'var(--border-strong)'}`, borderRadius: 999, padding: compact ? '1px 8px' : '2px 9px', fontSize: '0.72rem', fontWeight: 700, color: hearing > 0 ? 'var(--text-blue-700)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <span aria-hidden="true">🔔</span>
        {loaded && hearing > 0 ? <span>{hearing}</span> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Watch this job" style={{ position: 'absolute', zIndex: 30, top: 'calc(100% + 6px)', right: 0, minWidth: 340, maxWidth: 'min(92vw, 460px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 26px rgba(0,0,0,0.18)', padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Watch this job</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 8 }}>An email as it happens, at most one an hour per kind. Assigned superintendents hear progress and done unless you say otherwise.</div>
          {watchers.length === 0 ? <div style={{ color: 'var(--text-muted)', padding: '0.3rem 0' }}>Nobody yet — subscribe someone below.</div> : null}
          {watchers.map((w) => (
            <div key={w.userId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 10px', alignItems: 'center', padding: '0.35rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(w.userId)}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {roleOf(w.userId)} · {w.source === 'assigned' ? 'assigned to this job' : 'subscribed'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {KINDS.map(({ k, label, hint }) => (
                  <label key={k} title={hint} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={w.hears[k]} disabled={busy} onChange={(e) => void setHear(w.userId, k, e.target.checked)} />
                    {label}
                  </label>
                ))}
                <button type="button" disabled={busy} onClick={() => void unwatch(w.userId)} title={w.source === 'assigned' ? 'Turn everything off for them' : 'Remove'} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem' }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
            <select defaultValue="" disabled={busy || candidates.length === 0} onChange={(e) => { const v = e.target.value; e.target.value = ''; void subscribe(v) }} aria-label="Subscribe someone" style={{ padding: '0.3rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.78rem', background: 'var(--surface)', color: 'var(--text-900)', maxWidth: '100%' }}>
              <option value="">+ Subscribe someone…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default JobWatchersPopover
