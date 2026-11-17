import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { groupEventsByInstance, stripStamp, stuckReason, stuckSaidBy, type ChecklistCardEvent } from '../../lib/checklistCardEvents'
import { getCurrentUserName } from '../../lib/getCurrentUserName'
import { SORTED_LABEL, sortedPush, stuckListLabel, stuckRowWords } from '../../lib/tasks/taskDoerActs'
import { sayTaskStuck, tellTaskGiver } from '../../lib/tasks/taskDoerActsIo'
import { taskTitlePlain } from '../../lib/tasks/taskPlace'
import { formatErrorMessage } from '../../utils/errorHandling'

/** How far back a stuck line is looked for. A task stuck longer than this is an old task, and Manage holds those. */
const STUCK_WINDOW_DAYS = 90

type StuckRow = { instanceId: string; title: string; byUserId: string | null; byName: string; reason: string; at: string }

type Props = {
  authUserId: string | null
  /** The seams a test fills. */
  load?: () => Promise<{ rows: StuckRow[]; error: string | null }>
  saySorted?: typeof sayTaskStuck
  tell?: typeof tellTaskGiver
  nameOf?: (userId: string) => Promise<string>
}

/** The open tasks whose last word from the person doing them is that something is in the way. */
async function loadStuckRows(): Promise<{ rows: StuckRow[]; error: string | null }> {
  try {
    const since = new Date(Date.now() - STUCK_WINDOW_DAYS * 86_400_000).toISOString()
    const ev = await supabase.from('checklist_instance_events').select('id, instance_id, event_type, actor_user_id, body, created_at').in('event_type', ['stuck', 'unstuck', 'completed']).gte('created_at', since).order('created_at', { ascending: true })
    if (ev.error) return { rows: [], error: formatErrorMessage(ev.error, 'The stuck tasks did not load.') }
    const grouped = groupEventsByInstance((ev.data ?? []) as unknown as ChecklistCardEvent[])
    const stuckIds = [...grouped.entries()].filter(([, events]) => stuckReason(events) !== null).map(([id]) => id)
    if (stuckIds.length === 0) return { rows: [], error: null }
    const inst = await supabase.from('checklist_instances').select('id, completed_at, checklist_items(title)').in('id', stuckIds).is('completed_at', null)
    if (inst.error) return { rows: [], error: formatErrorMessage(inst.error, 'The stuck tasks did not load.') }
    const open = (inst.data ?? []) as unknown as Array<{ id: string; checklist_items: { title: string } | null }>
    const said = open.map((i) => ({ i, by: stuckSaidBy(grouped.get(i.id) ?? []), reason: stuckReason(grouped.get(i.id) ?? []) ?? '' }))
    const ids = [...new Set(said.map((s) => s.by?.userId).filter((v): v is string => !!v))]
    const names = new Map<string, string>()
    if (ids.length > 0) {
      const u = await supabase.from('users').select('id, name').in('id', ids)
      for (const r of (u.data ?? []) as Array<{ id: string; name: string | null }>) names.set(r.id, (r.name ?? '').trim() || 'Someone')
    }
    const rows = said
      .map(({ i, by, reason }): StuckRow => ({ instanceId: i.id, title: taskTitlePlain(i.checklist_items?.title), byUserId: by?.userId ?? null, byName: by?.userId ? (names.get(by.userId) ?? 'Someone') : 'Someone', reason, at: by?.at ?? '' }))
      .sort((a, b) => a.at.localeCompare(b.at))
    return { rows, error: null }
  } catch (e) {
    return { rows: [], error: formatErrorMessage(e, 'The stuck tasks did not load.') }
  }
}

/**
 * The office's list of stuck tasks, at the top of Checklist → Review (punch list #369, step C6). A person who says
 * *Can't do it* keeps the task, so without this list a stuck task would be a place to park work. Each row says who is
 * stuck on what and why, oldest first, with one press, **Sorted**, that takes the mark off and tells that person.
 * With nothing stuck the section draws nothing: an empty list here is the good state, and Review has enough on it.
 */
export function ChecklistStuckSection({ authUserId, load = loadStuckRows, saySorted = sayTaskStuck, tell = tellTaskGiver, nameOf = getCurrentUserName }: Props) {
  const [rows, setRows] = useState<StuckRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const read = useCallback(async () => {
    const res = await load()
    setRows(res.rows)
    setError(res.error)
  }, [load])

  useEffect(() => {
    if (!authUserId) return
    void read()
  }, [authUserId, read])

  const sorted = async (row: StuckRow) => {
    if (!authUserId || busyId) return
    setBusyId(row.instanceId)
    try {
      const refused = await saySorted({ instanceId: row.instanceId, userId: authUserId, kind: 'unstuck', words: '' })
      if (refused) {
        setError(refused)
        return
      }
      if (row.byUserId && row.byUserId !== authUserId) {
        const who = await nameOf(authUserId).catch(() => 'The office')
        const push = sortedPush(who, row.title)
        void tell({ giverId: row.byUserId, instanceId: row.instanceId, title: push.title, body: push.body })
      }
      await read()
    } finally {
      setBusyId(null)
    }
  }

  if (rows.length === 0 && !error) return null

  return (
    <section data-stuck-list style={{ maxWidth: 640, margin: '0 auto 1rem' }}>
      {rows.length > 0 ? <h3 style={{ margin: '0 2px 0.4rem', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-amber-800)' }}>{stuckListLabel(rows.length)}</h3> : null}
      {error ? (
        <p role="alert" style={{ margin: '0 0 0.4rem', fontSize: 13, color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}
      {rows.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--border-amber)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)' }}>
          {rows.map((row, i) => (
            <li key={row.instanceId} data-stuck-row={row.instanceId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.3 }}>{row.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-amber-800)', marginTop: 2 }}>
                  {stuckRowWords(row.byName, row.reason)}
                  {row.at ? <span style={{ color: 'var(--text-muted)' }}> · {stripStamp(row.at)}</span> : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void sorted(row)}
                disabled={busyId !== null}
                title="Take the stuck mark off and tell them"
                style={{ flexShrink: 0, minHeight: 36, padding: '0 14px', font: 'inherit', fontSize: 13, fontWeight: 700, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: busyId !== null ? 'not-allowed' : 'pointer', opacity: busyId === row.instanceId ? 0.6 : 1 }}
              >
                {busyId === row.instanceId ? '…' : SORTED_LABEL}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
